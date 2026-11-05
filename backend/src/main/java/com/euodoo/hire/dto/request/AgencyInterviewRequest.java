package com.euodoo.hire.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyInterviewRequest {

    @NotBlank(message = "Submission ID is required")
    private String submissionId;

    @Builder.Default
    private int roundNumber = 1;

    private String roundName;

    private String interviewType;

    @NotBlank(message = "Interview date is required")
    private String interviewDate;

    private String interviewTime;

    private String interviewMode;

    private String interviewLink;

    private String interviewLocation;

    private String interviewerName;

    private String interviewerEmail;
}
