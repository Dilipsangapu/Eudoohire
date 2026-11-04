package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.DocumentVerificationRequest;
import com.euodoo.hire.dto.response.AgencyDocumentResponse;
import com.euodoo.hire.model.AgencyDocumentType;
import com.euodoo.hire.service.AgencyDocumentService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/agencies/documents")
@RequiredArgsConstructor
public class AgencyDocumentController {

    private final AgencyDocumentService documentService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping("/upload")
    public ResponseEntity<AgencyDocumentResponse> uploadDocument(
            @RequestParam("type") AgencyDocumentType documentType,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "agencyId", required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyDocumentResponse response = documentService.uploadDocument(effectiveAgencyId, documentType, file, user.getId());
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<AgencyDocumentResponse>> getDocuments(
            @RequestParam(value = "agencyId", required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        List<AgencyDocumentResponse> response = documentService.getAgencyDocuments(effectiveAgencyId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<AgencyDocumentResponse> getDocument(
            @PathVariable String documentId,
            @RequestParam(value = "agencyId", required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyDocumentResponse response = documentService.getDocument(effectiveAgencyId, documentId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{documentId}")
    @PreAuthorize("hasAnyRole('CLIENT_ADMIN', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<AgencyDocumentResponse> verifyDocument(
            @PathVariable String documentId,
            @RequestParam(value = "agencyId", required = false) String agencyId,
            @Valid @RequestBody DocumentVerificationRequest request) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyDocumentResponse response = documentService.verifyDocument(
                effectiveAgencyId, documentId, request.getStatus(), request.getRemarks(), user.getId());
        return ResponseEntity.ok(response);
    }
}
