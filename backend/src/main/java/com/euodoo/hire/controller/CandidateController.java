package com.euodoo.hire.controller;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.service.CertificationService;
import com.euodoo.hire.service.FileStorageService;
import com.euodoo.hire.service.AtsService;
import com.euodoo.hire.service.CandidateService;
import com.euodoo.hire.service.JobService;
import com.euodoo.hire.service.NotificationService;
import com.euodoo.hire.service.PortfolioService;
import com.euodoo.hire.service.RecruiterActivityService;
import com.euodoo.hire.service.ResumeManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Handles both MVC view mappings (Thymeleaf, future) and REST API endpoints
 * for authenticated candidates.
 *
 * All endpoints require ROLE_CANDIDATE. Plan checks are performed server-side
 * in CandidateService. URL manipulation cannot bypass plan restrictions.
 */
@Controller
@RequiredArgsConstructor
@PreAuthorize("hasRole('CANDIDATE')")
public class CandidateController {

    private final CandidateService candidateService;
    private final NotificationService notificationService;
    private final JobService jobService;
    private final RecruiterActivityService recruiterActivityService;
    private final AtsService atsService;
    private final ResumeManagementService resumeManagementService;
    private final PortfolioService portfolioService;
    private final CertificationService certificationService;
    private final FileStorageService fileStorageService;

    /**
     * Real recruiter engagement activity recorded against the authenticated
     * candidate (profile views, resume downloads, shortlists, hire requests).
     * Scoping is enforced server-side: only the candidate's own activities
     * are ever returned.
     */
    @GetMapping("/api/candidate/recruiter-activities")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getRecruiterActivities(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(recruiterActivityService.getActivitiesForCandidate(
                resolveUserId(principal), page, size));
    }

    /**
     * Legacy candidate dashboard paths (referenced by older links and the
     * form-login flow). The actual dashboards are React routes served by the
     * SPA (/unpaid-dashboard, /paid-dashboard), which route on the
     * authenticated session via GET /api/auth/me. Redirect legacy URLs there
     * instead of rendering non-existent Thymeleaf templates.
     */
    @GetMapping("/candidate/unpaid-dashboard")
    public String unpaidDashboard(@AuthenticationPrincipal UserDetails principal, Model model) {
        return "redirect:/unpaid-dashboard";
    }

    @GetMapping("/candidate/paid-dashboard")
    public String paidDashboard(@AuthenticationPrincipal UserDetails principal, Model model) {
        String userId = resolveUserId(principal);
        candidateService.assertPaidPlan(userId);
        return "redirect:/paid-dashboard";
    }

    /**
     * Resume Templates (Thymeleaf pages in templates/resumetempletes).
     * Served under /candidate/resume-templates/ so the pages' relative links
     * (index.html, templates.html, start.html, builder.html) resolve correctly.
     */
    @GetMapping({"/candidate/resume-templates", "/resume-templates", "/resume-templates/"})
    public String resumeTemplatesRedirect() {
        return "redirect:/candidate/resume-templates/";
    }

    @GetMapping("/candidate/resume-templates/")
    public String resumeTemplatesHome() {
        return "resumetempletes/index";
    }

    @GetMapping({
        "/candidate/resume-templates/{page:index|templates|start|builder}.html",
        "/candidate/resume-templates/{page:index|templates|start|builder}"
    })
    public String resumeTemplatesPage(@PathVariable("page") String page) {
        return "resumetempletes/" + page;
    }

