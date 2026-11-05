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

/**
 * Tracks a candidate's application to a specific job.
 *
 * Workflow: INTERESTED → VIEWED → SHORTLISTED → HIRE_REQUESTED → RELEASED → HIRED
 * Also supports WITHDRAWN (by candidate) and REJECTED (by recruiter/admin).
 *
 * Duplicate prevention: a unique compound index prevents the same candidate
 * from applying to the same job while the application is not WITHDRAWN/REJECTED.
 * The index is enforced at DB level.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "job_applications")
@CompoundIndexes({
    @CompoundIndex(name = "candidate_job_idx", def = "{'candidateUserId': 1, 'jobId': 1}", unique = true),
    @CompoundIndex(name = "job_status_idx", def = "{'jobId': 1, 'status': 1}"),
    @CompoundIndex(name = "candidate_status_idx", def = "{'candidateUserId': 1, 'status': 1}")
})
public class JobApplication {

    @Id
    private String id;

    @Indexed
    private String candidateUserId;

    @Indexed
    private String jobId;

    private String companyId;
    private String recruiterUserId;

    @Builder.Default
    private ApplicationStatus status = ApplicationStatus.INTERESTED;

    private Instant interestedAt;
    private Instant viewedAt;
    private Instant shortlistedAt;
    private Instant hireRequestedAt;
    private Instant releasedAt;
    private Instant hiredAt;
    private Instant withdrawnAt;
    private Instant rejectedAt;

    private String withdrawalReason;
    private String rejectionReason;

    /** Shortlisting note by recruiter. */
    private String recruiterNote;

    private String coverNote;
    private String submittedResumePublicId;
    private String submittedResumeFilename;
    private Double atsScore;
    private String atsEvaluationId;

    /** Status history for audit trail. */
    @Builder.Default
    private List<StatusHistoryEntry> statusHistory = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class StatusHistoryEntry {
        private ApplicationStatus status;
        private Instant changedAt;
        private String changedByUserId;
        private String note;
    }
}
