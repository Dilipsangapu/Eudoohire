package com.euodoo.hire.controller;

import com.euodoo.hire.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * Serves locally stored files through short-lived, HMAC-signed URLs.
 *
 * The signature is the authorization: without a valid, unexpired signature the
 * request is rejected, and the path is confined to the storage root. This
 * mirrors the private signed URLs Cloudinary issues, so features that hand a
 * resume URL to a recruiter or admin keep working on local storage.
 */
@RestController
@RequiredArgsConstructor
public class FileController {

    private final FileStorageService fileStorageService;

    @GetMapping("/api/files/local")
    public ResponseEntity<byte[]> localFile(
            @RequestParam(value = "path", required = false) String path,
            @RequestParam(value = "exp", required = false, defaultValue = "0") long expiresAt,
            @RequestParam(value = "sig", required = false) String signature) {
        FileStorageService.ByteFile file =
                fileStorageService.readSignedLocalFile(path, expiresAt, signature);
        String contentType = file.contentType() != null
                ? file.contentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition
                        .inline()
                        .filename(file.filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(file.bytes());
    }
}
