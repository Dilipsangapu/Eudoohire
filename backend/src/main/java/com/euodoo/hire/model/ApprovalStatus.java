package com.euodoo.hire.model;

/**
 * Administrative verification and approval states for companies and recruiter profiles.
 */
public enum ApprovalStatus {
    /** Submitted for verification and pending administrative review. */
    PENDING,
    /** Successfully verified and approved by a platform administrator. */
    APPROVED,
    /** Rejected by a platform administrator with a recorded rejection reason. */
    REJECTED
}
