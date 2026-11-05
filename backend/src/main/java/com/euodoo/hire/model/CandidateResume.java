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
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * One stored resume version belonging to a candidate.
 *
 * The product keeps a version history: uploading a new file (or using
 * "Replace Resume") creates a NEW record and archives the previous one instead
 * of overwriting it. Exactly one record per candidate is {@code active}; the
 * active record is mirrored onto {@link CandidateProfile}'s legacy resume
 * fields so existing recruiter / hire-match flows keep working unchanged.
 *
 * The internal storage identifier is never serialized to clients.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "candidate_resumes")
@CompoundIndexes({
        // Version history: newest first for one candidate
        @CompoundIndex(name = "candidate_version_idx",
                def = "{'candidateUserId': 1, 'version': -1}"),
        // The single active version lookup
        @CompoundIndex(name = "candidate_active_idx",
                def = "{'candidateUserId': 1, 'active': 1}"),
        // Approval flow: locate the version for a storage public id
        @CompoundIndex(name = "stored_public_id_idx", def = "{'storedPublicId': 1}")
})
public class CandidateResume {

    @Id
    private String id;

    /** Owner. Always derived server-side from the authenticated session. */
    @Indexed
    private String candidateUserId;

    /** Per-candidate sequential version number (1, 2, 3, ...). */
    private int version;

    /** Internal storage ID (Cloudinary public id) — never exposed in API responses. */
    @JsonIgnore
    private String storedPublicId;

    private String originalFilename;
    private String mimeType;
    private long fileSizeBytes;

    /** When this version was uploaded. */
    private Instant uploadedAt;

    /** True for exactly one version per candidate (the primary resume). */
    private boolean active;

    /** Admin review state of this specific version. */
    private ChangeRequestStatus approvalStatus;

    /**
     * Source of this resume: "UPLOADED" (uploaded file) or "CREATED" (built/created in app).
     * Defaults to "UPLOADED".
     */
    @Builder.Default
    private String source = "UPLOADED";

    /**
     * Logical group / lineage ID linking multiple versions of the same resume together.
     * All versions of the same resume share the same resumeGroupId.
     */
    private String resumeGroupId;

    /** Custom title or display name for the resume. Defaults to originalFilename if not set. */
    private String resumeTitle;

    /** Template ID selected in resume templates (e.g., 'modern', 'executive', 'minimal', 'creative'). */
    private String templateId;

    /** Accent color chosen for the template. */
    private String accentColor;

    /** Structured resume builder data (personal, education, experience, skills, languages, etc.). */
    private Map<String, Object> resumeData;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
