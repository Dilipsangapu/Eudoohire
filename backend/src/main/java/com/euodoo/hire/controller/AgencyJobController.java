package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyJobRequest;
import com.euodoo.hire.dto.response.AgencyJobResponse;
import com.euodoo.hire.service.AgencyJobService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.JobStatus;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agency/jobs")
@RequiredArgsConstructor
public class AgencyJobController {

    private final AgencyJobService jobService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping
    public ResponseEntity<AgencyJobResponse> createJob(
            @Valid @RequestBody AgencyJobRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyJobResponse response = jobService.createJob(effectiveAgencyId, user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<AgencyJobResponse>> getJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String clientCompanyId,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Page<AgencyJobResponse> response = jobService.getJobs(effectiveAgencyId, page, size, search, clientCompanyId, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgencyJobResponse> getJob(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyJobResponse response = jobService.getJob(effectiveAgencyId, id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AgencyJobResponse> updateJob(
            @PathVariable String id,
            @Valid @RequestBody AgencyJobRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyJobResponse response = jobService.updateJob(effectiveAgencyId, id, request, user.getId());
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AgencyJobResponse> updateStatus(
            @PathVariable String id,
            @RequestParam JobStatus status,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyJobResponse response = jobService.updateStatus(effectiveAgencyId, id, status, user.getId());
        return ResponseEntity.ok(response);
    }
}
