package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyPlacementRequest;
import com.euodoo.hire.dto.response.AgencyPlacementResponse;
import com.euodoo.hire.model.PlacementStatus;
import com.euodoo.hire.model.SubmissionStatus;
import com.euodoo.hire.exception.AgencyExceptions.SubmissionNotFoundException;
import com.euodoo.hire.model.AgencyClient;
import com.euodoo.hire.model.AgencyPlacement;
import com.euodoo.hire.model.CandidateSubmission;
import com.euodoo.hire.repository.AgencyClientRepository;
import com.euodoo.hire.repository.AgencyPlacementRepository;
import com.euodoo.hire.repository.CandidateSubmissionRepository;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyPlacementService {

    private final AgencyPlacementRepository placementRepository;
    private final CandidateSubmissionRepository submissionRepository;
    private final AgencyClientRepository agencyClientRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final ApplicationTrackingService trackingService;
    private final AuditService auditService;

    public AgencyPlacementResponse createPlacement(String agencyId, String userId, AgencyPlacementRequest request) {
        CandidateSubmission submission = submissionRepository.findByIdAndAgencyId(request.getSubmissionId(), agencyId)
                .orElseThrow(() -> new SubmissionNotFoundException(request.getSubmissionId()));

        if (submission.getAdminReviewStatus() == SubmissionStatus.REJECTED
                || submission.getAdminReviewStatus() == SubmissionStatus.WITHDRAWN
                || submission.getAdminReviewStatus() == SubmissionStatus.NOT_SELECTED) {
            throw new BusinessException("INVALID_SUBMISSION_STATUS",
                    "Cannot create placement offer for a submission with status: " + submission.getAdminReviewStatus());
        }

        AgencyPlacement placement = placementRepository.findBySubmissionId(request.getSubmissionId())
                .orElse(AgencyPlacement.builder()
                        .agencyId(agencyId)
                        .candidateId(request.getCandidateId())
                        .jobId(request.getJobId())
                        .clientCompanyId(request.getClientCompanyId() != null ? request.getClientCompanyId() : submission.getClientCompanyId())
                        .submissionId(submission.getId())
                        .build());

        placement.setDesignation(request.getDesignation());
        placement.setOfferedSalaryInr(request.getOfferedSalaryInr());
        placement.setJoiningDate(request.getJoiningDate());
        placement.setEmploymentType(request.getEmploymentType());
        placement.setRemarks(request.getRemarks());
        placement.setPlacementStatus(PlacementStatus.OFFER_RELEASED);

        AgencyPlacement saved = placementRepository.save(placement);

        trackingService.recordStatusChange(submission.getId(), submission.getAdminReviewStatus().name(),
                "OFFER_RELEASED", userId, "AGENCY_USER", "Placement offer recorded: " + request.getDesignation());

        auditService.log(userId, "AGENCY_USER", "AgencyPlacement", saved.getId(),
                "PLACEMENT_OFFER_RECORDED", Map.of("submissionId", submission.getId(), "offeredSalary", String.valueOf(request.getOfferedSalaryInr())));

        return toResponse(saved);
    }

    public Page<AgencyPlacementResponse> getPlacements(String agencyId, int page, int size, PlacementStatus status) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<AgencyPlacement> all = placementRepository.findByAgencyId(agencyId);

        List<AgencyPlacement> filtered = all.stream()
                .filter(p -> status == null || p.getPlacementStatus() == status)
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), filtered.size());
        int end = Math.min((start + pageRequest.getPageSize()), filtered.size());

        List<AgencyPlacementResponse> content = filtered.subList(start, end).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(content, pageRequest, filtered.size());
    }

    public AgencyPlacementResponse getPlacement(String agencyId, String placementId) {
        AgencyPlacement placement = placementRepository.findByIdAndAgencyId(placementId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("AgencyPlacement", placementId));
        return toResponse(placement);
    }

    public AgencyPlacementResponse confirmPlacement(String agencyId, String placementId, String remarks, String userId) {
        AgencyPlacement placement = placementRepository.findByIdAndAgencyId(placementId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("AgencyPlacement", placementId));

        placement.setPlacementStatus(PlacementStatus.PLACEMENT_CONFIRMED);
        placement.setPlacementConfirmationDate(Instant.now());
        placement.setConfirmedByUserId(userId);
        if (remarks != null && !remarks.isBlank()) {
            placement.setRemarks(remarks);
        }

        AgencyPlacement saved = placementRepository.save(placement);

        // Update submission status to PLACED
        if (placement.getSubmissionId() != null) {
            submissionRepository.findById(placement.getSubmissionId()).ifPresent(sub -> {
                String prev = sub.getAdminReviewStatus().name();
                sub.setAdminReviewStatus(SubmissionStatus.PLACED);
                sub.setFinalSelectionStatus("PLACED");
                submissionRepository.save(sub);
                trackingService.recordStatusChange(sub.getId(), prev, SubmissionStatus.PLACED.name(),
                        userId, "AGENCY_USER", "Placement confirmed: " + remarks);
            });
        }

        auditService.log(userId, "AGENCY_USER", "AgencyPlacement", saved.getId(),
                "PLACEMENT_CONFIRMED", Map.of("placementId", saved.getId()));

        return toResponse(saved);
    }

    public AgencyPlacementResponse toResponse(AgencyPlacement p) {
        String candName = "Candidate";
        String candEmail = "";
        if (p.getCandidateId() != null) {
            Optional<User> u = userRepository.findById(p.getCandidateId());
            if (u.isPresent()) {
                candName = u.get().getName();
                candEmail = u.get().getEmail();
            }
        }
        String jobTitle = "Job";
        if (p.getJobId() != null) {
            jobTitle = jobRepository.findById(p.getJobId()).map(Job::getTitle).orElse("Job");
        }
        String clientCompanyName = "Client Company";
        if (p.getClientCompanyId() != null) {
            clientCompanyName = agencyClientRepository.findById(p.getClientCompanyId())
                    .map(AgencyClient::getCompanyName)
                    .orElse("Client Company");
        }

        return AgencyPlacementResponse.builder()
                .id(p.getId())
                .candidateId(p.getCandidateId())
                .candidateName(candName)
                .candidateEmail(candEmail)
                .jobId(p.getJobId())
                .jobTitle(jobTitle)
                .agencyId(p.getAgencyId())
                .clientCompanyId(p.getClientCompanyId())
                .clientCompanyName(clientCompanyName)
                .submissionId(p.getSubmissionId())
                .designation(p.getDesignation())
                .offeredSalaryInr(p.getOfferedSalaryInr())
                .joiningDate(p.getJoiningDate())
                .placementConfirmationDate(p.getPlacementConfirmationDate())
                .employmentType(p.getEmploymentType())
                .placementStatus(p.getPlacementStatus())
                .remarks(p.getRemarks())
                .confirmedByUserId(p.getConfirmedByUserId())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
