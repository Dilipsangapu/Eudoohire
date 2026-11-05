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

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Payment record for candidate plan upgrades and hiring fees.
 *
 * Amounts are stored as BigDecimal. Razorpay amounts are in paise (multiply by 100).
 *
 * Gateway credentials are NEVER stored here. Only gateway order/payment IDs
 * are stored for idempotency and verification.
 *
 * Idempotency: Handlers check gatewayPaymentId before processing
 * to prevent duplicate activations.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "payments")
public class Payment {

    @Id
    private String id;

    /** The user who made this payment. */
    @Indexed
    private String payerUserId;

    @Indexed
    private PaymentPurpose purpose;

    /** Plan being activated, if applicable. */
    private PlanType targetPlan;

    /** HiringRequest ID, if applicable. */
    private String hiringRequestId;

    /** Amount in INR (BigDecimal for precision). */
    private BigDecimal amountInr;

    @Builder.Default
    private String currency = "INR";

    /** Razorpay order ID created server-side before payment. */
    @Indexed(unique = true, sparse = true)
    private String gatewayOrderId;

    /**
     * Razorpay payment ID received after payment capture.
     * Unique index prevents duplicate processing.
     */
    @Indexed(unique = true, sparse = true)
    private String gatewayPaymentId;

    /** Razorpay signature verification token. Server-internal only — never exposed in API responses. */
    @JsonIgnore
    private String gatewaySignatureVerified;

    @Builder.Default
    private PaymentStatus status = PaymentStatus.PENDING;

    /** True after server-side Razorpay signature verification passes. */
    @Builder.Default
    private boolean verified = false;

    private Instant capturedAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
