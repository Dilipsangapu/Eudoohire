package com.euodoo.hire.controller;

import com.euodoo.hire.model.CandidateAgencyAssociation;
import com.euodoo.hire.service.AgencyCandidateService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.CandidateResume;
import com.euodoo.hire.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/agency/candidates")
@RequiredArgsConstructor
public class AgencyCandidateController {

    private final AgencyCandidateService candidateService;
    private final AgencySecurityUtils securityUtils;

    @GetMapping
    public ResponseEntity<Page<Map<String, Object>>> getCandidates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String skill,
            @RequestParam(required = false) Integer minExperience,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Page<Map<String, Object>> response = candidateService.getCandidates(effectiveAgencyId, page, size, skill, minExperience, location);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getCandidate(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Map<String, Object> response = candidateService.getCandidateDetails(effectiveAgencyId, id);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<CandidateAgencyAssociation> associateCandidate(
            @RequestParam String candidateId,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        CandidateAgencyAssociation response = candidateService.associateCandidate(effectiveAgencyId, candidateId, user.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<CandidateResume> uploadResume(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        CandidateResume response = candidateService.uploadResumeForCandidate(effectiveAgencyId, id, file, user.getId());
        return ResponseEntity.ok(response);
    }
}
