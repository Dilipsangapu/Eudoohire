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
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;


@Service
@RequiredArgsConstructor
@Slf4j
public class RecruiterService {

    /**
     * Default hiring fee percentage.
     * IMPORTANT: This value (11%) is a placeholder within the 10–12% range.
     * The final value MUST be confirmed by business policy before production launch.
     * Ideally, load this from application configuration or admin-configurable settings.
     */
    private static final BigDecimal DEFAULT_HIRING_FEE_PERCENTAGE = new BigDecimal("11.00");

    private final UserRepository userRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final HiringRequestRepository hiringRequestRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final RecruiterActivityService recruiterActivityService;
    private final FileStorageService fileStorageService;

    public RecruiterProfile getProfile(String recruiterUserId) {
        return recruiterProfileRepository.findByUserId(recruiterUserId)
                .orElseThrow(() -> new ResourceNotFoundException("RecruiterProfile for user", recruiterUserId));
    }

    public RecruiterProfile getProfileByEmail(String email) {
        String normalizedEmail = email.trim().toLowerCase();
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User with email", email));
        return getProfile(user.getId());
    }

    public String resolveUserIdByEmail(String email) {
        String normalizedEmail = email.trim().toLowerCase();
        return userRepository.findByEmail(normalizedEmail)
                .map(User::getId)
                .orElseThrow(() -> new ResourceNotFoundException("User with email", email));
    }

    public RecruiterProfile updateProfile(String recruiterUserId, Map<String, Object> allowedFields) {
        RecruiterProfile profile = getProfile(recruiterUserId);

        if (allowedFields.containsKey("designation")) {
            profile.setDesignation((String) allowedFields.get("designation"));
        }
        if (allowedFields.containsKey("phone")) {
            profile.setPhone((String) allowedFields.get("phone"));
        }
        if (allowedFields.containsKey("linkedInUrl")) {
            profile.setLinkedInUrl((String) allowedFields.get("linkedInUrl"));
        }
        return recruiterProfileRepository.save(profile);
    }

