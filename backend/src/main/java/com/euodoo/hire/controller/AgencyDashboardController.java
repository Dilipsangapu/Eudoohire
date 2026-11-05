package com.euodoo.hire.controller;

import com.euodoo.hire.dto.response.*;
import com.euodoo.hire.service.AgencyDashboardService;
import com.euodoo.hire.service.AgencySecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agency/dashboard")
@RequiredArgsConstructor
public class AgencyDashboardController {

    private final AgencyDashboardService dashboardService;
    private final AgencySecurityUtils securityUtils;

    @GetMapping("/summary")
    public ResponseEntity<AgencyDashboardSummaryResponse> getSummary(
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyDashboardSummaryResponse response = dashboardService.getDashboardSummary(effectiveAgencyId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/recent-jobs")
    public ResponseEntity<List<AgencyJobResponse>> getRecentJobs(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        List<AgencyJobResponse> response = dashboardService.getRecentJobs(effectiveAgencyId, limit);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/recent-submissions")
    public ResponseEntity<List<CandidateSubmissionResponse>> getRecentSubmissions(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        List<CandidateSubmissionResponse> response = dashboardService.getRecentSubmissions(effectiveAgencyId, limit);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/upcoming-interviews")
    public ResponseEntity<List<AgencyInterviewResponse>> getUpcomingInterviews(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        List<AgencyInterviewResponse> response = dashboardService.getUpcomingInterviews(effectiveAgencyId, limit);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/placement-statistics")
    public ResponseEntity<Map<String, Object>> getPlacementStatistics(
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Map<String, Object> response = dashboardService.getPlacementStatistics(effectiveAgencyId);
        return ResponseEntity.ok(response);
    }
}
