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
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "candidate_shortlists")
@CompoundIndexes({
    @CompoundIndex(name = "agency_job_candidate_idx", def = "{'agencyId': 1, 'jobId': 1, 'candidateId': 1}")
})
public class CandidateShortlist {

    @Id
    private String id;

    @Indexed
    private String agencyId;

    @Indexed
    private String candidateId;

    @Indexed
    private String jobId;

    @Builder.Default
    private List<String> matchingSkills = new ArrayList<>();

    private double matchingPercentage;

    private boolean experienceMatch;

    private boolean qualificationMatch;

    private boolean salaryMatch;

    private String shortlistingNotes;

    private String shortlistedByUserId;

    @Builder.Default
    private ShortlistStatus shortlistStatus = ShortlistStatus.ACTIVE;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
