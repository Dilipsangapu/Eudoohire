package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.SubmissionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminSubmissionReviewRequest {

    @NotNull(message = "Review status is required")
    private SubmissionStatus status;

    private String comments;
}
