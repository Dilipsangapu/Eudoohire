package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for CandidateService.
 * Validates plan enforcement, application workflow and ownership rules.
 */
@ExtendWith(MockitoExtension.class)
public class CandidateServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CandidateProfileRepository candidateProfileRepository;
    @Mock private JobRepository jobRepository;
    @Mock private JobApplicationRepository jobApplicationRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private ResumeApprovalRequestRepository resumeApprovalRequestRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private ResumeManagementService resumeManagementService;
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private com.euodoo.hire.repository.RecruiterProfileRepository recruiterProfileRepository;
    @Mock private com.euodoo.hire.repository.CompanyRepository companyRepository;

    private CandidateService candidateService;

    private User freeCandidateUser;
    private User basicCandidateUser;
    private User premiumCandidateUser;

    @BeforeEach
    void setUp() {
        candidateService = new CandidateService(userRepository, candidateProfileRepository,
                jobRepository, jobApplicationRepository, notificationRepository,
                resumeApprovalRequestRepository, fileStorageService, resumeManagementService,
                notificationService, auditService, passwordEncoder,
                recruiterProfileRepository, companyRepository);

        freeCandidateUser = User.builder()
                .id("cand-free-001").email("free@test.com")
                .role(Role.CANDIDATE).accountStatus(AccountStatus.ACTIVE)
                .plan(PlanType.FREE).planActivated(false).build();

        basicCandidateUser = User.builder()
                .id("cand-basic-001").email("basic@test.com")
                .passwordHash("$2a$12$hashedPasswordForTest")
                .role(Role.CANDIDATE).accountStatus(AccountStatus.ACTIVE)
                .plan(PlanType.BASIC).planActivated(true).build();

        premiumCandidateUser = User.builder()
                .id("cand-prem-001").email("premium@test.com")
                .role(Role.CANDIDATE).accountStatus(AccountStatus.ACTIVE)
                .plan(PlanType.PREMIUM).planActivated(true).build();
    }

    // =========================================================
    // Plan enforcement
    // =========================================================

    @Test
    void hasPaidActivePlan_free_returnsFalse() {
        when(userRepository.findById("cand-free-001")).thenReturn(Optional.of(freeCandidateUser));
        assertFalse(candidateService.hasPaidActivePlan("cand-free-001"));
    }

    @Test
    void hasPaidActivePlan_basic_returnsTrue() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        assertTrue(candidateService.hasPaidActivePlan("cand-basic-001"));
    }

    @Test
    void hasPaidActivePlan_premium_returnsTrue() {
        when(userRepository.findById("cand-prem-001")).thenReturn(Optional.of(premiumCandidateUser));
        assertTrue(candidateService.hasPaidActivePlan("cand-prem-001"));
    }

    @Test
    void assertPaidPlan_freeUser_throwsAccessDenied() {
        when(userRepository.findById("cand-free-001")).thenReturn(Optional.of(freeCandidateUser));
        assertThrows(AccessDeniedBusinessException.class,
                () -> candidateService.assertPaidPlan("cand-free-001"));
    }

    @Test
    void assertPaidPlan_basicUser_doesNotThrow() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        assertDoesNotThrow(() -> candidateService.assertPaidPlan("cand-basic-001"));
    }

    // =========================================================
    // Job application — paid plan required
    // =========================================================

    @Test
    void expressInterest_freeCandidate_throwsAccessDenied() {
        when(userRepository.findById("cand-free-001")).thenReturn(Optional.of(freeCandidateUser));
        assertThrows(AccessDeniedBusinessException.class,
                () -> candidateService.expressInterest("cand-free-001", "job-001"));
    }

    @Test
    void expressInterest_paidCandidate_success() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        Job activeJob = Job.builder().id("job-001").status(JobStatus.ACTIVE)
                .companyId("comp-001").recruiterUserId("rec-001").build();
        when(jobRepository.findById("job-001")).thenReturn(Optional.of(activeJob));
        when(jobApplicationRepository.existsByCandidateUserIdAndJobId(
                "cand-basic-001", "job-001")).thenReturn(false);
        when(jobApplicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        JobApplication app = candidateService.expressInterest("cand-basic-001", "job-001");
        assertEquals(ApplicationStatus.INTERESTED, app.getStatus());
        assertEquals("cand-basic-001", app.getCandidateUserId());
        assertNotNull(app.getInterestedAt());
        assertFalse(app.getStatusHistory().isEmpty());
    }

    @Test
    void expressInterest_duplicateApplication_throwsBusinessException() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        Job activeJob = Job.builder().id("job-001").status(JobStatus.ACTIVE).build();
        when(jobRepository.findById("job-001")).thenReturn(Optional.of(activeJob));
        when(jobApplicationRepository.existsByCandidateUserIdAndJobId(
                "cand-basic-001", "job-001")).thenReturn(true);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> candidateService.expressInterest("cand-basic-001", "job-001"));
        assertEquals("DUPLICATE_APPLICATION", ex.getErrorCode());
    }

    @Test
    void expressInterest_inactiveJob_throwsBusinessException() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        Job closedJob = Job.builder().id("job-002").status(JobStatus.CLOSED).build();
        when(jobRepository.findById("job-002")).thenReturn(Optional.of(closedJob));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> candidateService.expressInterest("cand-basic-001", "job-002"));
        assertEquals("JOB_NOT_ACTIVE", ex.getErrorCode());
    }

    // =========================================================
    // Application withdrawal
    // =========================================================

    @Test
    void withdrawApplication_success() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        JobApplication app = JobApplication.builder()
                .id("app-001").candidateUserId("cand-basic-001")
                .status(ApplicationStatus.INTERESTED).build();
        when(jobApplicationRepository.findById("app-001")).thenReturn(Optional.of(app));
        when(jobApplicationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        JobApplication result = candidateService.withdrawApplication(
                "cand-basic-001", "app-001", "Not interested");

        assertEquals(ApplicationStatus.WITHDRAWN, result.getStatus());
        assertNotNull(result.getWithdrawnAt());
    }

    @Test
    void withdrawApplication_alreadyWithdrawn_throwsBusinessException() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        JobApplication app = JobApplication.builder()
                .id("app-001").candidateUserId("cand-basic-001")
                .status(ApplicationStatus.WITHDRAWN).build();
        when(jobApplicationRepository.findById("app-001")).thenReturn(Optional.of(app));

        assertThrows(BusinessException.class,
                () -> candidateService.withdrawApplication("cand-basic-001", "app-001", null));
    }

    @Test
    void withdrawApplication_anotherCandidatesApp_throwsAccessDenied() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        JobApplication app = JobApplication.builder()
                .id("app-999").candidateUserId("other-candidate")
                .status(ApplicationStatus.INTERESTED).build();
        when(jobApplicationRepository.findById("app-999")).thenReturn(Optional.of(app));

        assertThrows(AccessDeniedBusinessException.class,
                () -> candidateService.withdrawApplication("cand-basic-001", "app-999", null));
    }

    // =========================================================
    // Account deletion (D1)
    // =========================================================

    @Test
    void requestAccountDeletion_cancelsOpenApplications_andDeletesUserData() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        when(passwordEncoder.matches("password", "$2a$12$hashedPasswordForTest")).thenReturn(true);

        CandidateProfile profile = CandidateProfile.builder()
                .id("cp-001").userId("cand-basic-001")
                .resumeCloudinaryPublicId("resumes/resume-123")
                .profilePictureCloudinaryPublicId("pictures/pic-123")
                .build();
        when(candidateProfileRepository.findByUserId("cand-basic-001")).thenReturn(Optional.of(profile));

        JobApplication app = JobApplication.builder()
                .id("app-001").candidateUserId("cand-basic-001")
                .status(ApplicationStatus.INTERESTED).build();
        when(jobApplicationRepository.findByCandidateUserIdAndStatusIn(eq("cand-basic-001"), anyList()))
                .thenReturn(java.util.List.of(app));

        candidateService.requestAccountDeletion("cand-basic-001", "password");

        verify(passwordEncoder).matches("password", "$2a$12$hashedPasswordForTest");
        verify(fileStorageService).deleteFile("resumes/resume-123");
        verify(fileStorageService).deleteFile("pictures/pic-123");
        verify(candidateProfileRepository).delete(profile);
        assertEquals(ApplicationStatus.WITHDRAWN, app.getStatus());
        assertEquals("Account deleted by user", app.getWithdrawalReason());
        verify(jobApplicationRepository).save(app);
        verify(notificationRepository).deleteByRecipientUserId("cand-basic-001");
        verify(auditService).log(eq("cand-basic-001"), eq("CANDIDATE"), eq("User"),
                eq("cand-basic-001"), eq("ACCOUNT_DELETED"), isNull());
        verify(userRepository).delete(basicCandidateUser);
    }

    @Test
    void requestAccountDeletion_incorrectPassword_throwsAccessDenied() {
        when(userRepository.findById("cand-basic-001")).thenReturn(Optional.of(basicCandidateUser));
        when(passwordEncoder.matches("wrong_password", "$2a$12$hashedPasswordForTest")).thenReturn(false);

        assertThrows(AccessDeniedBusinessException.class,
                () -> candidateService.requestAccountDeletion("cand-basic-001", "wrong_password"));

        verify(userRepository, never()).delete(any());
        verify(candidateProfileRepository, never()).delete(any());
    }
}
