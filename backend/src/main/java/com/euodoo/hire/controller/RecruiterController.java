package com.euodoo.hire.controller;

import com.euodoo.hire.model.*;
import com.euodoo.hire.service.AtsService;
import com.euodoo.hire.service.JobService;
import com.euodoo.hire.service.RecruiterActivityService;
import com.euodoo.hire.service.RecruiterService;
import com.euodoo.hire.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import com.euodoo.hire.repository.UserRepository;

import java.util.List;
import java.util.Map;

/**
 * Handles MVC views and REST API for authenticated recruiters.
 * All endpoints require ROLE_RECRUITER. Ownership and approval checks
 * are enforced in RecruiterService.
 */
@Controller
@RequiredArgsConstructor
@PreAuthorize("hasRole('RECRUITER')")
public class RecruiterController {

    private final RecruiterService recruiterService;
    private final JobService jobService;
    private final RecruiterActivityService recruiterActivityService;
    private final AtsService atsService;
    private final UserRepository userRepository;
    private final SubscriptionService subscriptionService;

    @GetMapping({"/recruiter", "/recruiter/", "/recruiter/dashboard", "/recruiter/index", "/recruiter/index.html"})
    public String dashboard(@AuthenticationPrincipal UserDetails principal, Model model) {
        String email = principal != null ? principal.getUsername() : "";
        model.addAttribute("email", email);
        userRepository.findByEmail(email).ifPresent(u -> model.addAttribute("name", u.getName()));
        return "recruiter/index";
    }

    @GetMapping("/api/recruiter/profile")
    @ResponseBody
    public ResponseEntity<RecruiterProfile> getProfile(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(recruiterService.getProfile(resolveUserId(principal)));
    }

    @PatchMapping("/api/recruiter/profile")
    @ResponseBody
    public ResponseEntity<RecruiterProfile> updateProfile(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> updates) {
        return ResponseEntity.ok(recruiterService.updateProfile(resolveUserId(principal), updates));
    }

    @PostMapping("/api/recruiter/companies")
    @ResponseBody
    public ResponseEntity<Company> registerCompany(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        Company company = jobService.registerCompany(
                resolveUserId(principal),
                (String) body.get("name"),
                (String) body.get("description"),
                (String) body.get("website"),
                (String) body.get("industry"),
                (String) body.get("headquarters"),
                (String) body.get("contactEmail"),
                (String) body.get("contactPhone")
        );
        return ResponseEntity.ok(company);
    }

    @GetMapping("/api/recruiter/companies")
    @ResponseBody
    public ResponseEntity<List<Company>> getMyCompanies(
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(jobService.getCompaniesForRecruiter(resolveUserId(principal)));
    }

    @PostMapping("/api/recruiter/jobs")
    @ResponseBody
    public ResponseEntity<Job> createJob(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(recruiterService.createJob(resolveUserId(principal), body));
    }

    @PatchMapping("/api/recruiter/jobs/{jobId}")
    @ResponseBody
    public ResponseEntity<Job> updateJob(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(recruiterService.updateJob(resolveUserId(principal), jobId, body));
    }

    @PostMapping("/api/recruiter/jobs/{jobId}/publish")
    @ResponseBody
    public ResponseEntity<Job> publishJob(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId) {
        return ResponseEntity.ok(recruiterService.publishJob(resolveUserId(principal), jobId));
    }

    @PostMapping("/api/recruiter/jobs/{jobId}/deactivate")
    @ResponseBody
    public ResponseEntity<Job> deactivateJob(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId) {
        return ResponseEntity.ok(recruiterService.deactivateJob(resolveUserId(principal), jobId));
    }

    @GetMapping("/api/recruiter/jobs/{jobId}")
    @ResponseBody
    public ResponseEntity<Job> getJob(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId) {
        return ResponseEntity.ok(recruiterService.getJob(resolveUserId(principal), jobId));
    }

    @GetMapping("/api/recruiter/jobs/{jobId}/applications")
    @ResponseBody
    public ResponseEntity<List<JobApplication>> getJobApplications(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String jobId) {
        subscriptionService.assertRecruiterSubscriptionActive(resolveUserId(principal));
        return ResponseEntity.ok(recruiterService.getApplicationsForJob(resolveUserId(principal), jobId));
    }

