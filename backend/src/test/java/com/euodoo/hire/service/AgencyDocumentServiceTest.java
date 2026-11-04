package com.euodoo.hire.service;

import com.euodoo.hire.dto.response.AgencyDocumentResponse;
import com.euodoo.hire.model.AgencyDocumentType;
import com.euodoo.hire.model.DocumentVerificationStatus;
import com.euodoo.hire.model.AgencyDocument;
import com.euodoo.hire.repository.AgencyDocumentRepository;
import com.euodoo.hire.repository.AgencyRepository;
import com.euodoo.hire.service.AgencyDocumentService;
import com.euodoo.hire.service.AuditService;
import com.euodoo.hire.service.FileStorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AgencyDocumentServiceTest {

    @Mock
    private AgencyDocumentRepository agencyDocumentRepository;

    @Mock
    private AgencyRepository agencyRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private AuditService auditService;

    @InjectMocks
    private AgencyDocumentService agencyDocumentService;

    @Test
    @DisplayName("uploadDocument: uploads certificate and saves AgencyDocument in PENDING status")
    void uploadDocument_success() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "pan_card.pdf", "application/pdf", "%PDF-1.4 test".getBytes());

        when(agencyRepository.existsById("agency-1")).thenReturn(true);
        when(agencyDocumentRepository.findByAgencyIdAndDocumentType("agency-1", AgencyDocumentType.COMPANY_PAN_CARD))
                .thenReturn(Optional.empty());

        FileStorageService.UploadResult uploadResult = new FileStorageService.UploadResult(
                "local:pan_card.pdf", "http://localhost/file", "pan_card.pdf", "application/pdf", 1024L);
        when(fileStorageService.uploadCertificate(eq("agency-1"), any())).thenReturn(uploadResult);

        AgencyDocument savedDoc = AgencyDocument.builder()
                .id("doc-1")
                .agencyId("agency-1")
                .documentType(AgencyDocumentType.COMPANY_PAN_CARD)
                .secureUrl("http://localhost/file")
                .originalFilename("pan_card.pdf")
                .verificationStatus(DocumentVerificationStatus.PENDING)
                .uploadedAt(Instant.now())
                .build();
        when(agencyDocumentRepository.save(any(AgencyDocument.class))).thenReturn(savedDoc);

        AgencyDocumentResponse response = agencyDocumentService.uploadDocument(
                "agency-1", AgencyDocumentType.COMPANY_PAN_CARD, file, "user-1");

        assertNotNull(response);
        assertEquals("doc-1", response.getId());
        assertEquals(DocumentVerificationStatus.PENDING, response.getVerificationStatus());
        assertEquals(AgencyDocumentType.COMPANY_PAN_CARD, response.getDocumentType());
    }

    @Test
    @DisplayName("verifyDocument: admin marks document as VERIFIED")
    void verifyDocument_success() {
        AgencyDocument doc = AgencyDocument.builder()
                .id("doc-1")
                .agencyId("agency-1")
                .documentType(AgencyDocumentType.GST_CERTIFICATE)
                .verificationStatus(DocumentVerificationStatus.PENDING)
                .build();

        when(agencyDocumentRepository.findByIdAndAgencyId("doc-1", "agency-1")).thenReturn(Optional.of(doc));
        when(agencyDocumentRepository.save(any(AgencyDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        AgencyDocumentResponse response = agencyDocumentService.verifyDocument(
                "agency-1", "doc-1", DocumentVerificationStatus.VERIFIED, "GST matches portal", "admin-1");

        assertNotNull(response);
        assertEquals(DocumentVerificationStatus.VERIFIED, response.getVerificationStatus());
        assertEquals("GST matches portal", response.getVerificationRemarks());
        assertEquals("admin-1", response.getVerifiedByAdminId());
    }
}
