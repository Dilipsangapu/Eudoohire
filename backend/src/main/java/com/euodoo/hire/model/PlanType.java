package com.euodoo.hire.model;

/**
 * Subscription plan tiers available for candidate accounts.
 *
 * <p>Subscription plans govern candidate feature access and platform visibility.
 * Plans are separate from the security {@link Role} and never confer administrative
 * or recruiter capabilities.
 */
public enum PlanType {
    /** Free default tier with restricted feature access and basic ATS check. */
    FREE,
    /** Standard paid tier offering profile updates, job applications, and resume uploads. */
    BASIC,
    /** Premium paid tier featuring search priority, recruiter prioritization, and premium placement. */
    PREMIUM
}