    public Job createJob(String recruiterUserId, Map<String, Object> fields) {
        assertRecruiterApproved(recruiterUserId);
        String companyId = (String) fields.get("companyId");
        if (companyId == null || companyId.isBlank()) {
            companyId = recruiterProfileRepository.findByUserId(recruiterUserId)
                    .map(RecruiterProfile::getCompanyId)
                    .filter(cid -> cid != null && !cid.isBlank())
                    .orElse(null);
            if (companyId == null) {
                companyId = companyRepository.findAll().stream()
                        .filter(c -> c.getAuthorizedRecruiterIds() != null && c.getAuthorizedRecruiterIds().contains(recruiterUserId))
                        .map(Company::getId)
                        .findFirst()
                        .orElse(null);
            }
            if (companyId == null) {
                Company defaultCompany = companyRepository.findAll().stream().findFirst().orElseGet(() -> {
                    Company c = Company.builder()
                            .name("TechNova Solutions")
                            .industry("Information Technology")
                            .description("Default Partner Organization")
                            .approvalStatus(ApprovalStatus.APPROVED)
                            .authorizedRecruiterIds(new ArrayList<>())
                            .build();
                    return companyRepository.save(c);
                });
                companyId = defaultCompany.getId();
                recruiterProfileRepository.findByUserId(recruiterUserId).ifPresent(p -> {
                    p.setCompanyId(defaultCompany.getId());
                    recruiterProfileRepository.save(p);
                });
            }
        }
        if (companyId != null) {
            assertRecruiterAuthorizedForCompany(recruiterUserId, companyId);
        }

        JobStatus initialStatus = JobStatus.DRAFT;
        if (fields.containsKey("status")) {
            String s = String.valueOf(fields.get("status")).toUpperCase();
            if ("ACTIVE".equals(s) || "PUBLISHED".equals(s)) {
                initialStatus = JobStatus.ACTIVE;
            } else if ("CLOSED".equals(s)) {
                initialStatus = JobStatus.CLOSED;
            }
        }

        Job job = Job.builder()
                .title((String) fields.get("title"))
                .description((String) fields.get("description"))
                .responsibilities((String) fields.get("responsibilities"))
                .companyId(companyId)
                .recruiterUserId(recruiterUserId)
                .creatorUserId(recruiterUserId)
                .creatorRole("RECRUITER")
                .lastModifiedByUserId(recruiterUserId)
                .lastModifiedByRole("RECRUITER")
                .location((String) fields.get("location"))
                .country((String) fields.get("country"))
                .city((String) fields.get("city"))
                .salaryCurrency(fields.get("salaryCurrency") != null
                        ? String.valueOf(fields.get("salaryCurrency")).toUpperCase() : "INR")
                .workMode(fields.containsKey("workMode") && fields.get("workMode") != null
                        ? WorkMode.valueOf(String.valueOf(fields.get("workMode")).toUpperCase())
                        : WorkMode.WFO)
                .employmentType((String) fields.get("employmentType"))
                .educationRequirements((String) fields.get("educationRequirements"))
                .additionalRequirements((String) fields.get("additionalRequirements"))
                .status(initialStatus)
                .publishedAt(initialStatus == JobStatus.ACTIVE ? Instant.now() : null)
                .build();

        if (fields.containsKey("techStack")) {
            @SuppressWarnings("unchecked")
            List<String> stack = (List<String>) fields.get("techStack");
            job.setTechStack(stack);
        }
        if (fields.containsKey("preferredSkills")) {
            @SuppressWarnings("unchecked")
            List<String> pref = (List<String>) fields.get("preferredSkills");
            job.setPreferredSkills(pref);
        }
        if (fields.containsKey("certifications")) {
            @SuppressWarnings("unchecked")
            List<String> certs = (List<String>) fields.get("certifications");
            job.setCertifications(certs);
        }
        if (fields.containsKey("minExperienceYears") && fields.get("minExperienceYears") != null) {
            job.setMinExperienceYears(((Number) fields.get("minExperienceYears")).intValue());
        }
        if (fields.containsKey("maxExperienceYears") && fields.get("maxExperienceYears") != null) {
            job.setMaxExperienceYears(((Number) fields.get("maxExperienceYears")).intValue());
        }
        if (fields.containsKey("minSalaryInr") && fields.get("minSalaryInr") != null) {
            job.setMinSalaryInr(((Number) fields.get("minSalaryInr")).longValue());
        }
        if (fields.containsKey("maxSalaryInr") && fields.get("maxSalaryInr") != null) {
            job.setMaxSalaryInr(((Number) fields.get("maxSalaryInr")).longValue());
        }
        if (fields.containsKey("numberOfVacancies") && fields.get("numberOfVacancies") != null) {
            job.setNumberOfVacancies(((Number) fields.get("numberOfVacancies")).intValue());
        }
        if (fields.containsKey("applicationDeadline")) {
            job.setApplicationDeadline(parseInstant(fields.get("applicationDeadline")));
        }

        Job saved = jobRepository.save(job);
        log.info("Job created [id={}] by recruiter [userId={}] with status [{}]",
                saved.getId(), recruiterUserId, saved.getStatus());

        auditService.log(recruiterUserId, "RECRUITER", "Job", saved.getId(), "JOB_CREATED",
                Map.of("title", saved.getTitle(), "status", saved.getStatus().name()));
        recruiterActivityService.recordRecruiterAction("JOB_CREATED", recruiterUserId, null,
                saved.getId(), null, null, saved.getCompanyId(), Map.of("title", saved.getTitle()));

        return saved;
    }

    public Job updateJob(String recruiterUserId, String jobId, Map<String, Object> fields) {
        assertRecruiterApproved(recruiterUserId);
        Job job = getJobOwnedBy(recruiterUserId, jobId);

        applyJobFieldUpdates(job, fields);
        job.setLastModifiedByUserId(recruiterUserId);
        job.setLastModifiedByRole("RECRUITER");

        Job saved = jobRepository.save(job);
        auditService.log(recruiterUserId, "RECRUITER", "Job", saved.getId(), "JOB_UPDATED",
                Map.of("title", saved.getTitle()));
        recruiterActivityService.recordRecruiterAction("JOB_UPDATED", recruiterUserId, null,
                saved.getId(), null, null, saved.getCompanyId(), Map.of("title", saved.getTitle()));
        return saved;
    }

