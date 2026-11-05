package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * Persistent record of a real engagement action performed in the platform,
 * used by the candidate's "Recruiter Activity Log" table and by recruiters
 * reviewing their own pipeline activity.
 *
 * Events are written by the backend ONLY after the underlying operation has
 * been authorized and completed successfully — never from frontend calls.
 *
 * Documents store REFERENCES (user IDs, job/application/hire IDs) rather than
 * duplicated candidate/recruiter records. Display names are resolved at
 * read time so deleted reference records degrade gracefully.
 *
 * NEVER log: passwords, tokens, resume contents, contact details that the
 * viewer is not authorized to see.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "recruiter_activities")
@CompoundIndexes({
    // Candidate-facing list: newest first for one candidate
    @CompoundIndex(name = "candidate_time_idx", def = "{'candidateUserId': 1, 'timestamp': -1}"),
    // Recruiter-facing list
    @CompoundIndex(name = "recruiter_time_idx", def = "{'recruiterUserId': 1, 'timestamp': -1}"),
    // Deduplication of repeated profile views within a short window
    @CompoundIndex(name = "dedup_idx", def = "{'recruiterUserId': 1, 'candidateUserId': 1, 'eventType': 1, 'timestamp': -1}")
})
public class RecruiterActivity {

    @Id
    private String id;

    /**
     * Authenticated user who performed the action.
     * Null for candidate-initiated events (e.g. ATS_EVALUATED).
     */
    @Indexed
    private String recruiterUserId;

    /** Candidate the action relates to. */
    @Indexed
    private String candidateUserId;

    /** One of the EVENT_* constants (indexed for per-type counts). */
    @Indexed
    private String eventType;

    /** Human-readable description of the action actually performed. */
    private String description;

    /** Related job, when one is genuinely associated with the event. */
    @Indexed
    private String jobId;

    /** Related job application, when one exists. */
    private String jobApplicationId;

    /** Related hiring request, when one exists. */
    private String hiringRequestId;

    /** Company the recruiter acted on behalf of (reference only). */
    @Indexed
    private String companyId;

    /** Actual event timestamp (server clock). */
    @Indexed
    private Instant timestamp;

    /**
     * Safe metadata only: search keyword actually typed by the recruiter,
     * actual ATS score returned by the evaluation, downloaded file name.
     */
    private Map<String, String> metadata;

    // --- Event types ---
    public static final String EVENT_VIEWED_PROFILE = "VIEWED_PROFILE";
    public static final String EVENT_VIEWED_APPLICATION = "VIEWED_APPLICATION";
    public static final String EVENT_DOWNLOADED_RESUME = "DOWNLOADED_RESUME";
    public static final String EVENT_SHORTLISTED = "SHORTLISTED";
    public static final String EVENT_REJECTED = "REJECTED";
    public static final String EVENT_HIRE_REQUESTED = "HIRE_REQUESTED";
    public static final String EVENT_ATS_EVALUATED = "ATS_EVALUATED";
}
