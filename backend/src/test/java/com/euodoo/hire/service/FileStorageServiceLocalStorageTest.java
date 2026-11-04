package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the local-disk storage fallback used when Cloudinary is not
 * configured, including its signed URL scheme and path containment.
 */
public class FileStorageServiceLocalStorageTest {

    private static final String PDF_MIME = "application/pdf";

    @TempDir
    Path tempDir;

    @TempDir
    Path legacyTempDir;

    private FileStorageService service;

    @BeforeEach
    void setUp() {
        service = new FileStorageService();
        ReflectionTestUtils.setField(service, "cloudName", "");
        ReflectionTestUtils.setField(service, "apiKey", "");
        ReflectionTestUtils.setField(service, "apiSecret", "");
        ReflectionTestUtils.setField(service, "localStorageDir", tempDir.toString());
        ReflectionTestUtils.setField(service, "signingSecret", "");
        service.init();
        // Isolate these tests from any unusual working-directory layout.
        ReflectionTestUtils.setField(service, "legacyRoots", java.util.List.of());
    }

    private MockMultipartFile pdfFile(String name, byte[] content) {
        return new MockMultipartFile("file", name, PDF_MIME, content);
    }

    @Test
    void localStorageIsActiveWhenCloudinaryIsNotConfigured() {
        assertTrue(service.isLocalStorageActive());
    }

    @Test
    void uploadThenFetchReturnsTheExactBytes() {
        byte[] content = "%PDF-1.4 local storage test".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = service.uploadResume("user-1", pdfFile("my_resume.pdf", content));

        assertTrue(result.publicId().startsWith("local:resumes/user-1/"));
        assertEquals(content.length, result.fileSizeBytes());
        assertArrayEquals(content, service.fetchFile(result.publicId(), PDF_MIME));
    }

    @Test
    void signedUrlCanBeReadBackAndCarriesTheContentType() {
        byte[] content = "%PDF-1.4 signed".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = service.uploadResume("user-2", pdfFile("cv.pdf", content));

        Map<String, String> query = parseQuery(service.getSecureUrl(result.publicId(), PDF_MIME));
        FileStorageService.ByteFile file = service.readSignedLocalFile(
                query.get("path"), Long.parseLong(query.get("exp")), query.get("sig"));

        assertArrayEquals(content, file.bytes());
        assertEquals(PDF_MIME, file.contentType());
    }

    @Test
    void tamperedSignatureIsRejected() {
        byte[] content = "%PDF-1.4 tamper".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = service.uploadResume("user-3", pdfFile("cv.pdf", content));

        Map<String, String> query = parseQuery(service.getSecureUrl(result.publicId(), PDF_MIME));
        String originalSig = query.get("sig");
        // Flip the last hex character to a DIFFERENT value, otherwise a
        // signature already ending in '0' would not be tampered at all.
        char lastChar = originalSig.charAt(originalSig.length() - 1);
        char flippedChar = lastChar == '0' ? '1' : '0';
        String tampered = originalSig.substring(0, originalSig.length() - 1) + flippedChar;

        BusinessException ex = assertThrows(BusinessException.class, () -> service.readSignedLocalFile(
                query.get("path"), Long.parseLong(query.get("exp")), tampered));
        assertEquals("INVALID_FILE_TOKEN", ex.getErrorCode());
    }

    @Test
    void expiredSignatureIsRejected() {
        byte[] content = "%PDF-1.4 expired".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = service.uploadResume("user-4", pdfFile("cv.pdf", content));

        Map<String, String> query = parseQuery(service.getSecureUrl(result.publicId(), PDF_MIME));
        BusinessException ex = assertThrows(BusinessException.class, () -> service.readSignedLocalFile(
                query.get("path"), 1L, query.get("sig")));
        assertEquals("EXPIRED_FILE_TOKEN", ex.getErrorCode());
    }