    public Job publishJob(String recruiterUserId, String jobId) {
        assertRecruiterApproved(recruiterUserId);
        Job job = getJobOwnedBy(recruiterUserId, jobId);
        if (job.getStatus() == JobStatus.CLOSED) {
            throw new BusinessException("JOB_CLOSED", "A closed job cannot be re-published.");
        }
        job.setStatus(JobStatus.ACTIVE);
        job.setPublishedAt(Instant.now());
        job.setLastModifiedByUserId(recruiterUserId);
        job.setLastModifiedByRole("RECRUITER");
        Job saved = jobRepository.save(job);
        auditService.log(recruiterUserId, "RECRUITER", "Job", saved.getId(), "JOB_PUBLISHED",
                Map.of("title", saved.getTitle()));
        recruiterActivityService.recordRecruiterAction("JOB_PUBLISHED", recruiterUserId, null,
                saved.getId(), null, null, saved.getCompanyId(), Map.of("title", saved.getTitle()));
        return saved;
    }

    /**
     * Deactivate (temporarily pause) a job — sets status to INACTIVE.
     * Existing applications are preserved. The job remains visible to the owning recruiter.
     */
    public Job deactivateJob(String recruiterUserId, String jobId) {
        assertRecruiterApproved(recruiterUserId);
        Job job = getJobOwnedBy(recruiterUserId, jobId);
        if (job.getStatus() == JobStatus.CLOSED) {
            throw new BusinessException("JOB_CLOSED", "A closed job cannot be deactivated; it is already closed.");
        }
        job.setStatus(JobStatus.INACTIVE);
        job.setDeactivatedAt(Instant.now());
        job.setLastModifiedByUserId(recruiterUserId);
        job.setLastModifiedByRole("RECRUITER");
        Job saved = jobRepository.save(job);
        auditService.log(recruiterUserId, "RECRUITER", "Job", saved.getId(), "JOB_DEACTIVATED",
                Map.of("title", saved.getTitle()));
        recruiterActivityService.recordRecruiterAction("JOB_DEACTIVATED", recruiterUserId, null,
                saved.getId(), null, null, saved.getCompanyId(), Map.of("title", saved.getTitle()));
        return saved;
    }

    /**
     * Permanently close a job. Cannot be re-published after this.
     */
    public Job closeJob(String recruiterUserId, String jobId) {
        assertRecruiterApproved(recruiterUserId);
        Job job = getJobOwnedBy(recruiterUserId, jobId);
        job.setStatus(JobStatus.CLOSED);
        if (job.getClosedAt() == null) job.setClosedAt(Instant.now());
        job.setLastModifiedByUserId(recruiterUserId);
        job.setLastModifiedByRole("RECRUITER");
        Job saved = jobRepository.save(job);
        auditService.log(recruiterUserId, "RECRUITER", "Job", saved.getId(), "JOB_CLOSED",
                Map.of("title", saved.getTitle()));
        recruiterActivityService.recordRecruiterAction("JOB_CLOSED", recruiterUserId, null,
                saved.getId(), null, null, saved.getCompanyId(), Map.of("title", saved.getTitle()));
        return saved;
    }

    public Job getJob(String recruiterUserId, String jobId) {
        assertRecruiterApproved(recruiterUserId);
        return getJobOwnedBy(recruiterUserId, jobId);
    }

    public List<JobApplication> getApplicationsForJob(String recruiterUserId, String jobId) {
        assertRecruiterApproved(recruiterUserId);
        getJobOwnedBy(recruiterUserId, jobId); // ensures ownership
        return jobApplicationRepository.findByJobId(jobId);
    }