    @GetMapping("/api/candidate/profile")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getProfile(
            @AuthenticationPrincipal UserDetails principal) {
        User user = candidateService.getUserByEmail(principal.getUsername());
        CandidateProfile profile = candidateService.getOrCreateProfileByUserId(user.getId());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("userId", user.getId());
        res.put("id", profile.getId());
        res.put("name", user.getName());
        res.put("fullName", user.getName());
        res.put("email", user.getEmail());
        res.put("role", user.getRole().name());
        res.put("accountStatus", user.getAccountStatus().name());
        res.put("plan", user.getPlan() != null ? user.getPlan().name() : "FREE");
        res.put("planActivated", user.isPlanActivated());
        res.put("phone", profile.getPhone() != null ? profile.getPhone() : "");
        res.put("location", profile.getLocation() != null ? profile.getLocation() : "");
        res.put("headline", profile.getHeadline() != null ? profile.getHeadline() : "");
        res.put("bio", profile.getBio() != null ? profile.getBio() : "");
        res.put("skills", profile.getSkills() != null ? profile.getSkills() : List.of());
        res.put("currentDesignation", profile.getCurrentDesignation() != null ? profile.getCurrentDesignation() : "");
        res.put("currentCompany", profile.getCurrentCompany() != null ? profile.getCurrentCompany() : "");
        res.put("totalExperienceYears", profile.getTotalExperienceYears());
        res.put("noticePeriodDays", profile.getNoticePeriodDays());
        res.put("expectedAnnualSalaryInr", profile.getExpectedAnnualSalaryInr());
        res.put("experiences", profile.getExperiences() != null ? profile.getExperiences() : List.of());
        res.put("resumeOriginalFilename", profile.getResumeOriginalFilename());
        res.put("resumeUploadedAt", profile.getResumeUploadedAt());
        res.put("profileApprovalStatus", profile.getProfileApprovalStatus() != null ? profile.getProfileApprovalStatus().name() : "APPROVED");
        res.put("visibleToRecruiters", profile.isVisibleToRecruiters());

        // Documented Profile Strength rule based on genuinely present fields.
        // Each criterion has a fixed weight summing to 100, and the suggestions
        // name only information that is actually missing from the profile.
        List<Map<String, Object>> criteria = new ArrayList<>();
        criteria.add(strengthCriterion("Professional headline",
                profile.getHeadline() != null && !profile.getHeadline().isBlank(), 15,
                "add a professional headline"));
        criteria.add(strengthCriterion("Contact phone",
                profile.getPhone() != null && !profile.getPhone().isBlank(), 5,
                "add a contact phone number"));
        criteria.add(strengthCriterion("Location",
                profile.getLocation() != null && !profile.getLocation().isBlank(), 5,
                "add your location"));
        criteria.add(strengthCriterion("Skills",
                profile.getSkills() != null && !profile.getSkills().isEmpty(), 10,
                "add your key skills"));
        criteria.add(strengthCriterion("Professional summary",
                profile.getBio() != null && !profile.getBio().isBlank(), 10,
                "write a short professional summary"));
        criteria.add(strengthCriterion("Work experience",
                (profile.getCurrentDesignation() != null && !profile.getCurrentDesignation().isBlank())
                        || (profile.getExperiences() != null && !profile.getExperiences().isEmpty()), 15,
                "add your current role or work experience"));
        criteria.add(strengthCriterion("Resume on file",
                profile.getResumeOriginalFilename() != null
                        && !profile.getResumeOriginalFilename().isBlank(), 15,
                "upload a resume"));
        criteria.add(strengthCriterion("Portfolio project",
                profile.getPortfolioProjects() != null && !profile.getPortfolioProjects().isEmpty(), 10,
                "add a portfolio project"));
        // One or more persisted certifications complete the profile. Weights
        // above still sum to 100 and this check reads real MongoDB data, so the
        // percentage can never be faked from the client.
        criteria.add(strengthCriterion("Certifications",
                certificationService.hasAny(resolveUserId(principal)), 15,
                "add a verifiable certification"));

        int earned = criteria.stream().mapToInt(c -> (Boolean) c.get("met") ? (Integer) c.get("weight") : 0).sum();
        List<String> suggestions = criteria.stream()
                .filter(c -> !(Boolean) c.get("met"))
                .map(c -> (String) c.get("suggestion"))
                .toList();
        Map<String, Object> strength = new LinkedHashMap<>();
        strength.put("percentage", Math.min(100, earned));
        strength.put("suggestions", suggestions);
        strength.put("criteria", criteria);
        res.put("profileStrength", strength);
        res.put("profileCompletionPercentage", Math.min(100, earned));

        return ResponseEntity.ok(res);
    }

    private Map<String, Object> strengthCriterion(String label, boolean met, int weight,
                                                  String suggestion) {
        Map<String, Object> criterion = new LinkedHashMap<>();
        criterion.put("label", label);
        criterion.put("met", met);
        criterion.put("weight", weight);
        criterion.put("suggestion", suggestion);
        return criterion;
    }

