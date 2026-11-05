package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Recruiter professional profile.
 *
 * A recruiter account starts with PENDING_APPROVAL status. Only after the
 * company is verified and the admin approves the recruiter does the account
 * transition to ACTIVE, granting recruiter-scoped permissions.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "recruiter_profiles")
public class RecruiterProfile {

    @Id
    private String id;

    /** Reference to the User document. */
    @Indexed(unique = true)
    private String userId;

    /** Reference to the Company document. */
    @Indexed
    private String companyId;

    private String designation;
    private String department;
    private String phone;
    private String linkedInUrl;

    /** Whether the recruiter's identity has been verified by an admin. */
    @Builder.Default
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    private String reviewedByAdminId;
    private String rejectionReason;
    private Instant approvedAt;
    private Instant rejectedAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