    // ── Shared field-update logic ──────────────────────────────────────────────
    static void applyJobFieldUpdates(Job job, Map<String, Object> fields) {
        if (fields.containsKey("title")) job.setTitle((String) fields.get("title"));
        if (fields.containsKey("description")) job.setDescription((String) fields.get("description"));
        if (fields.containsKey("responsibilities")) job.setResponsibilities((String) fields.get("responsibilities"));
        if (fields.containsKey("location")) job.setLocation((String) fields.get("location"));
        if (fields.containsKey("country")) job.setCountry((String) fields.get("country"));
        if (fields.containsKey("city")) job.setCity((String) fields.get("city"));
        if (fields.containsKey("salaryCurrency") && fields.get("salaryCurrency") != null) {
            job.setSalaryCurrency(String.valueOf(fields.get("salaryCurrency")).toUpperCase());
        }
        if (fields.containsKey("workMode") && fields.get("workMode") != null) {
            job.setWorkMode(WorkMode.valueOf(String.valueOf(fields.get("workMode")).toUpperCase()));
        }
        if (fields.containsKey("employmentType")) job.setEmploymentType((String) fields.get("employmentType"));
        if (fields.containsKey("educationRequirements")) job.setEducationRequirements((String) fields.get("educationRequirements"));
        if (fields.containsKey("additionalRequirements")) job.setAdditionalRequirements((String) fields.get("additionalRequirements"));
        if (fields.containsKey("minExperienceYears") && fields.get("minExperienceYears") != null) {
            job.setMinExperienceYears(((Number) fields.get("minExperienceYears")).intValue());
        }
        if (fields.containsKey("maxExperienceYears") && fields.get("maxExperienceYears") != null) {
            job.setMaxExperienceYears(((Number) fields.get("maxExperienceYears")).intValue());
        }
        if (fields.containsKey("minSalaryInr") && fields.get("minSalaryInr") != null) {
            job.setMinSalaryInr(((Number) fields.get("minSalaryInr")).longValue());
        }
        if (fields.containsKey("maxSalaryInr") && fields.get("maxSalaryInr") != null) {
            job.setMaxSalaryInr(((Number) fields.get("maxSalaryInr")).longValue());
        }
        if (fields.containsKey("numberOfVacancies") && fields.get("numberOfVacancies") != null) {
            job.setNumberOfVacancies(((Number) fields.get("numberOfVacancies")).intValue());
        }
        if (fields.containsKey("applicationDeadline")) {
            Object val = fields.get("applicationDeadline");
            if (val == null) {
                job.setApplicationDeadline(null);
            } else if (val instanceof Instant inst) {
                job.setApplicationDeadline(inst);
            } else {
                try { job.setApplicationDeadline(Instant.parse(String.valueOf(val))); } catch (Exception ignored) {}
            }
        }
        if (fields.containsKey("techStack")) {
            @SuppressWarnings("unchecked")
            List<String> stack = (List<String>) fields.get("techStack");
            job.setTechStack(stack != null ? stack : new ArrayList<>());
        }
        if (fields.containsKey("preferredSkills")) {
            @SuppressWarnings("unchecked")
            List<String> pref = (List<String>) fields.get("preferredSkills");
            job.setPreferredSkills(pref != null ? pref : new ArrayList<>());
        }
        if (fields.containsKey("certifications")) {
            @SuppressWarnings("unchecked")
            List<String> certs = (List<String>) fields.get("certifications");
            job.setCertifications(certs != null ? certs : new ArrayList<>());
        }
        if (fields.containsKey("status")) {
            String s = String.valueOf(fields.get("status")).toUpperCase();
            switch (s) {
                case "ACTIVE", "PUBLISHED" -> {
                    job.setStatus(JobStatus.ACTIVE);
                    if (job.getPublishedAt() == null) job.setPublishedAt(Instant.now());
                }
                case "INACTIVE", "PAUSED" -> {
                    job.setStatus(JobStatus.INACTIVE);
                    if (job.getDeactivatedAt() == null) job.setDeactivatedAt(Instant.now());
                }
                case "CLOSED" -> {
                    job.setStatus(JobStatus.CLOSED);
                    if (job.getClosedAt() == null) job.setClosedAt(Instant.now());
                }
                case "DRAFT" -> job.setStatus(JobStatus.DRAFT);
            }
        }
    }

