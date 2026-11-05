package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class CandidateService {

    private final UserRepository userRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final JobRepository jobRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final NotificationRepository notificationRepository;
    private final ResumeApprovalRequestRepository resumeApprovalRequestRepository;
    private final FileStorageService fileStorageService;
    private final ResumeManagementService resumeManagementService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final PasswordEncoder passwordEncoder;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CompanyRepository companyRepository;

    public User getUserById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User with email", email));
    }

    public CandidateProfile getProfileByUserId(String userId) {
        return candidateProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("CandidateProfile for user", userId));
    }

    public CandidateProfile getOrCreateProfileByUserId(String userId) {
        return candidateProfileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    CandidateProfile profile = CandidateProfile.builder()
                            .userId(userId)
                            .profileApprovalStatus(ApprovalStatus.APPROVED)
                            .visibleToRecruiters(true)
                            .build();
                    return candidateProfileRepository.save(profile);
                });
    }

    public CandidateProfile updateProfile(String userId, Map<String, Object> allowedFields) {
        assertPaidPlan(userId);

        CandidateProfile profile = getOrCreateProfileByUserId(userId);

        if (allowedFields.containsKey("name") || allowedFields.containsKey("fullName")) {
            String newName = (String) (allowedFields.containsKey("fullName") ? allowedFields.get("fullName") : allowedFields.get("name"));
            if (newName != null && !newName.isBlank()) {
                userRepository.findById(userId).ifPresent(u -> {
                    u.setName(newName.trim());
                    userRepository.save(u);
                });
            }
        }

        if (allowedFields.containsKey("phone")) {
            profile.setPhone((String) allowedFields.get("phone"));
        }
        if (allowedFields.containsKey("location")) {
            profile.setLocation((String) allowedFields.get("location"));
        }
        if (allowedFields.containsKey("headline")) {
            profile.setHeadline((String) allowedFields.get("headline"));
        }
        if (allowedFields.containsKey("bio")) {
            profile.setBio((String) allowedFields.get("bio"));
        }
        if (allowedFields.containsKey("currentDesignation")) {
            profile.setCurrentDesignation((String) allowedFields.get("currentDesignation"));
        }
        if (allowedFields.containsKey("currentCompany")) {
            profile.setCurrentCompany((String) allowedFields.get("currentCompany"));
        }
        if (allowedFields.containsKey("totalExperienceYears")) {
            profile.setTotalExperienceYears((Integer) allowedFields.get("totalExperienceYears"));
        }
        if (allowedFields.containsKey("noticePeriodDays")) {
            profile.setNoticePeriodDays((Integer) allowedFields.get("noticePeriodDays"));
        }
        if (allowedFields.containsKey("expectedAnnualSalaryInr")) {
            profile.setExpectedAnnualSalaryInr(
                    ((Number) allowedFields.get("expectedAnnualSalaryInr")).longValue());
        }
        if (allowedFields.containsKey("skills")) {
            @SuppressWarnings("unchecked")
            List<String> skills = (List<String>) allowedFields.get("skills");
            profile.setSkills(skills);
        }
        if (allowedFields.containsKey("visibleToRecruiters")) {
            profile.setVisibleToRecruiters((Boolean) allowedFields.get("visibleToRecruiters"));
        }

        return candidateProfileRepository.save(profile);
    }

    public CandidateProfile uploadResume(String userId, MultipartFile file) {
        // Versioned storage lives in ResumeManagementService: the upload creates
        // a new version, archives the previous one (never deletes it) and keeps
        // the profile's active-resume mirror in sync.
        resumeManagementService.uploadResume(userId, file, false);
        return getProfileByUserId(userId);
    }

    /**
     * Returns the latest ResumeApprovalRequest for the given candidate.
     * Candidates can use this to check whether their uploaded resume has been approved.
     */
    public ResumeApprovalRequest getResumeApprovalStatus(String userId) {
        return resumeApprovalRequestRepository
                .findTopByCandidateUserIdOrderByCreatedAtDesc(userId)
                .orElseThrow(() -> new ResourceNotFoundException("ResumeApprovalRequest for user", userId));
    }

    public String getResumeSecureUrl(String requestingUserId, String targetUserId) {
        // Owner can always download their own resume
        if (!requestingUserId.equals(targetUserId)) {
            throw new AccessDeniedBusinessException("You are not authorized to download this resume.");
        }
        CandidateProfile profile = getProfileByUserId(targetUserId);
        if (profile.getResumeCloudinaryPublicId() == null) {
            throw new ResourceNotFoundException("No resume uploaded for this candidate.");
        }
        return fileStorageService.getSecureUrl(profile.getResumeCloudinaryPublicId(), profile.getResumeMimeType());
    }    public CandidateProfile uploadProfilePicture(String userId, MultipartFile file) {
        assertPaidPlan(userId);
        fileStorageService.validateProfilePicture(file);

        CandidateProfile profile = getProfileByUserId(userId);
        if (profile.getProfilePictureCloudinaryPublicId() != null) {
            fileStorageService.deleteFile(profile.getProfilePictureCloudinaryPublicId());
        }

        FileStorageService.UploadResult result = fileStorageService.uploadProfilePicture(userId, file);
        profile.setProfilePictureCloudinaryPublicId(result.publicId());
        profile.setProfilePictureUrl(result.secureUrl());
        profile.setProfilePictureUploadedAt(Instant.now());

        return candidateProfileRepository.save(profile);
    }

    public Page<Job> searchJobs(String userId, String keyword, String location,
                                 WorkMode workMode, int page, int size) {
        // Both paid and unpaid candidates are allowed to search and view published jobs.
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        if (keyword != null && !keyword.isBlank()) {
            return jobRepository.searchByKeyword(JobStatus.ACTIVE, keyword.trim(), pageable);
        }
        if (location != null && workMode != null) {
            return jobRepository.findByStatusAndLocationAndWorkMode(
                    JobStatus.ACTIVE, location, workMode, pageable);
        }
        if (location != null) {
            return jobRepository.findByStatusAndLocation(JobStatus.ACTIVE, location, pageable);
        }
        if (workMode != null) {
            return jobRepository.findByStatusAndWorkMode(JobStatus.ACTIVE, workMode, pageable);
        }
        return jobRepository.findByStatus(JobStatus.ACTIVE, pageable);
    }

    public boolean hasAppliedForJob(String candidateUserId, String jobId) {
        return jobApplicationRepository.existsByCandidateUserIdAndJobId(candidateUserId, jobId);
    }

    /**
     * Resolves the real company display names for a batch of jobs from the
     * companies collection. Returned map keys are companyId values; a missing
     * entry means no company link exists — callers must NOT invent a name.
     */
    public Map<String, String> companyNamesFor(List<Job> jobs) {
        Set<String> companyIds = new LinkedHashSet<>();
        for (Job job : jobs) {
            if (job.getCompanyId() != null && !job.getCompanyId().isBlank()) companyIds.add(job.getCompanyId());
        }
        Map<String, String> names = new HashMap<>();
        if (!companyIds.isEmpty()) {
            for (Company c : companyRepository.findAllById(companyIds)) {
                names.put(c.getId(), c.getName());
            }
        }
        return names;
    }

    public JobApplication getApplication(String candidateUserId, String applicationId) {
        return getApplicationOwnedBy(applicationId, candidateUserId);
    }

    public JobApplication expressInterest(String candidateUserId, String jobId) {
        return expressInterest(candidateUserId, jobId, null);
    }

    public JobApplication expressInterest(String candidateUserId, String jobId, String coverNote) {
        assertPaidPlan(candidateUserId);

        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
        if (job.getStatus() != JobStatus.ACTIVE) {
            throw new BusinessException("JOB_NOT_ACTIVE", "This job is not accepting applications.");
        }

        if (job.getApplicationDeadline() != null && job.getApplicationDeadline().isBefore(Instant.now())) {
            throw new BusinessException("JOB_EXPIRED", "The application deadline for this job has passed.");
        }

        // The (candidateUserId, jobId) collection carries a unique compound index, so
        // only ONE application document may exist per candidate + job. A WITHDRAWN
        // record is re-activated in place; any other existing record is a duplicate.
        JobApplication application;
        Optional<JobApplication> existing = jobApplicationRepository
                .findByCandidateUserIdAndJobId(candidateUserId, jobId);
        if (existing.isPresent()) {
            JobApplication previous = existing.get();
            if (previous.getStatus() != ApplicationStatus.WITHDRAWN) {
                throw new BusinessException("DUPLICATE_APPLICATION",
                        "You have already applied for this job.");
            }
            application = previous;
        } else if (jobApplicationRepository.existsByCandidateUserIdAndJobId(candidateUserId, jobId)) {
            throw new BusinessException("DUPLICATE_APPLICATION",
                    "You have already applied for this job.");
        } else {
            application = JobApplication.builder()
                    .candidateUserId(candidateUserId)
                    .jobId(jobId)
                    .companyId(job.getCompanyId())
                    .recruiterUserId(job.getRecruiterUserId())
                    .build();
        }

        CandidateProfile profile = candidateProfileRepository.findByUserId(candidateUserId).orElse(null);
        String resumePublicId = profile != null ? profile.getResumeCloudinaryPublicId() : null;
        String resumeFilename = profile != null ? profile.getResumeOriginalFilename() : null;
        // Legacy profiles may miss the mirrored resume fields even though an active
        // resume version exists; fall back to the candidate's real primary version.
        if (resumePublicId == null || resumePublicId.isBlank()) {
            CandidateResume activeResume = resumeManagementService.getActiveResume(candidateUserId);
            if (activeResume != null) {
                resumePublicId = activeResume.getStoredPublicId();
                resumeFilename = activeResume.getOriginalFilename();
            }
        }

        application.setCandidateUserId(candidateUserId);
        application.setJobId(jobId);
        application.setCompanyId(job.getCompanyId());
        application.setRecruiterUserId(job.getRecruiterUserId());
        application.setCoverNote(coverNote);
        application.setSubmittedResumePublicId(resumePublicId);
        application.setSubmittedResumeFilename(resumeFilename);
        application.setStatus(ApplicationStatus.INTERESTED);
        application.setInterestedAt(Instant.now());
        application.setWithdrawnAt(null);
        application.setWithdrawalReason(null);
        application.getStatusHistory().add(
                JobApplication.StatusHistoryEntry.builder()
                        .status(ApplicationStatus.INTERESTED)
                        .changedAt(Instant.now())
                        .changedByUserId(candidateUserId)
                        .note("Application submitted by candidate")
                        .build()
        );

        JobApplication saved = jobApplicationRepository.save(application);

        String jobTitle = (job.getTitle() != null && !job.getTitle().isBlank())
                ? job.getTitle() : "the position";

        // Notify recruiter
        if (job.getRecruiterUserId() != null) {
            notificationService.notify(job.getRecruiterUserId(), "New Candidate Application",
                    "A candidate has applied for your job: " + jobTitle,
                    "JOB_APPLICATION", saved.getId(), "JobApplication", "/recruiter");
        }

        // Notify candidate of successful submission
        notificationService.notify(candidateUserId, "Application Submitted",
                "Your application for " + jobTitle + " has been submitted successfully.",
                "JOB_APPLICATION_SUBMITTED", saved.getId(), "JobApplication", "/paid-dashboard");

        // Log audit trail
        Map<String, String> auditMeta = new HashMap<>();
        auditMeta.put("jobId", jobId);
        auditMeta.put("jobTitle", jobTitle);
        auditService.log(candidateUserId, "CANDIDATE", "JobApplication", saved.getId(), "JOB_APPLIED", auditMeta);

        return saved;
    }

    public Page<JobApplication> getMyApplications(String candidateUserId, int page, int size) {
        assertPaidPlan(candidateUserId);
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return jobApplicationRepository.findByCandidateUserId(candidateUserId, pageable);
    }

    // ─── Recruiter Shortlists & Interviews (paid dashboard section) ─────

    /**
     * The authenticated candidate's genuine shortlist / pipeline records,
     * enriched with the real job, company and recruiter they reference.
     *
     * Only applications whose persisted status proves the recruiter actually
     * moved the candidate forward are included: SHORTLISTED, HIRE_REQUESTED,
     * RELEASED and HIRED. INTERESTED/VIEWED are not shortlists; WITHDRAWN and
     * REJECTED are no longer active pipeline records (the historical
     * documents stay in MongoDB and in the applications list).
     *
     * Optional fields stay null when they were not captured — the dashboard
     * renders a neutral placeholder instead of invented data. The platform
     * has no separate interview-scheduling model, so interview stages are
     * never fabricated here; the client derives its categories from these
     * real statuses only.
     */
    public Map<String, Object> getMyShortlists(String candidateUserId, int page, int size) {
        assertPaidPlan(candidateUserId);
        List<ApplicationStatus> pipelineStatuses = List.of(
                ApplicationStatus.SHORTLISTED,
                ApplicationStatus.HIRE_REQUESTED,
                ApplicationStatus.RELEASED,
                ApplicationStatus.HIRED);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50),
                Sort.by(Sort.Direction.DESC, "shortlistedAt"));
        Page<JobApplication> apps = jobApplicationRepository
                .findByCandidateUserIdAndStatusIn(candidateUserId, pipelineStatuses, pageable);

        Set<String> jobIds = new LinkedHashSet<>();
        Set<String> recruiterIds = new LinkedHashSet<>();
        Set<String> applicationCompanyIds = new LinkedHashSet<>();
        for (JobApplication app : apps.getContent()) {
            if (app.getJobId() != null && !app.getJobId().isBlank()) jobIds.add(app.getJobId());
            if (app.getRecruiterUserId() != null && !app.getRecruiterUserId().isBlank()) {
                recruiterIds.add(app.getRecruiterUserId());
            }
            if (app.getCompanyId() != null && !app.getCompanyId().isBlank()) {
                applicationCompanyIds.add(app.getCompanyId());
            }
        }

        Map<String, Job> jobs = new LinkedHashMap<>();
        for (Job job : jobIds.isEmpty() ? List.<Job>of() : jobRepository.findAllById(jobIds)) {
            jobs.put(job.getId(), job);
            if (job.getCompanyId() != null && !job.getCompanyId().isBlank()) {
                applicationCompanyIds.add(job.getCompanyId());
            }
        }
        Map<String, User> recruiters = new LinkedHashMap<>();
        for (User rec : recruiterIds.isEmpty() ? List.<User>of() : userRepository.findAllById(recruiterIds)) {
            recruiters.put(rec.getId(), rec);
        }
        Map<String, RecruiterProfile> recruiterProfiles = new LinkedHashMap<>();
        for (RecruiterProfile p : recruiterIds.isEmpty()
                ? List.<RecruiterProfile>of() : recruiterProfileRepository.findByUserIdIn(recruiterIds)) {
            recruiterProfiles.put(p.getUserId(), p);
        }
        Map<String, String> companyNameById = new HashMap<>();
        for (Company c : applicationCompanyIds.isEmpty() ? List.<Company>of() : companyRepository.findAllById(applicationCompanyIds)) {
            companyNameById.put(c.getId(), c.getName());
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (JobApplication app : apps.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", app.getId());
            row.put("jobId", app.getJobId());
            row.put("status", app.getStatus() != null ? app.getStatus().name() : null);

            row.put("shortlistedAt", app.getShortlistedAt());
            row.put("hireRequestedAt", app.getHireRequestedAt());
            row.put("releasedAt", app.getReleasedAt());
            row.put("hiredAt", app.getHiredAt());
            // Genuine recruiter-only note; null when never provided.
            row.put("recruiterNote", app.getRecruiterNote());
            row.put("atsScore", app.getAtsScore());

            Job job = app.getJobId() != null ? jobs.get(app.getJobId()) : null;
            if (job != null) {
                row.put("jobTitle", job.getTitle());
                row.put("jobLocation", job.getLocation());
                row.put("jobCity", job.getCity());
                row.put("workMode", job.getWorkMode() != null ? job.getWorkMode().name() : null);
                row.put("minSalaryInr", job.getMinSalaryInr());
                row.put("maxSalaryInr", job.getMaxSalaryInr());
                row.put("salaryCurrency", job.getSalaryCurrency());
            } else {
                row.put("jobTitle", null);
                row.put("jobLocation", null);
                row.put("jobCity", null);
                row.put("workMode", null);
                row.put("minSalaryInr", null);
                row.put("maxSalaryInr", null);
                row.put("salaryCurrency", null);
            }

            // Application level company first (a genuine reference), else the
            // company that owns the job.
            String directCompanyName = app.getCompanyId() != null
                    ? companyNameById.get(app.getCompanyId()) : null;
            String jobCompanyName = job != null && job.getCompanyId() != null
                    ? companyNameById.get(job.getCompanyId()) : null;
            String companyName = directCompanyName != null
                    ? directCompanyName : (job != null ? jobCompanyName : directCompanyName);
            String companyId = app.getCompanyId() != null
                    ? app.getCompanyId() : (job != null ? job.getCompanyId() : null);
            row.put("companyId", companyId);
            row.put("companyName", companyName);

            User recUser = app.getRecruiterUserId() != null ? recruiters.get(app.getRecruiterUserId()) : null;
            RecruiterProfile recProfile = app.getRecruiterUserId() != null
                    ? recruiterProfiles.get(app.getRecruiterUserId()) : null;
            Map<String, Object> recruiter = new LinkedHashMap<>();
            recruiter.put("userId", app.getRecruiterUserId());
            recruiter.put("name", recUser != null ? recUser.getName() : null);
            recruiter.put("initials", recUser != null ? initialsOf(recUser.getName()) : null);
            recruiter.put("designation", recProfile != null ? recProfile.getDesignation() : null);
            String recCompanyName = recProfile != null
                    && recProfile.getCompanyId() != null && !recProfile.getCompanyId().isBlank()
                    ? companyNameById.get(recProfile.getCompanyId())
                    : null;
            recruiter.put("companyName", recCompanyName);
            row.put("recruiter", recruiter);

            rows.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", rows);
        result.put("page", apps.getNumber());
        result.put("size", apps.getSize());
        result.put("totalElements", apps.getTotalElements());
        Map<String, Object> statusCounts = new LinkedHashMap<>();
        for (ApplicationStatus s : pipelineStatuses) {
            statusCounts.put(s.name(),
                    jobApplicationRepository.countByCandidateUserIdAndStatus(candidateUserId, s));
        }
        result.put("statusCounts", statusCounts);
        return result;
    }

    private String initialsOf(String name) {
        if (name == null || name.isBlank()) return null;
        String[] parts = name.trim().split("\\s+");
        return parts.length > 1
                ? ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
                : ("" + parts[0].charAt(0)).toUpperCase();
    }

    // ─── ATSTarget Job dropdown (real eligible openings only) ───────────

    /**
     * Job openings genuinely eligible as ATS evaluation targets: published
     * (ACTIVE) and, when an application deadline exists, not past it — the
     * same expiration rule the application workflow enforces (JOB_EXPIRED).
     * Draft, inactive, closed and expired jobs are therefore excluded, and
     * nothing is generated here: every row comes from the jobs collection,
     * with the real company name resolved from MongoDB.
     */
    public List<Map<String, Object>> listEligibleAtsJobs(int max) {
        int limit = Math.min(Math.max(max, 1), 500);
        List<Job> jobs = new ArrayList<>();
        Instant now = Instant.now();
        int pageIndex = 0;
        while (jobs.size() < limit) {
            Page<Job> result = jobRepository.findByStatus(JobStatus.ACTIVE,
                    PageRequest.of(pageIndex++, 100, Sort.by(Sort.Direction.DESC, "createdAt")));
            for (Job job : result.getContent()) {
                Instant deadline = job.getApplicationDeadline();
                if (deadline != null && deadline.isBefore(now)) continue;
                jobs.add(job);
                if (jobs.size() >= limit) break;
            }
            if (!result.hasNext()) break;
        }

        Set<String> companyIds = new LinkedHashSet<>();
        for (Job job : jobs) {
            if (job.getCompanyId() != null && !job.getCompanyId().isBlank()) companyIds.add(job.getCompanyId());
        }
        Map<String, String> companyNameById = new HashMap<>();
        if (!companyIds.isEmpty()) {
            for (Company c : companyRepository.findAllById(companyIds)) {
                companyNameById.put(c.getId(), c.getName());
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Job job : jobs) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", job.getId());
            row.put("title", job.getTitle());
            row.put("company", job.getCompanyId() != null
                    ? companyNameById.get(job.getCompanyId()) : null);
            row.put("location", job.getLocation());
            row.put("city", job.getCity());
            row.put("workMode", job.getWorkMode() != null ? job.getWorkMode().name() : null);
            row.put("applicationDeadline", job.getApplicationDeadline());
            rows.add(row);
        }
        return rows;
    }

    public JobApplication withdrawApplication(String candidateUserId, String applicationId,
                                               String reason) {
        assertPaidPlan(candidateUserId);
        JobApplication app = getApplicationOwnedBy(applicationId, candidateUserId);

        if (app.getStatus() == ApplicationStatus.WITHDRAWN) {
            throw new BusinessException("ALREADY_WITHDRAWN", "Application is already withdrawn.");
        }
        if (app.getStatus() == ApplicationStatus.HIRED) {
            throw new BusinessException("INVALID_TRANSITION", "Cannot withdraw after being hired.");
        }

        app.setStatus(ApplicationStatus.WITHDRAWN);
        app.setWithdrawnAt(Instant.now());
        app.setWithdrawalReason(reason);
        app.getStatusHistory().add(
                JobApplication.StatusHistoryEntry.builder()
                        .status(ApplicationStatus.WITHDRAWN)
                        .changedAt(Instant.now())
                        .changedByUserId(candidateUserId)
                        .note(reason)
                        .build()
        );
        return jobApplicationRepository.save(app);
    }

    public Page<Notification> getNotifications(String userId, boolean unreadOnly, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        if (unreadOnly) {
            return notificationRepository.findByRecipientUserIdAndRead(userId, false, pageable);
        }
        return notificationRepository.findByRecipientUserId(userId, pageable);
    }

    public long countUnreadNotifications(String userId) {
        return notificationRepository.countByRecipientUserIdAndRead(userId, false);
    }

    public void requestAccountDeletion(String userId, String confirmationPassword) {
        User user = getUserById(userId);
        log.info("Account deletion requested for userId={}", userId);

        // Security check: Must re-authenticate with the account password
        if (confirmationPassword == null || !passwordEncoder.matches(confirmationPassword, user.getPasswordHash())) {
            log.warn("Account deletion rejected for userId={}: incorrect or missing password", userId);
            throw new AccessDeniedBusinessException("Incorrect or missing confirmation password. Account deletion aborted.");
        }

        CandidateProfile profile = candidateProfileRepository.findByUserId(userId).orElse(null);
        if (profile != null) {
            // Delete stored files from Cloudinary
            if (profile.getResumeCloudinaryPublicId() != null) {
                try {
                    fileStorageService.deleteFile(profile.getResumeCloudinaryPublicId());
                } catch (Exception e) {
                    log.warn("Failed to delete resume from storage during account deletion: {}", e.getMessage());
                }
            }
            // Delete every stored resume version (files + metadata)
            try {
                resumeManagementService.deleteAllVersions(userId);
            } catch (Exception e) {
                log.warn("Failed to delete resume versions during account deletion: {}", e.getMessage());
            }
            if (profile.getProfilePictureCloudinaryPublicId() != null) {
                try {
                    fileStorageService.deleteFile(profile.getProfilePictureCloudinaryPublicId());
                } catch (Exception e) {
                    log.warn("Failed to delete profile picture during account deletion: {}", e.getMessage());
                }
            }
            candidateProfileRepository.delete(profile);
        }

        // FIX D1: Cancel open job applications (INTERESTED, VIEWED, SHORTLISTED only).
        // Applications in HIRE_REQUESTED or beyond have financial implications and must be retained.
        // Use the status-filtered query to avoid loading all applications unnecessarily.
        List<ApplicationStatus> cancellableStatuses = List.of(
                ApplicationStatus.INTERESTED, ApplicationStatus.VIEWED, ApplicationStatus.SHORTLISTED);
        jobApplicationRepository
                .findByCandidateUserIdAndStatusIn(userId, cancellableStatuses)
                .forEach(app -> {
                    app.setStatus(ApplicationStatus.WITHDRAWN);
                    app.setWithdrawalReason("Account deleted by user");
                    jobApplicationRepository.save(app);
                    log.info("Cancelled open application [id={}] during account deletion", app.getId());
                });

        // FIX D1: Delete personal notifications (not financial/audit records)
        notificationRepository.deleteByRecipientUserId(userId);

        // Payments, Invoices, HiringRequests, and AuditLogs are intentionally RETAINED:
        //   - Financial records are required for accounting and legal compliance.
        //   - Audit records must not be deleted to preserve the audit trail.
        //   - HiringRequests in progress must be preserved for the recruiter workflow.

        auditService.log(userId, "CANDIDATE", "User", userId, "ACCOUNT_DELETED", null);
        userRepository.delete(user);
        log.info("Account deleted: userId={}", userId);
    }

    public boolean hasPaidActivePlan(String userId) {
        User user = getUserById(userId);
        return user.isPlanActivated()
                && (user.getPlan() == PlanType.BASIC || user.getPlan() == PlanType.PREMIUM);
    }

    public void assertPaidPlan(String userId) {
        if (!hasPaidActivePlan(userId)) {
            throw new AccessDeniedBusinessException(
                    "This feature requires an active BASIC or PREMIUM subscription.");
        }
    }

    private JobApplication getApplicationOwnedBy(String applicationId, String candidateUserId) {
        JobApplication app = jobApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("JobApplication", applicationId));
        if (!app.getCandidateUserId().equals(candidateUserId)) {
            throw new AccessDeniedBusinessException("You do not own this application.");
        }
        return app;
    }
}
