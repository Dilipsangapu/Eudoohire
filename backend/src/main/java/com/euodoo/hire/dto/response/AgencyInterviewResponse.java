package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.InterviewStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyInterviewResponse {

    private String id;
    private String submissionId;
    private String candidateId;
    private String candidateName;
    private String jobId;
    private String jobTitle;
    private String agencyId;
    private String clientCompanyId;
    private String clientCompanyName;
    private int roundNumber;
    private String roundName;
    private String interviewType;
    private String interviewDate;
    private String interviewTime;
    private String interviewMode;
    private String interviewLink;
    private String interviewLocation;
    private String interviewerName;
    private String interviewerEmail;
    private InterviewStatus interviewStatus;
    private String feedback;
    private Integer rating;
    private String nextInterviewDate;
    private Instant createdAt;
    private Instant updatedAt;
}