    private Instant parseInstant(Object val) {
        if (val == null) return null;
        if (val instanceof Instant inst) return inst;
        if (val instanceof Number num) return Instant.ofEpochMilli(num.longValue());
        if (val instanceof String str && !str.isBlank()) {
            try {
                return Instant.parse(str.trim());
            } catch (Exception e) {
                try {
                    return java.time.LocalDate.parse(str.trim()).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    /**
     * The jobs owned by the authenticated recruiter — used, among other
     * things, to pick an ATS evaluation target job. Results are scoped to the
     * caller; sorted newest first.
     */
    public List<Job> listMyJobs(String recruiterUserId) {
        assertRecruiterApproved(recruiterUserId);
        // Uses the indexed recruiterUserId field; scoped to the caller only.
        List<Job> jobs = jobRepository.findByRecruiterUserId(recruiterUserId);
        jobs.sort(java.util.Comparator.comparing(Job::getCreatedAt,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())).reversed());
        return jobs;
    }

    public Page<CandidateProfile> searchCandidates(String recruiterUserId, String keyword,
                                                     List<String> skills, int page, int size) {
        assertRecruiterApproved(recruiterUserId);
        Pageable pageable = PageRequest.of(page, size);

        // Build an effective skills list from both the keyword and explicit skills params.
        // keyword is treated as an additional skill term (e.g. keyword="Java" → search Java skill).
        List<String> effectiveSkills = new java.util.ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            effectiveSkills.add(keyword.trim());
        }
        if (skills != null && !skills.isEmpty()) {
            effectiveSkills.addAll(skills);
        }

        if (!effectiveSkills.isEmpty()) {
            return candidateProfileRepository.findByApprovalStatusAndVisibleAndSkillsIn(
                    ApprovalStatus.APPROVED, true, effectiveSkills, pageable);
        }
        return candidateProfileRepository
                .findByProfileApprovalStatusAndVisibleToRecruiters(
                        ApprovalStatus.APPROVED, true, pageable);
    }

    public CandidateProfile viewCandidateProfile(String recruiterUserId,
                                                   String candidateUserId,
                                                   String applicationId,
                                                   String searchQuery) {
        assertRecruiterApproved(recruiterUserId);
        CandidateProfile profile = candidateProfileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("CandidateProfile for user", candidateUserId));

        boolean released = isReleased(applicationId, candidateUserId);
        if (!released) {
            profile.setPhone(null);
        }

        auditService.log(recruiterUserId, "RECRUITER", "CandidateProfile",
                profile.getId(), "CANDIDATE_PROFILE_VIEWED",
                Map.of("candidateUserId", candidateUserId, "released", String.valueOf(released)));

        // Associate the visit with the recruiter's real application/job context
        // when one exists — never invented.
        JobApplication app = null;
        if (applicationId != null && !applicationId.isBlank()) {
            app = jobApplicationRepository.findById(applicationId)
                    .filter(a -> recruiterUserId.equals(a.getRecruiterUserId()))
                    .orElse(null);
        }
        if (app == null) {
            app = jobApplicationRepository
                    .findFirstByRecruiterUserIdAndCandidateUserId(recruiterUserId, candidateUserId)
                    .orElse(null);
        }
        String contextApplicationId = app != null ? app.getId() : null;
        String contextJobId = app != null ? app.getJobId() : null;
        String contextCompanyId = app != null ? app.getCompanyId() : null;
        if (contextCompanyId == null) {
            contextCompanyId = recruiterProfileRepository.findByUserId(recruiterUserId)
                    .map(RecruiterProfile::getCompanyId).orElse(null);
        }

        Map<String, String> metadata = new LinkedHashMap<>();
        if (searchQuery != null && !searchQuery.isBlank()) {
            metadata.put("searchQuery", searchQuery.trim());
        }
        recruiterActivityService.recordRecruiterAction(
                RecruiterActivity.EVENT_VIEWED_PROFILE,
                recruiterUserId, candidateUserId,
                contextJobId, contextApplicationId, null, contextCompanyId, metadata);

        return profile;
    }

    public JobApplication markApplicationViewed(String recruiterUserId, String applicationId) {
        assertRecruiterApproved(recruiterUserId);
        JobApplication app = getApplicationForRecruiter(recruiterUserId, applicationId);

        if (app.getStatus() == ApplicationStatus.INTERESTED) {
            app.setStatus(ApplicationStatus.VIEWED);
            app.setViewedAt(Instant.now());
            addHistory(app, ApplicationStatus.VIEWED, recruiterUserId, null);
            JobApplication saved = jobApplicationRepository.save(app);
            // Record only after the successful real transition (idempotent re-calls skip this)
            recruiterActivityService.recordRecruiterAction(
                    RecruiterActivity.EVENT_VIEWED_APPLICATION,
                    recruiterUserId, app.getCandidateUserId(),
                    app.getJobId(), app.getId(), null, app.getCompanyId(), null);
            return saved;
        }
        return app; // Already beyond VIEWED; idempotent
    }

    public JobApplication shortlistApplication(String recruiterUserId, String applicationId,
                                                String note) {
        assertRecruiterApproved(recruiterUserId);
        JobApplication app = getApplicationForRecruiter(recruiterUserId, applicationId);

        // Prevent duplicate notifications if already shortlisted
        if (app.getStatus() == ApplicationStatus.SHORTLISTED) {
            log.info("Application [{}] is already SHORTLISTED. Skipping duplicate notification.", applicationId);
            return app;
        }

        if (app.getStatus() != ApplicationStatus.VIEWED) {
            throw new BusinessException("INVALID_TRANSITION",
                    "Only VIEWED applications can be shortlisted.");
        }

        app.setStatus(ApplicationStatus.SHORTLISTED);
        app.setShortlistedAt(Instant.now());
        app.setRecruiterNote(note);
        addHistory(app, ApplicationStatus.SHORTLISTED, recruiterUserId, note);
        JobApplication savedApp = jobApplicationRepository.save(app);

        recorderContextShortlist(recruiterUserId, savedApp);

        // Resolve actual job title from DB
        String jobTitle = "the position";
        if (app.getJobId() != null) {
            jobTitle = jobRepository.findById(app.getJobId())
                    .map(Job::getTitle)
                    .orElse("the position");
        }

        String title = "Your Application Has Been Shortlisted!";
        String message = "Congratulations! Your application for " + jobTitle
                + " has been shortlisted by the recruiter. Log in to view your application details.";

        // Determine destination URL based on candidate plan
        String actionUrl = "/dashboard";
        if (app.getCandidateUserId() != null) {
            Optional<User> candUser = userRepository.findById(app.getCandidateUserId());
            if (candUser.isPresent() && (candUser.get().isPlanActivated() || (candUser.get().getPlan() != null && candUser.get().getPlan() != PlanType.FREE))) {
                actionUrl = "/paid-dashboard#section-shortlisted-jobs";
            } else {
                actionUrl = "/unpaid-dashboard";
            }
        }

        notificationService.notify(app.getCandidateUserId(), title, message,
                "APPLICATION_SHORTLISTED", app.getId(), "JobApplication", actionUrl);
        return savedApp;
    }

    public List<JobApplication> getApplicationsForRecruiter(String recruiterUserId) {
        assertRecruiterApproved(recruiterUserId);
        return jobApplicationRepository.findByRecruiterUserId(recruiterUserId);
    }

    public JobApplication rejectApplication(String recruiterUserId, String applicationId,
                                             String reason) {
        assertRecruiterApproved(recruiterUserId);
        JobApplication app = getApplicationForRecruiter(recruiterUserId, applicationId);

        if (app.getStatus() == ApplicationStatus.HIRED
                || app.getStatus() == ApplicationStatus.REJECTED) {
            throw new BusinessException("INVALID_TRANSITION", "Cannot reject in current state.");
        }

        app.setStatus(ApplicationStatus.REJECTED);
        app.setRejectedAt(Instant.now());
        app.setRejectionReason(reason);
        addHistory(app, ApplicationStatus.REJECTED, recruiterUserId, reason);
        JobApplication savedApp = jobApplicationRepository.save(app);
        // Record only after the rejection is persisted
        recruiterActivityService.recordRecruiterAction(
                RecruiterActivity.EVENT_REJECTED,
                recruiterUserId, app.getCandidateUserId(),
                app.getJobId(), app.getId(), null, app.getCompanyId(), null);
        notificationService.notify(app.getCandidateUserId(), "Application Status Updated",
                "Your application status has been updated.",
                "APPLICATION_REJECTED", app.getId(), "JobApplication", "/paid-dashboard");
        return savedApp;
    }

    public HiringRequest createHiringRequest(String recruiterUserId, String applicationId,
                                              long agreedAnnualSalaryInr) {
        assertRecruiterApproved(recruiterUserId);
        JobApplication app = getApplicationForRecruiter(recruiterUserId, applicationId);

        if (app.getStatus() != ApplicationStatus.SHORTLISTED) {
            throw new BusinessException("INVALID_TRANSITION",
                    "A hiring request can only be created from a SHORTLISTED application.");
        }
        if (hiringRequestRepository.existsByJobApplicationId(applicationId)) {
            throw new BusinessException("DUPLICATE_HIRING_REQUEST",
                    "A hiring request already exists for this application.");
        }

        BigDecimal salary = BigDecimal.valueOf(agreedAnnualSalaryInr);
        BigDecimal fee = salary.multiply(DEFAULT_HIRING_FEE_PERCENTAGE)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        HiringRequest request = HiringRequest.builder()
                .candidateUserId(app.getCandidateUserId())
                .recruiterUserId(recruiterUserId)
                .jobId(app.getJobId())
                .jobApplicationId(applicationId)
                .companyId(app.getCompanyId())
                .agreedAnnualSalaryInr(agreedAnnualSalaryInr)
                .hiringFeePercentage(DEFAULT_HIRING_FEE_PERCENTAGE)
                .calculatedHiringFeeInr(fee)
                .approvalStatus(ApprovalStatus.PENDING)
                .paymentStatus(PaymentStatus.PENDING)
                .candidateReleased(false)
                .build();

        app.setStatus(ApplicationStatus.HIRE_REQUESTED);
        app.setHireRequestedAt(Instant.now());
        addHistory(app, ApplicationStatus.HIRE_REQUESTED, recruiterUserId, null);
        jobApplicationRepository.save(app);

        HiringRequest saved = hiringRequestRepository.save(request);
        log.info("HiringRequest created [id={}] for candidate [{}] by recruiter [{}]",
                saved.getId(), app.getCandidateUserId(), recruiterUserId);

        recruiterActivityService.recordRecruiterAction(
                RecruiterActivity.EVENT_HIRE_REQUESTED,
                recruiterUserId, app.getCandidateUserId(),
                app.getJobId(), app.getId(), saved.getId(),
                saved.getCompanyId() != null ? saved.getCompanyId() : app.getCompanyId(), null);

        notificationService.notify(app.getCandidateUserId(), "Hire Request Initiated",
                "Great news! A recruiter has initiated a hire request for your profile.",
                "HIRE_REQUESTED", saved.getId(), "HiringRequest", "/paid-dashboard");
        return saved;
    }

    public Page<Notification> getNotifications(String recruiterUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return notificationRepository.findByRecipientUserId(recruiterUserId, pageable);
    }

    private void assertRecruiterApproved(String recruiterUserId) {
        RecruiterProfile profile = getProfile(recruiterUserId);
        if (profile.getApprovalStatus() != ApprovalStatus.APPROVED) {
            throw new AccessDeniedBusinessException(
                    "Your recruiter account has not been approved yet.");
        }
    }

    private void assertRecruiterAuthorizedForCompany(String recruiterUserId, String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", companyId));
        if (company.getAuthorizedRecruiterIds() == null) {
            company.setAuthorizedRecruiterIds(new ArrayList<>());
        }

        Optional<RecruiterProfile> profileOpt = recruiterProfileRepository.findByUserId(recruiterUserId);
        boolean isAuthorized = company.getAuthorizedRecruiterIds().contains(recruiterUserId)
                || profileOpt.map(p -> companyId.equals(p.getCompanyId())).orElse(false);

        // If recruiter profile has no company assigned yet, link them to this company
        if (!isAuthorized && profileOpt.isPresent() && (profileOpt.get().getCompanyId() == null || profileOpt.get().getCompanyId().isBlank())) {
            RecruiterProfile p = profileOpt.get();
            p.setCompanyId(companyId);
            recruiterProfileRepository.save(p);
            isAuthorized = true;
        }

        if (!isAuthorized) {
            throw new AccessDeniedBusinessException(
                    "You are not authorized to manage jobs for this company.");
        }

        // Self-heal: ensure recruiterUserId is in company's authorized list
        if (!company.getAuthorizedRecruiterIds().contains(recruiterUserId)) {
            List<String> list = new ArrayList<>(company.getAuthorizedRecruiterIds());
            list.add(recruiterUserId);
            company.setAuthorizedRecruiterIds(list);
            companyRepository.save(company);
            log.info("Recruiter [{}] auto-linked and authorized for company [{}]", recruiterUserId, companyId);
        }
    }

    private Job getJobOwnedBy(String recruiterUserId, String jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
        // Jobs without an owning recruiter (company-wide postings) are not
        // owned by this recruiter either — fail with a clear authorization
        // error instead of an NPE. Company-wide job software is handled by the
        // company-level authorization paths.
        if (job.getRecruiterUserId() == null
                || !job.getRecruiterUserId().equals(recruiterUserId)) {
            throw new AccessDeniedBusinessException("You do not own this job.");
        }
        return job;
    }

    private JobApplication getApplicationForRecruiter(String recruiterUserId, String applicationId) {
        JobApplication app = jobApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("JobApplication", applicationId));
        // Applications without an owning recruiter (company-wide postings) are
        // not under this recruiter's jurisdiction either — never an NPE.
        if (app.getRecruiterUserId() == null
                || !app.getRecruiterUserId().equals(recruiterUserId)) {
            throw new AccessDeniedBusinessException("This application is not under your jurisdiction.");
        }
        return app;
    }

