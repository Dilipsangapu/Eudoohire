package com.euodoo.hire.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.euodoo.hire.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Critical Cloudinary-storage tests, with the cloud SDK mocked so no network
 * is used. Verifies:
 *  - fail-fast startup when Cloudinary is mandatory (production) but missing,
 *  - content-based (magic byte) file validation ignoring client-declared types,
 *  - a supported file uploads with the euodoo-hire/ folder and per-call timeouts,
 *  - a Cloudinary failure surfaces as UPLOAD_FAILED (never a false success).
 */
public class FileStorageServiceCloudinaryTest {

    private FileStorageService service;
    private Cloudinary cloudinary;
    private Uploader uploader;

    @BeforeEach
    void setUp() {
        cloudinary = Mockito.mock(Cloudinary.class);
        uploader = Mockito.mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);

        service = new FileStorageService();
        ReflectionTestUtils.setField(service, "cloudName", "test-cloud");
        ReflectionTestUtils.setField(service, "apiKey", "test-key");
        ReflectionTestUtils.setField(service, "apiSecret", "test-secret");
        service.init();
        ReflectionTestUtils.setField(service, "configured", true);
        ReflectionTestUtils.setField(service, "cloudinary", cloudinary);
        ReflectionTestUtils.setField(service, "legacyRoots", java.util.List.of());
    }

    @Test
    void startupFailsWhenCloudinaryIsRequiredButNotConfigured() {
        FileStorageService strict = new FileStorageService();
        ReflectionTestUtils.setField(strict, "cloudName", "");
        ReflectionTestUtils.setField(strict, "apiKey", "");
        ReflectionTestUtils.setField(strict, "apiSecret", "");
        ReflectionTestUtils.setField(strict, "requireCloudinary", true);
        IllegalStateException ex = assertThrows(IllegalStateException.class, strict::init);
        assertTrue(ex.getMessage().contains("mandatory"));
    }

    @Test
    void htmlContentNamedPdfIsRejectedByContentSniffing() {
        // Declared as application/pdf but really HTML/SVG payload.
        MockMultipartFile fake = new MockMultipartFile("file", "cv.pdf",
                "application/pdf", "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.validateResume(fake));
        assertEquals("INVALID_FILE_TYPE", ex.getErrorCode());
    }

    @Test
    void noPdfFileIsRejectedEvenWhenNamedDocx() {
        // Sniffs as PDF, claimed as DOCX: still rejected (declared file type is
        // not honored, and PDF bytes are not a valid DOCX document).
        MockMultipartFile fake = new MockMultipartFile("file", "cv.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "%PDF-1.4 fake".getBytes(StandardCharsets.UTF_8));
        assertThrows(BusinessException.class, () -> service.validateResume(fake));
    }

    @Test
    void successfulUploadUsesPrescribedFolderAndTimeouts() throws Exception {
        when(uploader.upload(any(byte[].class), anyMap()))
                .thenReturn(Map.of("public_id", "euodoo-hire/resumes/u1/1-abc",
                        "secure_url", "https://res.cloudinary.com/test-cloud/private/...",
                        "bytes", 7));
        byte[] pdf = "%PDF-1.4 real".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = service.uploadResume("u1",
                new MockMultipartFile("file", "cv.pdf", "application/pdf", pdf));

        assertTrue(result.publicId().startsWith("euodoo-hire/resumes/u1/"),
                "cloud uploads must use the euodoo-hire/resumes/ folder convention");
        assertTrue(result.publicId() != null);
        assertTrue(result.secureUrl() != null && !result.secureUrl().isBlank());

        @SuppressWarnings("unchecked")
        Map<String, Object> options = Mockito.mockingDetails(uploader).getInvocations().stream()
                .filter(i -> "upload".equals(i.getMethod().getName()))
                .findFirst().map(i -> (Map<String, Object>) i.getArgument(1))
                .orElseThrow();
        assertEquals("raw", options.get("resource_type"));
        assertEquals("private", options.get("type"));
        assertEquals("euodoo-hire/resumes/u1/1-abc", options.get("public_id"));
        // Per-call timeouts must be passed through to the HTTP client.
        assertEquals(60000, ((Number) options.get("timeout")).intValue());
        assertEquals(10000, ((Number) options.get("connect_timeout")).intValue());
        assertEquals(10000, ((Number) options.get("connection_request_timeout")).intValue());
    }

    @Test
    void cloudinaryFailureIsSurfacedAsUploadFailedWithoutFalseSuccess() throws Exception {
        when(uploader.upload(any(byte[].class), anyMap()))
                .thenThrow(new java.io.IOException("connection reset"));
        byte[] pdf = "%PDF-1.4 fails".getBytes(StandardCharsets.UTF_8);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.uploadResume("u1",
                        new MockMultipartFile("file", "cv.pdf", "application/pdf", pdf)));
        assertEquals("UPLOAD_FAILED", ex.getErrorCode());
    }
}
