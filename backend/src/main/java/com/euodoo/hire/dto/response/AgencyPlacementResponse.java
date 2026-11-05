package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.PlacementStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyPlacementResponse {

    private String id;
    private String candidateId;
    private String candidateName;
    private String candidateEmail;
    private String jobId;
    private String jobTitle;
    private String agencyId;
    private String clientCompanyId;
    private String clientCompanyName;
    private String submissionId;
    private String designation;
    private long offeredSalaryInr;
    private String joiningDate;
    private Instant placementConfirmationDate;
    private String employmentType;
    private PlacementStatus placementStatus;
    private String remarks;
    private String confirmedByUserId;
    private Instant createdAt;
    private Instant updatedAt;
}
