package com.euodoo.hire.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Core user account document.
 *
 * Security-sensitive fields (role, accountStatus, plan, planActivated,
 * approvedAt, rejectionReason) must NEVER be set from HTTP request binding.
 * Only trusted service methods and admin operations may mutate them.
 *
 * Passwords are stored as BCrypt hashes. Plaintext passwords are never stored.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "users")
public class User {

    @Id
    private String id;

    @NotBlank
    private String name;

    /** Stored in normalized (lowercased, trimmed) form. Unique index enforced. */
    @NotBlank
    @Email
    @Indexed(unique = true)
    private String email;

    /** BCrypt hash of the user's password. Never plaintext. Never serialized to API responses. */
    @JsonIgnore
    private String passwordHash;

    @NotNull
    private Role role;

    @NotNull
    @Builder.Default
    private AccountStatus accountStatus = AccountStatus.PENDING_APPROVAL;

    // --- Candidate-specific fields ---

    /** Applicable only when role == CANDIDATE. */
    @Builder.Default
    private PlanType plan = PlanType.FREE;

    /**
     * True only after server-side Razorpay payment verification succeeds.
     * Never trust a frontend-supplied value for this flag.
     */
    @Builder.Default
    private boolean planActivated = false;

    // --- Agency-specific fields ---

    /** Reference to Agency document when role is AGENCY_ADMIN or AGENCY_STAFF. */
    @Indexed
    private String agencyId;

    // --- Approval metadata ---

    /** ID of the CLIENT_ADMIN who approved or rejected this account. */
    private String reviewedByAdminId;

    private String rejectionReason;

    private Instant approvedAt;

    private Instant rejectedAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
