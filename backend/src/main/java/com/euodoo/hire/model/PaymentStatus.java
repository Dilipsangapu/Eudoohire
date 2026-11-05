package com.euodoo.hire.model;

/**
 * Lifecycle states of an online financial transaction in the platform.
 */
public enum PaymentStatus {
    /** Payment order created and awaiting user completion / gateway confirmation. */
    PENDING,
    /** Payment authorized, verified, and successfully captured by the payment gateway. */
    CAPTURED,
    /** Payment attempt failed, was rejected by bank, or expired at gateway. */
    FAILED,
    /** Captured payment that has been refunded back to payer. */
    REFUNDED,
    /** Payment cancelled before completion. */
    CANCELLED
}
