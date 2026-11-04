package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Resume approval request submitted automatically when a candidate uploads a new resume.
 *
 * A CLIENT_ADMIN must approve the uploaded resume before it becomes visible to recruiters
 * and before a secure download URL can be generated for third-party access.
 *
 * Workflow:
 *   Candidate uploads resume → ResumeApprovalRequest created (PENDING)
 *   → Admin approves → CandidateProfile.resumeApprovalStatus set to APPROVED
 *   → Admin rejects → Candidate notified; resume is removed from storage
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "resume_approval_requests")
public class ResumeApprovalRequest {

    /** Change type when no previous resume version existed (first upload). */
    public static final String CHANGE_NEW = "NEW";
    /** Change type when the candidate replaces an existing resume version. */
    public static final String CHANGE_UPDATE = "UPDATE";

    @Id
    private String id;

    @Indexed
    private String candidateUserId;

    /** Cloudinary/storage public ID of the resume pending approval. */
    private String cloudinaryPublicId;

    /** Original filename as uploaded by the candidate. */
    private String originalFilename;

    /** MIME type: application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document */
    private String mimeType;

    /** File size in bytes. */
    private long fileSizeBytes;

    /** The stored resume version this request refers to ({@code CandidateResume.id}). */
    private String resumeId;

    /** Version number of the submitted resume (display snapshot). */
    private Integer resumeVersion;

    /** {@link #CHANGE_NEW} when this is the candidate's first resume, otherwise {@link #CHANGE_UPDATE}. */
    @Builder.Default
    private String changeType = CHANGE_NEW;

    /** Previously active resume version, when this submission replaces one. */
    private String previousResumeId;

    private Integer previousResumeVersion;

    private String previousFilename;

    @Builder.Default
    private ChangeRequestStatus status = ChangeRequestStatus.PENDING;

    /** CLIENT_ADMIN who reviewed this request. */
    private String reviewedByAdminId;

    /** Optional note from the admin on rejection. */
    private String reviewNote;

    @CreatedDate
    private Instant createdAt;

    private Instant reviewedAt;
}
