package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyInterviewFeedbackRequest;
import com.euodoo.hire.dto.request.AgencyInterviewRequest;
import com.euodoo.hire.dto.response.AgencyInterviewResponse;
import com.euodoo.hire.model.InterviewStatus;
import com.euodoo.hire.service.AgencyInterviewService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agency/interviews")
@RequiredArgsConstructor
public class AgencyInterviewController {

    private final AgencyInterviewService interviewService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping
    public ResponseEntity<AgencyInterviewResponse> scheduleInterview(
            @Valid @RequestBody AgencyInterviewRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyInterviewResponse response = interviewService.scheduleInterview(effectiveAgencyId, user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<AgencyInterviewResponse>> getInterviews(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) InterviewStatus status,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Page<AgencyInterviewResponse> response = interviewService.getInterviews(effectiveAgencyId, page, size, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgencyInterviewResponse> getInterview(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyInterviewResponse response = interviewService.getInterview(effectiveAgencyId, id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/feedback")
    public ResponseEntity<AgencyInterviewResponse> recordFeedback(
            @PathVariable String id,
            @Valid @RequestBody AgencyInterviewFeedbackRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyInterviewResponse response = interviewService.recordFeedback(effectiveAgencyId, id, request, user.getId());
        return ResponseEntity.ok(response);
    }
}
