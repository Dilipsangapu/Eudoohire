package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * Immutable audit log entry for security-sensitive operations.
 *
 * NEVER log: passwords, password hashes, payment signatures,
 * gateway secrets, or full contact information.
 *
 * Log: approvals, rejections, profile releases, plan activations,
 * account deletions, payment verifications.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "audit_logs")
public class AuditLog {

    @Id
    private String id;

    /** User who performed the action. */
    @Indexed
    private String actorUserId;

    /** Role of the actor at the time of the action. */
    private String actorRole;

    /** Type of target record (e.g. "User", "HiringRequest"). */
    private String targetType;

    /** ID of the target record. */
    @Indexed
    private String targetId;

    /** Human-readable action name (e.g. "CANDIDATE_RELEASED"). */
    @Indexed
    private String action;

    @Indexed
    private Instant timestamp;

    /**
     * Safe metadata relevant to the action.
     * Must not contain passwords, secrets, or sensitive PII.
     */
    private Map<String, String> metadata;
}
