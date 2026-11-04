package com.euodoo.hire.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyDashboardSummaryResponse {

    private long totalClients;
    private long activeClients;
    private long totalJobs;
    private long openJobs;
    private long closedJobs;
    private long totalCandidates;
    private long shortlistedCandidates;
    private long pendingAdminApprovals;
    private long approvedSubmissions;
    private long rejectedSubmissions;
    private long releasedCandidates;
    private long candidatesSentToRecruiters;
    private long upcomingInterviews;
    private long completedInterviews;
    private long selectedCandidates;
    private long successfulPlacements;

    private Map<String, Long> statusDistribution;
}