    @GetMapping("/api/recruiter/candidates")
    @ResponseBody
    public ResponseEntity<Page<CandidateProfile>> searchCandidates(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) List<String> skills,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        subscriptionService.assertRecruiterSubscriptionActive(resolveUserId(principal));
        Page<CandidateProfile> candidates = recruiterService.searchCandidates(
                resolveUserId(principal), keyword, skills, page, Math.min(size, 20));
        return ResponseEntity.ok(candidates);
    }

    @GetMapping("/api/recruiter/candidates/{candidateUserId}")
    @ResponseBody
    public ResponseEntity<CandidateProfile> viewCandidate(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String candidateUserId,
            @RequestParam(required = false) String applicationId,
            @RequestParam(required = false) String q) {
        subscriptionService.assertRecruiterSubscriptionActive(resolveUserId(principal));
        return ResponseEntity.ok(recruiterService.viewCandidateProfile(
                resolveUserId(principal), candidateUserId, applicationId, q));
    }

    /**
     * Secure resume download for the authenticated recruiter.
     * Returns a short-lived URL only when the candidate's resume was approved;
     * the download activity is recorded server-side after URL generation succeeds.
     */
    @GetMapping("/api/recruiter/candidates/{candidateUserId}/resume-url")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getResumeDownloadUrl(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String candidateUserId) {
        subscriptionService.assertRecruiterSubscriptionActive(resolveUserId(principal));
        return ResponseEntity.ok(recruiterService.getResumeDownloadUrlForCandidate(
                resolveUserId(principal), candidateUserId));
    }

    /**
     * The authenticated recruiter's own recorded activity feed.
     */
    @GetMapping("/api/recruiter/activities")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getMyActivities(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(recruiterActivityService.getActivitiesForRecruiter(
                resolveUserId(principal), page, size));
    }

    @GetMapping("/api/recruiter/applications")
    @ResponseBody
    public ResponseEntity<List<JobApplication>> getMyApplications(
            @AuthenticationPrincipal UserDetails principal) {
        subscriptionService.assertRecruiterSubscriptionActive(resolveUserId(principal));
        return ResponseEntity.ok(recruiterService.getApplicationsForRecruiter(resolveUserId(principal)));
    }

    @PostMapping("/api/recruiter/applications/{applicationId}/view")
    @ResponseBody
    public ResponseEntity<JobApplication> markViewed(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String applicationId) {
        return ResponseEntity.ok(recruiterService.markApplicationViewed(
                resolveUserId(principal), applicationId));
    }

    @PostMapping("/api/recruiter/applications/{applicationId}/shortlist")
    @ResponseBody
    public ResponseEntity<JobApplication> shortlist(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String applicationId,
            @RequestParam(required = false) String note) {
        String recruiterUserId = resolveUserId(principal);
        recruiterService.markApplicationViewed(recruiterUserId, applicationId);
        return ResponseEntity.ok(recruiterService.shortlistApplication(
                recruiterUserId, applicationId, note));
    }

    @PostMapping("/api/recruiter/applications/{applicationId}/reject")
    @ResponseBody
    public ResponseEntity<JobApplication> reject(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String applicationId,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(recruiterService.rejectApplication(
                resolveUserId(principal), applicationId, reason));
    }

    @PostMapping("/api/recruiter/hiring-requests")
    @ResponseBody
    public ResponseEntity<HiringRequest> createHiringRequest(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        long salary = ((Number) body.get("agreedAnnualSalaryInr")).longValue();
        String applicationId = (String) body.get("applicationId");
        return ResponseEntity.ok(recruiterService.createHiringRequest(
                resolveUserId(principal), applicationId, salary));
    }

    @GetMapping("/api/recruiter/notifications")
    @ResponseBody
    public ResponseEntity<Page<Notification>> getNotifications(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(recruiterService.getNotifications(
                resolveUserId(principal), page, size));
    }

    // ─────────────────────────────────────────────────
    // ATS evaluation (recruiter-facing)
    // ─────────────────────────────────────────────────

    /** The authenticated recruiter's own jobs (used to pick an evaluation target). */
    @GetMapping("/api/recruiter/jobs")
    @ResponseBody
    public ResponseEntity<List<Job>> getMyJobs(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(recruiterService.listMyJobs(resolveUserId(principal)));
    }

    /**
     * Runs a real ATS evaluation of a candidate's stored resume against one of
     * the recruiter's own jobs. Authorization and scoring are fully
     * server-side; recruiter evaluations never consume the candidate's
     * free-check allowance. The activity record is written after success only.
     */
    @PostMapping("/api/recruiter/candidates/{candidateUserId}/ats-evaluate")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> atsEvaluate(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String candidateUserId,
            @RequestParam String jobId) {
        return ResponseEntity.ok(atsService.runRecruiterEvaluation(
                resolveUserId(principal), candidateUserId, jobId));
    }

    /** Retrieval of evaluation results for a specific candidate and/or job. */
    @GetMapping("/api/recruiter/ats-evaluations")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> atsEvaluations(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(required = false) String candidateUserId,
            @RequestParam(required = false) String jobId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(atsService.evaluationsForRecruiter(
                resolveUserId(principal), candidateUserId, jobId, page, size));
    }

    private String resolveUserId(UserDetails principal) {
        return recruiterService.resolveUserIdByEmail(principal.getUsername());
    }
}
