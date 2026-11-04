package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AdminSubmissionReviewRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.dto.response.CandidateSubmissionResponse;
import com.euodoo.hire.model.AgencyRegistrationStatus;
import com.euodoo.hire.model.SubmissionStatus;
import com.euodoo.hire.exception.AgencyExceptions.InvalidStatusTransitionException;
import com.euodoo.hire.exception.AgencyExceptions.SubmissionNotFoundException;
import com.euodoo.hire.exception.AgencyNotFoundException;
import com.euodoo.hire.service.AgencyMapper;
import com.euodoo.hire.model.Agency;
import com.euodoo.hire.model.CandidateSubmission;
import com.euodoo.hire.repository.AgencyRepository;
import com.euodoo.hire.repository.CandidateSubmissionRepository;
import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import com.euodoo.hire.service.NotificationService;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAgencyManagementService {

    private final AgencyRepository agencyRepository;
    private final CandidateSubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final AgencySubmissionService submissionService;
    private final ApplicationTrackingService trackingService;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public Page<AgencyResponse> getAllAgencies(int page, int size, AgencyRegistrationStatus status) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<Agency> all = agencyRepository.findAll();

        List<Agency> filtered = all.stream()
                .filter(a -> status == null || a.getRegistrationStatus() == status)
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), filtered.size());
        int end = Math.min((start + pageRequest.getPageSize()), filtered.size());

        List<AgencyResponse> content = filtered.subList(start, end).stream()
                .map(AgencyMapper::toAgencyResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(content, pageRequest, filtered.size());
    }

    public AgencyResponse getAgencyDetails(String agencyId) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new AgencyNotFoundException(agencyId));
        return AgencyMapper.toAgencyResponse(agency);
    }

    public AgencyResponse verifyAgency(String agencyId, String adminUserId, AgencyRegistrationStatus status, String remarks) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new AgencyNotFoundException(agencyId));

        agency.setRegistrationStatus(status);
        agency.setReviewedByAdminId(adminUserId);
        agency.setReviewedAt(Instant.now());
        agency.setVerificationRemarks(remarks);

        if (status == AgencyRegistrationStatus.REJECTED) {
            agency.setRejectionReason(remarks);
        }

        Agency saved = agencyRepository.save(agency);

        // Update corresponding primary user account status
        if (saved.getRegisteredUserId() != null) {
            userRepository.findById(saved.getRegisteredUserId()).ifPresent(u -> {
                if (status == AgencyRegistrationStatus.APPROVED) {
                    u.setAccountStatus(AccountStatus.ACTIVE);
                    u.setApprovedAt(Instant.now());
                    u.setReviewedByAdminId(adminUserId);
                } else if (status == AgencyRegistrationStatus.REJECTED) {
                    u.setAccountStatus(AccountStatus.REJECTED);
                    u.setRejectedAt(Instant.now());
                    u.setRejectionReason(remarks);
                    u.setReviewedByAdminId(adminUserId);
                } else if (status == AgencyRegistrationStatus.SUSPENDED) {
                    u.setAccountStatus(AccountStatus.DISABLED);
                }
                userRepository.save(u);
            });
        }

        auditService.log(adminUserId, "CLIENT_ADMIN", "Agency", saved.getId(),
                "AGENCY_VERIFICATION_STATUS_UPDATED", Map.of("status", status.name(), "remarks", remarks != null ? remarks : ""));

        if (saved.getRegisteredUserId() != null) {
            notificationService.notify(saved.getRegisteredUserId(), "AGENCY_STATUS_UPDATE",
                    "Your agency status has been updated to: " + status.name(), null, null);
        }

        log.info("Admin {} updated agency {} status to {}", adminUserId, agencyId, status);
        return AgencyMapper.toAgencyResponse(saved);
    }

    public Page<CandidateSubmissionResponse> getAllSubmissions(int page, int size, SubmissionStatus status) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<CandidateSubmission> all = submissionRepository.findAll();

        List<CandidateSubmission> filtered = all.stream()
                .filter(s -> status == null || s.getAdminReviewStatus() == status)
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), filtered.size());
        int end = Math.min((start + pageRequest.getPageSize()), filtered.size());

        List<CandidateSubmissionResponse> content = filtered.subList(start, end).stream()
                .map(submissionService::toResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(content, pageRequest, filtered.size());
    }

    public CandidateSubmissionResponse reviewSubmission(String adminUserId, String submissionId, AdminSubmissionReviewRequest request) {
        CandidateSubmission sub = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));

        String prev = sub.getAdminReviewStatus().name();
        sub.setAdminReviewStatus(request.getStatus());
        sub.setAdminComments(request.getComments());
        sub.setAdminReviewedByUserId(adminUserId);
        sub.setAdminReviewDate(Instant.now());

        CandidateSubmission saved = submissionRepository.save(sub);

        trackingService.recordStatusChange(saved.getId(), prev, request.getStatus().name(),
                adminUserId, "CLIENT_ADMIN", request.getComments());

        auditService.log(adminUserId, "CLIENT_ADMIN", "CandidateSubmission", saved.getId(),
                "SUBMISSION_REVIEWED_BY_ADMIN", Map.of("status", request.getStatus().name()));

        return submissionService.toResponse(saved);
    }

    public CandidateSubmissionResponse releaseCandidateToAgency(String adminUserId, String submissionId) {
        CandidateSubmission sub = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));

        if (sub.getAdminReviewStatus() != SubmissionStatus.APPROVED) {
            throw new InvalidStatusTransitionException("Only approved candidate submissions can be released to the agency");
        }

        String prev = sub.getAdminReviewStatus().name();
        sub.setAdminReviewStatus(SubmissionStatus.RELEASED_TO_AGENCY);
        sub.setAdminReleasedAt(Instant.now());

        CandidateSubmission saved = submissionRepository.save(sub);

        trackingService.recordStatusChange(saved.getId(), prev, SubmissionStatus.RELEASED_TO_AGENCY.name(),
                adminUserId, "CLIENT_ADMIN", "Approved candidate officially released to agency");

        auditService.log(adminUserId, "CLIENT_ADMIN", "CandidateSubmission", saved.getId(),
                "CANDIDATE_RELEASED_TO_AGENCY", Map.of("submissionId", submissionId));

        return submissionService.toResponse(saved);
    }
}
