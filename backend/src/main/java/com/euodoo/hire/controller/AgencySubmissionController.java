package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.CandidateSubmissionRequest;
import com.euodoo.hire.dto.response.ApplicationTrackingResponse;
import com.euodoo.hire.dto.response.CandidateSubmissionResponse;
import com.euodoo.hire.model.SubmissionStatus;
import com.euodoo.hire.service.AgencySubmissionService;
import com.euodoo.hire.service.ApplicationTrackingService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/agency/submissions")
@RequiredArgsConstructor
public class AgencySubmissionController {

    private final AgencySubmissionService submissionService;
    private final ApplicationTrackingService trackingService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping
    public ResponseEntity<CandidateSubmissionResponse> createSubmission(
            @Valid @RequestBody CandidateSubmissionRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        CandidateSubmissionResponse response = submissionService.createSubmission(effectiveAgencyId, user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<CandidateSubmissionResponse>> getSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) SubmissionStatus status,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Page<CandidateSubmissionResponse> response = submissionService.getAgencySubmissions(effectiveAgencyId, page, size, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CandidateSubmissionResponse> getSubmission(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        CandidateSubmissionResponse response = submissionService.getSubmission(effectiveAgencyId, id);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/submit-to-admin")
    public ResponseEntity<CandidateSubmissionResponse> submitToAdmin(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        CandidateSubmissionResponse response = submissionService.submitToAdmin(effectiveAgencyId, id, user.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/send-to-recruiter")
    public ResponseEntity<CandidateSubmissionResponse> sendToRecruiter(
            @PathVariable String id,
            @RequestParam(required = false) String recruiterUserId,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        CandidateSubmissionResponse response = submissionService.sendToRecruiter(effectiveAgencyId, id, recruiterUserId, user.getId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/tracking")
    public ResponseEntity<List<ApplicationTrackingResponse>> getTimeline(@PathVariable String id) {
        List<ApplicationTrackingResponse> response = trackingService.getTimeline(id);
        return ResponseEntity.ok(response);
    }
}
