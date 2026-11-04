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

import java.time.Instant;
import java.util.List;
import java.util.Map;


@Service
@RequiredArgsConstructor
@Slf4j
public class ClientAdminService {

    private final UserRepository userRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final HiringRequestRepository hiringRequestRepository;
    private final PortfolioChangeRequestRepository portfolioChangeRequestRepository;
    private final ResumeApprovalRequestRepository resumeApprovalRequestRepository;
    private final NotificationRepository notificationRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final FileStorageService fileStorageService;
    private final ResumeManagementService resumeManagementService;
    private final PortfolioService portfolioService;

    public Page<User> getPendingCandidates(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return userRepository.findAll(pageable).map(u -> u)
                .map(u -> u);
    }

    public Page<CandidateProfile> getPendingCandidateProfiles(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return candidateProfileRepository.findByProfileApprovalStatus(ApprovalStatus.PENDING, pageable);
    }

    public User approveCandidate(String adminUserId, String candidateUserId) {
        User candidate = getUserAsRole(candidateUserId, Role.CANDIDATE);
        assertNotAlreadyProcessed(candidate.getAccountStatus(), "candidate");

        candidate.setAccountStatus(AccountStatus.ACTIVE);
        candidate.setReviewedByAdminId(adminUserId);
        candidate.setApprovedAt(Instant.now());

        candidateProfileRepository.findByUserId(candidateUserId).ifPresent(profile -> {
            profile.setProfileApprovalStatus(ApprovalStatus.APPROVED);
            candidateProfileRepository.save(profile);
        });

        User saved = userRepository.save(candidate);
        auditService.log(adminUserId, "CLIENT_ADMIN", "User", candidateUserId,
                "CANDIDATE_APPROVED", Map.of("candidateEmail", candidate.getEmail()));
        notificationService.notify(candidateUserId, "ACCOUNT_APPROVED",
                "Your candidate account has been approved. You can now log in.", null, null);
        log.info("Candidate approved: userId={} by admin={}", candidateUserId, adminUserId);
        return saved;
    }

    public User rejectCandidate(String adminUserId, String candidateUserId, String reason) {
        User candidate = getUserAsRole(candidateUserId, Role.CANDIDATE);

        candidate.setAccountStatus(AccountStatus.REJECTED);
        candidate.setReviewedByAdminId(adminUserId);
        candidate.setRejectionReason(reason);
        candidate.setRejectedAt(Instant.now());

        User saved = userRepository.save(candidate);
        auditService.log(adminUserId, "CLIENT_ADMIN", "User", candidateUserId,
                "CANDIDATE_REJECTED", Map.of("reason", reason));
        notificationService.notify(candidateUserId, "ACCOUNT_REJECTED",
                "Your registration was not approved. Reason: " + reason, null, null);
        return saved;
    }

    public Page<RecruiterProfile> getPendingRecruiters(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return recruiterProfileRepository.findAll(pageable).map(r -> r);
    }

    public RecruiterProfile approveRecruiter(String adminUserId, String recruiterUserId,
                                              String companyId) {
        RecruiterProfile profile = recruiterProfileRepository.findByUserId(recruiterUserId)
                .orElseThrow(() -> new ResourceNotFoundException("RecruiterProfile for user", recruiterUserId));

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", companyId));

        if (company.getApprovalStatus() != ApprovalStatus.APPROVED) {
            throw new BusinessException("COMPANY_NOT_APPROVED",
                    "The company must be approved before approving its recruiter.");
        }

        profile.setApprovalStatus(ApprovalStatus.APPROVED);
        profile.setCompanyId(companyId);
        profile.setReviewedByAdminId(adminUserId);
        profile.setApprovedAt(Instant.now());

        // Add recruiter to company's authorized list
        if (!company.getAuthorizedRecruiterIds().contains(recruiterUserId)) {
            company.getAuthorizedRecruiterIds().add(recruiterUserId);
            companyRepository.save(company);
        }

        // Activate the user account
        userRepository.findById(recruiterUserId).ifPresent(user -> {
            user.setAccountStatus(AccountStatus.ACTIVE);
            user.setReviewedByAdminId(adminUserId);
            user.setApprovedAt(Instant.now());
            userRepository.save(user);
        });

        RecruiterProfile saved = recruiterProfileRepository.save(profile);
        auditService.log(adminUserId, "CLIENT_ADMIN", "RecruiterProfile", profile.getId(),
                "RECRUITER_APPROVED", Map.of("recruiterUserId", recruiterUserId, "companyId", companyId));
        notificationService.notify(recruiterUserId, "ACCOUNT_APPROVED",
                "Your recruiter account has been approved. You can now post jobs.", null, null);
        return saved;
    }