    @PatchMapping("/api/candidate/profile")
    @ResponseBody
    public ResponseEntity<CandidateProfile> updateProfile(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> updates) {
        CandidateProfile profile = candidateService.updateProfile(resolveUserId(principal), updates);
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/api/candidate/resume")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> uploadResume(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam("file") MultipartFile file) {
        String userId = resolveUserId(principal);
        Map<String, Object> resume = resumeManagementService.uploadResume(userId, file, false);
        return ResponseEntity.ok(resume);
    }

    /** Real resume version history for the authenticated candidate, newest first. */
    @GetMapping("/api/candidate/resumes")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> listResumes(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(resumeManagementService.listResumes(resolveUserId(principal)));
    }

    /** Real resume statistics for the authenticated candidate (Total, Created, Uploaded, Last Updated). */
    @GetMapping("/api/candidate/resumes/stats")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getResumeStats(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(resumeManagementService.getResumeStats(resolveUserId(principal)));
    }

    /** Detailed resume history along with summary stats. */
    @GetMapping("/api/candidate/resumes/history")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getResumeHistory(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        Map<String, Object> list = resumeManagementService.listResumes(userId);
        Map<String, Object> stats = resumeManagementService.getResumeStats(userId);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("stats", stats);
        res.put("history", list.get("content"));
        res.put("totalElements", list.get("totalElements"));
        return ResponseEntity.ok(res);
    }

    /** Creates an in-app generated / template resume for the authenticated candidate. */
    @PostMapping("/api/candidate/resumes/create")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> createResume(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody(required = false) Map<String, Object> body) {
        String title = body != null ? (String) body.get("title") : null;
        String templateName = body != null ? (String) body.get("templateName") : null;
        String contentHtml = body != null ? (String) body.get("contentHtml") : null;
        return ResponseEntity.ok(resumeManagementService.createResume(
                resolveUserId(principal), title, templateName, contentHtml));
    }

    /** Deletes a candidate's owned resume version. */
    @DeleteMapping("/api/candidate/resumes/{resumeId}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteResume(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String resumeId) {
        return ResponseEntity.ok(resumeManagementService.deleteResume(
                resolveUserId(principal), resumeId));
    }

    /**
     * Retrieves the candidate's structured resume builder data from MongoDB,
     * or pre-populated defaults from CandidateProfile and User. With the
     * optional {@code resumeId} request parameter (edit intent) the stored data
     * of that owned resume is returned; without it no existing draft is bound
     * (create intent — the next save starts a new logical resume).
     */
    @GetMapping("/api/candidate/resumes/builder-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getResumeBuilderData(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(name = "resumeId", required = false) String resumeId) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(resumeManagementService.getBuilderData(userId, resumeId));
    }

    /**
     * Persists the candidate's structured resume builder data to MongoDB.
     */
    @PostMapping("/api/candidate/resumes/builder-save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveResumeBuilderData(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> payload) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(resumeManagementService.saveBuilderData(userId, payload));
    }

