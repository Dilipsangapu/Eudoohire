package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.SubmissionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateSubmissionResponse {

    private String id;
    private String candidateId;
    private String candidateName;
    private String candidateEmail;
    private String jobId;
    private String jobTitle;
    private String agencyId;
    private String agencyName;
    private String clientCompanyId;
    private String clientCompanyName;
    private String submittedByUserId;
    private Instant submissionDate;
    private SubmissionStatus adminReviewStatus;
    private String adminComments;
    private String adminReviewedByUserId;
    private Instant adminReviewDate;
    private Instant adminReleasedAt;
    private String recruiterSubmissionStatus;
    private String recruiterUserId;
    private String recruiterComments;
    private Instant sentToRecruiterAt;
    private String finalSelectionStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
