package com.euodoo.hire.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "candidate_submissions")
@CompoundIndexes({
    @CompoundIndex(name = "agency_job_candidate_submission_idx", def = "{'agencyId': 1, 'jobId': 1, 'candidateId': 1}"),
    @CompoundIndex(name = "admin_status_created_idx", def = "{'adminReviewStatus': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "recruiter_status_idx", def = "{'recruiterUserId': 1, 'adminReviewStatus': 1}")
})
public class CandidateSubmission {

    @Id
    private String id;

    @Indexed
    private String candidateId;

    @Indexed
    private String jobId;

    @Indexed
    private String agencyId;

    @Indexed
    private String clientCompanyId;

    private String submittedByUserId;

    private Instant submissionDate;

    @Builder.Default
    @Indexed
    private SubmissionStatus adminReviewStatus = SubmissionStatus.DRAFT;

    private String adminComments;

    private String adminReviewedByUserId;

    private Instant adminReviewDate;

    private Instant adminReleasedAt;

    private String recruiterSubmissionStatus;

    @Indexed
    private String recruiterUserId;

    private String recruiterComments;

    private Instant sentToRecruiterAt;

    private String finalSelectionStatus;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
