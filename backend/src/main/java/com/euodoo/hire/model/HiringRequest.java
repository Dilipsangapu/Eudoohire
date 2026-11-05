package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Hiring request linking a candidate, recruiter, and job.
 *
 * The hiring fee is calculated server-side using the agreed salary and the
 * server-controlled fee percentage. The percentage range (10–12%) must be
 * confirmed by business policy before the value is hardcoded.
 *
 * Note on multi-document atomicity: Creating a HiringRequest and updating
 * the related JobApplication requires a MongoDB replica set for ACID
 * transactions. On a standalone deployment, use idempotent state checks
 * to ensure consistency.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "hiring_requests")
@CompoundIndexes({
    @CompoundIndex(name = "recruiter_paymentStatus_idx", def = "{'recruiterUserId': 1, 'paymentStatus': 1}"),
    @CompoundIndex(name = "candidate_status_idx", def = "{'candidateUserId': 1, 'approvalStatus': 1}")
})
public class HiringRequest {

    @Id
    private String id;

    @Indexed
    private String candidateUserId;

    @Indexed
    private String recruiterUserId;

    private String jobId;
    private String jobApplicationId;
    private String companyId;

    /** Agreed annual salary in INR. */
    private long agreedAnnualSalaryInr;

    /**
     * Hiring fee percentage agreed by admin. Range: 10–12%.
     * This is a server-controlled value; it cannot be supplied by the recruiter.
     */
    private BigDecimal hiringFeePercentage;

    /** Calculated hiring fee = agreedAnnualSalaryInr * hiringFeePercentage / 100. */
    private BigDecimal calculatedHiringFeeInr;

    @Builder.Default
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    /** Whether the candidate has been released to the recruiter. */
    @Builder.Default
    private boolean candidateReleased = false;

    private String paymentId;
    private String approvedByAdminId;
    private String rejectionReason;

    private Instant approvedAt;
    private Instant rejectedAt;
    private Instant paidAt;
    private Instant releasedAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
