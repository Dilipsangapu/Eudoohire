package com.euodoo.hire.service;

import com.euodoo.hire.dto.response.AgencyDocumentResponse;
import com.euodoo.hire.model.AgencyDocumentType;
import com.euodoo.hire.model.DocumentVerificationStatus;
import com.euodoo.hire.exception.AgencyExceptions.DocumentVerificationException;
import com.euodoo.hire.exception.AgencyNotFoundException;
import com.euodoo.hire.service.AgencyMapper;
import com.euodoo.hire.model.AgencyDocument;
import com.euodoo.hire.repository.AgencyDocumentRepository;
import com.euodoo.hire.repository.AgencyRepository;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.service.AuditService;
import com.euodoo.hire.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyDocumentService {

    private final AgencyDocumentRepository agencyDocumentRepository;
    private final AgencyRepository agencyRepository;
    private final FileStorageService fileStorageService;
    private final AuditService auditService;

    public AgencyDocumentResponse uploadDocument(String agencyId, AgencyDocumentType documentType, MultipartFile file, String userId) {
        if (!agencyRepository.existsById(agencyId)) {
            throw new AgencyNotFoundException(agencyId);
        }

        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_FILE", "Uploaded document cannot be empty");
        }

        fileStorageService.validateCertificate(file); // Validates size <= 10MB, PDF/PNG/JPG magic bytes

        FileStorageService.UploadResult result = fileStorageService.uploadCertificate(agencyId, file);

        AgencyDocument doc = agencyDocumentRepository.findByAgencyIdAndDocumentType(agencyId, documentType)
                .orElse(AgencyDocument.builder()
                        .agencyId(agencyId)
                        .documentType(documentType)
                        .build());

        // Clean previous stored file if replacement
        if (doc.getStoredPublicId() != null && !doc.getStoredPublicId().equals(result.publicId())) {
            fileStorageService.deleteFile(doc.getStoredPublicId());
        }

        doc.setStoredPublicId(result.publicId());
        doc.setSecureUrl(result.secureUrl());
        doc.setOriginalFilename(result.originalFilename());
        doc.setMimeType(result.mimeType());
        doc.setFileSizeBytes(result.fileSizeBytes());
        doc.setVerificationStatus(DocumentVerificationStatus.PENDING);
        doc.setUploadedAt(Instant.now());

        AgencyDocument saved = agencyDocumentRepository.save(doc);

        auditService.log(userId, "AGENCY_USER", "AgencyDocument", saved.getId(),
                "DOCUMENT_UPLOADED", Map.of("documentType", documentType.name(), "filename", result.originalFilename()));

        return AgencyMapper.toDocumentResponse(saved);
    }

    public List<AgencyDocumentResponse> getAgencyDocuments(String agencyId) {
        return agencyDocumentRepository.findByAgencyId(agencyId).stream()
                .map(AgencyMapper::toDocumentResponse)
                .collect(Collectors.toList());
    }

    public AgencyDocumentResponse getDocument(String agencyId, String documentId) {
        AgencyDocument doc = agencyDocumentRepository.findByIdAndAgencyId(documentId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("AgencyDocument", documentId));
        return AgencyMapper.toDocumentResponse(doc);
    }

    public AgencyDocumentResponse verifyDocument(String agencyId, String documentId, DocumentVerificationStatus status, String remarks, String adminUserId) {
        AgencyDocument doc = agencyDocumentRepository.findByIdAndAgencyId(documentId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("AgencyDocument", documentId));

        if (status == null || status == DocumentVerificationStatus.PENDING) {
            throw new DocumentVerificationException("Must specify a decisive verification status (VERIFIED, REJECTED, RESUBMISSION_REQUIRED)");
        }

        doc.setVerificationStatus(status);
        doc.setVerificationRemarks(remarks);
        doc.setVerifiedByAdminId(adminUserId);
        doc.setVerifiedAt(Instant.now());

        AgencyDocument saved = agencyDocumentRepository.save(doc);

        auditService.log(adminUserId, "CLIENT_ADMIN", "AgencyDocument", saved.getId(),
                "DOCUMENT_VERIFIED", Map.of("status", status.name(), "type", doc.getDocumentType().name()));

        return AgencyMapper.toDocumentResponse(saved);
    }
}
