package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.InterviewStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyInterviewFeedbackRequest {

    @NotNull(message = "Interview status is required")
    private InterviewStatus status;

    private String feedback;

    private Integer rating;

    private String nextInterviewDate;
}
