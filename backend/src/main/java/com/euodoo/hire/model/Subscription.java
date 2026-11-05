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
 * Subscription record for Recruiter and Candidate subscription plans.
 *
 * <p>Subscription lifecycle: PENDING → ACTIVE → EXPIRED / CANCELLED / FAILED.
 *
 * <p>Duration is server-authoritative and configured via
 * {@code app.subscription.recruiter-duration-days} and
 * {@code app.subscription.candidate-duration-days}.
 *
 * <p>Access guards read {@link #status} == ACTIVE and {@link #expiresAt} > now().
 * Recruiters with no ACTIVE subscription are blocked from candidate search and
 * profile/contact-detail endpoints at the service layer.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "subscriptions")
public class Subscription {

    @Id
    private String id;

    /** The user (CANDIDATE or RECRUITER) who owns this subscription. */
    @Indexed
    private String userId;

    /** Role of the subscriber. */
    private Role userRole;

    /** Plan type: for candidates it mirrors PlanType; for recruiters use RECRUITER_PLAN. */
    private String planName;

    @Builder.Default
    private SubscriptionStatus status = SubscriptionStatus.PENDING;

    /** Payment record that activated this subscription. Null until payment captured. */
    @Indexed
    private String paymentId;

    /** Razorpay gateway order ID for idempotency. */
    @Indexed(unique = true, sparse = true)
    private String gatewayOrderId;

    /** Razorpay gateway payment ID after capture. */
    @Indexed(unique = true, sparse = true)
    private String gatewayPaymentId;

    /** Amount charged in INR. */
    private java.math.BigDecimal amountInr;

    /** Subscription period start. Set when payment is verified. */
    private Instant activatedAt;

    /** Subscription period end. Null while PENDING. */
    private Instant expiresAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
