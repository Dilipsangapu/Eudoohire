package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.CandidateSubmissionRequest;
import com.euodoo.hire.dto.request.RecruiterSubmissionActionRequest;
import com.euodoo.hire.dto.response.CandidateSubmissionResponse;
import com.euodoo.hire.model.CandidateConsentStatus;
import com.euodoo.hire.model.SubmissionStatus;
import com.euodoo.hire.exception.AgencyExceptions.*;
import com.euodoo.hire.model.Agency;
import com.euodoo.hire.model.AgencyClient;
import com.euodoo.hire.model.CandidateAgencyAssociation;
import com.euodoo.hire.model.CandidateSubmission;
import com.euodoo.hire.repository.*;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.JobRepository;
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
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencySubmissionService {

    private final CandidateSubmissionRepository submissionRepository;
    private final CandidateAgencyAssociationRepository associationRepository;
    private final AgencyRepository agencyRepository;
    private final AgencyClientRepository agencyClientRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final ApplicationTrackingService trackingService;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public CandidateSubmissionResponse createSubmission(String agencyId, String userId, CandidateSubmissionRequest request) {
        String candidateUserId = request.getCandidateId();

        // 1. Check duplicate active submissions without blocking future submissions after withdrawal or rejection
        boolean hasActive = submissionRepository.existsByAgencyIdAndJobIdAndCandidateIdAndAdminReviewStatusNotIn(
                agencyId, request.getJobId(), candidateUserId,
                List.of(SubmissionStatus.REJECTED, SubmissionStatus.WITHDRAWN, SubmissionStatus.NOT_SELECTED));
        if (hasActive) {
            throw new InvalidSubmissionStatusException("An active submission already exists for this candidate and job");
        }

        // 2. Candidate consent check: candidate must have an explicit GRANTED consent
        Optional<CandidateAgencyAssociation> assoc = associationRepository.findByAgencyIdAndCandidateId(agencyId, candidateUserId);
        if (assoc.isEmpty() || assoc.get().getConsentStatus() != CandidateConsentStatus.GRANTED) {
            log.warn("Security alert: Attempted to submit candidate [{}] without GRANTED consent for agency [{}]",
                    candidateUserId, agencyId);
            throw new BusinessException("CANDIDATE_CONSENT_REQUIRED",
                    "Candidate has not explicitly granted consent to be submitted by this agency.");
        }

        Job job = jobRepository.findById(request.getJobId())
                .orElseThrow(() -> new JobNotFoundException(request.getJobId()));

        String clientCompanyId = request.getClientCompanyId();
        if (clientCompanyId == null || clientCompanyId.isBlank()) {
            clientCompanyId = job.getClientCompanyId();
        }

        if (clientCompanyId != null && !clientCompanyId.isBlank()) {
            if (!agencyClientRepository.existsByIdAndAgencyId(clientCompanyId, agencyId)) {
                log.warn("Security alert: Agency [{}] attempted to submit candidate for unassociated client company [{}]",
                        agencyId, clientCompanyId);
                throw new BusinessException("INVALID_CLIENT_COMPANY",
                        "The specified client company is not registered with your agency.");
            }
        }

        CandidateSubmission submission = CandidateSubmission.builder()
                .candidateId(candidateUserId)
                .jobId(request.getJobId())
                .agencyId(agencyId)
                .clientCompanyId(clientCompanyId)
                .submittedByUserId(userId)
                .adminReviewStatus(SubmissionStatus.DRAFT)
                .build();

        CandidateSubmission saved = submissionRepository.save(submission);

        trackingService.recordStatusChange(saved.getId(), "NONE", SubmissionStatus.DRAFT.name(),
                userId, "AGENCY_USER", "Submission created in draft");

        auditService.log(userId, "AGENCY_USER", "CandidateSubmission", saved.getId(),
                "CANDIDATE_SUBMISSION_CREATED", Map.of("candidateId", candidateUserId, "jobId", request.getJobId()));

        return toResponse(saved);
    }

    public CandidateSubmissionResponse submitToAdmin(String agencyId, String submissionId, String userId) {
        CandidateSubmission sub = submissionRepository.findByIdAndAgencyId(submissionId, agencyId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));

        if (sub.getAdminReviewStatus() != SubmissionStatus.DRAFT && sub.getAdminReviewStatus() != SubmissionStatus.RESUBMISSION_REQUIRED) {
            throw new InvalidStatusTransitionException("Submission can only be sent to admin from DRAFT or RESUBMISSION_REQUIRED status");
        }

        String prev = sub.getAdminReviewStatus().name();
        sub.setAdminReviewStatus(SubmissionStatus.SUBMITTED_TO_ADMIN);
        sub.setSubmissionDate(Instant.now());

        CandidateSubmission saved = submissionRepository.save(sub);

        trackingService.recordStatusChange(saved.getId(), prev, SubmissionStatus.SUBMITTED_TO_ADMIN.name(),
                userId, "AGENCY_USER", "Candidate submitted to Euodoo Hire Admin for review");

        auditService.log(userId, "AGENCY_USER", "CandidateSubmission", saved.getId(),
                "SUBMISSION_SENT_TO_ADMIN", Map.of("agencyId", agencyId));

        return toResponse(saved);
    }

    public Page<CandidateSubmissionResponse> getAgencySubmissions(String agencyId, int page, int size, SubmissionStatus status) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<CandidateSubmission> all = submissionRepository.findByAgencyId(agencyId);

        List<CandidateSubmission> filtered = all.stream()
                .filter(s -> status == null || s.getAdminReviewStatus() == status)
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), filtered.size());
        int end = Math.min((start + pageRequest.getPageSize()), filtered.size());

        List<CandidateSubmissionResponse> content = filtered.subList(start, end).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(content, pageRequest, filtered.size());
    }

    public CandidateSubmissionResponse getSubmission(String agencyId, String submissionId) {
        CandidateSubmission sub = submissionRepository.findByIdAndAgencyId(submissionId, agencyId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));
        return toResponse(sub);
    }

    public CandidateSubmissionResponse sendToRecruiter(String agencyId, String submissionId, String recruiterUserId, String userId) {
        CandidateSubmission sub = submissionRepository.findByIdAndAgencyId(submissionId, agencyId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));

        if (sub.getAdminReviewStatus() != SubmissionStatus.RELEASED_TO_AGENCY) {
            throw new InvalidStatusTransitionException("Only approved candidates released by admin can be sent to recruiters");
        }

        String prev = sub.getAdminReviewStatus().name();
        sub.setAdminReviewStatus(SubmissionStatus.SENT_TO_RECRUITER);
        sub.setRecruiterUserId(recruiterUserId);
        sub.setSentToRecruiterAt(Instant.now());
        sub.setRecruiterSubmissionStatus("PENDING_RECRUITER_ACTION");

        CandidateSubmission saved = submissionRepository.save(sub);

        trackingService.recordStatusChange(saved.getId(), prev, SubmissionStatus.SENT_TO_RECRUITER.name(),
                userId, "AGENCY_USER", "Released candidate submitted to Recruiter: " + recruiterUserId);

        auditService.log(userId, "AGENCY_USER", "CandidateSubmission", saved.getId(),
                "SUBMISSION_SENT_TO_RECRUITER", Map.of("recruiterUserId", recruiterUserId != null ? recruiterUserId : ""));

        if (recruiterUserId != null) {
            notificationService.notify(recruiterUserId, "NEW_AGENCY_SUBMISSION",
                    "A new candidate was submitted by an agency for review", null, null);
        }

        return toResponse(saved);
    }

    public Page<CandidateSubmissionResponse> getRecruiterSubmissions(String recruiterUserId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<CandidateSubmission> all = submissionRepository.findByRecruiterUserId(recruiterUserId);

        int start = Math.min((int) pageRequest.getOffset(), all.size());
        int end = Math.min((start + pageRequest.getPageSize()), all.size());

        List<CandidateSubmissionResponse> content = all.subList(start, end).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(content, pageRequest, all.size());
    }

    public CandidateSubmissionResponse updateRecruiterAction(String recruiterUserId, String submissionId, RecruiterSubmissionActionRequest request) {
        CandidateSubmission sub = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new SubmissionNotFoundException(submissionId));

        if (sub.getRecruiterUserId() == null || !sub.getRecruiterUserId().equals(recruiterUserId)) {
            log.warn("Security rejection: Recruiter [{}] attempted unauthorized action on submission [{}] assigned to [{}]",
                    recruiterUserId, submissionId, sub.getRecruiterUserId());
            throw new UnauthorizedAgencyAccessException("Recruiter not authorized to action this submission");
        }

        String prev = sub.getAdminReviewStatus().name();
        sub.setRecruiterComments(request.getComments());

        if (request.getSelectionStatus() != null) {
            sub.setFinalSelectionStatus(request.getSelectionStatus());
            try {
                SubmissionStatus newStatus = SubmissionStatus.valueOf(request.getSelectionStatus().toUpperCase());
                sub.setAdminReviewStatus(newStatus);
            } catch (Exception ignored) {}
        }

        CandidateSubmission saved = submissionRepository.save(sub);

        trackingService.recordStatusChange(saved.getId(), prev, saved.getAdminReviewStatus().name(),
                recruiterUserId, "RECRUITER", request.getComments());

        auditService.log(recruiterUserId, "RECRUITER", "CandidateSubmission", saved.getId(),
                "RECRUITER_ACTION_UPDATED", Map.of("status", saved.getAdminReviewStatus().name()));

        return toResponse(saved);
    }

    public CandidateSubmissionResponse toResponse(CandidateSubmission s) {
        String candName = "Candidate";
        String candEmail = "";
        if (s.getCandidateId() != null) {
            Optional<User> u = userRepository.findById(s.getCandidateId());
            if (u.isPresent()) {
                candName = u.get().getName();
                candEmail = u.get().getEmail();
            }
        }
        String jobTitle = "Job";
        if (s.getJobId() != null) {
            jobTitle = jobRepository.findById(s.getJobId()).map(Job::getTitle).orElse("Job");
        }
        String agencyName = "Agency";
        if (s.getAgencyId() != null) {
            agencyName = agencyRepository.findById(s.getAgencyId()).map(Agency::getAgencyName).orElse("Agency");
        }
        String clientCompanyName = "Client Company";
        if (s.getClientCompanyId() != null) {
            clientCompanyName = agencyClientRepository.findById(s.getClientCompanyId())
                    .map(AgencyClient::getCompanyName)
                    .orElse("Client Company");
        }

        return CandidateSubmissionResponse.builder()
                .id(s.getId())
                .candidateId(s.getCandidateId())
                .candidateName(candName)
                .candidateEmail(candEmail)
                .jobId(s.getJobId())
                .jobTitle(jobTitle)
                .agencyId(s.getAgencyId())
                .agencyName(agencyName)
                .clientCompanyId(s.getClientCompanyId())
                .clientCompanyName(clientCompanyName)
                .submittedByUserId(s.getSubmittedByUserId())
                .submissionDate(s.getSubmissionDate())
                .adminReviewStatus(s.getAdminReviewStatus())
                .adminComments(s.getAdminComments())
                .adminReviewedByUserId(s.getAdminReviewedByUserId())
                .adminReviewDate(s.getAdminReviewDate())
                .adminReleasedAt(s.getAdminReleasedAt())
                .recruiterSubmissionStatus(s.getRecruiterSubmissionStatus())
                .recruiterUserId(s.getRecruiterUserId())
                .recruiterComments(s.getRecruiterComments())
                .sentToRecruiterAt(s.getSentToRecruiterAt())
                .finalSelectionStatus(s.getFinalSelectionStatus())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
