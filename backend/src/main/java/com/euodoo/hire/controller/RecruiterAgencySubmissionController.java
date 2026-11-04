package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.RecruiterSubmissionActionRequest;
import com.euodoo.hire.dto.response.CandidateSubmissionResponse;
import com.euodoo.hire.service.AgencySubmissionService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recruiter/agency-submissions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('RECRUITER', 'CLIENT_ADMIN')")
public class RecruiterAgencySubmissionController {

    private final AgencySubmissionService submissionService;
    private final AgencySecurityUtils securityUtils;

    @GetMapping
    public ResponseEntity<Page<CandidateSubmissionResponse>> getRecruiterSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        User user = securityUtils.getAuthenticatedUser();
        Page<CandidateSubmissionResponse> response = submissionService.getRecruiterSubmissions(user.getId(), page, size);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/action")
    public ResponseEntity<CandidateSubmissionResponse> updateAction(
            @PathVariable String id,
            @Valid @RequestBody RecruiterSubmissionActionRequest request) {
        User user = securityUtils.getAuthenticatedUser();
        CandidateSubmissionResponse response = submissionService.updateRecruiterAction(user.getId(), id, request);
        return ResponseEntity.ok(response);
    }
}
