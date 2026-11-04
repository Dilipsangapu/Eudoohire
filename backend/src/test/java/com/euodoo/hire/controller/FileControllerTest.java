package com.euodoo.hire.controller;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.service.FileStorageService;
import com.euodoo.hire.service.FileStorageService.ByteFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link FileController} — signed local file access. The HMAC
 * signature IS the authorization, so every failure contract matters.
 */
@ExtendWith(MockitoExtension.class)
public class FileControllerTest {

    @Mock
    private FileStorageService fileStorageService;

    private FileController controller;

    @BeforeEach
    void setUp() {
        controller = new FileController(fileStorageService);
    }

    private ByteFile byteFile(String contentType, String filename, String text) {
        return new ByteFile(text.getBytes(StandardCharsets.UTF_8), filename, contentType);
    }

    @Test
    @DisplayName("happy path: serves bytes with stored content type and inline disposition")
    void localFile_servesBytes() {
        when(fileStorageService.readSignedLocalFile("resumes/x/1.pdf", 0L, "sig"))
                .thenReturn(byteFile("application/pdf", "Resume v1.pdf", "%PDF-fake"));

        ResponseEntity<byte[]> response = controller.localFile("resumes/x/1.pdf", 0L, "sig");

        assertEquals(200, response.getStatusCode().value());
        assertEquals("application/pdf", response.getHeaders().getContentType().toString());
        assertTrue(response.getHeaders().getFirst("Content-Disposition").startsWith("inline"));
        assertEquals("nosniff", response.getHeaders().getFirst("X-Content-Type-Options"));
        assertThatCacheControlIsNoStore(response);
        assertEquals("%PDF-fake", new String(response.getBody(), StandardCharsets.UTF_8));
    }

    private void assertThatCacheControlIsNoStore(ResponseEntity<byte[]> response) {
        assertTrue(String.valueOf(response.getHeaders().getFirst("Cache-Control")).contains("no-store"));
    }

    @Test
    @DisplayName("missing signature → INVALID_FILE_TOKEN from the storage service (400)")
    void localFile_missingSignature() {
        when(fileStorageService.readSignedLocalFile("resumes/x/1.pdf", 0L, null))
                .thenThrow(new BusinessException("INVALID_FILE_TOKEN", "Invalid or missing file signature."));

        assertThrows(BusinessException.class,
                () -> controller.localFile("resumes/x/1.pdf", 0L, null));
    }

    @Test
    @DisplayName("expired signature → EXPIRED_FILE_TOKEN from the storage service")
    void localFile_expired() {
        when(fileStorageService.readSignedLocalFile("resumes/x/1.pdf", 5L, "sig"))
                .thenThrow(new BusinessException("EXPIRED_FILE_TOKEN", "This link has expired."));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> controller.localFile("resumes/x/1.pdf", 5L, "sig"));
        assertEquals("EXPIRED_FILE_TOKEN", ex.getErrorCode());
    }

    @Test
    @DisplayName("path traversal attempt → INVALID_STORAGE_PATH from the storage service")
    void localFile_pathTraversal() {
        when(fileStorageService.readSignedLocalFile("../../etc/passwd", 0L, "sig"))
                .thenThrow(new BusinessException("INVALID_STORAGE_PATH", "Invalid storage path."));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> controller.localFile("../../etc/passwd", 0L, "sig"));
        assertEquals("INVALID_STORAGE_PATH", ex.getErrorCode());
    }

    @Test
    @DisplayName("deleted/stored-missing file → FILE_NOT_FOUND from the storage service")
    void localFile_missingFile() {
        when(fileStorageService.readSignedLocalFile("resumes/x/2.pdf", 0L, "sig"))
                .thenThrow(new BusinessException("FILE_NOT_FOUND", "File not found."));

        assertEquals("FILE_NOT_FOUND", assertThrows(BusinessException.class,
                () -> controller.localFile("resumes/x/2.pdf", 0L, "sig")).getErrorCode());
    }
}
