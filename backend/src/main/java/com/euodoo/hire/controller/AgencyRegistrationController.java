package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyDraftRequest;
import com.euodoo.hire.dto.request.AgencyRegistrationRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.service.AgencyRegistrationService;
import com.euodoo.hire.service.AgencySecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;

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
            @RequestPart(value = "incorporationFile", required = false) MultipartFile incorporationFile,
            @RequestPart(value = "gstFile", required = false) MultipartFile gstFile,
            HttpServletRequest httpRequest) throws Exception {

        String dataString = null;
        if (httpRequest instanceof MultipartHttpServletRequest multipartRequest) {
            // First check if "data" was sent as a regular form field / text parameter
            dataString = multipartRequest.getParameter("data");
            // If not found as parameter, check if it was uploaded as a blob/file part
            if (dataString == null || dataString.isBlank()) {
                MultipartFile dataFile = multipartRequest.getFile("data");
                if (dataFile != null && !dataFile.isEmpty()) {
                    dataString = new String(dataFile.getBytes(), StandardCharsets.UTF_8);
                }
            }
            // Fallback for "request" field or part name
            if (dataString == null || dataString.isBlank()) {
                dataString = multipartRequest.getParameter("request");
            }
            if (dataString == null || dataString.isBlank()) {
                MultipartFile reqFile = multipartRequest.getFile("request");
                if (reqFile != null && !reqFile.isEmpty()) {
                    dataString = new String(reqFile.getBytes(), StandardCharsets.UTF_8);
                }
            }
        } else {
            dataString = httpRequest.getParameter("data");
            if (dataString == null || dataString.isBlank()) {
                dataString = httpRequest.getParameter("request");
            }
        }

        if (dataString == null || dataString.isBlank()) {
            throw new BusinessException("INVALID_REQUEST", "Registration data is required");
        }

        AgencyRegistrationRequest request = JSON_MAPPER.readValue(dataString, AgencyRegistrationRequest.class);

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
