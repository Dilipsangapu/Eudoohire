package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.*;
import com.euodoo.hire.dto.response.*;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.*;
import com.euodoo.hire.service.*;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.JobStatus;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import com.euodoo.hire.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AgencyWorkflowIntegrationTest {

    @Mock
    private CandidateSubmissionRepository submissionRepository;

    @Mock
    private CandidateAgencyAssociationRepository associationRepository;

    @Mock
    private AgencyRepository agencyRepository;

    @Mock
    private AgencyClientRepository agencyClientRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ApplicationTrackingService trackingService;

    @Mock
    private AuditService auditService;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private AgencySubmissionService submissionService;

    @Mock
    private AgencyInterviewRepository interviewRepository;

    @InjectMocks
    private AgencyInterviewService interviewService;

    @Mock
    private AgencyPlacementRepository placementRepository;

    @InjectMocks
    private AgencyPlacementService placementService;

    private final String agencyId = "agency-100";
    private final String candidateId = "cand-200";
    private final String jobId = "job-300";
    private final String clientCompanyId = "client-400";
    private final String userId = "user-100";

    @Test
    @DisplayName("Complete workflow: draft -> submitToAdmin -> approve & release -> sendToRecruiter -> place")
    void fullSubmissionWorkflow() {
        // 1. Create draft submission
        when(submissionRepository.existsByAgencyIdAndJobIdAndCandidateIdAndAdminReviewStatusNotIn(eq(agencyId), eq(jobId), eq(candidateId), any()))
                .thenReturn(false);
        CandidateAgencyAssociation grantedAssoc = CandidateAgencyAssociation.builder()
                .agencyId(agencyId)
                .candidateId(candidateId)
                .consentStatus(CandidateConsentStatus.GRANTED)
                .build();
        when(associationRepository.findByAgencyIdAndCandidateId(agencyId, candidateId))
                .thenReturn(Optional.of(grantedAssoc));
        when(agencyClientRepository.existsByIdAndAgencyId(clientCompanyId, agencyId))
                .thenReturn(true);

        Job job = Job.builder().id(jobId).title("Senior Backend Engineer").clientCompanyId(clientCompanyId).build();
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));

        when(submissionRepository.save(any(CandidateSubmission.class))).thenAnswer(inv -> {
            CandidateSubmission s = inv.getArgument(0);
            if (s.getId() == null) s.setId("sub-500");
            return s;
        });

        CandidateSubmissionRequest createReq = CandidateSubmissionRequest.builder()
                .candidateId(candidateId)
                .jobId(jobId)
                .clientCompanyId(clientCompanyId)
                .build();

        CandidateSubmissionResponse created = submissionService.createSubmission(agencyId, userId, createReq);
        assertNotNull(created);
        assertEquals(SubmissionStatus.DRAFT, created.getAdminReviewStatus());

        // 2. Submit to admin
        CandidateSubmission draftSub = CandidateSubmission.builder()
                .id("sub-500")
                .agencyId(agencyId)
                .candidateId(candidateId)
                .jobId(jobId)
                .adminReviewStatus(SubmissionStatus.DRAFT)
                .build();
        when(submissionRepository.findByIdAndAgencyId("sub-500", agencyId)).thenReturn(Optional.of(draftSub));

        CandidateSubmissionResponse submitted = submissionService.submitToAdmin(agencyId, "sub-500", userId);
        assertEquals(SubmissionStatus.SUBMITTED_TO_ADMIN, submitted.getAdminReviewStatus());

        // 3. Admin releases candidate to agency
        draftSub.setAdminReviewStatus(SubmissionStatus.RELEASED_TO_AGENCY);

        // 4. Send released candidate to recruiter
        when(submissionRepository.findByIdAndAgencyId("sub-500", agencyId)).thenReturn(Optional.of(draftSub));
        CandidateSubmissionResponse sentToRecruiter = submissionService.sendToRecruiter(agencyId, "sub-500", "recruiter-1", userId);
        assertEquals(SubmissionStatus.SENT_TO_RECRUITER, sentToRecruiter.getAdminReviewStatus());
        assertEquals("recruiter-1", sentToRecruiter.getRecruiterUserId());
    }

    @Test
    @DisplayName("Submission creation fails if candidate consent is not GRANTED")
    void submissionFailsWithoutConsent() {
        when(submissionRepository.existsByAgencyIdAndJobIdAndCandidateIdAndAdminReviewStatusNotIn(eq(agencyId), eq(jobId), eq(candidateId), any()))
                .thenReturn(false);
        CandidateAgencyAssociation pendingAssoc = CandidateAgencyAssociation.builder()
                .agencyId(agencyId)
                .candidateId(candidateId)
                .consentStatus(CandidateConsentStatus.PENDING)
                .build();
        when(associationRepository.findByAgencyIdAndCandidateId(agencyId, candidateId))
                .thenReturn(Optional.of(pendingAssoc));

        CandidateSubmissionRequest createReq = CandidateSubmissionRequest.builder()
                .candidateId(candidateId)
                .jobId(jobId)
                .clientCompanyId(clientCompanyId)
                .build();

        BusinessException ex = assertThrows(BusinessException.class, () ->
                submissionService.createSubmission(agencyId, userId, createReq));
        assertEquals("CANDIDATE_CONSENT_REQUIRED", ex.getErrorCode());
    }

    @Test
    @DisplayName("Interview scheduling and feedback")
    void interviewSchedulingAndFeedback() {
        CandidateSubmission sub = CandidateSubmission.builder()
                .id("sub-500")
                .agencyId(agencyId)
                .candidateId(candidateId)
                .jobId(jobId)
                .adminReviewStatus(SubmissionStatus.SENT_TO_RECRUITER)
                .build();
        when(submissionRepository.findByIdAndAgencyId("sub-500", agencyId)).thenReturn(Optional.of(sub));

        AgencyInterview savedInterview = AgencyInterview.builder()
                .id("int-1")
                .submissionId("sub-500")
                .agencyId(agencyId)
                .candidateId(candidateId)
                .jobId(jobId)
                .roundNumber(1)
                .interviewDate("2026-11-10")
                .interviewStatus(InterviewStatus.SCHEDULED)
                .build();
        when(interviewRepository.save(any(AgencyInterview.class))).thenReturn(savedInterview);

        AgencyInterviewRequest req = AgencyInterviewRequest.builder()
                .submissionId("sub-500")
                .roundNumber(1)
                .interviewDate("2026-11-10")
                .build();

        AgencyInterviewResponse response = interviewService.scheduleInterview(agencyId, userId, req);
        assertNotNull(response);
        assertEquals(InterviewStatus.SCHEDULED, response.getInterviewStatus());

        // Feedback
        when(interviewRepository.findByIdAndAgencyId("int-1", agencyId)).thenReturn(Optional.of(savedInterview));
        AgencyInterviewFeedbackRequest fb = AgencyInterviewFeedbackRequest.builder()
                .status(InterviewStatus.PASSED)
                .feedback("Strong system design and problem solving")
                .rating(5)
                .build();

        AgencyInterviewResponse fbResponse = interviewService.recordFeedback(agencyId, "int-1", fb, userId);
        assertEquals(InterviewStatus.PASSED, fbResponse.getInterviewStatus());
    }

    @Test
    @DisplayName("Placement confirmation updates status to PLACEMENT_CONFIRMED and marks submission as PLACED")
    void placementConfirmation() {
        CandidateSubmission sub = CandidateSubmission.builder()
                .id("sub-500")
                .agencyId(agencyId)
                .candidateId(candidateId)
                .jobId(jobId)
                .adminReviewStatus(SubmissionStatus.SELECTED)
                .build();
        when(submissionRepository.findByIdAndAgencyId("sub-500", agencyId)).thenReturn(Optional.of(sub));

        AgencyPlacement placement = AgencyPlacement.builder()
                .id("place-1")
                .agencyId(agencyId)
                .submissionId("sub-500")
                .candidateId(candidateId)
                .jobId(jobId)
                .designation("Staff Engineer")
                .offeredSalaryInr(3500000L)
                .placementStatus(PlacementStatus.OFFER_RELEASED)
                .build();
        when(placementRepository.findBySubmissionId("sub-500")).thenReturn(Optional.of(placement));
        when(placementRepository.save(any(AgencyPlacement.class))).thenAnswer(inv -> inv.getArgument(0));

        AgencyPlacementRequest pReq = AgencyPlacementRequest.builder()
                .submissionId("sub-500")
                .candidateId(candidateId)
                .jobId(jobId)
                .designation("Staff Engineer")
                .offeredSalaryInr(3500000L)
                .build();

        AgencyPlacementResponse created = placementService.createPlacement(agencyId, userId, pReq);
        assertEquals(PlacementStatus.OFFER_RELEASED, created.getPlacementStatus());

        // Confirm
        when(placementRepository.findByIdAndAgencyId("place-1", agencyId)).thenReturn(Optional.of(placement));
        when(submissionRepository.findById("sub-500")).thenReturn(Optional.of(sub));

        AgencyPlacementResponse confirmed = placementService.confirmPlacement(agencyId, "place-1", "Offer accepted, joined today", userId);
        assertEquals(PlacementStatus.PLACEMENT_CONFIRMED, confirmed.getPlacementStatus());
        assertEquals(SubmissionStatus.PLACED, sub.getAdminReviewStatus());
    }
}