    public RecruiterProfile rejectRecruiter(String adminUserId, String recruiterUserId,
                                             String reason) {
        RecruiterProfile profile = recruiterProfileRepository.findByUserId(recruiterUserId)
                .orElseThrow(() -> new ResourceNotFoundException("RecruiterProfile for user", recruiterUserId));

        profile.setApprovalStatus(ApprovalStatus.REJECTED);
        profile.setReviewedByAdminId(adminUserId);
        profile.setRejectionReason(reason);
        profile.setRejectedAt(Instant.now());

        userRepository.findById(recruiterUserId).ifPresent(user -> {
            user.setAccountStatus(AccountStatus.REJECTED);
            userRepository.save(user);
        });

        auditService.log(adminUserId, "CLIENT_ADMIN", "RecruiterProfile", profile.getId(),
                "RECRUITER_REJECTED", Map.of("reason", reason));
        return recruiterProfileRepository.save(profile);
    }

    public Company approveCompany(String adminUserId, String companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", companyId));

        if (company.getApprovalStatus() == ApprovalStatus.APPROVED) {
            throw new BusinessException("ALREADY_APPROVED", "Company is already approved.");
        }

        company.setApprovalStatus(ApprovalStatus.APPROVED);
        company.setReviewedByAdminId(adminUserId);
        company.setApprovedAt(Instant.now());

        Company saved = companyRepository.save(company);
        auditService.log(adminUserId, "CLIENT_ADMIN", "Company", companyId,
                "COMPANY_APPROVED", Map.of("companyName", company.getName()));
        return saved;
    }

    public Company rejectCompany(String adminUserId, String companyId, String reason) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", companyId));

        company.setApprovalStatus(ApprovalStatus.REJECTED);
        company.setReviewedByAdminId(adminUserId);
        company.setRejectionReason(reason);

