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
@Document(collection = "agency_placements")
@CompoundIndexes({
    @CompoundIndex(name = "agency_placement_status_idx", def = "{'agencyId': 1, 'placementStatus': 1}"),
    @CompoundIndex(name = "candidate_placement_unique_idx", def = "{'candidateId': 1, 'jobId': 1, 'agencyId': 1}")
})
public class AgencyPlacement {

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

    @Indexed
    private String submissionId;

    private String designation;

    private long offeredSalaryInr;

    private String joiningDate;

    private Instant placementConfirmationDate;

    private String employmentType;

    @Builder.Default
    private PlacementStatus placementStatus = PlacementStatus.OFFER_RELEASED;

    private String remarks;

    private String confirmedByUserId;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
