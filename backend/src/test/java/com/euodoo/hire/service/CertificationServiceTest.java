package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.CandidateCertification;
import com.euodoo.hire.repository.CandidateCertificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the candidate certifications service (Account Settings →
 * Certifications &amp; Licenses).
 *
 * Focus: required-field validation, duplicate rejection, metadata-only
 * persistence, upload-failure atomicity (no record, no cleanup), never-expire
 * handling and strict ownership on reads/deletes.
 */
@ExtendWith(MockitoExtension.class)
public class CertificationServiceTest {

    /** Minimal fake PDF payload passing the backend's magic-byte sniffing. */
    private static final String PDF_BYTES = "%PDF-1.4 minimal test certificate";

    private static final String USER_ID = "user-1";

    @Mock private CandidateCertificationRepository repository;
    @Mock private FileStorageService fileStorageService;

    private CertificationService service;

    @BeforeEach
    void setUp() {
        service = new CertificationService(repository, fileStorageService);
    }

    private CertificationService.CertificationInput input(
            String title, String issuer, String issueDate, String expirationDate,
            boolean neverExpires, String credentialId, String url, MockMultipartFile file) {
        return new CertificationService.CertificationInput(
                title, issuer, issueDate, expirationDate, neverExpires, credentialId, url, file);
    }

