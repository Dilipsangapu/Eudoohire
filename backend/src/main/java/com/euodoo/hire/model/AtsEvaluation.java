package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * One completed ATS evaluation of a resume against a real job.
 *
 * Created ONLY by the backend after the scoring engine successfully produced a
 * deterministic score from real resume text and real job requirements. Scores
 * are never accepted from the frontend. Failed extractions/requests do not
 * create documents.
 *
 * Usage accounting is separated by {@code kind}:
 * - CANDIDATE_SELF: candidate-initiated checks; they consume the candidate's
 *   per-plan ATS allowance (tracked in AtsUsage).
 * - RECRUITER: recruiter-initiated evaluations; they never consume the
 *   candidate's allowance.
 *
 * Directories store REFERENCES (userId/jobId), never duplicated user records.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "ats_evaluations")
@CompoundIndexes({
    // Candidate history list: newest first for one candidate
    @CompoundIndex(name = "candidate_createdAt_idx", def = "{'candidateUserId': 1, 'createdAt': -1}"),
    // Recruiter result retrieval for a specific candidate + job
    @CompoundIndex(name = "candidate_job_idx", def = "{'candidateUserId': 1, 'jobId': 1, 'createdAt': -1}"),
    // Recruiter feed of evaluations they initiated
    @CompoundIndex(name = "recruiter_createdAt_idx", def = "{'recruiterUserId': 1, 'createdAt': -1}"),
    // Idempotency: a repeated identical submission replays the original result
    @CompoundIndex(name = "candidate_idempotency_idx", def = "{'candidateUserId': 1, 'idempotencyKey': 1}",
            unique = true, sparse = true),
    // Resume Management: latest evaluation for one stored resume version
    @CompoundIndex(name = "candidate_resume_created_idx",
            def = "{'candidateUserId': 1, 'resumeId': 1, 'createdAt': -1}")
})
public class AtsEvaluation {

    /** Candidate-initiated self-service check. */
    public static final String KIND_CANDIDATE_SELF = "CANDIDATE_SELF";
    /** Recruiter-initiated evaluation of a candidate's resume against a job. */
    public static final String KIND_RECRUITER = "RECRUITER";

    public static final String STATUS_COMPLETED = "COMPLETED";

    @Id
    private String id;

    /** CANDIDATE_SELF or RECRUITER. */
    @Indexed
    private String kind;

    /** The candidate whose resume was evaluated (always set). */
    @Indexed
    private String candidateUserId;

    /** The authenticated recruiter who initiated the evaluation (RECRUITER kind only). */
    private String recruiterUserId;

    /** Target job reference, when the evaluation targeted a real Job record. */
    @Indexed
    private String jobId;

    /** Snapshot of the real job title at evaluation time (for history display). */
    private String jobTitle;

    /** The job description text actually used for scoring (full JD or the Job's description). */
    private String jobDescriptionUsed;

    /** Resume source descriptor, e.g. "FILE:resume.pdf", "TEXT:paste", "STORED:<publicId>". */
    private String resumeRef;

    /**
     * The stored resume version that was scored ({@code CandidateResume.id}).
     * Set only when the evaluation used a resume from the candidate's stored
     * version history — a transient upload or pasted text has no version and
     * must never be presented as the score of a stored resume.
     */
    private String resumeId;

    /** Version number of {@link #resumeId} at evaluation time (display snapshot). */
    private Integer resumeVersion;

    /** Filename of the scored resume at evaluation time (display snapshot). */
    private String resumeFilename;

    /** Final ATS score 0-100 produced by the backend scoring engine. */
    private int score;

    /** Full deterministic breakdown from AtsScoringService (per-category scores, weights, notes). */
    private Map<String, Object> breakdown;

    /** Required skills the resume actually matched. */
    @Builder.Default
    private List<String> matchedRequiredSkills = new ArrayList<>();

    /** Required skills from the job that the resume did NOT evidence. */
    @Builder.Default
    private List<String> missingRequiredSkills = new ArrayList<>();

    /** Preferred skills the resume actually matched. */
    @Builder.Default
    private List<String> matchedPreferredSkills = new ArrayList<>();

    /** Preferred skills from the job that the resume did NOT evidence. */
    @Builder.Default
    private List<String> missingPreferredSkills = new ArrayList<>();

    @Builder.Default
    private String status = STATUS_COMPLETED;

    /**
     * Optional client-supplied idempotency key for the candidate self-service
     * flow: a resubmitted identical request replays the original result
     * without consuming another check.
     */
    private String idempotencyKey;

    /** Which plan's allowance was applied (candidate self-service only). */
    private String planApplied;

    @CreatedDate
    @Indexed
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
