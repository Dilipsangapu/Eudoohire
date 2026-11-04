package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Per-candidate ATS self-service usage counter.
 *
 * Enforcement is concurrency-safe: AtsService reserves one check with an
 * ATOMIC conditional findAndModify ({@code checksUsed < limit} → {@code $inc})
 * so two simultaneous requests can never both consume the last available
 * check. Reservations are released (decremented) when the evaluation fails so
 * failed attempts never consume allowance.
 *
 * Recruiter-initiated evaluations NEVER touch these counters — they are
 * accounted through their own AtsEvaluation records with kind=RECRUITER.
 *
 * This document (MongoDB) is the single source of truth; no local/session
 * storage participates in the limit.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "ats_usage")
public class AtsUsage {

    @Id
    private String id;

    /** The authenticated candidate this counter belongs to (one per candidate). */
    @Indexed(unique = true)
    private String candidateUserId;

    /**
     * Number of successful self-service ATS checks consumed by this candidate
     * (including briefly held in-flight reservations that are released on
     * failure).
     */
    @Builder.Default
    private int checksUsed = 0;

    @LastModifiedDate
    private Instant updatedAt;
}
