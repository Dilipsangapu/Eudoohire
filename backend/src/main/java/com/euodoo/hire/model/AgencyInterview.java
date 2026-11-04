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
@Document(collection = "agency_interviews")
@CompoundIndexes({
    @CompoundIndex(name = "submission_round_idx", def = "{'submissionId': 1, 'roundNumber': 1}"),
    @CompoundIndex(name = "agency_interview_date_idx", def = "{'agencyId': 1, 'interviewDate': 1}")
})
public class AgencyInterview {

    @Id
    private String id;

    @Indexed
    private String submissionId;

    @Indexed
    private String candidateId;

    @Indexed
    private String jobId;

    @Indexed
    private String agencyId;

    @Indexed
    private String clientCompanyId;

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

    @Builder.Default
    private InterviewStatus interviewStatus = InterviewStatus.SCHEDULED;

    private String feedback;

    private Integer rating;

    private String nextInterviewDate;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
