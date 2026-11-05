package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyInterviewFeedbackRequest;
import com.euodoo.hire.dto.request.AgencyInterviewRequest;
import com.euodoo.hire.dto.response.AgencyInterviewResponse;
import com.euodoo.hire.model.InterviewStatus;
import com.euodoo.hire.model.SubmissionStatus;
import com.euodoo.hire.exception.AgencyExceptions.SubmissionNotFoundException;
import com.euodoo.hire.model.AgencyClient;
import com.euodoo.hire.model.AgencyInterview;
import com.euodoo.hire.model.CandidateSubmission;
import com.euodoo.hire.repository.AgencyClientRepository;
import com.euodoo.hire.repository.AgencyInterviewRepository;
import com.euodoo.hire.repository.CandidateSubmissionRepository;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyInterviewService {

    private final AgencyInterviewRepository interviewRepository;
    private final CandidateSubmissionRepository submissionRepository;
    private final AgencyClientRepository agencyClientRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final ApplicationTrackingService trackingService;
    private final AuditService auditService;

    public AgencyInterviewResponse scheduleInterview(String agencyId, String userId, AgencyInterviewRequest request) {
        CandidateSubmission submission = submissionRepository.findByIdAndAgencyId(request.getSubmissionId(), agencyId)
                .orElseThrow(() -> new SubmissionNotFoundException(request.getSubmissionId()));

        AgencyInterview interview = AgencyInterview.builder()
                .submissionId(submission.getId())
                .candidateId(submission.getCandidateId())
                .jobId(submission.getJobId())
                .agencyId(agencyId)
                .clientCompanyId(submission.getClientCompanyId())
                .roundNumber(request.getRoundNumber() > 0 ? request.getRoundNumber() : 1)
                .roundName(request.getRoundName())
                .interviewType(request.getInterviewType())
                .interviewDate(request.getInterviewDate())
                .interviewTime(request.getInterviewTime())
                .interviewMode(request.getInterviewMode())
                .interviewLink(request.getInterviewLink())
                .interviewLocation(request.getInterviewLocation())
                .interviewerName(request.getInterviewerName())
                .interviewerEmail(request.getInterviewerEmail())
                .interviewStatus(InterviewStatus.SCHEDULED)
                .build();

        AgencyInterview saved = interviewRepository.save(interview);

        // Update submission status if needed
        if (submission.getAdminReviewStatus() == SubmissionStatus.SENT_TO_RECRUITER) {
            submission.setAdminReviewStatus(SubmissionStatus.INTERVIEW_SCHEDULED);
            submissionRepository.save(submission);
            trackingService.recordStatusChange(submission.getId(), SubmissionStatus.SENT_TO_RECRUITER.name(),
                    SubmissionStatus.INTERVIEW_SCHEDULED.name(), userId, "AGENCY_USER", "Interview scheduled: Round " + saved.getRoundNumber());
        }

        auditService.log(userId, "AGENCY_USER", "AgencyInterview", saved.getId(),
                "INTERVIEW_SCHEDULED", Map.of("submissionId", saved.getSubmissionId(), "round", String.valueOf(saved.getRoundNumber())));

        return toResponse(saved);
    }

    public Page<AgencyInterviewResponse> getInterviews(String agencyId, int page, int size, InterviewStatus status) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<AgencyInterview> all = interviewRepository.findByAgencyId(agencyId);

        List<AgencyInterview> filtered = all.stream()
                .filter(i -> status == null || i.getInterviewStatus() == status)
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), filtered.size());
        int end = Math.min((start + pageRequest.getPageSize()), filtered.size());

        List<AgencyInterviewResponse> content = filtered.subList(start, end).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return new PageImpl<>(content, pageRequest, filtered.size());
    }

    public AgencyInterviewResponse getInterview(String agencyId, String interviewId) {
        AgencyInterview interview = interviewRepository.findByIdAndAgencyId(interviewId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("AgencyInterview", interviewId));
        return toResponse(interview);
    }

    public AgencyInterviewResponse recordFeedback(String agencyId, String interviewId, AgencyInterviewFeedbackRequest request, String userId) {
        AgencyInterview interview = interviewRepository.findByIdAndAgencyId(interviewId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("AgencyInterview", interviewId));

        interview.setInterviewStatus(request.getStatus());
        interview.setFeedback(request.getFeedback());
        interview.setRating(request.getRating());
        interview.setNextInterviewDate(request.getNextInterviewDate());

        AgencyInterview saved = interviewRepository.save(interview);

        trackingService.recordStatusChange(saved.getSubmissionId(), "INTERVIEW_IN_PROGRESS",
                "INTERVIEW_" + request.getStatus().name(), userId, "AGENCY_USER",
                "Interview round " + saved.getRoundNumber() + " feedback: " + request.getStatus().name());

        auditService.log(userId, "AGENCY_USER", "AgencyInterview", saved.getId(),
                "INTERVIEW_FEEDBACK_RECORDED", Map.of("status", request.getStatus().name()));

        return toResponse(saved);
    }

    public AgencyInterviewResponse toResponse(AgencyInterview i) {
        String candName = "Candidate";
        if (i.getCandidateId() != null) {
            Optional<User> u = userRepository.findById(i.getCandidateId());
            if (u.isPresent()) candName = u.get().getName();
        }
        String jobTitle = "Job";
        if (i.getJobId() != null) {
            jobTitle = jobRepository.findById(i.getJobId()).map(Job::getTitle).orElse("Job");
        }
        String clientCompanyName = "Client Company";
        if (i.getClientCompanyId() != null) {
            clientCompanyName = agencyClientRepository.findById(i.getClientCompanyId())
                    .map(AgencyClient::getCompanyName)
                    .orElse("Client Company");
        }

        return AgencyInterviewResponse.builder()
                .id(i.getId())
                .submissionId(i.getSubmissionId())
                .candidateId(i.getCandidateId())
                .candidateName(candName)
                .jobId(i.getJobId())
                .jobTitle(jobTitle)
                .agencyId(i.getAgencyId())
                .clientCompanyId(i.getClientCompanyId())
                .clientCompanyName(clientCompanyName)
                .roundNumber(i.getRoundNumber())
                .roundName(i.getRoundName())
                .interviewType(i.getInterviewType())
                .interviewDate(i.getInterviewDate())
                .interviewTime(i.getInterviewTime())
                .interviewMode(i.getInterviewMode())
                .interviewLink(i.getInterviewLink())
                .interviewLocation(i.getInterviewLocation())
                .interviewerName(i.getInterviewerName())
                .interviewerEmail(i.getInterviewerEmail())
                .interviewStatus(i.getInterviewStatus())
                .feedback(i.getFeedback())
                .rating(i.getRating())
                .nextInterviewDate(i.getNextInterviewDate())
                .createdAt(i.getCreatedAt())
                .updatedAt(i.getUpdatedAt())
                .build();
    }
}