    @Test
    void missingTitleIsRejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.add(USER_ID, input("  ", "AWS", null, null, false, null, null, null)));
        assertTrue(ex.getMessage().toLowerCase().contains("name"));
        verify(repository, never()).save(any(CandidateCertification.class));
    }

    @Test
    void missingIssuerIsRejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.add(USER_ID, input("AWS SA", " ", null, null, false, null, null, null)));
        assertTrue(ex.getMessage().toLowerCase().contains("organization"));
        verify(repository, never()).save(any(CandidateCertification.class));
    }

    @Test
    void duplicateNameAndIssuerIsRejected() {
        when(repository.findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(
                USER_ID, "AWS Certified", "Amazon"))
                .thenReturn(List.of(CandidateCertification.builder().id("existing").build()));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.add(USER_ID, input("AWS Certified", "Amazon",
                        null, null, false, null, null, null)));
        assertEquals("DUPLICATE_CERTIFICATION", ex.getErrorCode());
        verify(repository, never()).save(any(CandidateCertification.class));
    }

    @Test
    void metadataOnlyCertificationIsSavedWithoutUpload() {
        when(repository.findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(
                anyString(), anyString(), anyString())).thenReturn(List.of());
        when(repository.save(any(CandidateCertification.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> res = service.add(USER_ID,
                input("Coursera ML Specialization", "Coursera", "May 2024", null,
                        true, "ML-123", null, null));

        assertEquals("Certification added successfully.", res.get("message"));
        @SuppressWarnings("unchecked")
        Map<String, Object> saved = (Map<String, Object>) res.get("certification");
        assertEquals(Boolean.TRUE, saved.get("neverExpires"));
        assertNull(saved.get("expirationDate"));
        assertFalse((Boolean) saved.get("hasDocument"));
        verify(fileStorageService, never()).uploadCertificate(anyString(), any());
    }

    @Test
    void neverExpireKeywordSetsNeverExpires() {
        when(repository.findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(
                anyString(), anyString(), anyString())).thenReturn(List.of());
        when(repository.save(any(CandidateCertification.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        service.add(USER_ID, input("Meta Front-End", "Meta", null,
                "No Expiration", false, null, null, null));

        ArgumentCaptor<CandidateCertification> captor = ArgumentCaptor.forClass(CandidateCertification.class);
        verify(repository).save(captor.capture());
        assertTrue(captor.getValue().isNeverExpires());
        assertNull(captor.getValue().getExpirationDate());
    }

    @Test
    void invalidDateIsRejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.add(USER_ID, input("AWS SA", "AWS", "sometime soon??",
                        null, false, null, null, null)));
        assertEquals("INVALID_DATE", ex.getErrorCode());
        verify(repository, never()).save(any(CandidateCertification.class));
    }

    @Test
    void invalidVerificationUrlIsRejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.add(USER_ID, input("AWS SA", "AWS", null,
                        null, true, null, "ftp://not-allowed.example", null)));
        assertEquals("INVALID_URL", ex.getErrorCode());
        verify(repository, never()).save(any(CandidateCertification.class));
    }

    @Test
    void uploadFailureLeavesNoRecordAndNoCleanup() {
        when(repository.findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(
                anyString(), anyString(), anyString())).thenReturn(List.of());
        MockMultipartFile file = new MockMultipartFile("file", "cert.pdf", "application/pdf",
                PDF_BYTES.getBytes(StandardCharsets.UTF_8));
        when(fileStorageService.uploadCertificate(USER_ID, file))
                .thenThrow(new BusinessException("UPLOAD_FAILED", "Failed to upload certificate document."));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.add(USER_ID, input("AWS SA", "AWS", null,
                        null, true, null, null, file)));
        assertEquals("UPLOAD_FAILED", ex.getErrorCode());
        verify(repository, never()).save(any(CandidateCertification.class));
        // Nothing was persisted, so there must be no cleanup of a live file.
        verify(fileStorageService, never()).deleteFile(anyString());
    }

    @Test
    void persistenceFailureRemovesJustUploadedFile() {
        when(repository.findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(
                anyString(), anyString(), anyString())).thenReturn(List.of());
        MockMultipartFile file = new MockMultipartFile("file", "cert.png", "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47});
        when(fileStorageService.uploadCertificate(eq(USER_ID), any()))
                .thenReturn(new FileStorageService.UploadResult("pub-id", "https://secure", "cert.png",
                        "image/png", 4));
        when(repository.save(any(CandidateCertification.class)))
                .thenThrow(new RuntimeException("mongo down"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.add(USER_ID, input("Google Cloud", "Google", null,
                        null, true, null, null, file)));
        assertEquals("SAVE_FAILED", ex.getErrorCode());
        // The uploaded document is cleaned up so no orphan file remains.
        verify(fileStorageService).deleteFile("pub-id");
    }

    @Test
    void deleteEnforcesOwnership() {
        when(repository.findFirstByIdAndCandidateUserId("cert-1", USER_ID))
                .thenReturn(Optional.empty());
        assertThrows(AccessDeniedBusinessException.class,
                () -> service.delete(USER_ID, "cert-1"));
        verify(repository, never()).delete(any(CandidateCertification.class));
    }

    @Test
    void ownedDeleteRemovesRecordAndDocument() {
        CandidateCertification owned = CandidateCertification.builder()
                .id("cert-1").candidateUserId(USER_ID).storedPublicId("pub-id").build();
        when(repository.findFirstByIdAndCandidateUserId("cert-1", USER_ID))
                .thenReturn(Optional.of(owned));

        service.delete(USER_ID, "cert-1");

        verify(repository).delete(owned);
        verify(fileStorageService).deleteFile("pub-id");
    }

    @Test
    void yearOnlyDateIsAccepted() {
        when(repository.findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(
                anyString(), anyString(), anyString())).thenReturn(List.of());
        when(repository.save(any(CandidateCertification.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> res = service.add(USER_ID,
                input("Kubernetes Admin", "CNCF", "2024", "2027", false, null, null, null));
        assertEquals("Certification added successfully.", res.get("message"));
        @SuppressWarnings("unchecked")
        Map<String, Object> saved = (Map<String, Object>) res.get("certification");
        assertEquals("2024", saved.get("issueDate"));
        assertEquals("2027", saved.get("expirationDate"));
    }

    @Test
    void hasAnyReflectsExistence() {
        when(repository.findByCandidateUserIdOrderByCreatedAtDesc(USER_ID))
                .thenReturn(List.of(CandidateCertification.builder().id("c1").build()));
        assertTrue(service.hasAny(USER_ID));

        when(repository.findByCandidateUserIdOrderByCreatedAtDesc("other-user"))
                .thenReturn(List.of());
        assertFalse(service.hasAny("other-user"));
    }

    @Test
    void listReflectsPersistedRecords() {
        CandidateCertification cert = CandidateCertification.builder()
                .id("cert-1").candidateUserId(USER_ID).title("AWS SA").issuer("AWS")
                .storedPublicId("pub-id").mimeType("application/pdf").build();
        when(repository.findByCandidateUserIdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of(cert));
        when(fileStorageService.storedFileExists("pub-id")).thenReturn(true);

        Map<String, Object> res = service.listForCandidate(USER_ID);
        assertEquals(1, res.get("totalElements"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) res.get("content");
        assertEquals("/api/candidate/certifications/cert-1/file", content.get(0).get("documentUrl"));
        assertTrue((Boolean) content.get(0).get("hasDocument"));
        assertFalse(content.get(0).containsKey("storedPublicId"));
    }
}
