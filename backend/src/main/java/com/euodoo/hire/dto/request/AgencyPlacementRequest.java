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
public class AgencyPlacementRequest {

    @NotBlank(message = "Candidate ID is required")
    private String candidateId;

    @NotBlank(message = "Job ID is required")
    private String jobId;

    private String clientCompanyId;

    @NotBlank(message = "Submission ID is required")
    private String submissionId;

    private String designation;

    private long offeredSalaryInr;

    private String joiningDate;

    private String employmentType;

    private String remarks;
}
