package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.ShortlistStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateShortlistResponse {

    private String id;
    private String agencyId;
    private String candidateId;
    private String candidateName;
    private String candidateEmail;
    private String candidateHeadline;
    private String candidateLocation;
    private int candidateTotalExperienceYears;
    private String jobId;
    private String jobTitle;
    private List<String> matchingSkills;
    private double matchingPercentage;
    private boolean experienceMatch;
    private boolean qualificationMatch;
    private boolean salaryMatch;
    private String shortlistingNotes;
    private String shortlistedByUserId;
    private ShortlistStatus shortlistStatus;
    private Instant createdAt;
    private Instant updatedAt;
}
