package com.euodoo.hire.controller;

import com.euodoo.hire.model.*;
import com.euodoo.hire.service.ClientAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * All endpoints restricted to CLIENT_ADMIN role.
 * Every action is audited via AuditService in the service layer.
 */
@Controller
@RequiredArgsConstructor
@PreAuthorize("hasRole('CLIENT_ADMIN')")
public class ClientAdminController {

    private final ClientAdminService clientAdminService;

    @GetMapping({
        "/client-admin", "/client-admin/", "/client-admin/dashboard", "/client-admin/index", "/client-admin/index.html",
        "/admin", "/admin/", "/admin/dashboard", "/admin/index", "/admin/index.html"
    })
    public String dashboard(@AuthenticationPrincipal UserDetails principal, Model model) {
        model.addAttribute("email", principal != null ? principal.getUsername() : "admin@euodoo.dev");
        return "admin/index";
    }

    @GetMapping({
        "/client-admin/{page}",
        "/admin/{page}"
    })
    public String renderAdminPage(@PathVariable String page, @AuthenticationPrincipal UserDetails principal, Model model) {
        model.addAttribute("email", principal != null ? principal.getUsername() : "admin@euodoo.dev");
        String view = page.endsWith(".html") ? page.substring(0, page.length() - 5) : page;
        if ("dashboard".equalsIgnoreCase(view) || "index".equalsIgnoreCase(view)) {
            return "admin/index";
        }
        return "admin/" + view;
    }

    @GetMapping("/api/admin/candidates/pending")
    @ResponseBody
    public ResponseEntity<Page<CandidateProfile>> pendingCandidates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(clientAdminService.getPendingCandidateProfiles(page, size));
    }

    @PostMapping("/api/admin/candidates/{candidateUserId}/approve")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> approveCandidate(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String candidateUserId) {
        User user = clientAdminService.approveCandidate(principal.getUsername(), candidateUserId);
        return ResponseEntity.ok(Map.of("message", "Candidate approved.", "userId", user.getId()));
    }

    @PostMapping("/api/admin/candidates/{candidateUserId}/reject")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> rejectCandidate(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String candidateUserId,
            @RequestParam String reason) {
        clientAdminService.rejectCandidate(principal.getUsername(), candidateUserId, reason);
        return ResponseEntity.ok(Map.of("message", "Candidate rejected."));
    }

    @PostMapping("/api/admin/recruiters/{recruiterUserId}/approve")
    @ResponseBody
    public ResponseEntity<RecruiterProfile> approveRecruiter(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String recruiterUserId,
            @RequestParam String companyId) {
        return ResponseEntity.ok(clientAdminService.approveRecruiter(
                principal.getUsername(), recruiterUserId, companyId));
    }

    @PostMapping("/api/admin/recruiters/{recruiterUserId}/reject")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> rejectRecruiter(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String recruiterUserId,
            @RequestParam String reason) {
        clientAdminService.rejectRecruiter(principal.getUsername(), recruiterUserId, reason);
        return ResponseEntity.ok(Map.of("message", "Recruiter rejected."));
    }

    @PostMapping("/api/admin/recruiters/{recruiterUserId}/activate")
    @ResponseBody
    public ResponseEntity<User> activateRecruiter(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String recruiterUserId,
            @RequestParam boolean active) {
        return ResponseEntity.ok(clientAdminService.setRecruiterActive(
                principal.getUsername(), recruiterUserId, active));
    }

    @PostMapping("/api/admin/companies/{companyId}/approve")
    @ResponseBody
    public ResponseEntity<Company> approveCompany(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String companyId) {
        return ResponseEntity.ok(clientAdminService.approveCompany(
                principal.getUsername(), companyId));
    }

    @PostMapping("/api/admin/companies/{companyId}/reject")
    @ResponseBody
    public ResponseEntity<Company> rejectCompany(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String companyId,
            @RequestParam String reason) {
        return ResponseEntity.ok(clientAdminService.rejectCompany(
                principal.getUsername(), companyId, reason));
    }

    @GetMapping("/api/admin/hiring-requests/pending")
    @ResponseBody
    public ResponseEntity<Page<HiringRequest>> pendingHiringRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(clientAdminService.getPendingHiringRequests(page, size));
    }

    @PostMapping("/api/admin/hiring-requests/{hiringRequestId}/approve")
    @ResponseBody
    public ResponseEntity<HiringRequest> approveHiringRequest(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String hiringRequestId) {
        return ResponseEntity.ok(clientAdminService.approveHiringRequest(
                principal.getUsername(), hiringRequestId));
    }

    @PostMapping("/api/admin/hiring-requests/{hiringRequestId}/release")
    @ResponseBody
    public ResponseEntity<HiringRequest> releaseCandidate(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String hiringRequestId) {
        return ResponseEntity.ok(clientAdminService.releaseCandidate(
                principal.getUsername(), hiringRequestId));
    }

    @GetMapping("/api/admin/change-requests/pending")
    @ResponseBody
    public ResponseEntity<Page<PortfolioChangeRequest>> pendingChangeRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(clientAdminService.getPendingChangeRequests(page, size));
    }

    @PostMapping("/api/admin/change-requests/{requestId}/approve")
    @ResponseBody
    public ResponseEntity<PortfolioChangeRequest> approveChangeRequest(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String requestId) {
        return ResponseEntity.ok(clientAdminService.approveChangeRequest(
                principal.getUsername(), requestId));
    }

    @PostMapping("/api/admin/change-requests/{requestId}/reject")
    @ResponseBody
    public ResponseEntity<PortfolioChangeRequest> rejectChangeRequest(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String requestId,
            @RequestParam(required = false) String note) {
        return ResponseEntity.ok(clientAdminService.rejectChangeRequest(
                principal.getUsername(), requestId, note));
    }

    @GetMapping("/api/admin/resume-requests/pending")
    @ResponseBody
    public ResponseEntity<Page<ResumeApprovalRequest>> pendingResumeRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(clientAdminService.getPendingResumeRequests(page, size));
    }

    @PostMapping("/api/admin/resume-requests/{requestId}/approve")
    @ResponseBody
    public ResponseEntity<ResumeApprovalRequest> approveResumeRequest(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String requestId) {
        return ResponseEntity.ok(clientAdminService.approveResumeRequest(
                principal.getUsername(), requestId));
    }

    @PostMapping("/api/admin/resume-requests/{requestId}/reject")
    @ResponseBody
    public ResponseEntity<ResumeApprovalRequest> rejectResumeRequest(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String requestId,
            @RequestParam(required = false) String note) {
        return ResponseEntity.ok(clientAdminService.rejectResumeRequest(
                principal.getUsername(), requestId, note));
    }

    @GetMapping("/api/admin/audit-logs")
    @ResponseBody
    public ResponseEntity<Page<AuditLog>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(clientAdminService.getAuditLogs(page, Math.min(size, 100)));
    }
    @GetMapping("/api/admin/candidates/{candidateUserId}/resume-url")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getCandidateResumeUrl(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String candidateUserId) {
        String url = clientAdminService.getCandidateResumeSecureUrl(
                principal.getUsername(), candidateUserId);
        return ResponseEntity.ok(Map.of("resumeUrl", url));
    }
}
