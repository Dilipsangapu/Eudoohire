package com.euodoo.hire.model;

/**
 * Categories of financial transactions recorded in the Payment document.
 */
public enum PaymentPurpose {
    /** Subscription fee payment for Candidate BASIC membership tier. */
    CANDIDATE_PLAN_BASIC,
    /** Subscription fee payment for Candidate PREMIUM membership tier. */
    CANDIDATE_PLAN_PREMIUM,
    /** Recruitment placement success fee paid by Recruiter upon candidate hire. */
    HIRING_FEE,
    /** Subscription fee paid by a Recruiter to access candidate search and profiles. */
    RECRUITER_SUBSCRIPTION,
    /** Subscription fee paid by a Candidate to activate their platform plan. */
    CANDIDATE_SUBSCRIPTION
}
