package com.euodoo.hire.model;

/**
 * Lifecycle states for a user subscription.
 */
public enum SubscriptionStatus {
    /** Payment order created, awaiting user payment. */
    PENDING,
    /** Payment verified and subscription is active. */
    ACTIVE,
    /** Subscription period has ended (not renewed). */
    EXPIRED,
    /** Payment failed or was rejected. */
    FAILED,
    /** Subscription was cancelled before expiry. */
    CANCELLED
}
