package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyDraftRequest;
import com.euodoo.hire.dto.request.AgencyRegistrationRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.service.AgencyRegistrationService;
import com.euodoo.hire.service.AgencySecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/agencies")
@RequiredArgsConstructor
public class AgencyRegistrationController {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    private final AgencyRegistrationService registrationService;
    private final AgencySecurityUtils securityUtils;
    private final Validator validator;

    @PostMapping(value = "/register", consumes = {MediaType.APPLICATION_JSON_VALUE, MediaType.ALL_VALUE})
    public ResponseEntity<AgencyResponse> registerJson(@Valid @RequestBody AgencyRegistrationRequest request) {
        AgencyResponse response = registrationService.registerAgency(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AgencyResponse> registerMultipart(
            @RequestParam(value = "data", required = false) String dataString,
            @RequestPart(value = "data", required = false) AgencyRegistrationRequest dataPart,
            @RequestPart(value = "request", required = false) AgencyRegistrationRequest requestPart,
            @RequestPart(value = "incorporationFile", required = false) MultipartFile incorporationFile,
            @RequestPart(value = "gstFile", required = false) MultipartFile gstFile) throws Exception {
        AgencyRegistrationRequest request = dataPart != null ? dataPart : requestPart;
        if (request == null && dataString != null && !dataString.isBlank()) {
            request = JSON_MAPPER.readValue(dataString, AgencyRegistrationRequest.class);
        }
        if (request == null) {
            throw new BusinessException("INVALID_REQUEST", "Registration data is required");
        }

        var violations = validator.validate(request);
        if (!violations.isEmpty()) {
            String msg = violations.iterator().next().getMessage();
            throw new BusinessException("VALIDATION_ERROR", msg);
        }

        AgencyResponse response = registrationService.registerAgency(request, incorporationFile, gstFile);
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
