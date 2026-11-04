package com.euodoo.hire.model;

/**
 * States for job application workflow.
 *
 * Allowed transitions:
 *   INTERESTED → VIEWED → SHORTLISTED → HIRE_REQUESTED → RELEASED → HIRED
 *   Any state → WITHDRAWN (by candidate)
 *   Any state before HIRED → REJECTED (by recruiter)
 */
public enum ApplicationStatus {
    INTERESTED,
    VIEWED,
    SHORTLISTED,
    HIRE_REQUESTED,
    RELEASED,
    HIRED,
    WITHDRAWN,
    REJECTED
}
