package com.euodoo.hire.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One professional certification / license added by a candidate from
 * Account Settings → Certifications &amp; Licenses.
 *
 * Dates are stored exactly as the candidate writes them ("May 2024",
 * "2024-05", …) after server-side validation; expiry is optional —
 * {@code neverExpires} is true for credentials without expiration.
 *
 * The certificate document (PDF / PNG / JPG) lives in private file storage
 * (Cloudinary or local disk); its internal identifier is never serialized
 * to clients.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "candidate_certifications")
@CompoundIndex(name = "candidate_cert_recent_idx",
        def = "{'candidateUserId': 1, 'createdAt': -1}")
public class CandidateCertification {

    @Id
    private String id;

    /** Owner. Always derived server-side from the authenticated session. */
    @Indexed
    private String candidateUserId;

    /** Certificate / credential name (required). */
    private String title;

    /** Issuing organization (required). */
    private String issuer;

    /** Free-text validated issue date; null when not provided. */
    private String issueDate;

    /** Free-text validated expiration date; null when neverExpires or absent. */
    private String expirationDate;

    /** True for credentials that do not expire. */
    private boolean neverExpires;

    /** Optional credential ID / number. */
    private String credentialId;

    /** Optional verified verification URL (validated http/https). */
    private String verificationUrl;

    /** Original uploaded filename; null for metadata-only certifications. */
    private String originalFilename;

    /** Sniffed content type of the stored document. */
    private String mimeType;

    private long fileSizeBytes;

    /** Internal storage ID (Cloudinary public id) — never exposed in API responses. */
    @JsonIgnore
    private String storedPublicId;

    private Instant createdAt;

    private Instant updatedAt;
}
