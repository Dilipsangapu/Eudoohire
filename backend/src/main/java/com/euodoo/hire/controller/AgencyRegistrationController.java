package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyDraftRequest;
import com.euodoo.hire.dto.request.AgencyRegistrationRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.service.AgencyRegistrationService;
import com.euodoo.hire.service.AgencySecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agencies")
@RequiredArgsConstructor
public class AgencyRegistrationController {

    private final AgencyRegistrationService registrationService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping("/register")
    public ResponseEntity<AgencyResponse> register(@Valid @RequestBody AgencyRegistrationRequest request) {
        AgencyResponse response = registrationService.registerAgency(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/draft")
    public ResponseEntity<AgencyResponse> saveDraft(@Valid @RequestBody AgencyDraftRequest request) {
        AgencyResponse response = registrationService.saveDraft(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/submit")
    public ResponseEntity<AgencyResponse> submit(@RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyResponse response = registrationService.submitRegistration(effectiveAgencyId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/registration-status")
    public ResponseEntity<AgencyResponse> getRegistrationStatus(@RequestParam String identifier) {
        AgencyResponse response = registrationService.getPublicRegistrationStatus(identifier);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('AGENCY_ADMIN', 'AGENCY_STAFF', 'CLIENT_ADMIN', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<AgencyResponse> getAgencyById(@PathVariable String id) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(id);
        AgencyResponse response = registrationService.getRegistrationStatus(effectiveAgencyId);
        return ResponseEntity.ok(response);
    }
}
