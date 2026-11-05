package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.CandidateShortlistRequest;
import com.euodoo.hire.dto.response.CandidateShortlistResponse;
import com.euodoo.hire.service.AgencyShortlistService;
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
@RequestMapping("/api/agency/shortlists")
@RequiredArgsConstructor
public class AgencyShortlistController {

    private final AgencyShortlistService shortlistService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping
    public ResponseEntity<CandidateShortlistResponse> shortlistCandidate(
            @Valid @RequestBody CandidateShortlistRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        CandidateShortlistResponse response = shortlistService.shortlistCandidate(effectiveAgencyId, user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<CandidateShortlistResponse>> getShortlists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Page<CandidateShortlistResponse> response = shortlistService.getShortlists(effectiveAgencyId, page, size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/job/{jobId}")
    public ResponseEntity<List<CandidateShortlistResponse>> getJobShortlists(
            @PathVariable String jobId,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        List<CandidateShortlistResponse> response = shortlistService.getJobShortlists(effectiveAgencyId, jobId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removeShortlist(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        shortlistService.removeShortlist(effectiveAgencyId, id);
        return ResponseEntity.noContent().build();
    }
}
