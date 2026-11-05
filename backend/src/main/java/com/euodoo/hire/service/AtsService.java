package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.AtsEvaluation;
import com.euodoo.hire.model.AtsUsage;
import com.euodoo.hire.model.CandidateProfile;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.JobApplication;
import com.euodoo.hire.model.JobStatus;
import com.euodoo.hire.model.PlanType;
import com.euodoo.hire.model.RecruiterProfile;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.AtsEvaluationRepository;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.JobApplicationRepository;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.repository.RecruiterProfileRepository;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Orchestrates ATS evaluations with secure, server-side usage enforcement.
 *
 * Entitlement rules (all derived from trusted server-side data — never a
 * frontend-supplied flag):
 *  - FREE (or a paid plan without a server-verified activation): 2 self-service checks
 *  - BASIC: 10 self-service checks
 *  - PREMIUM: 20 self-service checks
 *    (see {@link AtsScoringService.AtsEntitlementPolicy})
 *  - Recruiter evaluations are a separate accounting kind and NEVER consume a
 *    candidate's allowance.
 *
 * Concurrency safety: one check is reserved with an ATOMIC conditional
 * findAndModify ({@code checksUsed < limit} → {@code $inc}) so two
 * simultaneous requests can never both consume the last available check. The
 * reservation is released when the evaluation fails, so failed attempts never
 * consume allowance. Usages live in MongoDB, so the limit survives logout,
 * login, refresh and application restarts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AtsService {

    private static final int MAX_RESUME_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_RESUME_TYPES =
            Set.of("application/pdf",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "text/plain");
    private static final int MAX_JD_CHARS = 20_000;
    private static final int SAVED_JD_CHARS = 20_000;

    private final AtsEvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final JobRepository jobRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final MongoTemplate mongoTemplate;
    private final AtsScoringService scoringService;
    private final ResumeAnalysisService resumeAnalysisService;
    private final FileStorageService fileStorageService;
    private final RecruiterActivityService recruiterActivityService;
    private final com.euodoo.hire.repository.CandidateResumeRepository candidateResumeRepository;

    // ─────────────────────────────────────────────────
    // Entitlement (server-side only)
    // ─────────────────────────────────────────────────

    /**
     * The candidate's current ATS entitlement, computed from the persisted
     * user record (plan + planActivated) and the persisted usage counter.
     */
    public Map<String, Object> entitlement(String candidateUserId) {
        User user = userRepository.findById(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", candidateUserId));
        int allowed = allowanceFor(user);
        int used = usageCount(candidateUserId);
        int remaining = Math.max(0, allowed - used);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("plan", user.getPlan() != null ? user.getPlan().name() : "FREE");
        res.put("planActivated", user.isPlanActivated());
        res.put("allottedChecks", allowed);
        res.put("usedChecks", Math.min(used, allowed));
        res.put("remainingChecks", remaining);
        res.put("exhausted", remaining <= 0);
        res.put("message", remaining > 0
                ? "You have " + remaining + " free ATS check" + (remaining == 1 ? "" : "s") + " remaining."
                : "You have used all " + allowed + " ATS checks. Upgrade your plan to continue.");
        return res;
    }

    /**
     * Effective allowance: paid plans count only after a server-verified plan
     * activation (mirrors CandidateService.hasPaidActivePlan); a paid plan
     * without activation falls back to the FREE allowance.
     */
    private int allowanceFor(User user) {
        boolean paidActive = user.isPlanActivated()
                && (user.getPlan() == PlanType.BASIC || user.getPlan() == PlanType.PREMIUM);
        return AtsScoringService.AtsEntitlementPolicy.allowanceFor(
                paidActive ? user.getPlan().name() : "FREE");
    }

    // ─────────────────────────────────────────────────
    // Candidate self-service evaluation
    // ─────────────────────────────────────────────────

    /**
     * Runs one candidate self-service ATS check.
     *
     * Input validation happens BEFORE any allowance is consumed; the atomic
     * reservation happens only after validation succeeds and is released if
     * the evaluation fails — so a failed attempt never consumes a check.
     *
     * @param file           uploaded resume file (PDF/DOCX/TXT), optional
     * @param resumeText     pasted resume text, optional (exactly one source required)
     * @param jobId          target job reference, optional
     * @param jobDescription pasted job description, optional (exactly one target required)
     * @param idempotencyKey optional client key: an identical resubmission
     *                       replays the original result without a new charge
     */
    public Map<String, Object> runSelfCheck(String candidateUserId,
                                            MultipartFile file,
                                            String resumeText,
                                            String jobId,
                                            String jobDescription,
                                            String idempotencyKey) {
        return runSelfCheck(candidateUserId, file, resumeText, jobId, jobDescription,
                idempotencyKey, false);
    }

    /**
     * Runs one candidate self-service ATS check.
     *
     * Input validation happens BEFORE any allowance is consumed; the atomic
     * reservation happens only after validation succeeds and is released if
     * the evaluation fails — so a failed attempt never consumes a check.
     *
     * @param file            uploaded resume file (PDF/DOCX/TXT), optional
     * @param resumeText      pasted resume text, optional (exactly one source required)
     * @param jobId           target job reference, optional
     * @param jobDescription  pasted job description, optional (exactly one target required)
     * @param idempotencyKey  optional client key: an identical resubmission
     *                        replays the original result without a new charge
     * @param useStoredResume evaluate the candidate's profile resume (stored
     *                        on their account) instead of a new upload
     */
    public Map<String, Object> runSelfCheck(String candidateUserId,
                                            MultipartFile file,
                                            String resumeText,
                                            String jobId,
                                            String jobDescription,
                                            String idempotencyKey,
                                            boolean useStoredResume) {
        // 1. Idempotency replay: never re-charge or re-score a repeated identical request
        String key = idempotencyKey != null ? idempotencyKey.trim() : null;
        if (key != null && !key.isEmpty()) {
            AtsEvaluation previous = evaluationRepository
                    .findByCandidateUserIdAndIdempotencyKey(candidateUserId, key)
                    .orElse(null);
            if (previous != null) {
                log.info("ATS self-check replayed via idempotency key [candidate={}]", candidateUserId);
                return toResult(previous, true);
            }
        }

        // 2. Validate the request BEFORE consuming any allowance
        User user = userRepository.findById(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", candidateUserId));
        int allowed = allowanceFor(user);
        if (usageCount(candidateUserId) >= allowed) {
            throw new BusinessException("ATS_LIMIT_REACHED",
                    "You have used all " + allowed + " ATS checks. Upgrade your plan to continue.");
        }
        JobTarget target = resolveTarget(jobId, jobDescription);
        ResumeSource source = resolveResumeSource(candidateUserId, file, resumeText, useStoredResume);

        // 3. Reserve one check atomically (fails when the limit has been reached)
        if (reserve(candidateUserId, allowed) == null) {
            throw new BusinessException("ATS_LIMIT_REACHED",
                    "You have used all " + allowed + " ATS checks. Upgrade your plan to continue.");
        }

        try {
            // 4. Extract resume text (failure releases the reservation)
            String extracted = extractResumeText(source);

            // 5. Score with the deterministic engine
            AtsScoringService.Result result =
                    scoringService.score(extracted, target.requirements);

            // 6. Persist the completed evaluation — the only successful accounting
            AtsEvaluation evaluation = AtsEvaluation.builder()
                    .kind(AtsEvaluation.KIND_CANDIDATE_SELF)
                    .candidateUserId(candidateUserId)
                    .jobId(target.jobId)
                    .jobTitle(target.jobTitle)
                    .jobDescriptionUsed(truncate(target.jobDescription, SAVED_JD_CHARS))
                    .resumeRef(source.ref)
                    .resumeId(source.storedResumeId())
                    .resumeVersion(source.storedResumeVersion())
                    .resumeFilename(source.storedFilename())
                    .score(result.score())
                    .breakdown(result.breakdown())
                    .matchedRequiredSkills(result.matchedRequiredSkills())
                    .missingRequiredSkills(result.missingRequiredSkills())
                    .matchedPreferredSkills(result.matchedPreferredSkills())
                    .missingPreferredSkills(result.missingPreferredSkills())
                    .status(AtsEvaluation.STATUS_COMPLETED)
                    .idempotencyKey(key)
                    .planApplied(user.getPlan() != null ? user.getPlan().name() : "FREE")
                    .build();
            AtsEvaluation saved;
            try {
                saved = evaluationRepository.save(evaluation);
            } catch (DuplicateKeyException e) {
                // A concurrent duplicate of the same submission: replay it and
                // give the reservation back so the candidate is not charged twice.
                release(candidateUserId);
                AtsEvaluation original = key != null
                        ? evaluationRepository.findByCandidateUserIdAndIdempotencyKey(candidateUserId, key)
                            .orElse(null)
                        : null;
                if (original != null) return toResult(original, true);
                throw new BusinessException("DUPLICATE_SUBMISSION",
                        "An identical evaluation is already being processed.");
            }

            // Candidate-attributed activity record with the real score
            recruiterActivityService.recordAtsEvaluation(candidateUserId, saved.getScore(), source.description);
            return toResult(saved, false);
        } catch (BusinessException e) {
            release(candidateUserId);
            throw e;
        } catch (RuntimeException e) {
            release(candidateUserId);
            log.error("ATS self-check failed for candidate {}: {}", candidateUserId, e.getMessage());
            throw new BusinessException("ATS_EVALUATION_FAILED",
                    "The evaluation could not be completed. No free check was consumed.");
        }
    }

    // ─────────────────────────────────────────────────
    // Recruiter evaluation
    // ─────────────────────────────────────────────────

    /**
     * Recruiter-initiated evaluation of a candidate's stored resume against one
     * of the recruiter's own jobs. Authorization uses backend session data:
     * the recruiter must be approved, must own the job, and the candidate must
     * be approved and visible to recruiters. NEVER touches the candidate's
     * allowance, and only the score/breakdown are exposed — never the resume
     * document or its text.
     */
    public Map<String, Object> runRecruiterEvaluation(String recruiterUserId,
                                                      String candidateUserId,
                                                      String jobId) {
        RecruiterProfile recruiter = recruiterProfileRepository.findByUserId(recruiterUserId)
                .orElseThrow(() -> new AccessDeniedBusinessException("No recruiter profile found for this session."));
        if (recruiter.getApprovalStatus() != com.euodoo.hire.model.ApprovalStatus.APPROVED) {
            throw new AccessDeniedBusinessException("Your recruiter account has not been approved yet.");
        }
        if (jobId == null || jobId.isBlank()) {
            throw new BusinessException("JOB_REQUIRED", "Select one of your jobs to evaluate against.");
        }
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
        if (!recruiterUserId.equals(job.getRecruiterUserId())) {
            throw new AccessDeniedBusinessException("You do not own this job.");
        }
        CandidateProfile candidate = candidateProfileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("CandidateProfile for user", candidateUserId));
        if (candidate.getProfileApprovalStatus() != com.euodoo.hire.model.ApprovalStatus.APPROVED
                || !candidate.isVisibleToRecruiters()) {
            throw new AccessDeniedBusinessException("This candidate's profile is not available for evaluation.");
        }
        if (candidate.getResumeCloudinaryPublicId() == null) {
            throw new BusinessException("RESUME_NOT_AVAILABLE",
                    "This candidate has not uploaded a resume that can be evaluated.");
        }
        com.euodoo.hire.model.CandidateResume activeResume = activeStoredResume(candidateUserId);
        try {
            byte[] stored = fileStorageService.fetchFile(
                    candidate.getResumeCloudinaryPublicId(), candidate.getResumeMimeType());
            String text = resumeAnalysisService.extractText(stored,
                    candidate.getResumeOriginalFilename(), candidate.getResumeMimeType());
            if (text == null || text.isBlank()) {
                throw new BusinessException("RESUME_NOT_READABLE",
                        "The stored resume could not be read for evaluation.");
            }

            AtsScoringService.Result result =
                    scoringService.score(text, requirementsFromJob(job));

            JobApplication app = jobApplicationRepository
                    .findFirstByRecruiterUserIdAndCandidateUserId(recruiterUserId, candidateUserId)
                    .orElse(null);
            String companyId = app != null && app.getCompanyId() != null
                    ? app.getCompanyId() : recruiter.getCompanyId();

            AtsEvaluation evaluation = AtsEvaluation.builder()
                    .kind(AtsEvaluation.KIND_RECRUITER)
                    .candidateUserId(candidateUserId)
                    .recruiterUserId(recruiterUserId)
                    .jobId(job.getId())
                    .jobTitle(job.getTitle())
                    .jobDescriptionUsed(truncate(job.getDescription(), SAVED_JD_CHARS))
                    .resumeRef("STORED:" + candidate.getResumeCloudinaryPublicId())
                    .resumeId(activeResume != null ? activeResume.getId() : null)
                    .resumeVersion(activeResume != null ? activeResume.getVersion() : null)
                    .resumeFilename(candidate.getResumeOriginalFilename())
                    .score(result.score())
                    .breakdown(result.breakdown())
                    .matchedRequiredSkills(result.matchedRequiredSkills())
                    .missingRequiredSkills(result.missingRequiredSkills())
                    .matchedPreferredSkills(result.matchedPreferredSkills())
                    .missingPreferredSkills(result.missingPreferredSkills())
                    .status(AtsEvaluation.STATUS_COMPLETED)
                    .build();
            AtsEvaluation saved = evaluationRepository.save(evaluation);

            // Activity recorded ONLY after the evaluation persisted successfully
            recruiterActivityService.recordRecruiterAtsEvaluation(recruiterUserId, candidateUserId,
                    job.getId(), app != null ? app.getId() : null, companyId, saved.getScore());

            return toResult(saved, false);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Recruiter ATS evaluation failed [recruiter={}, candidate={}, job={}]: {}",
                    recruiterUserId, candidateUserId, jobId, e.getMessage());
            throw new BusinessException("ATS_EVALUATION_FAILED",
                    "The evaluation could not be completed. Try again later.");
        }
    }

    // ─────────────────────────────────────────────────
    // History retrieval (opening a result never consumes a check)
    // ─────────────────────────────────────────────────

    public Map<String, Object> historyForCandidate(String candidateUserId, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50),
                Sort.by("createdAt").descending());
        Page<AtsEvaluation> evaluations = evaluationRepository
                .findByCandidateUserIdAndKindOrderByCreatedAtDesc(
                        candidateUserId, AtsEvaluation.KIND_CANDIDATE_SELF, pageable);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("content", evaluations.getContent().stream().map(this::toSummary).toList());
        res.put("page", evaluations.getNumber());
        res.put("size", evaluations.getSize());
        res.put("totalElements", evaluations.getTotalElements());
        return res;
    }

    /** Ownership enforced: a candidate can only open their own saved result. */
    public AtsEvaluation getEvaluationForCandidate(String candidateUserId, String evaluationId) {
        AtsEvaluation evaluation = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException("AtsEvaluation", evaluationId));
        if (!candidateUserId.equals(evaluation.getCandidateUserId())) {
            throw new AccessDeniedBusinessException("You do not own this evaluation.");
        }
        return evaluation;
    }

    /** Recruiter result retrieval for a specific candidate and/or job. */
    public Map<String, Object> evaluationsForRecruiter(String recruiterUserId, String candidateUserId,
                                                       String jobId, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50),
                Sort.by("createdAt").descending());
        Page<AtsEvaluation> evaluations;
        boolean hasCandidate = candidateUserId != null && !candidateUserId.isBlank();
        boolean hasJob = jobId != null && !jobId.isBlank();
        if (hasCandidate && hasJob) {
            evaluations = evaluationRepository
                    .findByRecruiterUserIdAndCandidateUserIdAndJobIdOrderByCreatedAtDesc(
                            recruiterUserId, candidateUserId, jobId, pageable);
        } else if (hasCandidate) {
            evaluations = evaluationRepository
                    .findByRecruiterUserIdAndCandidateUserIdOrderByCreatedAtDesc(
                            recruiterUserId, candidateUserId, pageable);
        } else {
            evaluations = evaluationRepository
                    .findByRecruiterUserIdOrderByCreatedAtDesc(recruiterUserId, pageable);
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("content", evaluations.getContent().stream().map(this::toSummary).toList());
        res.put("page", evaluations.getNumber());
        res.put("size", evaluations.getSize());
        res.put("totalElements", evaluations.getTotalElements());
        return res;
    }

    // ─────────────────────────────────────────────────
    // Input resolution & validation (pre-consumption)
    // ─────────────────────────────────────────────────

    private record JobTarget(String jobId, String jobTitle, String jobDescription,
                             AtsScoringService.JobRequirements requirements) {}

    private record ResumeSource(String ref, String description, MultipartFile file, String text,
                                String storedPublicId, String storedMime, String storedFilename,
                                String storedResumeId, Integer storedResumeVersion) {}

    private JobTarget resolveTarget(String jobId, String jobDescription) {
        boolean hasJob = jobId != null && !jobId.isBlank();
        boolean hasDescription = jobDescription != null && !jobDescription.isBlank();
        if (hasJob == hasDescription) {
            throw new BusinessException("TARGET_REQUIRED",
                    "Select a target job or provide a job description.");
        }
        if (hasJob) {
            Job job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
            // A selected job must be genuinely eligible: published and not past
            // its application deadline. This mirrors the application workflow
            // rules (JOB_NOT_ACTIVE / JOB_EXPIRED) so a candidate can never
            // evaluate against a draft, inactive, closed or expired posting by
            // crafting the request.
            if (job.getStatus() != JobStatus.ACTIVE) {
                throw new BusinessException("JOB_NOT_ACTIVE",
                        "This job is not accepting applications.");
            }
            if (job.getApplicationDeadline() != null
                    && job.getApplicationDeadline().isBefore(Instant.now())) {
                throw new BusinessException("JOB_EXPIRED",
                        "The application deadline for this job has passed.");
            }
            return new JobTarget(job.getId(), job.getTitle(), job.getDescription(), requirementsFromJob(job));
        }
        if (jobDescription.length() > MAX_JD_CHARS) {
            throw new BusinessException("JOB_DESCRIPTION_TOO_LONG",
                    "The job description must be under 20,000 characters.");
        }
        return new JobTarget(null, null, jobDescription,
                AtsScoringService.fromJobDescription(jobDescription));
    }

    /** Builds structured requirements from a real Job record. */
    public AtsScoringService.JobRequirements requirementsFromJob(Job job) {
        List<String> techStack = job.getTechStack() == null ? List.of() : job.getTechStack();
        Map<String, Boolean> requiredSeen = new LinkedHashMap<>();
        for (String s : techStack) {
            if (s != null && !s.isBlank()) requiredSeen.put(s.trim(), Boolean.TRUE);
        }
        String normalizedDescription = AtsScoringService.normalize(
                job.getDescription() == null ? "" : job.getDescription());
        List<String> preferred = new ArrayList<>();
        if (!requiredSeen.isEmpty()) {
            // Skills detected in the job description beyond the posted tech stack
            // become preferred (deterministic dictionary matching).
            String joined = normalizedDescription.replace(" ", "");
            for (String skill : AtsScoringService.dictionarySkills()) {
                if (requiredSeen.containsKey(skill)) continue;
                if (AtsScoringService.isSkillPresent(normalizedDescription, joined, skill)) preferred.add(skill);
            }
        }
        return new AtsScoringService.JobRequirements(
                job.getTitle(),
                job.getDescription(),
                new ArrayList<>(requiredSeen.keySet()),
                preferred,
                job.getMinExperienceYears(),
                job.getMaxExperienceYears(),
                AtsScoringService.detectEducationRequirement(normalizedDescription));
    }

    private ResumeSource resolveResumeSource(String candidateUserId, MultipartFile file,
                                             String resumeText, boolean useStoredResume) {
        boolean hasFile = file != null && !file.isEmpty();
        boolean hasText = resumeText != null && !resumeText.isBlank();
        if (useStoredResume) {
            int sources = (hasFile ? 1 : 0) + (hasText ? 1 : 0);
            if (sources > 0) {
                throw new BusinessException("RESUME_SOURCE_CONFLICT",
                        "Choose either your stored resume or a new upload, not both.");
            }
            // The candidate's own stored resume (server-side read; never exposed).
            // Prefer the active version; if its file has gone missing (wiped
            // storage, legacy root loss), fall back to the newest version whose
            // file still exists so ATS stays usable without breaking ownership.
            CandidateProfile profile = candidateProfileRepository.findByUserId(candidateUserId)
                    .orElseThrow(() -> new ResourceNotFoundException("CandidateProfile for user", candidateUserId));
            com.euodoo.hire.model.CandidateResume active = activeStoredResume(candidateUserId);
            com.euodoo.hire.model.CandidateResume resolved = active;
            if (resolved != null && !fileStorageService.storedFileExists(resolved.getStoredPublicId())) {
                log.warn("ATS source: active resume file is missing, trying another version [candidate={}, missingPublicId={}]",
                        candidateUserId, resolved.getStoredPublicId());
                resolved = candidateResumeRepository
                        .findByCandidateUserIdOrderByVersionDesc(candidateUserId).stream()
                        .filter(r -> r.getStoredPublicId() != null && !r.getStoredPublicId().isBlank())
                        .filter(r -> fileStorageService.storedFileExists(r.getStoredPublicId()))
                        .findFirst()
                        .orElse(null);
            }
            String publicId = resolved != null ? resolved.getStoredPublicId()
                    : (active != null ? active.getStoredPublicId()
                        : profile.getResumeCloudinaryPublicId());
            if (publicId == null) {
                throw new BusinessException("RESUME_NOT_AVAILABLE",
                        "No stored resume found. Upload a resume file instead.");
            }
            String mime = resolved != null ? resolved.getMimeType()
                    : (active != null ? active.getMimeType() : profile.getResumeMimeType());
            String filename = resolved != null ? resolved.getOriginalFilename()
                    : (active != null ? active.getOriginalFilename() : profile.getResumeOriginalFilename());
            String resumeRecordId = resolved != null ? resolved.getId()
                    : (active != null ? active.getId() : null);
            Integer resumeRecordVersion = null;
            if (resolved != null) {
                resumeRecordVersion = resolved.getVersion();
            } else if (active != null) {
                resumeRecordVersion = active.getVersion();
            }
            return new ResumeSource("STORED:" + publicId,
                    filename != null ? filename : "stored resume",
                    null, null, publicId, mime, filename,
                    resumeRecordId, resumeRecordVersion);
        }
        if (hasFile == hasText) {
            throw new BusinessException("RESUME_REQUIRED",
                    "Upload a resume file or paste your resume text.");
        }
        if (hasFile) {
            String filename = file.getOriginalFilename() == null ? "resume" : file.getOriginalFilename();
            if (file.getSize() > MAX_RESUME_BYTES) {
                throw new BusinessException("FILE_TOO_LARGE", "Resume must be smaller than 5 MB.");
            }
            String mime = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            boolean typeOk = ALLOWED_RESUME_TYPES.contains(mime)
                    || filename.toLowerCase(Locale.ROOT).matches(".*\\.(pdf|docx|txt)$");
            if (!typeOk) {
                throw new BusinessException("INVALID_FILE_TYPE", "Only PDF, DOCX, or TXT files are accepted.");
            }
            return new ResumeSource("FILE:" + filename, filename, file, null, null, null, null,
                    null, null);
        }
        if (resumeText.length() > 200_000) {
            throw new BusinessException("RESUME_TOO_LONG", "The pasted resume is too long.");
        }
        return new ResumeSource("TEXT:paste", "pasted resume text", null, resumeText, null, null,
                null, null, null);
    }

    /** The candidate's active stored resume version, if the history has one. */
    private com.euodoo.hire.model.CandidateResume activeStoredResume(String candidateUserId) {
        var active = candidateResumeRepository.findByCandidateUserIdAndActiveTrue(candidateUserId);
        return active.isEmpty() ? null : active.get(0);
    }

    private String extractResumeText(ResumeSource source) {
        try {
            if (source.file() != null) {
                String text = resumeAnalysisService.extractText(source.file().getBytes(),
                        source.file().getOriginalFilename(), source.file().getContentType());
                if (text == null || text.isBlank()) {
                    throw new BusinessException("RESUME_NOT_READABLE",
                            "The uploaded file could not be read as text (scanned/image-only PDFs are not supported).");
                }
                return text;
            }
            if (source.storedPublicId() != null) {
                byte[] stored = fileStorageService.fetchFile(source.storedPublicId(), source.storedMime());
                String text = resumeAnalysisService.extractText(stored, source.storedFilename(), source.storedMime());
                if (text == null || text.isBlank()) {
                    throw new BusinessException("RESUME_NOT_READABLE",
                            "The stored resume could not be read as text.");
                }
                return text;
            }
            return source.text();
        } catch (IOException e) {
            throw new BusinessException("RESUME_NOT_READABLE", "The resume file could not be processed.");
        }
    }

    // ─────────────────────────────────────────────────
    // Atomic usage accounting (MongoDB, no transactions)
    // ─────────────────────────────────────────────────

    private void ensureUsage(String candidateUserId) {
        mongoTemplate.upsert(
                Query.query(Criteria.where("candidateUserId").is(candidateUserId)),
                new Update().setOnInsert("candidateUserId", candidateUserId)
                        .setOnInsert("checksUsed", 0)
                        .set("updatedAt", Instant.now()),
                AtsUsage.class);
    }

    private int usageCount(String candidateUserId) {
        ensureUsage(candidateUserId);
        AtsUsage usage = mongoTemplate.findOne(
                Query.query(Criteria.where("candidateUserId").is(candidateUserId)), AtsUsage.class);
        return usage != null ? usage.getChecksUsed() : 0;
    }

    /**
     * Atomically reserves one check. Returns null when the limit is already
     * reached (or was reached by a concurrent request between validation and
     * reservation) — the caller must reject in that case.
     */
    private AtsUsage reserve(String candidateUserId, int limit) {
        ensureUsage(candidateUserId);
        return mongoTemplate.findAndModify(
                Query.query(Criteria.where("candidateUserId").is(candidateUserId)
                        .and("checksUsed").lt(limit)),
                new Update().inc("checksUsed", 1).set("updatedAt", Instant.now()),
                FindAndModifyOptions.options().returnNew(true),
                AtsUsage.class);
    }

    /** Frees a held reservation after a failed evaluation. */
    private void release(String candidateUserId) {
        try {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("candidateUserId").is(candidateUserId)
                            .and("checksUsed").gt(0)),
                    new Update().inc("checksUsed", -1).set("updatedAt", Instant.now()),
                    AtsUsage.class);
        } catch (Exception e) {
            log.error("Failed to release ATS reservation for {}: {}", candidateUserId, e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────
    // Response shaping
    // ─────────────────────────────────────────────────

    private Map<String, Object> toSummary(AtsEvaluation e) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", e.getId());
        row.put("kind", e.getKind());
        row.put("jobId", e.getJobId());
        row.put("jobTitle", e.getJobTitle());
        row.put("score", e.getScore());
        row.put("matchedRequiredSkills", e.getMatchedRequiredSkills());
        row.put("missingRequiredSkills", e.getMissingRequiredSkills());
        row.put("createdAt", e.getCreatedAt());
        row.put("resumeRef", e.getResumeRef());
        row.put("resumeId", e.getResumeId());
        row.put("resumeVersion", e.getResumeVersion());
        row.put("resumeFilename", e.getResumeFilename());
        return row;
    }

    private Map<String, Object> toResult(AtsEvaluation e, boolean replayed) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", e.getId());
        res.put("score", e.getScore());
        res.put("breakdown", e.getBreakdown());
        res.put("matchedRequiredSkills", e.getMatchedRequiredSkills());
        res.put("missingRequiredSkills", e.getMissingRequiredSkills());
        res.put("matchedPreferredSkills", e.getMatchedPreferredSkills());
        res.put("missingPreferredSkills", e.getMissingPreferredSkills());
        res.put("jobId", e.getJobId());
        res.put("jobTitle", e.getJobTitle());
        res.put("resumeRef", e.getResumeRef());
        res.put("resumeId", e.getResumeId());
        res.put("resumeVersion", e.getResumeVersion());
        res.put("resumeFilename", e.getResumeFilename());
        res.put("createdAt", e.getCreatedAt());
        res.put("replayed", replayed);
        res.put("summary", summarize(e.getScore()));
        return res;
    }

    private String summarize(int score) {
        if (score >= 85) {
            return "Strong match — your resume closely aligns with the job requirements; address the missing skills below to strengthen it further.";
        }
        if (score >= 70) {
            return "Good match. Closing the gaps in the listed missing skills would improve your compatibility.";
        }
        if (score >= 50) {
            return "Partial match. Focus on adding the missing required skills and relevant experience to raise your score.";
        }
        return "Low match for this job. Compare the required skills below with your resume and tailor it accordingly.";
    }

    private String truncate(String text, int max) {
        if (text == null) return null;
        return text.length() > max ? text.substring(0, max) : text;
    }
}
