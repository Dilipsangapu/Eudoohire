package com.euodoo.hire.controller;

import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregated data REST API for the Client Admin Thymeleaf dashboard.
 * All endpoints return JSON consumed by admin.js running in the browser.
 */
@RestController
@RequestMapping("/api/admin/data")
@RequiredArgsConstructor
@PreAuthorize("hasRole('CLIENT_ADMIN')")
public class AdminDataController {

    private final UserRepository userRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CompanyRepository companyRepository;
    private final HiringRequestRepository hiringRequestRepository;
    private final PortfolioChangeRequestRepository portfolioChangeRequestRepository;
    private final ResumeApprovalRequestRepository resumeApprovalRequestRepository;
    private final JobRepository jobRepository;
    private final com.euodoo.hire.service.NotificationService notificationService;
    private final com.euodoo.hire.service.ClientAdminService clientAdminService;
    private final com.euodoo.hire.service.FileStorageService fileStorageService;
    private final com.euodoo.hire.service.SubscriptionService subscriptionService;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy").withZone(ZoneId.systemDefault());

    // ─────────────────────────────────────────────────
    // Registrations (all users ordered by newest first)
    // ─────────────────────────────────────────────────
    @GetMapping("/registrations")
    public ResponseEntity<List<Map<String, Object>>> registrations() {
        List<User> users = userRepository.findAll();
        users.sort(Comparator.comparing(u -> u.getCreatedAt() == null ? "" : u.getCreatedAt().toString(), Comparator.reverseOrder()));

        List<Map<String, Object>> result = users.stream()
                .filter(u -> u.getRole() == Role.CANDIDATE || u.getRole() == Role.RECRUITER)
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("name", u.getName());
                    m.put("email", u.getEmail());
                    m.put("type", u.getRole() == Role.CANDIDATE ? "Candidate" : "Recruiter");
                    m.put("registered", u.getCreatedAt() != null ? DATE_FMT.format(u.getCreatedAt()) : "—");
                    if (u.getRole() == Role.RECRUITER) {
                        boolean subActive = subscriptionService.hasActiveRecruiterSubscription(u.getId());
                        m.put("plan", subActive ? "Recruiter Pro" : "Recruiter (No sub)");
                        m.put("payment", subActive ? "Paid" : "Unpaid");
                    } else {
                        m.put("plan", u.getPlan() != null ? titleCase(u.getPlan().name()) : "Free");
                        m.put("payment", u.isPlanActivated() ? "Paid" : (u.getPlan() != null && u.getPlan() != PlanType.FREE ? "Paid" : "Unpaid"));
                    }
                    m.put("status", titleCase(u.getAccountStatus().name().replace("_", " ")));
                    return m;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────
    // Recruiters
    // ─────────────────────────────────────────────────
    @GetMapping("/recruiters")
    public ResponseEntity<List<Map<String, Object>>> recruiters() {
        List<User> recruiters = userRepository.findByRole(Role.RECRUITER);
        List<Map<String, Object>> result = recruiters.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("name", u.getName());
            m.put("email", u.getEmail());
            m.put("registered", u.getCreatedAt() != null ? DATE_FMT.format(u.getCreatedAt()) : "—");
            m.put("status", titleCase(u.getAccountStatus().name().replace("_", " ")));
            boolean subActive = subscriptionService.hasActiveRecruiterSubscription(u.getId());
            m.put("payment", subActive ? "Paid" : "Unpaid");
            m.put("subscriptionActive", subActive);

            recruiterProfileRepository.findByUserId(u.getId()).ifPresent(p -> {
                m.put("designation", p.getDesignation() != null ? p.getDesignation() : "—");
                m.put("approvalStatus", titleCase(p.getApprovalStatus().name()));
                if (p.getCompanyId() != null) {
                    companyRepository.findById(p.getCompanyId()).ifPresent(c -> {
                        m.put("company", c.getName());
                        m.put("companyVerification", p.getApprovalStatus() == ApprovalStatus.APPROVED ? "Verified" : "Verification required");
                    });
                }
            });
            if (!m.containsKey("company")) m.put("company", "—");
            if (!m.containsKey("companyVerification")) m.put("companyVerification", "Verification required");
            if (!m.containsKey("approvalStatus")) m.put("approvalStatus", "Pending");
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────
    // Candidates
    // ─────────────────────────────────────────────────
    @GetMapping("/candidates")
    public ResponseEntity<List<Map<String, Object>>> candidates() {
        List<User> candidates = userRepository.findByRole(Role.CANDIDATE);
        List<Map<String, Object>> result = candidates.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("name", u.getName());
            m.put("email", u.getEmail());
            m.put("registered", u.getCreatedAt() != null ? DATE_FMT.format(u.getCreatedAt()) : "—");
            m.put("plan", u.getPlan() != null ? titleCase(u.getPlan().name()) : "Free");
            m.put("status", titleCase(u.getAccountStatus().name().replace("_", " ")));
            m.put("payment", u.isPlanActivated() ? "Paid" : (u.getPlan() != null && u.getPlan() != PlanType.FREE ? "Paid" : "Unpaid"));
            Map<String, Object> subStatus = subscriptionService.getSubscriptionStatus(u.getId());
            m.put("subscriptionActive", Boolean.TRUE.equals(subStatus.get("active")));
            m.put("hasSubscription", Boolean.TRUE.equals(subStatus.get("hasSubscription")));
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────
    // Companies
    // ─────────────────────────────────────────────────
    @GetMapping("/companies")
    public ResponseEntity<List<Map<String, Object>>> companies() {
        List<Company> companies = companyRepository.findAll();
        List<Map<String, Object>> result = companies.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            m.put("industry", c.getIndustry() != null ? c.getIndustry() : "—");
            m.put("headquarters", c.getHeadquarters() != null ? c.getHeadquarters() : "—");
            m.put("verification", c.getApprovalStatus() == ApprovalStatus.APPROVED ? "Verified" : "Verification required");
            m.put("status", c.getApprovalStatus() == ApprovalStatus.APPROVED ? "Active" : "Pending");
            long recCount = recruiterProfileRepository.findByCompanyId(c.getId()).size();
            long jobCount = jobRepository.findAll().stream().filter(j -> c.getId().equals(j.getCompanyId())).count();
            m.put("recruiterCount", recCount);
            m.put("jobCount", jobCount);
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────
    // Hire Matches (Hiring Requests)
    // ─────────────────────────────────────────────────
    @GetMapping("/hire-matches")
    public ResponseEntity<List<Map<String, Object>>> hireMatches() {
        List<HiringRequest> requests = hiringRequestRepository.findAll();
        List<Map<String, Object>> result = requests.stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", h.getId());
            m.put("requested", h.getCreatedAt() != null ? DATE_FMT.format(h.getCreatedAt()) : "—");
            m.put("approval", titleCase(h.getApprovalStatus().name()));
            m.put("payment", titleCase(h.getPaymentStatus().name().replace("_", " ")));
            m.put("candidateReleased", h.isCandidateReleased());

            userRepository.findById(h.getCandidateUserId()).ifPresent(c -> {
                m.put("candidateName", c.getName());
                m.put("candidateEmail", c.getEmail());
            });
            userRepository.findById(h.getRecruiterUserId()).ifPresent(r -> {
                m.put("recruiterName", r.getName());
                m.put("recruiterEmail", r.getEmail());
            });
            if (h.getCompanyId() != null) {
                companyRepository.findById(h.getCompanyId()).ifPresent(c -> m.put("company", c.getName()));
            }
            if (!m.containsKey("candidateName")) m.put("candidateName", "—");
            if (!m.containsKey("recruiterName")) m.put("recruiterName", "—");
            if (!m.containsKey("company")) m.put("company", "—");
            m.put("fee", h.getCalculatedHiringFeeInr() != null ? "₹" + h.getCalculatedHiringFeeInr().toPlainString() : "—");
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────
    // Portfolio Change Requests
    // ─────────────────────────────────────────────────
    @GetMapping("/portfolio-requests")
    public ResponseEntity<List<Map<String, Object>>> portfolioRequests() {
        List<PortfolioChangeRequest> requests = portfolioChangeRequestRepository.findAll();
        requests.sort(Comparator.comparing(
                r -> r.getCreatedAt() == null ? "" : r.getCreatedAt().toString(),
                Comparator.reverseOrder()));
        List<Map<String, Object>> result = requests.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("title", r.getTitle() != null && !r.getTitle().isBlank()
                    ? r.getTitle() : "Portfolio change");
            m.put("date", r.getCreatedAt() != null ? DATE_FMT.format(r.getCreatedAt()) : "—");
            m.put("submittedAt", r.getCreatedAt());
            m.put("reviewedAt", r.getReviewedAt());
            m.put("status", r.getStatus() != null ? titleCase(r.getStatus().name()) : "Pending");
            m.put("reviewNote", r.getReviewNote() != null ? r.getReviewNote() : "");
            m.put("proposedChanges", r.getProposedChangesJson() != null ? r.getProposedChangesJson() : "[]");
            m.put("previousChanges", r.getPreviousChangesJson() != null ? r.getPreviousChangesJson() : "[]");
            userRepository.findById(r.getCandidateUserId()).ifPresent(u -> {
                m.put("candidateName", u.getName());
                m.put("candidateEmail", u.getEmail());
            });
            if (!m.containsKey("candidateName")) m.put("candidateName", "—");
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────
    // Resume Approval Requests
    // ─────────────────────────────────────────────────
    @GetMapping("/resume-requests")
    public ResponseEntity<List<Map<String, Object>>> resumeRequests() {
        List<ResumeApprovalRequest> requests = resumeApprovalRequestRepository.findAllByOrderByCreatedAtDesc();
        List<Map<String, Object>> result = requests.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("date", r.getCreatedAt() != null ? DATE_FMT.format(r.getCreatedAt()) : "—");
            m.put("submittedAt", r.getCreatedAt());
            m.put("reviewedAt", r.getReviewedAt());
            m.put("status", r.getStatus() != null ? titleCase(r.getStatus().name()) : "Pending");
            m.put("filename", r.getOriginalFilename() != null ? r.getOriginalFilename() : "—");
            m.put("reviewNote", r.getReviewNote() != null ? r.getReviewNote() : "");
            long kb = r.getFileSizeBytes() / 1024;
            m.put("fileSize", kb > 0 ? kb + " KB" : "—");
            m.put("resumeVersion", r.getResumeVersion() != null ? "v" + r.getResumeVersion() : "—");
            m.put("changeType", ResumeApprovalRequest.CHANGE_UPDATE.equals(r.getChangeType())
                    ? "Replacement" : "New upload");
            m.put("previousVersion", r.getPreviousResumeVersion() != null
                    ? "v" + r.getPreviousResumeVersion() : "—");
            m.put("previousFilename", r.getPreviousFilename() != null ? r.getPreviousFilename() : "");
            m.put("hasFile", r.getCloudinaryPublicId() != null && !r.getCloudinaryPublicId().isBlank());
            userRepository.findById(r.getCandidateUserId()).ifPresent(u -> {
                m.put("candidateName", u.getName());
                m.put("candidateEmail", u.getEmail());
            });
            if (!m.containsKey("candidateName")) m.put("candidateName", "—");
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * Streams the file submitted with a resume change request so a reviewer can
     * inspect exactly what was submitted. Bytes come from the same storage the
     * candidate uploaded to; the storage id is never returned to the browser.
     */
    @GetMapping("/resume-requests/{id}/file")
    public ResponseEntity<byte[]> resumeRequestFile(
            @PathVariable String id,
            @RequestParam(value = "download", required = false, defaultValue = "false") boolean download) {
        ResumeApprovalRequest request = resumeApprovalRequestRepository.findById(id)
                .orElseThrow(() -> new com.euodoo.hire.exception.ResourceNotFoundException(
                        "ResumeApprovalRequest", id));
        if (request.getCloudinaryPublicId() == null || request.getCloudinaryPublicId().isBlank()) {
            throw new com.euodoo.hire.exception.ResourceNotFoundException(
                    "The submitted file for this request is missing.", id);
        }
        byte[] bytes = fileStorageService.fetchFile(
                request.getCloudinaryPublicId(), request.getMimeType());
        String mime = request.getMimeType() != null && !request.getMimeType().isBlank()
                ? request.getMimeType() : "application/octet-stream";
        String filename = request.getOriginalFilename() != null && !request.getOriginalFilename().isBlank()
                ? request.getOriginalFilename().replaceAll("[\\\\/\\r\\n\\t]", "_").trim()
                : "resume";
        org.springframework.http.ContentDisposition disposition = org.springframework.http.ContentDisposition
                .builder(download ? "attachment" : "inline")
                .filename(filename, java.nio.charset.StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType(mime))
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(org.springframework.http.CacheControl.noStore())
                .body(bytes);
    }

    // ─────────────────────────────────────────────────
    // Jobs — full CRUD management
    // ─────────────────────────────────────────────────

    /** List all jobs with enriched creator/modifier/application-count data. */
    @GetMapping("/jobs")
    public ResponseEntity<List<Map<String, Object>>> jobs() {
        return ResponseEntity.ok(clientAdminService.getAllJobsForAdmin());
    }

    /** Get single job detail. */
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> jobDetail(@PathVariable String jobId) {
        List<Map<String, Object>> all = clientAdminService.getAllJobsForAdmin();
        return all.stream()
                .filter(j -> jobId.equals(j.get("id")))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Admin creates a new job posting. */
    @PostMapping("/jobs")
    public ResponseEntity<com.euodoo.hire.model.Job> createJob(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        String adminUserId = resolveAdminId(principal);
        return ResponseEntity.ok(clientAdminService.createJobAsAdmin(adminUserId, body));
    }

    /** Admin edits any job — preserves original creator identity. */
    @PatchMapping("/jobs/{jobId}")
    public ResponseEntity<com.euodoo.hire.model.Job> updateJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        String adminUserId = resolveAdminId(principal);
        return ResponseEntity.ok(clientAdminService.updateJobAsAdmin(adminUserId, jobId, body));
    }

    /** Activate a job (ACTIVE). */
    @PostMapping("/jobs/{jobId}/activate")
    public ResponseEntity<Map<String, Object>> activateJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String adminUserId = resolveAdminId(principal);
        clientAdminService.activateJobAsAdmin(adminUserId, jobId);
        return ResponseEntity.ok(Map.of("message", "Job activated"));
    }

    /** Deactivate a job (INACTIVE — temporarily hidden from candidates). */
    @PostMapping("/jobs/{jobId}/deactivate")
    public ResponseEntity<Map<String, Object>> deactivateJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String adminUserId = resolveAdminId(principal);
        clientAdminService.deactivateJobAsAdmin(adminUserId, jobId);
        return ResponseEntity.ok(Map.of("message", "Job deactivated"));
    }

    /** Permanently close a job (CLOSED — cannot be re-published). */
    @PostMapping("/jobs/{jobId}/close")
    public ResponseEntity<Map<String, Object>> closeJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String adminUserId = resolveAdminId(principal);
        clientAdminService.closeJobAsAdmin(adminUserId, jobId);
        return ResponseEntity.ok(Map.of("message", "Job closed"));
    }

    // ─────────────────────────────────────────────────
    // Overview summary counts
    // ─────────────────────────────────────────────────
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary() {
        long totalRegs = userRepository.findByRole(Role.CANDIDATE).size() + userRepository.findByRole(Role.RECRUITER).size();
        long pendingRegs = userRepository.findAll().stream()
                .filter(u -> (u.getRole() == Role.CANDIDATE || u.getRole() == Role.RECRUITER)
                        && u.getAccountStatus() == AccountStatus.PENDING_APPROVAL)
                .count();
        long activeRecruiters = userRepository.findByRoleAndAccountStatus(Role.RECRUITER, AccountStatus.ACTIVE).size();
        long activeCompanies = companyRepository.findAll().stream().filter(c -> c.getApprovalStatus() == ApprovalStatus.APPROVED).count();
        long pendingHireMatches = hiringRequestRepository.findAll().stream().filter(h -> h.getApprovalStatus() == ApprovalStatus.PENDING).count();
        long pendingPortfolio = portfolioChangeRequestRepository.findAll().stream().filter(r -> r.getStatus() == ChangeRequestStatus.PENDING).count();
        long pendingResumes = resumeApprovalRequestRepository.findAll().stream().filter(r -> r.getStatus() == ChangeRequestStatus.PENDING).count();

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("regs", totalRegs);
        m.put("regPend", pendingRegs);
        m.put("rec", activeRecruiters);
        m.put("co", activeCompanies);
        m.put("hm", pendingHireMatches);
        m.put("port", pendingPortfolio);
        m.put("res", pendingResumes);
        return ResponseEntity.ok(m);
    }

    // ─────────────────────────────────────────────────
    // Approve / Reject candidate
    // ─────────────────────────────────────────────────
    @PostMapping("/candidates/{userId}/approve")
    public ResponseEntity<Map<String, Object>> approveCandidate(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails principal) {
        User u = userRepository.findById(userId).orElseThrow();
        u.setAccountStatus(AccountStatus.ACTIVE);
        u.setReviewedByAdminId(resolveAdminId(principal));
        userRepository.save(u);
        candidateProfileRepository.findByUserId(userId).ifPresent(p -> {
            p.setProfileApprovalStatus(ApprovalStatus.APPROVED);
            candidateProfileRepository.save(p);
        });
        notificationService.notify(userId, "Account Approved",
                "Your candidate account has been approved by the administrator. Welcome to the platform!",
                "ACCOUNT_APPROVED", userId, "User", "/dashboard");
        return ResponseEntity.ok(Map.of("message", "Candidate approved"));
    }

    @PostMapping("/candidates/{userId}/reject")
    public ResponseEntity<Map<String, Object>> rejectCandidate(
            @PathVariable String userId,
            @RequestParam(required = false, defaultValue = "Rejected by admin") String reason,
            @AuthenticationPrincipal UserDetails principal) {
        User u = userRepository.findById(userId).orElseThrow();
        u.setAccountStatus(AccountStatus.REJECTED);
        u.setRejectionReason(reason);
        u.setReviewedByAdminId(resolveAdminId(principal));
        userRepository.save(u);
        notificationService.notify(userId, "Account Status Update",
                "Your candidate registration was not approved. Reason: " + reason,
                "ACCOUNT_REJECTED", userId, "User", "/dashboard");
        return ResponseEntity.ok(Map.of("message", "Candidate rejected"));
    }

    // ─────────────────────────────────────────────────
    // Approve / Reject recruiter
    // ─────────────────────────────────────────────────
    @PostMapping("/recruiters/{userId}/approve")
    public ResponseEntity<Map<String, Object>> approveRecruiter(
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails principal) {
        User u = userRepository.findById(userId).orElseThrow();
        u.setAccountStatus(AccountStatus.ACTIVE);
        u.setReviewedByAdminId(resolveAdminId(principal));
        userRepository.save(u);
        recruiterProfileRepository.findByUserId(userId).ifPresent(p -> {
            p.setApprovalStatus(ApprovalStatus.APPROVED);
            recruiterProfileRepository.save(p);
        });
        notificationService.notify(userId, "Recruiter Account Approved",
                "Your recruiter account has been verified and approved by the administrator.",
                "ACCOUNT_APPROVED", userId, "User", "/recruiter");
        return ResponseEntity.ok(Map.of("message", "Recruiter approved"));
    }

    @PostMapping("/recruiters/{userId}/reject")
    public ResponseEntity<Map<String, Object>> rejectRecruiter(
            @PathVariable String userId,
            @RequestParam(required = false, defaultValue = "Rejected by admin") String reason,
            @AuthenticationPrincipal UserDetails principal) {
        User u = userRepository.findById(userId).orElseThrow();
        u.setAccountStatus(AccountStatus.REJECTED);
        u.setRejectionReason(reason);
        u.setReviewedByAdminId(resolveAdminId(principal));
        userRepository.save(u);
        notificationService.notify(userId, "Account Status Update",
                "Your recruiter account was not approved. Reason: " + reason,
                "ACCOUNT_REJECTED", userId, "User", "/recruiter");
        return ResponseEntity.ok(Map.of("message", "Recruiter rejected"));
    }

    // ─────────────────────────────────────────────────
    // Approve / Reject company
    // ─────────────────────────────────────────────────
    @PostMapping("/companies/{companyId}/approve")
    public ResponseEntity<Map<String, Object>> approveCompany(@PathVariable String companyId) {
        Company c = companyRepository.findById(companyId).orElseThrow();
        c.setApprovalStatus(ApprovalStatus.APPROVED);
        companyRepository.save(c);
        if (c.getAuthorizedRecruiterIds() != null) {
            for (String recId : c.getAuthorizedRecruiterIds()) {
                notificationService.notify(recId, "Company Verified",
                        "Company profile for '" + c.getName() + "' has been approved.",
                        "COMPANY_APPROVED", c.getId(), "Company", "/recruiter");
            }
        }
        return ResponseEntity.ok(Map.of("message", "Company verified"));
    }

    @PostMapping("/companies/{companyId}/reject")
    public ResponseEntity<Map<String, Object>> rejectCompany(
            @PathVariable String companyId,
            @RequestParam(required = false, defaultValue = "Rejected by admin") String reason) {
        Company c = companyRepository.findById(companyId).orElseThrow();
        c.setApprovalStatus(ApprovalStatus.REJECTED);
        c.setRejectionReason(reason);
        companyRepository.save(c);
        if (c.getAuthorizedRecruiterIds() != null) {
            for (String recId : c.getAuthorizedRecruiterIds()) {
                notificationService.notify(recId, "Company Status Update",
                        "Company profile for '" + c.getName() + "' was rejected. Reason: " + reason,
                        "COMPANY_REJECTED", c.getId(), "Company", "/recruiter");
            }
        }
        return ResponseEntity.ok(Map.of("message", "Company rejected"));
    }

    // ─────────────────────────────────────────────────
    // Approve / Reject hire match
    // ─────────────────────────────────────────────────
    @PostMapping("/hire-matches/{id}/approve")
    public ResponseEntity<Map<String, Object>> approveHireMatch(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails principal) {
        HiringRequest h = hiringRequestRepository.findById(id).orElseThrow();
        h.setApprovalStatus(ApprovalStatus.APPROVED);
        h.setApprovedByAdminId(resolveAdminId(principal));
        hiringRequestRepository.save(h);
        notificationService.notify(h.getCandidateUserId(), "Hire Match Approved",
                "Admin has approved the hiring request for your application! Contact details will be unlocked shortly.",
                "HIRE_APPROVED", h.getId(), "HiringRequest", "/paid-dashboard");
        notificationService.notify(h.getRecruiterUserId(), "Hire Match Approved",
                "Admin has approved your hiring request. You can now proceed with candidate release.",
                "HIRE_APPROVED", h.getId(), "HiringRequest", "/recruiter");
        return ResponseEntity.ok(Map.of("message", "Hire match approved"));
    }

    @PostMapping("/hire-matches/{id}/release")
    public ResponseEntity<Map<String, Object>> releaseCandidate(@PathVariable String id) {
        HiringRequest h = hiringRequestRepository.findById(id).orElseThrow();
        h.setCandidateReleased(true);
        hiringRequestRepository.save(h);
        notificationService.notify(h.getCandidateUserId(), "Candidate Profile Released",
                "Admin has released your profile for direct recruiter contact. Expect to hear from the recruiter soon!",
                "CANDIDATE_RELEASED", h.getId(), "HiringRequest", "/paid-dashboard");
        notificationService.notify(h.getRecruiterUserId(), "Candidate Contact Unlocked",
                "Admin has released candidate profile. Candidate phone number and full contact details are now visible.",
                "CANDIDATE_RELEASED", h.getId(), "HiringRequest", "/recruiter");
        return ResponseEntity.ok(Map.of("message", "Candidate released"));
    }

    // ─────────────────────────────────────────────────
    // Approve / Reject portfolio change request
    // (delegates to ClientAdminService — single source of truth)
    // ─────────────────────────────────────────────────
    @PostMapping("/portfolio-requests/{id}/approve")
    public ResponseEntity<Map<String, Object>> approvePortfolio(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails principal) {
        clientAdminService.approveChangeRequest(adminIdentity(principal), id);
        return ResponseEntity.ok(Map.of("message", "Portfolio change approved"));
    }

    @PostMapping("/portfolio-requests/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectPortfolio(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "") String note,
            @AuthenticationPrincipal UserDetails principal) {
        clientAdminService.rejectChangeRequest(adminIdentity(principal), id, note);
        return ResponseEntity.ok(Map.of("message", "Portfolio change rejected"));
    }

    // ─────────────────────────────────────────────────
    // Approve / Reject resume request
    // (delegates to ClientAdminService so the approved version, the profile
    //  mirror, notifications and audit trail all follow the real workflow)
    // ─────────────────────────────────────────────────
    @PostMapping("/resume-requests/{id}/approve")
    public ResponseEntity<Map<String, Object>> approveResume(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails principal) {
        clientAdminService.approveResumeRequest(adminIdentity(principal), id);
        return ResponseEntity.ok(Map.of("message", "Resume approved"));
    }

    @PostMapping("/resume-requests/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectResume(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "") String note,
            @AuthenticationPrincipal UserDetails principal) {
        clientAdminService.rejectResumeRequest(adminIdentity(principal), id, note);
        return ResponseEntity.ok(Map.of("message", "Resume rejected"));
    }

    // ─────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────
    private String titleCase(String s) {
        if (s == null || s.isBlank()) return "—";
        String lower = s.toLowerCase().replace("_", " ");
        String[] words = lower.split(" ");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1)).append(" ");
            }
        }
        return sb.toString().trim();
    }

    /** Reviewer identity for the approval workflow — always the authenticated principal. */
    private String adminIdentity(UserDetails principal) {
        return principal != null ? principal.getUsername() : "unknown";
    }

    private String resolveAdminId(UserDetails principal) {
        if (principal == null) return "unknown";
        return userRepository.findByEmail(principal.getUsername())
                .map(User::getId).orElse("unknown");
    }

    // ─────────────────────────────────────────────────
    // Subscriptions (admin view)
    // ─────────────────────────────────────────────────

    /**
     * List all subscriptions for admin overview (newest first, paginated).
     */
    @GetMapping("/subscriptions")
    public ResponseEntity<List<Map<String, Object>>> subscriptions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        return ResponseEntity.ok(subscriptionService.listAllSubscriptions(page, size));
    }

    /**
     * Get subscription status for a specific user.
     */
    @GetMapping("/subscriptions/user/{userId}")
    public ResponseEntity<Map<String, Object>> userSubscription(@PathVariable String userId) {
        return ResponseEntity.ok(subscriptionService.getSubscriptionStatusForAdmin(userId));
    }
}