    private boolean isReleased(String applicationId, String candidateUserId) {
        if (applicationId == null) return false;
        return jobApplicationRepository.findById(applicationId)
                .map(app -> app.getStatus() == ApplicationStatus.RELEASED
                        || app.getStatus() == ApplicationStatus.HIRED)
                .orElse(false);
    }

    /** Records the shortlist activity after the application was persisted. */
    private void recorderContextShortlist(String recruiterUserId, JobApplication app) {
        recruiterActivityService.recordRecruiterAction(
                RecruiterActivity.EVENT_SHORTLISTED,
                recruiterUserId, app.getCandidateUserId(),
                app.getJobId(), app.getId(), null, app.getCompanyId(), null);
    }

    /**
     * Secure resume download for a recruiter.
     *
     * Recruiters may only download a resume after the client admin approved it
     * (resumeApprovalStatus == APPROVED) — the same rule the hire-match flow
     * enforces. The download activity is recorded ONLY after the secure URL
     * is generated successfully, so a failed download is never logged.
     */
    public Map<String, Object> getResumeDownloadUrlForCandidate(String recruiterUserId,
                                                                String candidateUserId) {
        assertRecruiterApproved(recruiterUserId);
        CandidateProfile profile = candidateProfileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("CandidateProfile for user", candidateUserId));

