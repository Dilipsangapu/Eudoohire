package com.euodoo.hire.service;

import com.euodoo.hire.dto.response.*;
import com.euodoo.hire.model.*;
import com.euodoo.hire.model.AgencyInterview;
import com.euodoo.hire.model.AgencyPlacement;
import com.euodoo.hire.model.CandidateSubmission;
import com.euodoo.hire.repository.*;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.JobStatus;
import com.euodoo.hire.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyDashboardService {

    private final AgencyClientRepository clientRepository;
    private final JobRepository jobRepository;
    private final CandidateAgencyAssociationRepository candidateAssociationRepository;
    private final CandidateShortlistRepository shortlistRepository;
    private final CandidateSubmissionRepository submissionRepository;
    private final AgencyInterviewRepository interviewRepository;
    private final AgencyPlacementRepository placementRepository;
    private final AgencyJobService jobService;
    private final AgencySubmissionService submissionService;
    private final AgencyInterviewService interviewService;
    private final AgencyPlacementService placementService;

    public AgencyDashboardSummaryResponse getDashboardSummary(String agencyId) {
        long totalClients = clientRepository.countByAgencyId(agencyId);
        long activeClients = clientRepository.countByAgencyIdAndStatus(agencyId, AgencyClientStatus.ACTIVE);

        long totalJobs = jobRepository.countByAgencyId(agencyId);
        long openJobs = jobRepository.countByAgencyIdAndStatus(agencyId, JobStatus.ACTIVE);
        long closedJobs = jobRepository.countByAgencyIdAndStatus(agencyId, JobStatus.CLOSED);

        long totalCandidates = candidateAssociationRepository.countByAgencyId(agencyId);
        long shortlistedCandidates = shortlistRepository.countByAgencyIdAndShortlistStatus(agencyId, ShortlistStatus.ACTIVE);

        long pendingAdminApprovals = submissionRepository.countByAgencyIdAndAdminReviewStatus(agencyId, SubmissionStatus.SUBMITTED_TO_ADMIN);
        long approvedSubmissions = submissionRepository.countByAgencyIdAndAdminReviewStatus(agencyId, SubmissionStatus.APPROVED);
        long rejectedSubmissions = submissionRepository.countByAgencyIdAndAdminReviewStatus(agencyId, SubmissionStatus.REJECTED);
        long releasedCandidates = submissionRepository.countByAgencyIdAndAdminReviewStatus(agencyId, SubmissionStatus.RELEASED_TO_AGENCY);
        long candidatesSentToRecruiters = submissionRepository.countByAgencyIdAndAdminReviewStatus(agencyId, SubmissionStatus.SENT_TO_RECRUITER);

        long upcomingInterviews = interviewRepository.countByAgencyIdAndInterviewStatus(agencyId, InterviewStatus.SCHEDULED);
        long completedInterviews = interviewRepository.countByAgencyIdAndInterviewStatus(agencyId, InterviewStatus.COMPLETED);

        long selectedCandidates = submissionRepository.countByAgencyIdAndAdminReviewStatus(agencyId, SubmissionStatus.SELECTED);
        long successfulPlacements = placementRepository.countByAgencyIdAndPlacementStatus(agencyId, PlacementStatus.PLACEMENT_CONFIRMED);

        Map<String, Long> statusDistribution = new LinkedHashMap<>();
        for (SubmissionStatus status : SubmissionStatus.values()) {
            long count = submissionRepository.countByAgencyIdAndAdminReviewStatus(agencyId, status);
            if (count > 0) {
                statusDistribution.put(status.name(), count);
            }
        }

        return AgencyDashboardSummaryResponse.builder()
                .totalClients(totalClients)
                .activeClients(activeClients)
                .totalJobs(totalJobs)
                .openJobs(openJobs)
                .closedJobs(closedJobs)
                .totalCandidates(totalCandidates)
                .shortlistedCandidates(shortlistedCandidates)
                .pendingAdminApprovals(pendingAdminApprovals)
                .approvedSubmissions(approvedSubmissions)
                .rejectedSubmissions(rejectedSubmissions)
                .releasedCandidates(releasedCandidates)
                .candidatesSentToRecruiters(candidatesSentToRecruiters)
                .upcomingInterviews(upcomingInterviews)
                .completedInterviews(completedInterviews)
                .selectedCandidates(selectedCandidates)
                .successfulPlacements(successfulPlacements)
                .statusDistribution(statusDistribution)
                .build();
    }

    public List<AgencyJobResponse> getRecentJobs(String agencyId, int limit) {
        PageRequest pr = PageRequest.of(0, limit, Sort.by("createdAt").descending());
        return jobRepository.findByAgencyId(agencyId, pr).getContent().stream()
                .map(j -> jobService.getJob(agencyId, j.getId()))
                .collect(Collectors.toList());
    }

    public List<CandidateSubmissionResponse> getRecentSubmissions(String agencyId, int limit) {
        PageRequest pr = PageRequest.of(0, limit, Sort.by("createdAt").descending());
        return submissionRepository.findByAgencyId(agencyId, pr).getContent().stream()
                .map(submissionService::toResponse)
                .collect(Collectors.toList());
    }

    public List<AgencyInterviewResponse> getUpcomingInterviews(String agencyId, int limit) {
        return interviewRepository.findByAgencyIdAndInterviewStatus(agencyId, InterviewStatus.SCHEDULED).stream()
                .limit(limit)
                .map(interviewService::toResponse)
                .collect(Collectors.toList());
    }

    public List<AgencyPlacementResponse> getRecentPlacements(String agencyId, int limit) {
        PageRequest pr = PageRequest.of(0, limit, Sort.by("createdAt").descending());
        return placementRepository.findByAgencyId(agencyId, pr).getContent().stream()
                .map(placementService::toResponse)
                .collect(Collectors.toList());
    }

    public Map<String, Object> getPlacementStatistics(String agencyId) {
        List<AgencyPlacement> placements = placementRepository.findByAgencyId(agencyId);

        Map<String, Long> statusCounts = placements.stream()
                .collect(Collectors.groupingBy(p -> p.getPlacementStatus().name(), Collectors.counting()));

        long confirmedCount = placements.stream()
                .filter(p -> p.getPlacementStatus() == PlacementStatus.PLACEMENT_CONFIRMED)
                .count();

        long totalSalary = placements.stream()
                .filter(p -> p.getPlacementStatus() == PlacementStatus.PLACEMENT_CONFIRMED)
                .mapToLong(AgencyPlacement::getOfferedSalaryInr)
                .sum();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalPlacementsRecorded", placements.size());
        stats.put("confirmedPlacements", confirmedCount);
        stats.put("totalConfirmedSalaryInr", totalSalary);
        stats.put("averageSalaryInr", confirmedCount > 0 ? totalSalary / confirmedCount : 0);
        stats.put("statusBreakdown", statusCounts);

        return stats;
    }
}
