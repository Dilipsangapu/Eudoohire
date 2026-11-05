package com.euodoo.hire.model;

/**
 * Security roles defining coarse-grained authorization boundaries in Euodoo Hire.
 *
 * <p>CLIENT_ADMIN can only be provisioned through a trusted internal process —
 * never via public registration.
 */
public enum Role {
    /** Job seekers and professionals seeking recruitment opportunities. */
    CANDIDATE,
    /** Corporate recruiters and hiring managers managing job postings and candidate shortlists. */
    RECRUITER,
    /** Platform administrators responsible for compliance, approvals, and audit oversight. */
    CLIENT_ADMIN,
    /** Platform admin alias. */
    ADMIN,
    /** Super admin with full privileges. */
    SUPER_ADMIN,
    /** Primary agency administrator managing agency profile, staff, jobs, candidates, and submissions. */
    AGENCY_ADMIN,
    /** Agency staff managing assigned jobs, candidates, and submissions. */
    AGENCY_STAFF
}