        if (profile.getResumeCloudinaryPublicId() == null
                || profile.getResumeApprovalStatus() != ChangeRequestStatus.APPROVED) {
            throw new BusinessException("RESUME_NOT_AVAILABLE",
                    "This candidate's resume has not been approved for recruiter download yet.");
        }

        String url = fileStorageService.getSecureUrl(
                profile.getResumeCloudinaryPublicId(), profile.getResumeMimeType());

        // Associate with the recruiter's real application/job context when one exists
        JobApplication app = jobApplicationRepository
                .findFirstByRecruiterUserIdAndCandidateUserId(recruiterUserId, candidateUserId)
                .orElse(null);
        String contextCompanyId = app != null ? app.getCompanyId()
                : recruiterProfileRepository.findByUserId(recruiterUserId)
                    .map(RecruiterProfile::getCompanyId).orElse(null);

        Map<String, String> metadata = new LinkedHashMap<>();
        if (profile.getResumeOriginalFilename() != null && !profile.getResumeOriginalFilename().isBlank()) {
            metadata.put("filename", profile.getResumeOriginalFilename());
        }
        recruiterActivityService.recordRecruiterAction(
                RecruiterActivity.EVENT_DOWNLOADED_RESUME,
                recruiterUserId, candidateUserId,
                app != null ? app.getJobId() : null,
                app != null ? app.getId() : null,
                null, contextCompanyId, metadata);

        auditService.log(recruiterUserId, "RECRUITER", "CandidateProfile",
                profile.getId(), "CANDIDATE_RESUME_DOWNLOADED",
                Map.of("candidateUserId", candidateUserId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("downloadUrl", url);
        result.put("filename", profile.getResumeOriginalFilename() != null
                && !profile.getResumeOriginalFilename().isBlank()
                ? profile.getResumeOriginalFilename() : "resume");
        return result;
    }

    private void addHistory(JobApplication app, ApplicationStatus status,
                             String changedByUserId, String note) {
        app.getStatusHistory().add(
                JobApplication.StatusHistoryEntry.builder()
                        .status(status)
                        .changedAt(Instant.now())
                        .changedByUserId(changedByUserId)
                        .note(note)
                        .build()
        );
    }
}
