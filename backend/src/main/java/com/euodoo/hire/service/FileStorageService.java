package com.euodoo.hire.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.euodoo.hire.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;


/**
 * Stores uploaded files.
 *
 * Two interchangeable backends:
 *  - Cloudinary when {@code CLOUDINARY_*} credentials are configured (production).
 *  - Local disk under {@code app.storage.dir} when they are not, so resumes and
 *    profile pictures work out of the box on a fresh checkout with no external
 *    account. Local files are served through a short-lived HMAC-signed URL
 *    (see {@link #getSecureUrl}), never by exposing the storage directory.
 *
 * Public ids for locally stored files are prefixed with {@code local:}; reads
 * and deletes branch on that prefix, so a deployment that later enables
 * Cloudinary keeps serving previously stored local files.
 */
@Service
@Slf4j
public class FileStorageService {

    private static final Set<String> ALLOWED_RESUME_MIME_TYPES =
            Set.of("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    private static final Set<String> ALLOWED_IMAGE_MIME_TYPES =
            Set.of("image/jpeg", "image/png");

    // Canonical mime values used for validation, Cloudinary format and extensions.
    private static final String MIME_PDF = "application/pdf";
    private static final String MIME_DOCX =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    private static final String MIME_JPEG = "image/jpeg";
    private static final String MIME_PNG = "image/png";

    private static final long MAX_RESUME_BYTES = 5 * 1024 * 1024L;      // 5 MB default
    private static final long MAX_PROFILE_PIC_BYTES = 512 * 1024L;       // 500 KB
    private static final long MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024L; // 10 MB
    private static final Set<String> ALLOWED_CERTIFICATE_MIME_TYPES =
            Set.of(MIME_PDF, MIME_JPEG, MIME_PNG);

    /** Public-id prefix marking a file that lives on the local filesystem. */
    private static final String LOCAL_PREFIX = "local:";

    /** Local signed URLs are valid for one hour, matching the Cloudinary private URL TTL. */
    private static final long LOCAL_URL_TTL_SECONDS = 3600;

    @Value("${cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${cloudinary.api-key:}")
    private String apiKey;

    @Value("${cloudinary.api-secret:}")
    private String apiSecret;

    /**
     * Directory used when Cloudinary is not configured. Mirrors the default in
     * application.properties so the root is absolute even when the property is
     * missing (a relative path used to resolve against the process working
     * directory, splitting uploads between project and backend folders).
     */
    @Value("${app.storage.dir:${user.home}/.euodoo-hire/uploads}")
    private String localStorageDir;

    /**
     * Relative directories that earlier versions used before the storage root
     * was made absolute (the cause of uploads being split between the backend
     * and the project root). They are consulted read/delete-fallback only, so
     * existing {@code local:} file references keep resolving after the fix
     * without moving any existing files.
     */
    private static final String[] LEGACY_ROOT_HINTS = {"./uploads", "../uploads", "backend/uploads"};

    /** Secret for signing local file URLs. Generated per-process when unset. */
    @Value("${app.storage.signing-secret:}")
    private String signingSecret;

    /**
     * When true (production), startup FAILS unless Cloudinary credentials are
     * configured, instead of silently falling back to local disk.
     */
    @Value("${app.storage.require-cloudinary:false}")
    private boolean requireCloudinary;

    private Cloudinary cloudinary;
    private boolean configured;

    private Path localRoot;
    private List<Path> legacyRoots = List.of();
    private boolean localEnabled;
    private String effectiveSigningSecret;

    @PostConstruct
    public void init() {
        configured = !cloudName.isBlank() && !apiKey.isBlank() && !apiSecret.isBlank();
        if (configured) {
            cloudinary = new Cloudinary(ObjectUtils.asMap(
                    "cloud_name", cloudName,
                    "api_key", apiKey,
                    "api_secret", apiSecret,
                    "secure", true
            ));
            log.info("Cloudinary file storage configured for cloud: {}", cloudName);
        } else if (requireCloudinary) {
            // Fail clearly at startup — production must never silently write
            // candidate documents to the server's local disk. Message contains
            // no credential values.
            throw new IllegalStateException(
                    "Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, "
                            + "CLOUDINARY_API_SECRET) are mandatory in this environment.");
        } else {
            try {
                localRoot = Paths.get(localStorageDir).toAbsolutePath().normalize();
                Files.createDirectories(localRoot);
                localEnabled = true;
                log.info("Effective local file storage directory: {}", localRoot);
                log.warn("Cloudinary credentials not configured - using LOCAL DISK storage at {}. " +
                         "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to use Cloudinary.",
                        localRoot);
            } catch (IOException e) {
                log.error("Could not create local storage directory {}: {}", localStorageDir, e.getMessage());
            }
        }
        this.legacyRoots = collectLegacyRoots(localRoot);

        if (signingSecret == null || signingSecret.isBlank()) {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            effectiveSigningSecret = HexFormat.of().formatHex(random);
            log.warn("app.storage.signing-secret is not set - using a random per-process secret. " +
                     "Local file URLs issued before a restart will stop working.");
        } else {
            effectiveSigningSecret = signingSecret;
        }
    }

    /**
     * Detects upload directories created by earlier versions, whose location
     * depended on the process working directory. Found directories are used as
     * read/delete fallbacks for existing {@code local:} references only.
     */
    private List<Path> collectLegacyRoots(Path primary) {
        java.util.LinkedHashSet<Path> found = new java.util.LinkedHashSet<>();
        for (String hint : LEGACY_ROOT_HINTS) {
            try {
                Path candidate = Paths.get(hint).toAbsolutePath().normalize();
                if (primary == null || (!candidate.equals(primary) && Files.isDirectory(candidate))) {
                    found.add(candidate);
                }
            } catch (Exception e) {
                log.debug("Legacy storage root hint '{}' could not be resolved: {}", hint, e.getMessage());
            }
        }
        if (!found.isEmpty()) {
            log.info("Legacy local storage directories detected for existing file references (will not be written to): {}", found);
        }
        return List.copyOf(found);
    }

    /** The effective absolute local storage directory (primary root for new files). */
    public Path getEffectiveStorageRoot() {
        return localRoot;
    }

    /** True when files are written to local disk (Cloudinary not configured). */
    public boolean isLocalStorageActive() {
        return localEnabled;
    }

    // ─────────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────────

    public void validateResume(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_FILE", "Resume file must not be empty.");
        }
        if (file.getSize() > MAX_RESUME_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "Resume must be smaller than 5 MB.");
        }
        String mime = detectMimeType(file);
        if (!ALLOWED_RESUME_MIME_TYPES.contains(mime)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Only PDF and DOCX resumes are accepted.");
        }
        if (MIME_PDF.equals(mime)) {
            validatePdf(file);
        } else {
            validateDocx(file);
        }
    }

    public void validateProfilePicture(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_FILE", "Profile picture must not be empty.");
        }
        if (file.getSize() > MAX_PROFILE_PIC_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "Profile picture must be smaller than 500 KB.");
        }
        String mime = detectMimeType(file);
        if (!ALLOWED_IMAGE_MIME_TYPES.contains(mime)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Only JPG and PNG profile pictures are accepted.");
        }
    }

    /**
     * Certificate documents (manual, badge images or PDF statements) follow the
     * same secure rules as resumes: size limit, magic-byte sniffing (never the
     * client-declared Content-Type) and real PDF structure validation.
     */
    public void validateCertificate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_FILE", "Certificate file must not be empty.");
        }
        if (file.getSize() > MAX_CERTIFICATE_BYTES) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "Certificate files must be smaller than 10 MB.");
        }
        String mime = detectMimeType(file);
        if (!ALLOWED_CERTIFICATE_MIME_TYPES.contains(mime)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "Only PDF, PNG and JPG certificate documents are accepted.");
        }
        if (MIME_PDF.equals(mime)) {
            validatePdf(file);
        }
    }

    // ─────────────────────────────────────────────────
    // Uploads
    // ─────────────────────────────────────────────────

    /**
     * Cloudinary request timeouts (milliseconds), applied per call via the
     * cloudinary-http44 client: overall request, connect and connection-acquire.
     * Prevents hung requests to the cloud provider from blocking endpoints.
     */
    private Map<String, Object> cloudinaryTimeouts() {
        return ObjectUtils.asMap(
                "timeout", 60_000,                   // overall request/socket
                "connect_timeout", 10_000,           // TCP connect
                "connection_request_timeout", 10_000 // pool acquire
        );
    }

    public UploadResult uploadResume(String userId, MultipartFile file) {
        String mime = detectMimeType(file);
        if (!configured) {
            return storeLocally("resumes", userId, file, mime);
        }
        try {
            // Predictable, non-PII folder convention; unique suffix so a
            // retry never overwrites (or collides with) another stored file.
            String publicId = "euodoo-hire/resumes/" + sanitizeSegment(userId)
                    + "/" + System.currentTimeMillis()
                    + "-" + UUID.randomUUID().toString().substring(0, 8);
            Map<String, Object> options = ObjectUtils.asMap(
                    "public_id", publicId,
                    "resource_type", "raw",
                    "type", "private",
                    "overwrite", false
            );
            options.putAll(cloudinaryTimeouts());
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), options);
            return new UploadResult(
                    (String) result.get("public_id"),
                    (String) result.get("secure_url"),
                    file.getOriginalFilename(),
                    mime,
                    file.getSize()
            );
        } catch (IOException e) {
            log.error("Resume upload failed for userId={}: {}", userId, e.getMessage());
            throw new BusinessException("UPLOAD_FAILED", "Failed to upload resume. Please try again.");
        }
    }

    /**
     * Uploads a certificate document under a private, per-owner Cloudinary
     * folder. Retry-safe: every upload gets a unique suffix so a repeated
     * submission can never overwrite or collide with another stored file.
     */
    public UploadResult uploadCertificate(String userId, MultipartFile file) {
        String mime = detectMimeType(file);
        if (!configured) {
            return storeLocally("certificates", userId, file, mime);
        }
        try {
            String publicId = "euodoo-hire/certificates/" + sanitizeSegment(userId)
                    + "/" + System.currentTimeMillis()
                    + "-" + UUID.randomUUID().toString().substring(0, 8);
            Map<String, Object> options = ObjectUtils.asMap(
                    "public_id", publicId,
                    "resource_type", "raw",
                    "type", "private",
                    "overwrite", false
            );
            options.putAll(cloudinaryTimeouts());
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), options);
            return new UploadResult(
                    (String) result.get("public_id"),
                    (String) result.get("secure_url"),
                    file.getOriginalFilename(),
                    mime,
                    file.getSize()
            );
        } catch (IOException e) {
            log.error("Certificate upload failed for userId={}: {}", userId, e.getMessage());
            throw new BusinessException("UPLOAD_FAILED", "Failed to upload certificate document. Please try again.");
        }
    }

    public UploadResult uploadProfilePicture(String userId, MultipartFile file) {
        String mime = detectMimeType(file);
        if (!configured) {
            return storeLocally("profile-pictures", userId, file, mime);
        }
        try {
            String publicId = "euodoo-hire/profile-pictures/" + sanitizeSegment(userId)
                    + "-" + System.currentTimeMillis();
            Map<String, Object> options = ObjectUtils.asMap(
                    "public_id", publicId,
                    "resource_type", "image",
                    "overwrite", false,
                    "transformation", "c_fill,w_400,h_400,g_face"
            );
            options.putAll(cloudinaryTimeouts());
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), options);
            return new UploadResult(
                    (String) result.get("public_id"),
                    (String) result.get("secure_url"),
                    file.getOriginalFilename(),
                    mime,
                    file.getSize()
            );
        } catch (IOException e) {
            log.error("Profile picture upload failed for userId={}: {}", userId, e.getMessage());
            throw new BusinessException("UPLOAD_FAILED", "Failed to upload profile picture. Please try again.");
        }
    }

    private UploadResult storeLocally(String folder, String ownerId, MultipartFile file, String mime) {
        if (!localEnabled || localRoot == null) {
            throw new BusinessException("STORAGE_NOT_CONFIGURED",
                    "File storage is not configured. Contact support.");
        }
        String relative = folder + "/" + sanitizeSegment(ownerId) + "/"
                + UUID.randomUUID() + extensionFor(file.getOriginalFilename(), mime);
        Path target = resolveInsideRoot(relative);
        try {
            Files.createDirectories(target.getParent());
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("Local file write failed [path={}]: {}", relative, e.getMessage());
            throw new BusinessException("UPLOAD_FAILED", "Failed to upload file. Please try again.");
        }
        String publicId = LOCAL_PREFIX + relative;
        return new UploadResult(
                publicId,
                getSecureUrl(publicId, mime),
                file.getOriginalFilename(),
                mime,
                file.getSize()
        );
    }

    // ─────────────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────────────

    public void deleteFile(String publicId) {
        if (publicId == null) return;

        if (isLocalPublicId(publicId)) {
            String relative = localRelativePath(publicId);
            // Files written before the storage root became absolute live under
            // one of the legacy roots; delete wherever the file actually is.
            java.util.List<Path> roots = new java.util.ArrayList<>();
            roots.add(localRoot);
            roots.addAll(legacyRoots);
            for (Path root : roots) {
                if (root == null) continue;
                try {
                    Files.deleteIfExists(resolveInsideRoot(root, relative));
                } catch (BusinessException e) {
                    log.warn("Refused to delete local file with unsafe path [publicId={}]", publicId);
                } catch (IOException e) {
                    log.warn("Failed to delete local file [publicId={}]: {}", publicId, e.getMessage());
                }
            }
            return;
        }

        if (!configured) return;
        // Profile pictures (both the legacy "profile-pictures/..." ids and the
        // prefixed "euodoo-hire/profile-pictures/..." ids) were uploaded as
        // resource_type="image"; everything else is "raw".
        String resourceType = publicId.contains("profile-pictures/") ? "image" : "raw";
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.asMap("resource_type", resourceType));
        } catch (Exception e) {
            log.warn("Failed to delete file [publicId={}, resourceType={}]: {}", publicId, resourceType, e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────
    // Read
    // ─────────────────────────────────────────────────

    /**
     * Returns a time-limited URL the browser can open to read the file.
     * Cloudinary returns its own signed private URL; local files get a signed
     * URL to {@code GET /api/files/local} that this service can verify.
     */
    public String getSecureUrl(String publicId, String mimeType) {
        if (isLocalPublicId(publicId)) {
            String relative = localRelativePath(publicId);
            long expiresAt = Instant.now().getEpochSecond() + LOCAL_URL_TTL_SECONDS;
            String signature = sign(relative + "|" + expiresAt);
            return "/api/files/local?path=" + URLEncoder.encode(relative, StandardCharsets.UTF_8)
                    + "&exp=" + expiresAt + "&sig=" + signature;
        }

        assertConfigured();
        try {
            // Derive Cloudinary format string from MIME type
            String format = MIME_DOCX.equals(mimeType) ? "docx" : "pdf";
            @SuppressWarnings("unchecked")
            Map<String, Object> options = ObjectUtils.asMap(
                    "resource_type", "raw",
                    "type", "private",
                    "expires_at", (System.currentTimeMillis() / 1000) + 3600
            );
            return cloudinary.privateDownload(publicId, format, options);
        } catch (Exception e) {
            throw new BusinessException("URL_GENERATION_FAILED",
                    "Failed to generate secure download URL.");
        }
    }

    /**
     * Cheap existence probe for a stored file, without reading its bytes.
     * Local files are checked across the canonical root and the legacy
     * fallback roots; remote (Cloudinary) ids are assumed present — the
     * fetch itself reports any failure for those.
     */
    public boolean storedFileExists(String publicId) {
        if (publicId == null || publicId.isBlank()) {
            return false;
        }
        if (isLocalPublicId(publicId)) {
            Path path = locateExistingRelative(localRelativePath(publicId));
            return path != null && Files.isRegularFile(path);
        }
        return true;
    }

    /**
     * Downloads the stored file's bytes. Local files are read directly from
     * disk; Cloudinary files are fetched over the private, signed URL
     * server-side so the bytes never leave the backend.
     */
    public byte[] fetchFile(String publicId, String mimeType) {
        if (isLocalPublicId(publicId)) {
            Path path = locateExistingRelative(localRelativePath(publicId));
            if (path == null || !Files.isRegularFile(path)) {
                log.warn("Stored resume file is missing [publicId={}, primaryRoot={}]", publicId,
                        localRoot != null ? localRoot : "(local storage not active)");
                throw new BusinessException("RESUME_FETCH_FAILED",
                        "The stored resume file is missing. Please re-upload the resume or choose another version.");
            }
            try {
                return Files.readAllBytes(path);
            } catch (IOException e) {
                log.warn("Failed to read local file [publicId={}]: {}", publicId, e.getMessage());
                throw new BusinessException("RESUME_FETCH_FAILED",
                        "Failed to read the stored resume from file storage.");
            }
        }

        String url = getSecureUrl(publicId, mimeType);
        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .followRedirects(java.net.http.HttpClient.Redirect.NORMAL).build();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .GET()
                    .build();
            java.net.http.HttpResponse<byte[]> response =
                    client.send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BusinessException("RESUME_FETCH_FAILED",
                        "Failed to read the stored resume from file storage.");
            }
            return response.body();
        } catch (BusinessException e) {
            throw e;
        } catch (java.io.IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("Failed to fetch stored file [publicId={}]: {}", publicId, e.getMessage());
            throw new BusinessException("RESUME_FETCH_FAILED",
                    "Failed to read the stored resume from file storage.");
        }
    }

    /**
     * Verifies a signed local-file URL and reads the file it points at.
     * Used by the public {@code /api/files/local} endpoint.
     */
    public ByteFile readSignedLocalFile(String relativePath, long expiresAt, String signature) {
        if (relativePath == null || relativePath.isBlank() || signature == null) {
            throw new BusinessException("INVALID_FILE_TOKEN", "This file link is not valid.");
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new BusinessException("EXPIRED_FILE_TOKEN", "This file link has expired. Please try again.");
        }
        String expected = sign(relativePath + "|" + expiresAt);
        if (!constantTimeEquals(expected, signature)) {
            throw new BusinessException("INVALID_FILE_TOKEN", "This file link is not valid.");
        }
        Path path = locateExistingRelative(relativePath);
        if (path == null || !Files.isRegularFile(path)) {
            throw new BusinessException("FILE_NOT_FOUND", "This file is no longer available.");
        }
        try {
            String filename = path.getFileName().toString();
            return new ByteFile(Files.readAllBytes(path), filename, contentTypeFor(filename));
        } catch (IOException e) {
            throw new BusinessException("FILE_NOT_FOUND", "This file is no longer available.");
        }
    }

    // ─────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────

    private boolean isLocalPublicId(String publicId) {
        return publicId != null && publicId.startsWith(LOCAL_PREFIX);
    }

    private String localRelativePath(String publicId) {
        return publicId.substring(LOCAL_PREFIX.length());
    }

    private void assertConfigured() {
        if (!configured) {
            throw new BusinessException("STORAGE_NOT_CONFIGURED",
                    "File storage is not configured. Contact support.");
        }
    }

    /** Resolves a stored relative path against the primary root, refusing anything outside it. */
    private Path resolveInsideRoot(String relativePath) {
        return resolveInsideRoot(localRoot, relativePath);
    }

    /** Resolves a stored relative path against the given root, refusing anything outside it. */
    private Path resolveInsideRoot(Path baseRoot, String relativePath) {
        if (baseRoot == null) {
            throw new BusinessException("STORAGE_NOT_CONFIGURED",
                    "File storage is not configured. Contact support.");
        }
        String cleaned = relativePath.replace('\\', '/');
        if (cleaned.startsWith("/") || cleaned.contains("..")) {
            throw new BusinessException("INVALID_STORAGE_PATH", "Invalid file reference.");
        }
        Path resolved = baseRoot.resolve(cleaned).normalize();
        if (!resolved.startsWith(baseRoot)) {
            throw new BusinessException("INVALID_STORAGE_PATH", "Invalid file reference.");
        }
        return resolved;
    }

    /**
     * Finds an existing file by relative path: primary root first, then the
     * legacy roots (files written before the canonical root was fixed). Used
     * only for reading, never for writing — new files always land under the
     * primary root.
     */
    private Path locateExistingRelative(String relativePath) {
        Path primary = resolveInsideRoot(relativePath);
        if (Files.isRegularFile(primary)) {
            return primary;
        }
        for (Path legacy : legacyRoots) {
            try {
                Path candidate = resolveInsideRoot(legacy, relativePath);
                if (Files.isRegularFile(candidate)) {
                    return candidate;
                }
            } catch (BusinessException e) {
                // unsafe reference: never fall back past a rejected path
                break;
            }
        }
        return null;
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(effectiveSigningSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new BusinessException("URL_GENERATION_FAILED", "Failed to generate secure download URL.");
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private String sanitizeSegment(String value) {
        if (value == null || value.isBlank()) return "unknown";
        return value.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    private String extensionFor(String originalFilename, String mime) {
        if (originalFilename != null) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0 && dot < originalFilename.length() - 1) {
                String ext = originalFilename.substring(dot + 1).toLowerCase(Locale.ROOT);
                if (ext.matches("[a-z0-9]{1,5}")) return "." + ext;
            }
        }
        return contentTypeExtension(mime);
    }

    private String contentTypeExtension(String mime) {
        if (mime == null) return ".bin";
        return switch (mime) {
            case "application/pdf" -> ".pdf";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> ".docx";
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            default -> ".bin";
        };
    }

    private String contentTypeFor(String filename) {
        return switch (extensionFor(filename, null)) {
            case ".pdf" -> "application/pdf";
            case ".docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case ".png" -> "image/png";
            case ".jpg", ".jpeg" -> "image/jpeg";
            default -> "application/octet-stream";
        };
    }

    /**
     * Determines the file's mime type from its actual content (magic bytes)
     * first, and only falls back to the client-declared content type when the
     * bytes are not recognisable. This prevents an attacker from hiding an
     * HTML/script payload behind a ".pdf" or ".docx" name or an innocent
     * Content-Type header; the parse-based validators below still run on top.
     */
    private String detectMimeType(MultipartFile file) {
        String sniffed = detectContentTypeFromBytes(file);
        if (sniffed != null) {
            return sniffed;
        }
        String contentType = file.getContentType();
        return contentType != null ? contentType.toLowerCase(Locale.ROOT) : "application/octet-stream";
    }

    /** Reads the file header and maps well-known magic bytes to a mime type, or null when unknown. */
    private String detectContentTypeFromBytes(MultipartFile file) {
        if (file == null) return null;
        try (InputStream in = file.getInputStream()) {
            byte[] header = in.readNBytes(8);
            if (header.length >= 5 && header[0] == '%' && header[1] == 'P' && header[2] == 'D'
                    && header[3] == 'F' && header[4] == '-') {
                return MIME_PDF;
            }
            if (header.length >= 4 && header[0] == 0x50 && header[1] == 0x4B
                    && header[2] == 0x03 && header[3] == 0x04) {
                // Zip container: a real DOCX is a zip payload (POI still parses
                // and validates it afterwards; plain ZIPs fail that check).
                return MIME_DOCX;
            }
            if (header.length >= 4 && header[0] == (byte) 0x89 && header[1] == 0x50
                    && header[2] == 0x4E && header[3] == 0x47) {
                return MIME_PNG;
            }
            if (header.length >= 3 && (header[0] & 0xFF) == 0xFF
                    && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF) {
                return MIME_JPEG;
            }
        } catch (IOException e) {
            log.debug("Could not sniff file header: {}", e.getMessage());
        }
        return null;
    }

    private void validatePdf(MultipartFile file) {
        try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(file.getBytes())) {
            if (doc.getNumberOfPages() < 1) {
                throw new BusinessException("INVALID_PDF", "The PDF file appears to be empty.");
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("INVALID_PDF", "The uploaded file is not a valid PDF.");
        }
    }

    private void validateDocx(MultipartFile file) {
        try (InputStream is = file.getInputStream();
             XWPFDocument doc = new XWPFDocument(is)) {
        } catch (Exception e) {
            throw new BusinessException("INVALID_DOCX", "The uploaded file is not a valid DOCX document.");
        }
    }

    public record UploadResult(
            String publicId,
            String secureUrl,
            String originalFilename,
            String mimeType,
            long fileSizeBytes
    ) {}

    /** Bytes plus metadata for a verified local file. */
    public record ByteFile(byte[] bytes, String filename, String contentType) {}
}