        auditService.log(adminUserId, "CLIENT_ADMIN", "Company", companyId,
                "COMPANY_REJECTED", Map.of("reason", reason));
        return companyRepository.save(company);
    }

    public Page<HiringRequest> getPendingHiringRequests(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return hiringRequestRepository.findByApprovalStatus(ApprovalStatus.PENDING, pageable);
    }

    public HiringRequest approveHiringRequest(String adminUserId, String hiringRequestId) {
        HiringRequest request = hiringRequestRepository.findById(hiringRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("HiringRequest", hiringRequestId));

        if (request.getApprovalStatus() != ApprovalStatus.PENDING) {
            throw new BusinessException("INVALID_STATE", "Hiring request is not in PENDING state.");
        }

        request.setApprovalStatus(ApprovalStatus.APPROVED);
        request.setApprovedByAdminId(adminUserId);
        request.setApprovedAt(Instant.now());

        HiringRequest saved = hiringRequestRepository.save(request);
        auditService.log(adminUserId, "CLIENT_ADMIN", "HiringRequest", hiringRequestId,
                "HIRING_REQUEST_APPROVED", Map.of("candidateUserId", request.getCandidateUserId()));

        // Recruiter notification — carries the hire match reference + deep link
        notificationService.notify(request.getRecruiterUserId(), "Hire Match Approved",
                "Your hiring request has been approved. Please complete the payment to release the candidate.",
                "HIRING_REQUEST_APPROVED", hiringRequestId, "HiringRequest", "/recruiter");

        // Candidate notification for the same approval (was missing before)
        notificationService.notify(request.getCandidateUserId(), "Hire Match Approved",
                "Congratulations! The client admin has approved your hire match. Login to view the details.",
                "HIRE_MATCH_APPROVED", hiringRequestId, "HiringRequest", "/paid-dashboard");
        return saved;
    }

    /**
     * Releases candidate contact details to the recruiter.
     * Requires: approved hiring request + verified payment.
     * Prevents repeated release actions.
     */
    public HiringRequest releaseCandidate(String adminUserId, String hiringRequestId) {
        HiringRequest request = hiringRequestRepository.findById(hiringRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("HiringRequest", hiringRequestId));

        if (request.isCandidateReleased()) {
            throw new BusinessException("ALREADY_RELEASED", "Candidate has already been released.");
        }
        if (request.getApprovalStatus() != ApprovalStatus.APPROVED) {
            throw new BusinessException("NOT_APPROVED", "Hiring request must be approved first.");
        }
        if (request.getPaymentStatus() != PaymentStatus.CAPTURED) {
            throw new BusinessException("PAYMENT_NOT_VERIFIED",
                    "Payment must be verified before releasing the candidate.");
        }

        request.setCandidateReleased(true);
        request.setReleasedAt(Instant.now());

        // Transition the job application to RELEASED
        if (request.getJobApplicationId() != null) {
            jobApplicationRepository.findById(request.getJobApplicationId()).ifPresent(app -> {
                app.setStatus(ApplicationStatus.RELEASED);
                app.setReleasedAt(Instant.now());
                app.getStatusHistory().add(
                        JobApplication.StatusHistoryEntry.builder()
                                .status(ApplicationStatus.RELEASED)
                                .changedAt(Instant.now())
                                .changedByUserId(adminUserId)
                                .note("Released by admin after payment verification")
                                .build()
                );
                jobApplicationRepository.save(app);
            });
        }

        HiringRequest saved = hiringRequestRepository.save(request);
        auditService.log(adminUserId, "CLIENT_ADMIN", "HiringRequest", hiringRequestId,
                "CANDIDATE_RELEASED", Map.of(
                        "candidateUserId", request.getCandidateUserId(),
                        "recruiterUserId", request.getRecruiterUserId()
                ));
        notificationService.notify(request.getRecruiterUserId(), "CANDIDATE_RELEASED",
                "The candidate's contact information is now available to you.",
                hiringRequestId, "HiringRequest");
        notificationService.notify(request.getCandidateUserId(), "YOU_HAVE_BEEN_RELEASED",
                "A recruiter now has access to your contact details for a job opportunity.",
                hiringRequestId, "HiringRequest");
        return saved;
    }

    public Page<PortfolioChangeRequest> getPendingChangeRequests(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return portfolioChangeRequestRepository.findByStatus(ChangeRequestStatus.PENDING, pageable);
    }

    public PortfolioChangeRequest approveChangeRequest(String adminUserId, String requestId) {
        PortfolioChangeRequest req = portfolioChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("PortfolioChangeRequest", requestId));

        if (req.getStatus() != ChangeRequestStatus.PENDING) {
            throw new BusinessException("ALREADY_REVIEWED", "This portfolio request has already been reviewed.");
        }

        req.setStatus(ChangeRequestStatus.APPROVED);
        req.setReviewedByAdminId(adminUserId);
        req.setReviewedAt(Instant.now());
        PortfolioChangeRequest saved = portfolioChangeRequestRepository.save(req);

        // Publish the newly approved portfolio onto the candidate profile. The
        // previous approved version is replaced only now, never on submission.
        portfolioService.applyApprovedChanges(saved);

        auditService.log(adminUserId, "CLIENT_ADMIN", "PortfolioChangeRequest", requestId,
                "CHANGE_REQUEST_APPROVED", Map.of("candidateUserId", req.getCandidateUserId()));
        notificationService.notify(req.getCandidateUserId(), "Portfolio Approved",
                "Your portfolio change request has been approved and is now live on your profile.",
                "PORTFOLIO_APPROVED", requestId, "PortfolioChangeRequest", "/paid-dashboard");
        log.info("Portfolio change approved: requestId={} by admin={}", requestId, adminUserId);
        return saved;
    }

    public PortfolioChangeRequest rejectChangeRequest(String adminUserId, String requestId,
                                                       String note) {
        PortfolioChangeRequest req = portfolioChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("PortfolioChangeRequest", requestId));

        if (req.getStatus() != ChangeRequestStatus.PENDING) {
            throw new BusinessException("ALREADY_REVIEWED", "This portfolio request has already been reviewed.");
        }

        req.setStatus(ChangeRequestStatus.REJECTED);
        req.setReviewedByAdminId(adminUserId);
        req.setReviewNote(note);
        req.setReviewedAt(Instant.now());
        PortfolioChangeRequest saved = portfolioChangeRequestRepository.save(req);
        // The previously approved portfolio is intentionally left untouched.

        auditService.log(adminUserId, "CLIENT_ADMIN", "PortfolioChangeRequest", requestId,
                "CHANGE_REQUEST_REJECTED", Map.of("candidateUserId", req.getCandidateUserId(),
                        "reason", note != null ? note : ""));
        notificationService.notify(req.getCandidateUserId(), "Portfolio Rejected",
                "Your portfolio change request was not approved."
                        + (note != null && !note.isBlank() ? " Reason: " + note : ""),
                "PORTFOLIO_REJECTED", requestId, "PortfolioChangeRequest", "/paid-dashboard");
        log.info("Portfolio change rejected: requestId={} by admin={}", requestId, adminUserId);
        return saved;
    }

    public Page<ResumeApprovalRequest> getPendingResumeRequests(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return resumeApprovalRequestRepository.findByStatus(ChangeRequestStatus.PENDING, pageable);
    }

    /**
     * Approves a candidate's uploaded resume.
     * Sets the approval status on both the request document and the CandidateProfile.
     * Notifies the candidate.
     */
    public ResumeApprovalRequest approveResumeRequest(String adminUserId, String requestId) {
        ResumeApprovalRequest req = resumeApprovalRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("ResumeApprovalRequest", requestId));

        if (req.getStatus() != ChangeRequestStatus.PENDING) {
            throw new BusinessException("ALREADY_REVIEWED", "This resume request has already been reviewed.");
        }

        req.setStatus(ChangeRequestStatus.APPROVED);
        req.setReviewedByAdminId(adminUserId);
        req.setReviewedAt(Instant.now());

        // Reflect approval on the candidate's profile
        candidateProfileRepository.findByUserId(req.getCandidateUserId()).ifPresent(profile -> {
            // Only update if this request matches the current resume (candidate may have re-uploaded)
            if (req.getCloudinaryPublicId().equals(profile.getResumeCloudinaryPublicId())) {
                profile.setResumeApprovalStatus(ChangeRequestStatus.APPROVED);
                candidateProfileRepository.save(profile);
            }
        });
        // The version history record for this exact stored file is approved too
        resumeManagementService.markApproved(req.getCandidateUserId(), req.getCloudinaryPublicId());

        ResumeApprovalRequest saved = resumeApprovalRequestRepository.save(req);
        auditService.log(adminUserId, "CLIENT_ADMIN", "ResumeApprovalRequest", requestId,
                "RESUME_APPROVED", Map.of("candidateUserId", req.getCandidateUserId()));
        notificationService.notify(req.getCandidateUserId(), "Resume Approved",
                "Your uploaded resume has been approved and is now active on your profile.",
                "RESUME_APPROVED", requestId, "ResumeApprovalRequest", "/paid-dashboard");
        log.info("Resume approved: requestId={} by admin={}", requestId, adminUserId);
        return saved;
    }

    /**
     * Rejects a candidate's uploaded resume.
     * Sets REJECTED status, deletes the file from Cloudinary, resets the profile's resume fields,
     * and notifies the candidate with the provided reason.
     */
    public ResumeApprovalRequest rejectResumeRequest(String adminUserId, String requestId, String note) {
        ResumeApprovalRequest req = resumeApprovalRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("ResumeApprovalRequest", requestId));

        if (req.getStatus() != ChangeRequestStatus.PENDING) {
            throw new BusinessException("ALREADY_REVIEWED", "This resume request has already been reviewed.");
        }

        req.setStatus(ChangeRequestStatus.REJECTED);
        req.setReviewedByAdminId(adminUserId);
        req.setReviewNote(note);
        req.setReviewedAt(Instant.now());

        // Remove the rejected resume from storage and clear profile fields
        candidateProfileRepository.findByUserId(req.getCandidateUserId()).ifPresent(profile -> {
            if (req.getCloudinaryPublicId().equals(profile.getResumeCloudinaryPublicId())) {
                fileStorageService.deleteFile(req.getCloudinaryPublicId());
                profile.setResumeCloudinaryPublicId(null);
                profile.setResumeOriginalFilename(null);
                profile.setResumeMimeType(null);
                profile.setResumeFileSizeBytes(0);
                profile.setResumeUploadedAt(null);
                profile.setResumeApprovalStatus(ChangeRequestStatus.REJECTED);
                candidateProfileRepository.save(profile);
            }
        });
        // Drop the rejected version from the history (promotes an approved older
        // version back to active when one exists)
        resumeManagementService.removeRejectedVersion(req.getCandidateUserId(),
                req.getCloudinaryPublicId());

        ResumeApprovalRequest saved = resumeApprovalRequestRepository.save(req);
        auditService.log(adminUserId, "CLIENT_ADMIN", "ResumeApprovalRequest", requestId,
                "RESUME_REJECTED", Map.of("candidateUserId", req.getCandidateUserId(),
                        "reason", note != null ? note : ""));
        notificationService.notify(req.getCandidateUserId(), "Resume Rejected",
                "Your uploaded resume was not approved."
                        + (note != null && !note.isBlank() ? " Reason: " + note : ""),
                "RESUME_REJECTED", requestId, "ResumeApprovalRequest", "/paid-dashboard");
        log.info("Resume rejected: requestId={} by admin={}", requestId, adminUserId);
        return saved;
    }

    public Page<com.euodoo.hire.model.AuditLog> getAuditLogs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());
        return auditLogRepository.findAll(pageable);
    }

    public User setRecruiterActive(String adminUserId, String recruiterUserId, boolean active) {
        User user = getUserAsRole(recruiterUserId, Role.RECRUITER);
        user.setAccountStatus(active ? AccountStatus.ACTIVE : AccountStatus.DISABLED);
        User saved = userRepository.save(user);
        auditService.log(adminUserId, "CLIENT_ADMIN", "User", recruiterUserId,
                active ? "RECRUITER_ACTIVATED" : "RECRUITER_DEACTIVATED", null);
        return saved;
    }

    private User getUserAsRole(String userId, Role expectedRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (user.getRole() != expectedRole) {
            throw new BusinessException("ROLE_MISMATCH",
                    "User is not a " + expectedRole.name() + ".");
        }
        return user;
    }

    private void assertNotAlreadyProcessed(AccountStatus status, String entityType) {
        if (status == AccountStatus.ACTIVE || status == AccountStatus.REJECTED) {
            throw new BusinessException("ALREADY_PROCESSED",
                    "This " + entityType + " has already been processed.");
        }
    }
    /**
     * H5 FIX: Allows an admin to generate a secure download URL for any candidate's resume.
     * Used for resume approval review. Access is restricted to CLIENT_ADMIN at the controller layer.
     *
     * @param adminEmail   email of the admin requesting the URL (for audit logging)
     * @param candidateUserId the candidate whose resume URL is requested
     * @return a short-lived signed URL from Cloudinary
     */
    public String getCandidateResumeSecureUrl(String adminEmail, String candidateUserId) {
        CandidateProfile profile = candidateProfileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("CandidateProfile for user", candidateUserId));
        if (profile.getResumeCloudinaryPublicId() == null) {
            throw new ResourceNotFoundException("No resume uploaded for candidate", candidateUserId);
        }
        auditService.log(adminEmail, "CLIENT_ADMIN", "CandidateProfile", profile.getId(),
                "ADMIN_RESUME_VIEWED", Map.of("candidateUserId", candidateUserId));
        return fileStorageService.getSecureUrl(profile.getResumeCloudinaryPublicId(), profile.getResumeMimeType());
    }

    // ─────────────────────────────────────────────────
    // Admin Job Management
    // ─────────────────────────────────────────────────

    /**
     * Returns all jobs in the system (single-tenant). Enriches each with
     * application count, company name and creator/modifier names.
     */
    public List<Map<String, Object>> getAllJobsForAdmin() {
        List<Job> jobs = jobRepository.findAll();
        jobs.sort(java.util.Comparator.comparing(Job::getCreatedAt,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())).reversed());

        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Job j : jobs) {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", j.getId());
            m.put("title", j.getTitle());
            m.put("description", j.getDescription() != null ? j.getDescription() : "");
            m.put("responsibilities", j.getResponsibilities());
            m.put("companyId", j.getCompanyId());
            m.put("location", j.getLocation() != null ? j.getLocation() : "");
            m.put("country", j.getCountry());
            m.put("city", j.getCity());
            m.put("salaryCurrency", j.getSalaryCurrency() != null ? j.getSalaryCurrency() : "INR");
            m.put("workMode", j.getWorkMode() != null ? j.getWorkMode().name() : "WFO");
            m.put("employmentType", j.getEmploymentType() != null ? j.getEmploymentType() : "");
            m.put("techStack", j.getTechStack() != null ? j.getTechStack() : java.util.List.of());
            m.put("preferredSkills", j.getPreferredSkills() != null ? j.getPreferredSkills() : java.util.List.of());
            m.put("certifications", j.getCertifications() != null ? j.getCertifications() : java.util.List.of());
            m.put("minExperienceYears", j.getMinExperienceYears());
            m.put("maxExperienceYears", j.getMaxExperienceYears());
            m.put("minSalaryInr", j.getMinSalaryInr());
            m.put("maxSalaryInr", j.getMaxSalaryInr());
            m.put("numberOfVacancies", j.getNumberOfVacancies());
            m.put("educationRequirements", j.getEducationRequirements());
            m.put("additionalRequirements", j.getAdditionalRequirements());
            m.put("applicationDeadline", j.getApplicationDeadline());
            m.put("status", j.getStatus() != null ? j.getStatus().name() : "DRAFT");
            m.put("publishedAt", j.getPublishedAt());
            m.put("deactivatedAt", j.getDeactivatedAt());
            m.put("closedAt", j.getClosedAt());
            m.put("createdAt", j.getCreatedAt());
            m.put("updatedAt", j.getUpdatedAt());
            m.put("recruiterUserId", j.getRecruiterUserId());
            // Jobs saved before creator tracking fall back to the owning recruiter
            String creatorId = j.getCreatorUserId() != null ? j.getCreatorUserId() : j.getRecruiterUserId();
            m.put("creatorUserId", creatorId);
            m.put("creatorRole", j.getCreatorRole() != null ? j.getCreatorRole() : "");
            m.put("lastModifiedByUserId", j.getLastModifiedByUserId());
            m.put("lastModifiedByRole", j.getLastModifiedByRole() != null ? j.getLastModifiedByRole() : "");

            // Creator name (and role, when the job predates creator tracking)
            if (creatorId != null) {
                userRepository.findById(creatorId).ifPresent(u -> {
                    m.put("creatorName", u.getName());
                    if (j.getCreatorRole() == null || j.getCreatorRole().isBlank()) {
                        m.put("creatorRole", u.getRole().name());
                    }
                });
            }
            if (!m.containsKey("creatorName")) m.put("creatorName", "—");

            // Last modifier name
            if (j.getLastModifiedByUserId() != null) {
                userRepository.findById(j.getLastModifiedByUserId())
                        .ifPresent(u -> m.put("lastModifiedByName", u.getName()));
            }
            if (!m.containsKey("lastModifiedByName")) m.put("lastModifiedByName", "—");

            // Recruiter name (may differ from creator if admin created)
            if (j.getRecruiterUserId() != null) {
                userRepository.findById(j.getRecruiterUserId())
                        .ifPresent(u -> m.put("recruiterName", u.getName()));
            }
            if (!m.containsKey("recruiterName")) m.put("recruiterName", "—");

            // Company name
            if (j.getCompanyId() != null) {
                companyRepository.findById(j.getCompanyId())
                        .ifPresent(c -> m.put("companyName", c.getName()));
            }
            if (!m.containsKey("companyName")) m.put("companyName", "—");

            // Application count
            m.put("applicationCount", jobApplicationRepository.countByJobId(j.getId()));
            result.add(m);
        }
        return result;
    }

    /**
     * Admin creates a job. Creator identity is set to the admin's user ID and role CLIENT_ADMIN.
     * recruiterUserId is left null (admin-owned job) unless explicitly provided.
     */
    public Job createJobAsAdmin(String adminUserId, Map<String, Object> fields) {
        String companyId = (String) fields.get("companyId");
        if ((companyId == null || companyId.isBlank()) && fields.get("companyName") != null) {
            String companyNameInput = String.valueOf(fields.get("companyName")).trim();
            companyId = companyRepository.findAll().stream()
                    .filter(c -> c.getName() != null && c.getName().equalsIgnoreCase(companyNameInput))
                    .map(Company::getId)
                    .findFirst()
                    .orElse(null);
        }

        JobStatus initialStatus = JobStatus.DRAFT;
        if (fields.containsKey("status")) {
            String s = String.valueOf(fields.get("status")).toUpperCase();
            if ("ACTIVE".equals(s) || "PUBLISHED".equals(s)) initialStatus = JobStatus.ACTIVE;
            else if ("CLOSED".equals(s)) initialStatus = JobStatus.CLOSED;
        }

        Job job = Job.builder()
                .title((String) fields.get("title"))
                .description((String) fields.get("description"))
                .responsibilities((String) fields.get("responsibilities"))
                .companyId(companyId)
                .recruiterUserId(adminUserId) // admin acts as the owner for management purposes
                .creatorUserId(adminUserId)
                .creatorRole("CLIENT_ADMIN")
                .lastModifiedByUserId(adminUserId)
                .lastModifiedByRole("CLIENT_ADMIN")
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

        applyListFields(job, fields);

        if (fields.containsKey("minExperienceYears") && fields.get("minExperienceYears") != null)
            job.setMinExperienceYears(((Number) fields.get("minExperienceYears")).intValue());
        if (fields.containsKey("maxExperienceYears") && fields.get("maxExperienceYears") != null)
            job.setMaxExperienceYears(((Number) fields.get("maxExperienceYears")).intValue());
        if (fields.containsKey("minSalaryInr") && fields.get("minSalaryInr") != null)
            job.setMinSalaryInr(((Number) fields.get("minSalaryInr")).longValue());
        if (fields.containsKey("maxSalaryInr") && fields.get("maxSalaryInr") != null)
            job.setMaxSalaryInr(((Number) fields.get("maxSalaryInr")).longValue());
        if (fields.containsKey("numberOfVacancies") && fields.get("numberOfVacancies") != null)
            job.setNumberOfVacancies(((Number) fields.get("numberOfVacancies")).intValue());
        if (fields.containsKey("applicationDeadline"))
            job.setApplicationDeadline(parseInstant(fields.get("applicationDeadline")));

        Job saved = jobRepository.save(job);
        auditService.log(adminUserId, "CLIENT_ADMIN", "Job", saved.getId(), "JOB_CREATED",
                Map.of("title", saved.getTitle(), "status", saved.getStatus().name()));
        log.info("Admin [{}] created job [{}]", adminUserId, saved.getId());
        return saved;
    }

    /**
     * Admin updates any job. Original creatorUserId / creatorRole are NEVER overwritten.
     * Notifies the recruiter who owns the job if it was created by a recruiter.
     */
    public Job updateJobAsAdmin(String adminUserId, String jobId, Map<String, Object> fields) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));

        RecruiterService.applyJobFieldUpdates(job, fields);
        job.setLastModifiedByUserId(adminUserId);
        job.setLastModifiedByRole("CLIENT_ADMIN");

        Job saved = jobRepository.save(job);
        auditService.log(adminUserId, "CLIENT_ADMIN", "Job", saved.getId(), "JOB_UPDATED",
                Map.of("title", saved.getTitle()));

        // Notify recruiter if admin edited their job
        if (saved.getRecruiterUserId() != null && !adminUserId.equals(saved.getRecruiterUserId())) {
            notificationService.notify(saved.getRecruiterUserId(), "Job Updated by Admin",
                    "Your job posting \"" + saved.getTitle() + "\" has been updated by the admin.",
                    "JOB_UPDATED_BY_ADMIN", saved.getId(), "Job", "/recruiter");
        }
        return saved;
    }

    /**
     * Admin activates any job (ACTIVE).
     */
    public Job activateJobAsAdmin(String adminUserId, String jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
        if (job.getStatus() == JobStatus.CLOSED) {
            throw new BusinessException("JOB_CLOSED", "A closed job cannot be re-activated.");
        }
        job.setStatus(JobStatus.ACTIVE);
        if (job.getPublishedAt() == null) job.setPublishedAt(Instant.now());
        job.setLastModifiedByUserId(adminUserId);
        job.setLastModifiedByRole("CLIENT_ADMIN");
        Job saved = jobRepository.save(job);
        auditService.log(adminUserId, "CLIENT_ADMIN", "Job", saved.getId(), "JOB_ACTIVATED", Map.of("title", saved.getTitle()));
        notifyRecruiterOnJobAction(saved, adminUserId, "activated", "JOB_ACTIVATED_BY_ADMIN");
        return saved;
    }

    /**
     * Admin deactivates any job (INACTIVE — temporarily hidden from candidates).
     */
    public Job deactivateJobAsAdmin(String adminUserId, String jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
        if (job.getStatus() == JobStatus.CLOSED) {
            throw new BusinessException("JOB_CLOSED", "A closed job cannot be deactivated; it is already closed.");
        }
        job.setStatus(JobStatus.INACTIVE);
        if (job.getDeactivatedAt() == null) job.setDeactivatedAt(Instant.now());
        job.setLastModifiedByUserId(adminUserId);
        job.setLastModifiedByRole("CLIENT_ADMIN");
        Job saved = jobRepository.save(job);
        auditService.log(adminUserId, "CLIENT_ADMIN", "Job", saved.getId(), "JOB_DEACTIVATED", Map.of("title", saved.getTitle()));
        notifyRecruiterOnJobAction(saved, adminUserId, "deactivated", "JOB_DEACTIVATED_BY_ADMIN");
        return saved;
    }

    /**
     * Admin permanently closes any job (CLOSED — cannot be re-published).
     */
    public Job closeJobAsAdmin(String adminUserId, String jobId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
        job.setStatus(JobStatus.CLOSED);
        if (job.getClosedAt() == null) job.setClosedAt(Instant.now());
        job.setLastModifiedByUserId(adminUserId);
        job.setLastModifiedByRole("CLIENT_ADMIN");
        Job saved = jobRepository.save(job);
        auditService.log(adminUserId, "CLIENT_ADMIN", "Job", saved.getId(), "JOB_CLOSED", Map.of("title", saved.getTitle()));
        notifyRecruiterOnJobAction(saved, adminUserId, "closed", "JOB_CLOSED_BY_ADMIN");
        return saved;
    }

    // ─── Private helpers ────────────────────────────────
    private void notifyRecruiterOnJobAction(Job job, String adminUserId, String action, String eventType) {
        if (job.getRecruiterUserId() != null && !adminUserId.equals(job.getRecruiterUserId())) {
            notificationService.notify(job.getRecruiterUserId(),
                    "Job " + capitalize(action) + " by Admin",
                    "Your job posting \"" + job.getTitle() + "\" has been " + action + " by the admin.",
                    eventType, job.getId(), "Job", "/recruiter");
        }
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    @SuppressWarnings("unchecked")
    private void applyListFields(Job job, Map<String, Object> fields) {
        if (fields.containsKey("techStack"))
            job.setTechStack((java.util.List<String>) fields.get("techStack"));
        if (fields.containsKey("preferredSkills"))
            job.setPreferredSkills((java.util.List<String>) fields.get("preferredSkills"));
        if (fields.containsKey("certifications"))
            job.setCertifications((java.util.List<String>) fields.get("certifications"));
    }

    private Instant parseInstant(Object val) {
        if (val == null) return null;
        if (val instanceof Instant inst) return inst;
        if (val instanceof String str && !str.isBlank()) {
            try { return Instant.parse(str.trim()); } catch (Exception e) {
                try { return java.time.LocalDate.parse(str.trim())
                        .atStartOfDay(java.time.ZoneOffset.UTC).toInstant(); } catch (Exception ignored) {}
            }
        }
        return null;
    }
}

