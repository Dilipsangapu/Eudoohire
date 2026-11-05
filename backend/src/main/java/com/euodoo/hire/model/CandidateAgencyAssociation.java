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
@Document(collection = "candidate_agency_associations")
@CompoundIndexes({
    @CompoundIndex(name = "agency_candidate_unique_idx", def = "{'agencyId': 1, 'candidateId': 1}", unique = true)
})
public class CandidateAgencyAssociation {

    @Id
    private String id;

    @Indexed
    private String agencyId;

    /** Reference to CandidateProfile id or User id (standardized to User id of candidate). */
    @Indexed
    private String candidateId;

    private String addedByUserId;

    @Builder.Default
    private CandidateConsentStatus consentStatus = CandidateConsentStatus.GRANTED;

    private String consentNotes;

    @Builder.Default
    private CandidateAssociationStatus status = CandidateAssociationStatus.ACTIVE;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
