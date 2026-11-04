package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AdminSubmissionReviewRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.dto.response.CandidateSubmissionResponse;
import com.euodoo.hire.model.AgencyRegistrationStatus;
import com.euodoo.hire.model.SubmissionStatus;
import com.euodoo.hire.service.AdminAgencyManagementService;
import com.euodoo.hire.service.AgencySubmissionService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('CLIENT_ADMIN', 'ADMIN', 'SUPER_ADMIN')")
public class AdminAgencyController {

    private final AdminAgencyManagementService adminService;
    private final AgencySubmissionService submissionService;
    private final AgencySecurityUtils securityUtils;

    // ─────────────────────────────────────────────────
    // Agency Verification
    // ─────────────────────────────────────────────────

    @GetMapping("/api/admin/agencies")
    public ResponseEntity<Page<AgencyResponse>> getAgencies(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) AgencyRegistrationStatus status) {
        Page<AgencyResponse> response = adminService.getAllAgencies(page, size, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/admin/agencies/{id}")
    public ResponseEntity<AgencyResponse> getAgency(@PathVariable String id) {
        AgencyResponse response = adminService.getAgencyDetails(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/admin/agencies/{id}/approve")
    public ResponseEntity<AgencyResponse> approveAgency(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        User admin = securityUtils.getAuthenticatedUser();
        String remarks = body != null ? body.get("remarks") : "Approved by administrator";
        AgencyResponse response = adminService.verifyAgency(id, admin.getId(), AgencyRegistrationStatus.APPROVED, remarks);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/admin/agencies/{id}/reject")
    public ResponseEntity<AgencyResponse> rejectAgency(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        User admin = securityUtils.getAuthenticatedUser();
        String reason = body != null ? body.get("reason") : "Registration rejected by administrator";
        AgencyResponse response = adminService.verifyAgency(id, admin.getId(), AgencyRegistrationStatus.REJECTED, reason);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/admin/agencies/{id}/request-resubmission")
    public ResponseEntity<AgencyResponse> requestResubmission(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        User admin = securityUtils.getAuthenticatedUser();
        String remarks = body != null ? body.get("remarks") : "Document or detail resubmission required";
        AgencyResponse response = adminService.verifyAgency(id, admin.getId(), AgencyRegistrationStatus.RESUBMISSION_REQUIRED, remarks);
        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────────────
    // Candidate Submission Review & Release
    // ─────────────────────────────────────────────────

    @GetMapping("/api/admin/submissions")
    public ResponseEntity<Page<CandidateSubmissionResponse>> getSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) SubmissionStatus status) {
        Page<CandidateSubmissionResponse> response = adminService.getAllSubmissions(page, size, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/admin/submissions/{id}")
    public ResponseEntity<CandidateSubmissionResponse> getSubmission(@PathVariable String id) {
        CandidateSubmissionResponse response = adminService.getAllSubmissions(0, 1000, null).getContent().stream()
                .filter(s -> id.equals(s.getId()))
                .findFirst()
                .orElseThrow(() -> new com.euodoo.hire.exception.AgencyExceptions.SubmissionNotFoundException(id));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/admin/submissions/{id}/approve")
    public ResponseEntity<CandidateSubmissionResponse> approveSubmission(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        User admin = securityUtils.getAuthenticatedUser();
        String comments = body != null ? body.get("comments") : "Approved by administrator";
        AdminSubmissionReviewRequest req = AdminSubmissionReviewRequest.builder()
                .status(SubmissionStatus.APPROVED)
                .comments(comments)
                .build();
        CandidateSubmissionResponse response = adminService.reviewSubmission(admin.getId(), id, req);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/admin/submissions/{id}/reject")
    public ResponseEntity<CandidateSubmissionResponse> rejectSubmission(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        User admin = securityUtils.getAuthenticatedUser();
        String comments = body != null ? body.get("comments") : "Rejected by administrator";
        AdminSubmissionReviewRequest req = AdminSubmissionReviewRequest.builder()
                .status(SubmissionStatus.REJECTED)
                .comments(comments)
                .build();
        CandidateSubmissionResponse response = adminService.reviewSubmission(admin.getId(), id, req);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/admin/submissions/{id}/request-resubmission")
    public ResponseEntity<CandidateSubmissionResponse> requestSubmissionResubmission(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        User admin = securityUtils.getAuthenticatedUser();
        String comments = body != null ? body.get("comments") : "Resubmission required";
        AdminSubmissionReviewRequest req = AdminSubmissionReviewRequest.builder()
                .status(SubmissionStatus.RESUBMISSION_REQUIRED)
                .comments(comments)
                .build();
        CandidateSubmissionResponse response = adminService.reviewSubmission(admin.getId(), id, req);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/admin/submissions/{id}/release")
    public ResponseEntity<CandidateSubmissionResponse> releaseCandidate(@PathVariable String id) {
        User admin = securityUtils.getAuthenticatedUser();
        CandidateSubmissionResponse response = adminService.releaseCandidateToAgency(admin.getId(), id);
        return ResponseEntity.ok(response);
    }
}
