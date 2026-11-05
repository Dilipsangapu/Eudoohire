package com.euodoo.hire.model;

/**
 * Lifecycle states governing the visibility and active status of Job listings.
 *
 * State transitions:
 *   DRAFT → ACTIVE (publish)
 *   ACTIVE → INACTIVE (deactivate / temporarily pause)
 *   INACTIVE → ACTIVE (reactivate)
 *   ACTIVE | INACTIVE | DRAFT → CLOSED (close permanently)
 *   Any → EXPIRED (deadline passed, auto-derived or set by system)
 */
public enum JobStatus {
    /** Initial draft state; not visible in public or candidate search. */
    DRAFT,
    /** Published and actively accepting candidate applications. */
    ACTIVE,
    /** Temporarily deactivated — not visible to candidates, not accepting applications. */
    INACTIVE,
    /** Temporarily paused by recruiter; legacy alias, treated equivalent to INACTIVE. */
    PAUSED,
    /** Permanently closed or archived job requisition. */
    CLOSED,
    /** Application deadline has passed. No new applications accepted. */
    EXPIRED
}
