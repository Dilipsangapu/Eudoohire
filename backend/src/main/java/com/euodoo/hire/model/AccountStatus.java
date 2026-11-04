package com.euodoo.hire.model;

/**
 * Lifecycle states for user accounts.
 */
public enum AccountStatus {
    /** Registration submitted, awaiting admin review. */
    PENDING_APPROVAL,
    /** Account is active and fully functional. */
    ACTIVE,
    /** Account was rejected by an admin. */
    REJECTED,
    /** Account has been disabled by an admin. */
    DISABLED
}