    @Test
    void pathTraversalIsRejected() {
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.fetchFile("local:../../etc/passwd", PDF_MIME));
        assertEquals("INVALID_STORAGE_PATH", ex.getErrorCode());
    }

    @Test
    void deleteRemovesTheLocalFile() {
        byte[] content = "%PDF-1.4 to delete".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = service.uploadResume("user-5", pdfFile("cv.pdf", content));

        service.deleteFile(result.publicId());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.fetchFile(result.publicId(), PDF_MIME));
        assertEquals("RESUME_FETCH_FAILED", ex.getErrorCode());
    }

    @Test
    void storedFileLandsUnderTheConfiguredRootOnly() throws Exception {
        byte[] content = "%PDF-1.4 path check".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = service.uploadResume("user/6", pdfFile("cv.pdf", content));

        String relative = result.publicId().substring("local:".length());
        Path stored = tempDir.resolve(relative);
        assertTrue(stored.startsWith(tempDir));
        assertTrue(Files.isRegularFile(stored));
        // Owner segment is sanitized so it cannot escape its folder.
        assertFalse(relative.contains(".."));
    }

    // ── Canonical storage root & legacy reference compatibility ──

    @Test
    void effectiveStorageRootIsTheConfiguredAbsoluteDirectory() {
        Path effective = service.getEffectiveStorageRoot();
        assertEquals(tempDir.toAbsolutePath().normalize(), effective);
        assertTrue(effective.isAbsolute(),
                "the effective storage root must be absolute so it never depends on the process working directory");
    }

    @Test
    void filesStoredBeforeTheRootChangeRemainReadableThroughLegacyRoots() throws Exception {
        // Simulate a file written under an earlier helper root (pre-fix location).
        String relative = "resumes/user-legacy/cv.pdf";
        Path legacyFile = legacyTempDir.resolve(relative);
        Files.createDirectories(legacyFile.getParent());
        byte[] content = "%PDF-1.4 legacy file".getBytes(StandardCharsets.UTF_8);
        Files.write(legacyFile, content);

        FileStorageService mirror = new FileStorageService();
        ReflectionTestUtils.setField(mirror, "cloudName", "");
        ReflectionTestUtils.setField(mirror, "apiKey", "");
        ReflectionTestUtils.setField(mirror, "apiSecret", "");
        ReflectionTestUtils.setField(mirror, "localStorageDir", tempDir.toString());
        ReflectionTestUtils.setField(mirror, "signingSecret", "");
        mirror.init();
        ReflectionTestUtils.setField(mirror, "legacyRoots", java.util.List.of(legacyTempDir));

        String publicId = "local:" + relative;
        assertArrayEquals(content, mirror.fetchFile(publicId, PDF_MIME));
    }

    @Test
    void signedUrlsOfLegacyFilesStillResolve() throws Exception {
        String relative = "profile-pictures/user-legacy/avatar.png";
        Path legacyFile = legacyTempDir.resolve(relative);
        Files.createDirectories(legacyFile.getParent());
        byte[] content = "png bytes".getBytes(StandardCharsets.UTF_8);
        Files.write(legacyFile, content);

        FileStorageService mirror = new FileStorageService();
        ReflectionTestUtils.setField(mirror, "cloudName", "");
        ReflectionTestUtils.setField(mirror, "apiKey", "");
        ReflectionTestUtils.setField(mirror, "apiSecret", "");
        ReflectionTestUtils.setField(mirror, "localStorageDir", tempDir.toString());
        ReflectionTestUtils.setField(mirror, "signingSecret", "");
        mirror.init();
        ReflectionTestUtils.setField(mirror, "legacyRoots", java.util.List.of(legacyTempDir));

        Map<String, String> query = parseQuery(mirror.getSecureUrl("local:" + relative, "image/png"));
        FileStorageService.ByteFile file = mirror.readSignedLocalFile(
                query.get("path"), Long.parseLong(query.get("exp")), query.get("sig"));
        assertArrayEquals(content, file.bytes());
    }

    @Test
    void deletingALegacyFileRemovesItFromTheLegacyRoot() throws Exception {
        String relative = "resumes/user-legacy/old.pdf";
        Path legacyFile = legacyTempDir.resolve(relative);
        Files.createDirectories(legacyFile.getParent());
        byte[] content = "%PDF-1.4 delete me".getBytes(StandardCharsets.UTF_8);
        Files.write(legacyFile, content);

        FileStorageService mirror = new FileStorageService();
        ReflectionTestUtils.setField(mirror, "cloudName", "");
        ReflectionTestUtils.setField(mirror, "apiKey", "");
        ReflectionTestUtils.setField(mirror, "apiSecret", "");
        ReflectionTestUtils.setField(mirror, "localStorageDir", tempDir.toString());
        ReflectionTestUtils.setField(mirror, "signingSecret", "");
        mirror.init();
        ReflectionTestUtils.setField(mirror, "legacyRoots", java.util.List.of(legacyTempDir));

        mirror.deleteFile("local:" + relative);
        assertFalse(Files.exists(legacyFile), "business deletions must reach the legacy location, not just the new root");
    }

    @Test
    void newUploadsAlwaysLandInPrimaryRootAndNeverInLegacyRoot() throws Exception {
        FileStorageService mirror = new FileStorageService();
        ReflectionTestUtils.setField(mirror, "cloudName", "");
        ReflectionTestUtils.setField(mirror, "apiKey", "");
        ReflectionTestUtils.setField(mirror, "apiSecret", "");
        ReflectionTestUtils.setField(mirror, "localStorageDir", tempDir.toString());
        ReflectionTestUtils.setField(mirror, "signingSecret", "");
        mirror.init();
        ReflectionTestUtils.setField(mirror, "legacyRoots", java.util.List.of(legacyTempDir));

        byte[] content = "%PDF-1.4 canonical".getBytes(StandardCharsets.UTF_8);
        FileStorageService.UploadResult result = mirror.uploadResume("user-new", pdfFile("cv.pdf", content));

        String relative = result.publicId().substring("local:".length());
        assertTrue(Files.isRegularFile(tempDir.resolve(relative)),
                "new files must be written to the canonical storage root");
        assertFalse(Files.exists(legacyTempDir.resolve(relative)),
                "legacy roots must never receive new files");
        assertArrayEquals(content, mirror.fetchFile(result.publicId(), PDF_MIME));
    }

    private Map<String, String> parseQuery(String url) {
        Map<String, String> params = new HashMap<>();
        int q = url.indexOf('?');
        for (String pair : url.substring(q + 1).split("&")) {
            int eq = pair.indexOf('=');
            params.put(
                    java.net.URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8),
                    java.net.URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
        }
        return params;
    }
}