    /** Uploads a new resume version (creates a new record, archives the previous). */
    @PostMapping("/api/candidate/resumes")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> uploadResumeVersion(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "mode", required = false) String mode) {
        boolean replacing = "replace".equalsIgnoreCase(mode);
        return ResponseEntity.ok(resumeManagementService.uploadResume(
                resolveUserId(principal), file, replacing));
    }

    /** Promotes one of the candidate's own approved versions to primary. */
    @PostMapping("/api/candidate/resumes/{resumeId}/activate")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> activateResume(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String resumeId) {
        return ResponseEntity.ok(resumeManagementService.setActiveResume(
                resolveUserId(principal), resumeId));
    }

    /**
     * Streams the exact requested resume version to its owner. Inline by
     * default so the browser can display a PDF; {@code ?download=true} sends an
     * attachment with the original filename. Ownership is enforced server-side.
     */
    @GetMapping("/api/candidate/resumes/{resumeId}/file")
    public ResponseEntity<byte[]> getResumeFile(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String resumeId,
            @RequestParam(value = "download", required = false) boolean download) {
        ResumeManagementService.StoredResumeFile file = resumeManagementService
                .loadOwnedResumeFile(resolveUserId(principal), resumeId);
        return resumeFileResponse(file, download);
    }

    private ResponseEntity<byte[]> resumeFileResponse(
            ResumeManagementService.StoredResumeFile file, boolean download) {
        String mime = file.mimeType() != null && !file.mimeType().isBlank()
                ? file.mimeType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        String filename = sanitizeFilename(file.filename(), file.version());
        ContentDisposition disposition = ContentDisposition
                .builder(download ? "attachment" : "inline")
                .filename(filename, StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(file.bytes());
    }

    private String sanitizeFilename(String filename, int version) {
        String fallback = "resume-v" + version;
        if (filename == null || filename.isBlank()) return fallback;
        // Strip path separators and control characters; keep the extension.
        String cleaned = filename.replaceAll("[\\\\/\\r\\n\\t]", "_").trim();
        return cleaned.isBlank() ? fallback : cleaned;
    }

    @GetMapping("/api/candidate/resume/download")
    @ResponseBody
    public ResponseEntity<Map<String, String>> getResumeDownloadUrl(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        String url = candidateService.getResumeSecureUrl(userId, userId);
        return ResponseEntity.ok(Map.of("downloadUrl", url));
    }

    // ─────────────────────────────────────────────────
    // Portfolio change review (separate from ATS scoring)
    //
    // The approved portfolio lives on the candidate profile. Submitting an
    // update creates a PENDING PortfolioChangeRequest for admin review; it does
    // NOT change the approved portfolio and does NOT touch any ATS evaluation.
    // ─────────────────────────────────────────────────

    /** The candidate's approved portfolio plus their latest submission status. */
    @GetMapping("/api/candidate/portfolio")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getPortfolio(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(portfolioService.getPortfolioState(resolveUserId(principal)));
    }

    /**
     * Submits proposed portfolio projects for review. Identity is taken from the
     * Spring Security session only — a candidate can never submit a change on
     * behalf of another candidate.
     */
    @PostMapping("/api/candidate/portfolio/change-request")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> submitPortfolioChange(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody(required = false) Map<String, Object> body) {
        String userId = resolveUserId(principal);
        candidateService.assertPaidPlan(userId);

        String title = asString(body != null ? body.get("title") : null);
        List<PortfolioService.PortfolioProjectInput> projects = new ArrayList<>();
        Object rawProjects = body != null ? body.get("projects") : null;
        if (rawProjects instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> map)) continue;
                List<String> techStack = new ArrayList<>();
                Object rawTech = map.get("techStack");
                if (rawTech instanceof List<?> techList) {
                    for (Object tech : techList) {
                        String value = asString(tech);
                        if (value != null && !value.isBlank()) techStack.add(value);
                    }
                }
                projects.add(new PortfolioService.PortfolioProjectInput(
                        asString(map.get("title")),
                        asString(map.get("description")),
                        asString(map.get("projectUrl")),
                        asString(map.get("repoUrl")),
                        techStack));
            }
        }

        var request = portfolioService.submitChangeRequest(userId, title, projects);
        return ResponseEntity.ok(Map.of(
                "id", request.getId(),
                "status", request.getStatus() != null ? request.getStatus().name() : "PENDING",
                "message", "Portfolio changes submitted for review."));
    }

    private String asString(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    // ─────────────────────────────────────────────────
    // Certifications & licenses (Account Settings)
    //
    // Identity comes from the authenticated session only; ownership is
    // enforced in CertificationService for every per-id operation. The
    // optional certificate document arrives as multipart/form-data.
    // ─────────────────────────────────────────────────

    /** The authenticated candidate's certifications, newest first. */
    @GetMapping("/api/candidate/certifications")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> listCertifications(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(certificationService.listForCandidate(resolveUserId(principal)));
    }

    /**
     * Adds one certification for the authenticated candidate. Requires the
     * certification name and issuing organization; the document is optional
     * (validated: PDF / PNG / JPG up to 10 MB, content-sniffed server-side).
     */
    @PostMapping(value = "/api/candidate/certifications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> addCertification(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam("title") String title,
            @RequestParam("issuer") String issuer,
            @RequestParam(value = "issueDate", required = false) String issueDate,
            @RequestParam(value = "expirationDate", required = false) String expirationDate,
            @RequestParam(value = "neverExpires", required = false) String neverExpiresValue,
            @RequestParam(value = "credentialId", required = false) String credentialId,
            @RequestParam(value = "verificationUrl", required = false) String verificationUrl,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        boolean neverExpires = neverExpiresValue != null
                && (neverExpiresValue.equalsIgnoreCase("true") || neverExpiresValue.equals("1")
                        || neverExpiresValue.equalsIgnoreCase("on"));
        return ResponseEntity.ok(certificationService.add(resolveUserId(principal),
                new CertificationService.CertificationInput(title, issuer, issueDate,
                        expirationDate, neverExpires, credentialId, verificationUrl, file)));
    }

    /** Deletes one of the candidate's own certifications (and its document). */
    @DeleteMapping("/api/candidate/certifications/{certificationId}")
    @ResponseBody
    public ResponseEntity<Map<String, String>> deleteCertification(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String certificationId) {
        certificationService.delete(resolveUserId(principal), certificationId);
        return ResponseEntity.ok(Map.of("message", "Certification deleted successfully."));
    }

    /**
     * Streams the candidate's own certificate document (ownership enforced
     * server-side); inline so PDFs and images can be previewed in-app.
     */
    @GetMapping("/api/candidate/certifications/{certificationId}/file")
    public ResponseEntity<byte[]> getCertificationFile(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String certificationId,
            @RequestParam(value = "download", required = false) boolean download) {
        String userId = resolveUserId(principal);
        CandidateCertification cert = certificationService.requireOwned(userId, certificationId);
        if (cert.getStoredPublicId() == null || cert.getStoredPublicId().isBlank()) {
            throw new BusinessException("NOT_FOUND", "This certification has no document attached.");
        }
        byte[] bytes = fileStorageService.fetchFile(cert.getStoredPublicId(), cert.getMimeType());
        String mime = cert.getMimeType() != null && !cert.getMimeType().isBlank()
                ? cert.getMimeType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        String filename = cert.getOriginalFilename() != null && !cert.getOriginalFilename().isBlank()
                ? cert.getOriginalFilename() : "certificate";
        ContentDisposition disposition = ContentDisposition
                .builder(download ? "attachment" : "inline")
                .filename(filename, StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(bytes);
    }

    @GetMapping("/api/candidate/resume/approval-status")
    @ResponseBody
    public ResponseEntity<ResumeApprovalRequest> getResumeApprovalStatus(
            @AuthenticationPrincipal UserDetails principal) {
        ResumeApprovalRequest req = candidateService.getResumeApprovalStatus(resolveUserId(principal));
        return ResponseEntity.ok(req);
    }

    @PostMapping("/api/candidate/profile-picture")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> uploadProfilePicture(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam("file") MultipartFile file) {
        String userId = resolveUserId(principal);
        CandidateProfile profile = candidateService.uploadProfilePicture(userId, file);
        return ResponseEntity.ok(Map.of(
                "message", "Profile picture uploaded.",
                "url", profile.getProfilePictureUrl()
        ));
    }

    /**
     * Published (ACTIVE) job search for candidates. Each row additionally
     * carries the real company display name resolved from MongoDB
     * ("companyName"); jobs without a company link get null — no fallback
     * name is ever invented. The page envelope (content/totalElements/…)
     * is preserved for the frontend.
     */
    @GetMapping("/api/candidate/jobs")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> searchJobs(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) WorkMode workMode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String userId = resolveUserId(principal);
        Page<Job> jobs = candidateService.searchJobs(userId, keyword, location, workMode,
                page, Math.min(size, 20));
        Map<String, String> companyNames = candidateService.companyNamesFor(jobs.getContent());

        List<Map<String, Object>> content = new ArrayList<>();
        for (Job job : jobs.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", job.getId());
            row.put("title", job.getTitle());
            row.put("description", job.getDescription());
            row.put("responsibilities", job.getResponsibilities());
            row.put("companyId", job.getCompanyId());
            row.put("companyName", job.getCompanyId() != null
                    ? companyNames.get(job.getCompanyId()) : null);
            row.put("recruiterUserId", job.getRecruiterUserId());
            row.put("location", job.getLocation());
            row.put("country", job.getCountry());
            row.put("city", job.getCity());
            row.put("workMode", job.getWorkMode() != null ? job.getWorkMode().name() : null);
            row.put("techStack", job.getTechStack());
            row.put("preferredSkills", job.getPreferredSkills());
            row.put("minExperienceYears", job.getMinExperienceYears());
            row.put("maxExperienceYears", job.getMaxExperienceYears());
            row.put("minSalaryInr", job.getMinSalaryInr());
            row.put("maxSalaryInr", job.getMaxSalaryInr());
            row.put("salaryCurrency", job.getSalaryCurrency());
            row.put("employmentType", job.getEmploymentType());
            row.put("educationRequirements", job.getEducationRequirements());
            row.put("certifications", job.getCertifications());
            row.put("numberOfVacancies", job.getNumberOfVacancies());
            row.put("applicationDeadline", job.getApplicationDeadline());
            row.put("additionalRequirements", job.getAdditionalRequirements());
            row.put("status", job.getStatus() != null ? job.getStatus().name() : null);
            row.put("createdAt", job.getCreatedAt());
            row.put("updatedAt", job.getUpdatedAt());
            content.add(row);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", content);
        body.put("number", jobs.getNumber());
        body.put("size", jobs.getSize());
        body.put("totalElements", jobs.getTotalElements());
        body.put("totalPages", jobs.getTotalPages());
        body.put("first", jobs.isFirst());
        body.put("last", jobs.isLast());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/api/candidate/jobs/{jobId}")
    @ResponseBody
    public ResponseEntity<Job> getJob(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId) {
        // Both paid and unpaid candidates can view active job details.
        return ResponseEntity.ok(jobService.findById(jobId));
    }

    @GetMapping("/api/candidate/jobs/{jobId}/has-applied")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> hasApplied(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(Map.of("hasApplied", candidateService.hasAppliedForJob(userId, jobId)));
    }

    @PostMapping("/api/candidate/jobs/{jobId}/apply")
    @ResponseBody
    public ResponseEntity<JobApplication> expressInterest(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId,
            @RequestBody(required = false) Map<String, Object> body) {
        String coverNote = body != null ? (String) body.get("coverNote") : null;
        JobApplication app = candidateService.expressInterest(resolveUserId(principal), jobId, coverNote);
        return ResponseEntity.ok(app);
    }

    @GetMapping("/api/candidate/applications")
    @ResponseBody
    public ResponseEntity<Page<JobApplication>> getApplications(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<JobApplication> apps = candidateService.getMyApplications(
                resolveUserId(principal), page, Math.min(size, 20));
        return ResponseEntity.ok(apps);
    }

    /**
     * Genuine recruiter shortlist / pipeline records for the authenticated
     * candidate, enriched with the real job, company and recruiter referenced
     * by each persisted application. Used by the "Recruiter Shortlists &
     * Interviews" dashboard section so counts and records always come from
     * the same source of truth.
     */
    @GetMapping("/api/candidate/shortlists")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getShortlists(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(candidateService.getMyShortlists(
                resolveUserId(principal), page, Math.min(size, 20)));
    }

    /**
     * Job openings that are eligible ATS evaluation targets for the
     * authenticated candidate's resume check: published (ACTIVE) and not
     * past their application deadline. Every option maps to a real MongoDB
     * job document; draft/inactive/closed/expired jobs are excluded
     * server-side.
     */
    @GetMapping("/api/candidate/ats-eligible-jobs")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getEligibleAtsJobs(
            @RequestParam(defaultValue = "200") int max) {
        List<Map<String, Object>> jobs = candidateService.listEligibleAtsJobs(max);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("content", jobs);
        res.put("totalElements", jobs.size());
        return ResponseEntity.ok(res);
    }

    @GetMapping("/api/candidate/applications/{applicationId}")
    @ResponseBody
    public ResponseEntity<JobApplication> getApplication(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String applicationId) {
        return ResponseEntity.ok(candidateService.getApplication(resolveUserId(principal), applicationId));
    }

    @PostMapping("/api/candidate/applications/{applicationId}/withdraw")
    @ResponseBody
    public ResponseEntity<JobApplication> withdrawApplication(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String applicationId,
            @RequestParam(required = false) String reason) {
        JobApplication app = candidateService.withdrawApplication(
                resolveUserId(principal), applicationId, reason);
        return ResponseEntity.ok(app);
    }

    @GetMapping("/api/candidate/notifications")
    @ResponseBody
    public ResponseEntity<Page<Notification>> getNotifications(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Notification> notifications = candidateService.getNotifications(
                resolveUserId(principal), unreadOnly, page, size);
        return ResponseEntity.ok(notifications);
    }

    @PatchMapping("/api/candidate/notifications/{notificationId}/read")
    @ResponseBody
    public ResponseEntity<Notification> markNotificationRead(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String notificationId) {
        Notification n = notificationService.markAsRead(notificationId, resolveUserId(principal));
        return ResponseEntity.ok(n);
    }

    @DeleteMapping("/api/candidate/account")
    @ResponseBody
    public ResponseEntity<Map<String, String>> deleteAccount(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String password,
            @RequestBody(required = false) Map<String, String> body) {
        String confirmationPassword = (password != null && !password.isBlank())
                ? password
                : (body != null ? body.get("password") : null);
        candidateService.requestAccountDeletion(resolveUserId(principal), confirmationPassword);
        return ResponseEntity.ok(Map.of("message", "Account deleted successfully."));
    }

    // ─────────────────────────────────────────────────
    // ATS Resume Checker (candidate self-service)
    //
    // Identity comes from the Spring Security session only; free-check
    // enforcement happens entirely server-side in AtsService. Available for
    // unpaid (FREE) candidates too — plan restrictions are per-feature.
    // ─────────────────────────────────────────────────

    /** Current ATS entitlement for the authenticated candidate (real persisted usage). */
    @GetMapping("/api/candidate/ats-entitlement")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> atsEntitlement(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(atsService.entitlement(resolveUserId(principal)));
    }

    /**
     * Runs one candidate self-service ATS check against a target job or pasted
     * job description. Consumes a free check ONLY when the backend scoring
     * completes successfully; failed attempts never consume allowance.
     */
    @PostMapping(value = "/api/candidate/ats-evaluate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> atsEvaluateFile(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(value = "resume", required = false) MultipartFile resumeFile,
            @RequestParam(value = "resumeText", required = false) String resumeText,
            @RequestParam(value = "jobId", required = false) String jobId,
            @RequestParam(value = "jobDescription", required = false) String jobDescription,
            @RequestParam(value = "idempotencyKey", required = false) String idempotencyKey,
            @RequestParam(value = "useStoredResume", required = false) Boolean useStoredResume) {
        return ResponseEntity.ok(atsService.runSelfCheck(resolveUserId(principal),
                resumeFile, resumeText, jobId, jobDescription, idempotencyKey,
                Boolean.TRUE.equals(useStoredResume)));
    }

    @PostMapping(value = "/api/candidate/ats-evaluate", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> atsEvaluateText(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(atsService.runSelfCheck(resolveUserId(principal),
                null,
                body != null ? (String) body.get("resumeText") : null,
                body != null ? (String) body.get("jobId") : null,
                body != null ? (String) body.get("jobDescription") : null,
                body != null ? (String) body.get("idempotencyKey") : null,
                body != null && Boolean.TRUE.equals(body.get("useStoredResume"))));
    }

    /** Saved ATS result history (viewing it never consumes a check). */
    @GetMapping("/api/candidate/ats-evaluations")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> atsHistory(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(atsService.historyForCandidate(resolveUserId(principal), page, size));
    }

    /** A single saved result — ownership enforced server-side. */
    @GetMapping("/api/candidate/ats-evaluations/{evaluationId}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> atsEvaluationDetail(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String evaluationId) {
        AtsEvaluation evaluation = atsService.getEvaluationForCandidate(
                resolveUserId(principal), evaluationId);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", evaluation.getId());
        res.put("score", evaluation.getScore());
        res.put("breakdown", evaluation.getBreakdown());
        res.put("matchedRequiredSkills", evaluation.getMatchedRequiredSkills());
        res.put("missingRequiredSkills", evaluation.getMissingRequiredSkills());
        res.put("matchedPreferredSkills", evaluation.getMatchedPreferredSkills());
        res.put("missingPreferredSkills", evaluation.getMissingPreferredSkills());
        res.put("jobId", evaluation.getJobId());
        res.put("jobTitle", evaluation.getJobTitle());
        res.put("createdAt", evaluation.getCreatedAt());
        res.put("resumeRef", evaluation.getResumeRef());
        return ResponseEntity.ok(res);
    }

    private String resolveUserId(UserDetails principal) {
        return candidateService.getUserByEmail(principal.getUsername()).getId();
    }
}
