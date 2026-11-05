package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.CandidateCertification;
import com.euodoo.hire.repository.CandidateCertificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Candidate certifications / licenses. Every record is owned by exactly one
 * candidate; identity always flows in from the authenticated session, never
 * from client-supplied user ids.
 *
 * Order of operations on add guarantees neither false records nor orphans:
 * the document upload happens FIRST; only once storage succeeds is metadata
 * persisted. A persistence failure deletes the just-uploaded file again.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CertificationService {

    private final CandidateCertificationRepository repository;
    private final FileStorageService fileStorageService;

    /** Accepted "no expiration" expressions, checked without punctuation. */
    private static final String NEVER_EXPIRES_PATTERN = "^(never|noexpiration|noexpiry|notexpire)$";

    private static final int TITLE_MAX = 100;
    private static final int ISSUER_MAX = 120;
    private static final int CREDENTIAL_ID_MAX = 100;
    private static final int URL_MAX = 512;
    private static final int DATE_MAX = 40;

    public record CertificationInput(
            String title,
            String issuer,
            String issueDate,
            String expirationDate,
            boolean neverExpires,
            String credentialId,
            String verificationUrl,
            MultipartFile file) {}

    /** Certifications of the authenticated candidate, newest first. */
    public Map<String, Object> listForCandidate(String userId) {
        List<CandidateCertification> items = repository.findByCandidateUserIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> content = new ArrayList<>();
        for (CandidateCertification cert : items) {
            content.add(toClient(cert));
        }
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("content", content);
        res.put("totalElements", content.size());
        return res;
    }

    /**
     * Validates and persists a new certification for the candidate.
     *
     * @throws com.euodoo.hire.exception.BusinessException on validation
     *         failure, duplicate records or upload failure
     */
    public Map<String, Object> add(String userId, CertificationInput input) {
        String title = requireText(input.title(), "certification name", TITLE_MAX);
        String issuer = requireText(input.issuer(), "issuing organization", ISSUER_MAX);
        String credentialId = cleanText(input.credentialId());
        if (credentialId != null && credentialId.length() > CREDENTIAL_ID_MAX) {
            throw new BusinessException("INVALID_FIELD",
                    "Credential ID must be shorter than " + (CREDENTIAL_ID_MAX + 1) + " characters.");
        }
        String verificationUrl = validateUrl(cleanText(input.verificationUrl()));

        boolean neverExpires = input.neverExpires();
        String expirationDate = null;
        if (!neverExpires) {
            expirationDate = cleanText(input.expirationDate());
            if (expirationDate != null) {
                if (isNeverExpiresExpression(expirationDate)) {
                    neverExpires = true;
                } else {
                    expirationDate = validateDate(expirationDate, "expiration date");
                }
            }
            // No expiry given at all → the credential never expires.
            if (expirationDate == null) {
                neverExpires = true;
            }
        }
        String issueDate = cleanText(input.issueDate());
        if (issueDate != null) {
            issueDate = validateDate(issueDate, "issue date");
        }

        rejectDuplicate(userId, title, issuer);

        MultipartFile file = input.file();
        if (file != null && !file.isEmpty()) {
            fileStorageService.validateCertificate(file);
        }

        CandidateCertification cert = CandidateCertification.builder()
                .candidateUserId(userId)
                .title(title)
                .issuer(issuer)
                .issueDate(issueDate)
                .expirationDate(neverExpires ? null : expirationDate)
                .neverExpires(neverExpires)
                .credentialId(credentialId)
                .verificationUrl(verificationUrl)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        if (file != null && !file.isEmpty()) {
            FileStorageService.UploadResult stored = fileStorageService.uploadCertificate(userId, file);
            cert.setStoredPublicId(stored.publicId());
            cert.setOriginalFilename(cleanText(stored.originalFilename()));
            cert.setMimeType(stored.mimeType());
            cert.setFileSizeBytes(Math.max(0, stored.fileSizeBytes()));
        }

        try {
            cert = repository.save(cert);
        } catch (RuntimeException persistFailure) {
            // Roll the uploaded document back so no orphan file remains and
            // the failed request leaves no half-created state behind.
            if (cert.getStoredPublicId() != null) {
                try {
                    fileStorageService.deleteFile(cert.getStoredPublicId());
                } catch (RuntimeException cleanupFailure) {
                    log.warn("Could not clean up uploaded certificate [publicId={}] after persistence "
                            + "failure for userId={}: {}", cert.getStoredPublicId(), userId, cleanupFailure.getMessage());
                }
            }
            log.error("Failed to persist certification for userId={}", userId);
            throw new BusinessException("SAVE_FAILED", "Could not save the certification. Please try again.");
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", "Certification added successfully.");
        res.put("certification", toClient(cert));
        return res;
    }

    /** Deletes one of the candidate's own certifications (and its document). */
    public void delete(String userId, String certificationId) {
        CandidateCertification cert = requireOwned(userId, certificationId);
        repository.delete(cert);
        // The DB record is already gone; storage cleanup is best-effort so a
        // transient Cloudinary error can never break the user-facing delete.
        if (cert.getStoredPublicId() != null) {
            try {
                fileStorageService.deleteFile(cert.getStoredPublicId());
            } catch (RuntimeException e) {
                log.warn("Leaked certificate document after delete [publicId={}]: {}",
                        cert.getStoredPublicId(), e.getMessage());
            }
        }
    }

    /** Strict ownership check used by every per-id endpoint. */
    public CandidateCertification requireOwned(String userId, String certificationId) {
        if (certificationId == null || certificationId.isBlank()) {
            throw new BusinessException("NOT_FOUND", "Certification not found.");
        }
        return repository.findFirstByIdAndCandidateUserId(certificationId, userId)
                .orElseThrow(() -> new AccessDeniedBusinessException("You do not own this certification."));
    }

    /** True when the candidate has at least one certification (profile strength). */
    public boolean hasAny(String userId) {
        return !repository.findByCandidateUserIdOrderByCreatedAtDesc(userId).isEmpty();
    }

    // ─────────────────────────────────────────────────
    // Validation helpers
    // ─────────────────────────────────────────────────

    private String requireText(String value, String label, int maxLength) {
        String cleaned = cleanText(value);
        if (cleaned == null) {
            throw new BusinessException("MISSING_FIELD", "Please enter the " + label + ".");
        }
        if (cleaned.length() > maxLength) {
            throw new BusinessException("INVALID_FIELD",
                    "The " + label + " must be shorter than " + (maxLength + 1) + " characters.");
        }
        return cleaned;
    }

    private String cleanText(String value) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s+", " ");
        return cleaned.isEmpty() ? null : cleaned;
    }

    private void rejectDuplicate(String userId, String title, String issuer) {
        List<CandidateCertification> existing = repository
                .findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(userId, title, issuer);
        if (!existing.isEmpty()) {
            throw new BusinessException("DUPLICATE_CERTIFICATION",
                    "You have already added a certification with this name and organization.");
        }
    }

    /**
     * Validates an optional http(s) verification URL. Any URL the browser
     * accepts as type=url should pass here as well.
     */
    private String validateUrl(String value) {
        if (value == null) return null;
        if (value.length() > URL_MAX) {
            throw new BusinessException("INVALID_URL", "The verification URL is too long.");
        }
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                    || uri.getHost() == null || uri.getHost().isBlank()) {
                throw new BusinessException("INVALID_URL",
                        "The verification URL must be a valid http or https address.");
            }
        } catch (IllegalArgumentException e) {
            throw new BusinessException("INVALID_URL",
                    "The verification URL must be a valid http or https address.");
        }
        return value;
    }

    private boolean isNeverExpiresExpression(String value) {
        String letters = value.replaceAll("[^a-zA-Z]", "").toLowerCase(Locale.ROOT);
        return letters.matches(NEVER_EXPIRES_PATTERN);
    }

    /**
     * Accepts realistic date representations ("May 2024", "2024-05",
     * "2024-05-01", "May 1, 2024", "2024") and keeps them as the candidate
     * wrote them. Anything that cannot be a real date is rejected.
     */
    private String validateDate(String value, String label) {
        if (value.length() > DATE_MAX) {
            throw new BusinessException("INVALID_DATE",
                    "The " + label + " looks too long. Use a date such as May 2024 or 2024-05.");
        }
        if (parseAsValidDate(value)) {
            return value;
        }
        throw new BusinessException("INVALID_DATE",
                "The " + label + " must be a real date such as May 2024 or 2024-05.");
    }

    private boolean parseAsValidDate(String value) {
        String trimmed = value.trim();
        // ISO full date first (strict).
        try {
            LocalDate.parse(trimmed, DateTimeFormatter.ISO_LOCAL_DATE);
            return true;
        } catch (DateTimeParseException ignored) {
            // try the other accepted formats below
        }
        // Month-name dates that include a day ("May 1, 2024", "1 May 2024").
        for (String pattern : DAY_INCLUSIVE_PATTERNS) {
            try {
                LocalDate.parse(trimmed, caseInsensitiveFormatter(pattern));
                return true;
            } catch (DateTimeParseException ignored) {
                // try the next candidate format
            }
        }
        // Month + year only ("May 2024", "2024-05", "05/2024", "2024").
        for (String pattern : MONTH_YEAR_PATTERNS) {
            try {
                YearMonth.parse(trimmed, caseInsensitiveFormatter(pattern));
                return true;
            } catch (DateTimeParseException ignored) {
                // try the next candidate format
            }
        }
        // Year only ("2024")
        try {
            Year.parse(trimmed);
            return true;
        } catch (DateTimeParseException ignored) {
            // not a 4-digit year
        }
        return false;
    }

    /** Month + year patterns, with and without a separator, either order. */
    private static final String[] MONTH_YEAR_PATTERNS =
            {"MM/uuuu", "MM-uuuu", "uuuu/MM", "uuuu-MM", "MMMM uuuu", "MMM uuuu"};

    /** Full calendar-date patterns using month names. */
    private static final String[] DAY_INCLUSIVE_PATTERNS =
            {"d MMMM uuuu", "d MMM uuuu", "MMMM d, uuuu", "MMM d, uuuu"};

    private DateTimeFormatter caseInsensitiveFormatter(String pattern) {
        return new DateTimeFormatterBuilder()
                .parseCaseInsensitive()
                .appendPattern(pattern)
                .toFormatter(Locale.ENGLISH);
    }

    // ─────────────────────────────────────────────────
    // Client mapping
    // ─────────────────────────────────────────────────

    /** API representation; never includes storage internals. */
    public Map<String, Object> toClient(CandidateCertification cert) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", cert.getId());
        map.put("candidateUserId", cert.getCandidateUserId());
        map.put("title", cert.getTitle());
        map.put("issuer", cert.getIssuer());
        map.put("issueDate", cert.getIssueDate());
        map.put("expirationDate", cert.getExpirationDate());
        map.put("neverExpires", cert.isNeverExpires());
        map.put("credentialId", cert.getCredentialId());
        map.put("verificationUrl", cert.getVerificationUrl());
        boolean hasDocument = cert.getStoredPublicId() != null && !cert.getStoredPublicId().isBlank()
                && fileStorageService.storedFileExists(cert.getStoredPublicId());
        map.put("hasDocument", hasDocument);
        map.put("documentKind", hasDocument ? describeDocument(cert.getOriginalFilename(), cert.getMimeType()) : null);
        map.put("documentUrl", hasDocument
                ? "/api/candidate/certifications/" + cert.getId() + "/file" : null);
        map.put("createdAt", cert.getCreatedAt());
        return map;
    }

    private String describeDocument(String filename, String mimeType) {
        if (mimeType != null && mimeType.contains("pdf")) return "PDF";
        if (mimeType != null && mimeType.contains("png")) return "PNG";
        if (mimeType != null && (mimeType.contains("jpeg") || mimeType.contains("jpg"))) return "JPG";
        if (filename != null && filename.lastIndexOf('.') >= 0) {
            return filename.substring(filename.lastIndexOf('.') + 1).toUpperCase(Locale.ROOT);
        }
        return "Document";
    }
}
