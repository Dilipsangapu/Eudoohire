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
public class CandidateShortlistRequest {

    @NotBlank(message = "Candidate ID is required")
    private String candidateId;

    @NotBlank(message = "Job ID is required")
    private String jobId;

    private String notes;
}
