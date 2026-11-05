package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.AtsEvaluation;
import com.euodoo.hire.model.CandidateProfile;
import com.euodoo.hire.model.CandidateResume;
import com.euodoo.hire.model.ChangeRequestStatus;
import com.euodoo.hire.model.PlanType;
import com.euodoo.hire.model.ResumeApprovalRequest;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.AtsEvaluationRepository;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.CandidateResumeRepository;
import com.euodoo.hire.repository.ResumeApprovalRequestRepository;
import com.euodoo.hire.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for the versioned Resume Management service.
 *
 * Focus: each version keeps its own identifier and storage reference (the root
 * cause of the shared-preview bug), ownership is enforced on every file read,
 * a failed upload never creates a record, and ATS scores are only ever attached
 * to the exact resume version that produced them.
 */
@ExtendWith(MockitoExtension.class)
public class ResumeManagementServiceTest {

    @Mock private CandidateResumeRepository resumeRepository;
    @Mock private CandidateProfileRepository profileRepository;
    @Mock private ResumeApprovalRequestRepository approvalRequestRepository;
    @Mock private AtsEvaluationRepository evaluationRepository;
    @Mock private UserRepository userRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private ResumePdfService resumePdfService;
    @Mock private AuditService auditService;
    @Mock private MultipartFile multipartFile;

    private ResumeManagementService service;

    private static final String CANDIDATE = "cand-1";
    private static final String OTHER_CANDIDATE = "cand-2";

    @BeforeEach
    void setUp() {
        service = new ResumeManagementService(resumeRepository, profileRepository,
                approvalRequestRepository, evaluationRepository, userRepository,
                fileStorageService, resumePdfService, auditService);
    }

    private User paidUser(String id) {
        return User.builder().id(id).name("C").email(id + "@x.dev").role(Role.CANDIDATE)
                .plan(PlanType.PREMIUM).planActivated(true).build();
    }

    private CandidateProfile profile(String userId) {
        return CandidateProfile.builder().id("profile-" + userId).userId(userId).build();
    }

    private CandidateResume version(String id, String userId, int number, boolean active,
                                    String publicId, ChangeRequestStatus status) {
        return CandidateResume.builder()
                .id(id).candidateUserId(userId).version(number).active(active)
                .storedPublicId(publicId)
                .originalFilename("resume-v" + number + ".pdf")
                .mimeType("application/pdf").fileSizeBytes(1024L * number)
                .uploadedAt(Instant.parse("2026-01-0" + number + "T10:00:00Z"))
                .approvalStatus(status)
                .build();
    }

    private void allowPaidPlan() {
        when(userRepository.findById(CANDIDATE)).thenReturn(Optional.of(paidUser(CANDIDATE)));
    }

    private void noEvaluations() {
        lenient().when(evaluationRepository.findByCandidateUserIdAndResumeIdAndKindOrderByCreatedAtDesc(
                anyString(), anyString(), anyString(), any(Pageable.class)))
                .thenReturn(Page.empty());
    }

    // ── Listing: real versions, newest first, count equals record count ──

    @Test
    void listResumes_returnsRealVersionsNewestFirst_withCountMatchingRecords() {
        CandidateResume v1 = version("r1", CANDIDATE, 1, false, "pub-1", ChangeRequestStatus.APPROVED);
        CandidateResume v2 = version("r2", CANDIDATE, 2, true, "pub-2", ChangeRequestStatus.PENDING);
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(v2, v1));
        noEvaluations();

        Map<String, Object> result = service.listResumes(CANDIDATE);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content = (List<Map<String, Object>>) result.get("content");
        assertEquals(2, content.size());
        assertEquals(2, result.get("totalElements"));
        assertEquals("r2", content.get(0).get("id"));
        assertEquals(2, content.get(0).get("version"));
        assertEquals("v2", content.get(0).get("versionLabel"));
        assertTrue((Boolean) content.get(0).get("active"));
        assertEquals("r1", content.get(1).get("id"));
        assertFalse((Boolean) content.get(1).get("active"));
    }

    @Test
    void listResumes_neverExposesStoragePublicId() {
        CandidateResume v1 = version("r1", CANDIDATE, 1, true, "secret/public/id", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(v1));
        noEvaluations();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content =
                (List<Map<String, Object>>) service.listResumes(CANDIDATE).get("content");

        assertFalse(content.get(0).containsKey("storedPublicId"));
        assertFalse(content.get(0).toString().contains("secret/public/id"));
    }

    @Test
    void listResumes_unevaluatedVersion_hasNoAtsBlock() {
        CandidateResume v1 = version("r1", CANDIDATE, 1, true, "pub-1", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(v1));
        noEvaluations();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content =
                (List<Map<String, Object>>) service.listResumes(CANDIDATE).get("content");

        assertNull(content.get(0).get("ats"));
    }

    @Test
    void listResumes_attachesOnlyEvaluationForThatExactVersion() {
        CandidateResume v1 = version("r1", CANDIDATE, 1, false, "pub-1", ChangeRequestStatus.APPROVED);
        CandidateResume v2 = version("r2", CANDIDATE, 2, true, "pub-2", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(v2, v1));

        AtsEvaluation scored = AtsEvaluation.builder().id("eval-1").candidateUserId(CANDIDATE)
                .resumeId("r1").resumeVersion(1).score(77).jobId("job-1").jobTitle("Backend Engineer")
                .createdAt(Instant.parse("2026-02-01T10:00:00Z")).build();
        // v2 has no evaluation; v1 has one.
        when(evaluationRepository.findByCandidateUserIdAndResumeIdAndKindOrderByCreatedAtDesc(
                eq(CANDIDATE), eq("r2"), eq("CANDIDATE_SELF"), any(Pageable.class))).thenReturn(Page.empty());
        when(evaluationRepository.findByCandidateUserIdAndResumeIdAndKindOrderByCreatedAtDesc(
                eq(CANDIDATE), eq("r1"), eq("CANDIDATE_SELF"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(scored)));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content =
                (List<Map<String, Object>>) service.listResumes(CANDIDATE).get("content");

        assertNull(content.get(0).get("ats"), "newer version must not inherit an older version's score");
        @SuppressWarnings("unchecked")
        Map<String, Object> ats = (Map<String, Object>) content.get(1).get("ats");
        assertNotNull(ats);
        assertEquals(77, ats.get("score"));
        assertEquals("job-1", ats.get("jobId"));
        assertEquals("Backend Engineer", ats.get("jobTitle"));
    }

    // ── Upload creates a new version, archives the previous one ──

    @Test
    void uploadResume_createsNewVersionAndArchivesPrevious_withoutDeletingOldFile() {
        allowPaidPlan();
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        CandidateResume previous = version("r1", CANDIDATE, 1, true, "pub-old", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(previous));
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(Optional.of(previous));
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE))
                .thenReturn(new ArrayList<>(List.of(previous)));
        when(fileStorageService.uploadResume(eq(CANDIDATE), eq(multipartFile)))
                .thenReturn(new FileStorageService.UploadResult(
                        "pub-new", "https://x", "new.pdf", "application/pdf", 2048L));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            if (r.getId() == null) r.setId("r2");
            return r;
        });
        noEvaluations();

        Map<String, Object> result = service.uploadResume(CANDIDATE, multipartFile, false);

        assertEquals(2, result.get("version"));
        assertEquals("r2", result.get("id"));
        assertTrue((Boolean) result.get("active"));
        assertEquals("PENDING", result.get("approvalStatus"));
        assertEquals("new.pdf", result.get("originalFilename"));

        // The previous version is archived, not deleted and not overwritten.
        assertFalse(previous.isActive());
        verify(fileStorageService, never()).deleteFile("pub-old");
    }

    @Test
    void uploadResume_recordsVersionAndPreviousReferenceOnApprovalRequest() {
        allowPaidPlan();
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        CandidateResume previous = version("r1", CANDIDATE, 1, true, "pub-old", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(previous));
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(Optional.of(previous));
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE))
                .thenReturn(new ArrayList<>(List.of(previous)));
        when(fileStorageService.uploadResume(eq(CANDIDATE), eq(multipartFile)))
                .thenReturn(new FileStorageService.UploadResult(
                        "pub-new", "https://x", "new.pdf", "application/pdf", 2048L));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            if (r.getId() == null) r.setId("r2");
            return r;
        });
        noEvaluations();

        service.uploadResume(CANDIDATE, multipartFile, false);

        // The review request must reference the exact submitted version and the
        // version it would supersede, so a reviewer never has to guess.
        ArgumentCaptor<ResumeApprovalRequest> captor = ArgumentCaptor.forClass(ResumeApprovalRequest.class);
        verify(approvalRequestRepository).save(captor.capture());
        ResumeApprovalRequest req = captor.getValue();
        assertEquals("r2", req.getResumeId());
        assertEquals(2, req.getResumeVersion());
        assertEquals(ResumeApprovalRequest.CHANGE_UPDATE, req.getChangeType());
        assertEquals("r1", req.getPreviousResumeId());
        assertEquals(1, req.getPreviousResumeVersion());
        assertEquals("resume-v1.pdf", req.getPreviousFilename());
        assertEquals(ChangeRequestStatus.PENDING, req.getStatus());
    }

    @Test
    void uploadResume_firstUpload_isMarkedAsNew() {
        allowPaidPlan();
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());
        when(fileStorageService.uploadResume(eq(CANDIDATE), eq(multipartFile)))
                .thenReturn(new FileStorageService.UploadResult(
                        "pub-new", "https://x", "new.pdf", "application/pdf", 2048L));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            if (r.getId() == null) r.setId("r1");
            return r;
        });
        noEvaluations();

        service.uploadResume(CANDIDATE, multipartFile, false);

        ArgumentCaptor<ResumeApprovalRequest> captor = ArgumentCaptor.forClass(ResumeApprovalRequest.class);
        verify(approvalRequestRepository).save(captor.capture());
        assertEquals(ResumeApprovalRequest.CHANGE_NEW, captor.getValue().getChangeType());
        assertNull(captor.getValue().getPreviousResumeId());
    }

    @Test
    void uploadResume_storageFailure_createsNoRecordAndKeepsActiveResume() {
        allowPaidPlan();
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());
        when(fileStorageService.uploadResume(anyString(), any(MultipartFile.class)))
                .thenThrow(new BusinessException("UPLOAD_FAILED", "Failed to upload resume."));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.uploadResume(CANDIDATE, multipartFile, true));

        assertEquals("UPLOAD_FAILED", ex.getErrorCode());
        verify(resumeRepository, never()).save(any());
        verify(approvalRequestRepository, never()).save(any());
        verify(profileRepository, never()).save(any());
    }

    @Test
    void uploadResume_unpaidPlan_isRejectedBeforeAnyStorageCall() {
        when(userRepository.findById(CANDIDATE)).thenReturn(Optional.of(
                User.builder().id(CANDIDATE).plan(PlanType.FREE).planActivated(false)
                        .role(Role.CANDIDATE).build()));

        assertThrows(AccessDeniedBusinessException.class,
                () -> service.uploadResume(CANDIDATE, multipartFile, false));

        verify(fileStorageService, never()).uploadResume(anyString(), any());
        verify(resumeRepository, never()).save(any());
    }

    // ── Created resumes must be genuine PDFs, never HTML ──

    private static final String SAMPLE_CONTENT_HTML = """
            <div class="resume tpl-modern l-sidebar f-sans" style="--accent:#2563eb">
              <aside class="r-side">
                <div class="r-avatar">PS</div>
                <div class="r-section"><h3 class="r-h">Skills</h3>
                  <div class="r-chips"><span class="r-chip">Figma</span><span class="r-chip">Design</span></div>
                </div>
              </aside>
              <main class="r-main">
                <div class="r-header-text">
                  <h1 class="r-name">Priya Sharma</h1>
                  <div class="r-title">Senior Product Designer</div>
                </div>
                <div class="r-section"><h3 class="r-h">Profile</h3><p>Product designer with 7 years of experience.</p></div>
                <div class="r-section"><h3 class="r-h">Experience</h3>
                  <div class="r-item">
                    <div class="r-item-head"><strong>Senior Product Designer</strong><span class="r-date">Mar 2022 – Present</span></div>
                    <div class="r-sub">Nimbus Labs</div>
                    <ul><li>Led redesign of core dashboard.</li></ul>
                  </div>
                </div>
              </main>
            </div>""";

    private static final byte[] FAKE_PDF_BYTES =
            ("%PDF-1.7 generated for test").getBytes(java.nio.charset.StandardCharsets.UTF_8);

    @Test
    void createResume_convertsContentHtmlIntoAGenuinePdfRecord() throws Exception {
        // Real converter: the stored bytes must be an actual PDF file, not HTML.
        ResumePdfService realPdfService = new ResumePdfService();
        realPdfService.loadStylesheet();
        service = new ResumeManagementService(resumeRepository, profileRepository,
                approvalRequestRepository, evaluationRepository, userRepository,
                fileStorageService, realPdfService, auditService);

        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE)).thenReturn(List.of());
        when(fileStorageService.uploadResume(eq(CANDIDATE), any(MultipartFile.class)))
                .thenAnswer(inv -> {
                    MultipartFile file = inv.getArgument(1);
                    return new FileStorageService.UploadResult(
                            "local:resumes/cand-1/abc.pdf", "/signed", file.getOriginalFilename(),
                            file.getContentType(), file.getSize());
                });
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            r.setId("r-created");
            return r;
        });
        noEvaluations();

        Map<String, Object> result = service.createResume(
                CANDIDATE, "Priya Sharma", "modern", SAMPLE_CONTENT_HTML);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<MultipartFile> fileCaptor = ArgumentCaptor.forClass(MultipartFile.class);
        verify(fileStorageService).uploadResume(eq(CANDIDATE), fileCaptor.capture());

        MultipartFile stored = fileCaptor.getValue();
        byte[] bytes = stored.getBytes();
        assertTrue(bytes.length > 5);
        assertArrayEquals("%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                java.util.Arrays.copyOfRange(bytes, 0, 5));
        assertFalse(new String(bytes, java.nio.charset.StandardCharsets.UTF_8).contains("<div"),
                "generated resume must not be stored as HTML");
        assertEquals("Priya_Sharma.pdf", stored.getOriginalFilename());
        assertEquals("application/pdf", stored.getContentType());

        assertEquals("application/pdf", result.get("mimeType"));
        assertEquals("Priya_Sharma.pdf", result.get("originalFilename"));

        ArgumentCaptor<CandidateResume> captor = ArgumentCaptor.forClass(CandidateResume.class);
        verify(resumeRepository).save(captor.capture());
        assertEquals("application/pdf", captor.getValue().getMimeType());
        assertEquals("CREATED", captor.getValue().getSource());
    }

    @Test
    void createResume_pdfGenerationFailure_storesNothingAndCreatesNoRecord() {
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());
        when(resumePdfService.generateResumePdf(anyString(), any(), any()))
                .thenThrow(new BusinessException("PDF_GENERATION_FAILED", "bad content"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createResume(CANDIDATE, "My Resume", null, "<p>broken</p>"));

        assertEquals("PDF_GENERATION_FAILED", ex.getErrorCode());
        verify(fileStorageService, never()).uploadResume(anyString(), any(MultipartFile.class));
        verify(resumeRepository, never()).save(any());
        verify(profileRepository, never()).save(any());
    }

    @Test
    void createResume_storageFailure_noRecordIsLeftBehind() {
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(anyString(), any(MultipartFile.class)))
                .thenThrow(new BusinessException("UPLOAD_FAILED", "disk full"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.createResume(CANDIDATE, "My Resume", "modern", SAMPLE_CONTENT_HTML));

        assertEquals("UPLOAD_FAILED", ex.getErrorCode());
        verify(resumeRepository, never()).save(any());
    }

    @Test
    void saveBuilderData_withHtml_generatesAndStoresPdfAndReplacesOldFile() throws Exception {
        noEvaluations();
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(eq(CANDIDATE), any(MultipartFile.class)))
                .thenReturn(new FileStorageService.UploadResult(
                        "local:resumes/cand-1/new.pdf", "/signed", "Resume.pdf",
                        "application/pdf", 4096L));
        CandidateProfile profile = profile(CANDIDATE);
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile));
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(Optional.empty());
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE)).thenReturn(List.of());
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            r.setId("saved-1");
            return r;
        });

        Map<String, Object> payload = Map.of(
                "template", "modern",
                "accent", "#0d9488",
                "data", Map.of("name", "Alice", "title", "Engineer"),
                "html", SAMPLE_CONTENT_HTML);

        service.saveBuilderData(CANDIDATE, payload);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<MultipartFile> fileCaptor = ArgumentCaptor.forClass(MultipartFile.class);
        verify(fileStorageService).uploadResume(eq(CANDIDATE), fileCaptor.capture());
        assertArrayEquals("%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                java.util.Arrays.copyOfRange(fileCaptor.getValue().getBytes(), 0, 5));
        assertEquals("application/pdf", fileCaptor.getValue().getContentType());

        ArgumentCaptor<CandidateResume> captor = ArgumentCaptor.forClass(CandidateResume.class);
        verify(resumeRepository).save(captor.capture());
        CandidateResume savedResume = captor.getValue();
        assertEquals("application/pdf", savedResume.getMimeType());
        assertEquals("Alice_-_Engineer.pdf", savedResume.getOriginalFilename());
        assertEquals("Alice_-_Engineer.pdf", fileCaptor.getValue().getOriginalFilename());
        assertEquals("local:resumes/cand-1/new.pdf", savedResume.getStoredPublicId());
        assertEquals(4096L, savedResume.getFileSizeBytes());
        // No previous file existed, so nothing must be deleted.
        verify(fileStorageService, never()).deleteFile(any());
    }

    @Test
    void saveBuilderData_pdfGenerationFailure_keepsPreviousValidReference() {
        CandidateResume previous = version("r1", CANDIDATE, 1, true, "local:old.pdf",
                ChangeRequestStatus.APPROVED);
        previous.setSource("CREATED");
        previous.setResumeData(Map.of("name", "Old"));
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(previous));
        when(resumePdfService.generateResumePdf(anyString(), any(), any()))
                .thenThrow(new BusinessException("PDF_GENERATION_FAILED", "bad content"));

        Map<String, Object> payload = Map.of(
                "resumeId", "r1",
                "template", "modern",
                "accent", "",
                "data", Map.of("name", "New"),
                "html", "<p>bad</p>");

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.saveBuilderData(CANDIDATE, payload));

        assertEquals("PDF_GENERATION_FAILED", ex.getErrorCode());
        // The previous file must not be deleted while the new one isn't stored.
        verify(fileStorageService, never()).deleteFile(any());
        verify(fileStorageService, never()).uploadResume(anyString(), any(MultipartFile.class));
        verify(resumeRepository, never()).save(any());
    }

    @Test
    void saveBuilderData_storageFailure_keepsPreviousValidReference() {
        CandidateResume previous = version("r1", CANDIDATE, 1, true, "local:old.pdf",
                ChangeRequestStatus.APPROVED);
        previous.setSource("CREATED");
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(previous));
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(anyString(), any(MultipartFile.class)))
                .thenThrow(new BusinessException("UPLOAD_FAILED", "disk full"));

        Map<String, Object> payload = Map.of(
                "resumeId", "r1",
                "template", "modern",
                "accent", "",
                "data", Map.of("name", "New"),
                "html", SAMPLE_CONTENT_HTML);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.saveBuilderData(CANDIDATE, payload));

        assertEquals("UPLOAD_FAILED", ex.getErrorCode());
        verify(fileStorageService, never()).deleteFile("local:old.pdf");
        verify(resumeRepository, never()).save(any());
    }

    @Test
    void saveBuilderData_databaseFailure_removesNewFileAndKeepsPreviousReference() {
        CandidateResume previous = version("r1", CANDIDATE, 1, true, "local:old.pdf",
                ChangeRequestStatus.APPROVED);
        previous.setSource("CREATED");
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(previous));
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(anyString(), any(MultipartFile.class)))
                .thenReturn(new FileStorageService.UploadResult(
                        "local:resumes/cand-1/new.pdf", "/signed", "New.pdf",
                        "application/pdf", 2048L));
        when(resumeRepository.save(any(CandidateResume.class)))
                .thenThrow(new RuntimeException("database unavailable"));

        Map<String, Object> payload = Map.of(
                "resumeId", "r1",
                "template", "modern",
                "accent", "",
                "data", Map.of("name", "New"),
                "html", SAMPLE_CONTENT_HTML);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> service.saveBuilderData(CANDIDATE, payload));

        assertEquals("database unavailable", ex.getMessage());
        // The record still points at the old file, so the new upload is an
        // orphan and must be removed; the old file must stay resolvable.
        verify(fileStorageService).deleteFile("local:resumes/cand-1/new.pdf");
        verify(fileStorageService, never()).deleteFile("local:old.pdf");
    }

    // ── Set active ──

    @Test
    void setActiveResume_deactivatesOthersAndMirrorsProfile() {
        allowPaidPlan();
        CandidateResume v1 = version("r1", CANDIDATE, 1, false, "pub-1", ChangeRequestStatus.APPROVED);
        CandidateResume v2 = version("r2", CANDIDATE, 2, true, "pub-2", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(v1));
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE))
                .thenReturn(new ArrayList<>(List.of(v2)));
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> inv.getArgument(0));
        noEvaluations();

        Map<String, Object> result = service.setActiveResume(CANDIDATE, "r1");

        assertEquals("r1", result.get("id"));
        assertTrue((Boolean) result.get("active"));
        assertFalse(v2.isActive());

        ArgumentCaptor<CandidateProfile> captor = ArgumentCaptor.forClass(CandidateProfile.class);
        verify(profileRepository).save(captor.capture());
        assertEquals("pub-1", captor.getValue().getResumeCloudinaryPublicId());
        assertEquals("resume-v1.pdf", captor.getValue().getResumeOriginalFilename());
    }

    @Test
    void setActiveResume_pendingVersion_isRejected() {
        allowPaidPlan();
        CandidateResume pending = version("r2", CANDIDATE, 2, false, "pub-2", ChangeRequestStatus.PENDING);
        when(resumeRepository.findById("r2")).thenReturn(Optional.of(pending));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.setActiveResume(CANDIDATE, "r2"));

        assertEquals("RESUME_NOT_APPROVED", ex.getErrorCode());
        verify(resumeRepository, never()).save(any());
    }

    @Test
    void setActiveResume_otherCandidatesResume_isDenied() {
        allowPaidPlan();
        CandidateResume foreign = version("r9", OTHER_CANDIDATE, 1, false, "pub-9",
                ChangeRequestStatus.APPROVED);
        when(resumeRepository.findById("r9")).thenReturn(Optional.of(foreign));

        assertThrows(AccessDeniedBusinessException.class,
                () -> service.setActiveResume(CANDIDATE, "r9"));

        verify(resumeRepository, never()).save(any());
        verify(profileRepository, never()).save(any());
    }

    @Test
    void setActiveResume_missingResume_isNotFound() {
        allowPaidPlan();
        when(resumeRepository.findById("nope")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.setActiveResume(CANDIDATE, "nope"));
    }

    // ── File access: the exact requested version ──

    @Test
    void loadOwnedResumeFile_returnsBytesOfRequestedVersion() {
        CandidateResume v1 = version("r1", CANDIDATE, 1, false, "pub-1", ChangeRequestStatus.APPROVED);
        CandidateResume v2 = version("r2", CANDIDATE, 2, true, "pub-2", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(v1));
        when(resumeRepository.findById("r2")).thenReturn(Optional.of(v2));
        when(fileStorageService.fetchFile("pub-1", "application/pdf")).thenReturn("one".getBytes());
        when(fileStorageService.fetchFile("pub-2", "application/pdf")).thenReturn("two".getBytes());

        ResumeManagementService.StoredResumeFile first = service.loadOwnedResumeFile(CANDIDATE, "r1");
        ResumeManagementService.StoredResumeFile second = service.loadOwnedResumeFile(CANDIDATE, "r2");

        assertArrayEquals("one".getBytes(), first.bytes());
        assertEquals("resume-v1.pdf", first.filename());
        assertEquals(1, first.version());
        assertArrayEquals("two".getBytes(), second.bytes());
        assertEquals("resume-v2.pdf", second.filename());
        assertEquals(2, second.version());
        assertNotEquals(first.filename(), second.filename());
    }

    @Test
    void loadOwnedResumeFile_otherCandidatesResume_isDenied() {
        CandidateResume foreign = version("r9", OTHER_CANDIDATE, 1, true, "pub-9",
                ChangeRequestStatus.APPROVED);
        when(resumeRepository.findById("r9")).thenReturn(Optional.of(foreign));

        assertThrows(AccessDeniedBusinessException.class,
                () -> service.loadOwnedResumeFile(CANDIDATE, "r9"));

        verify(fileStorageService, never()).fetchFile(anyString(), anyString());
    }

    @Test
    void loadOwnedResumeFile_missingRecord_isNotFound_neverFallsBack() {
        when(resumeRepository.findById("missing")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.loadOwnedResumeFile(CANDIDATE, "missing"));

        verify(fileStorageService, never()).fetchFile(anyString(), anyString());
    }

    @Test
    void loadOwnedResumeFile_missingStoredFile_isNotFound() {
        CandidateResume broken = version("r1", CANDIDATE, 1, true, "pub-1", ChangeRequestStatus.APPROVED);
        broken.setStoredPublicId(null);
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(broken));

        assertThrows(ResourceNotFoundException.class,
                () -> service.loadOwnedResumeFile(CANDIDATE, "r1"));
    }

    // ── Legacy migration ──

    @Test
    void listResumes_migratesLegacySingleProfileResume_intoVersionOne() {
        CandidateProfile legacyProfile = profile(CANDIDATE);
        legacyProfile.setResumeCloudinaryPublicId("legacy-pub");
        legacyProfile.setResumeOriginalFilename("legacy.pdf");
        legacyProfile.setResumeMimeType("application/pdf");
        legacyProfile.setResumeFileSizeBytes(4096);
        legacyProfile.setResumeUploadedAt(Instant.parse("2025-12-01T09:00:00Z"));
        legacyProfile.setResumeApprovalStatus(ChangeRequestStatus.APPROVED);

        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of())   // outer race check
                .thenReturn(List.of())   // in-lock re-check
                .thenReturn(List.of(version("r1", CANDIDATE, 1, true, "legacy-pub",
                        ChangeRequestStatus.APPROVED)));  // post-migration state
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(legacyProfile));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            r.setId("r1");
            return r;
        });
        noEvaluations();

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> content =
                (List<Map<String, Object>>) service.listResumes(CANDIDATE).get("content");

        ArgumentCaptor<CandidateResume> captor = ArgumentCaptor.forClass(CandidateResume.class);
        verify(resumeRepository).save(captor.capture());
        assertEquals(1, captor.getValue().getVersion());
        assertEquals("legacy-pub", captor.getValue().getStoredPublicId());
        assertTrue(captor.getValue().isActive());
        assertEquals(1, content.size());
    }

    // ── Admin approval workflow hooks ──

    @Test
    void markApproved_updatesMatchingVersionOnly() {
        CandidateResume v1 = version("r1", CANDIDATE, 1, false, "pub-1", ChangeRequestStatus.PENDING);
        when(resumeRepository.findByCandidateUserIdAndStoredPublicId(CANDIDATE, "pub-1"))
                .thenReturn(List.of(v1));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> inv.getArgument(0));

        service.markApproved(CANDIDATE, "pub-1");

        assertEquals(ChangeRequestStatus.APPROVED, v1.getApprovalStatus());
        verify(resumeRepository).save(v1);
    }

    @Test
    void removeRejectedVersion_promotesNewestApprovedFallback() {
        CandidateResume rejected = version("r3", CANDIDATE, 3, true, "pub-3",
                ChangeRequestStatus.PENDING);
        CandidateResume approved = version("r2", CANDIDATE, 2, false, "pub-2",
                ChangeRequestStatus.APPROVED);
        when(resumeRepository.findByCandidateUserIdAndStoredPublicId(CANDIDATE, "pub-3"))
                .thenReturn(List.of(rejected));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(approved));
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> inv.getArgument(0));

        service.removeRejectedVersion(CANDIDATE, "pub-3");

        verify(resumeRepository).delete(rejected);
        assertTrue(approved.isActive());
        ArgumentCaptor<CandidateProfile> captor = ArgumentCaptor.forClass(CandidateProfile.class);
        verify(profileRepository).save(captor.capture());
        assertEquals("pub-2", captor.getValue().getResumeCloudinaryPublicId());
    }

    @Test
    void removeRejectedVersion_noFallback_clearsProfileResume() {
        CandidateResume rejected = version("r1", CANDIDATE, 1, true, "pub-1",
                ChangeRequestStatus.PENDING);
        when(resumeRepository.findByCandidateUserIdAndStoredPublicId(CANDIDATE, "pub-1"))
                .thenReturn(List.of(rejected));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of());
        CandidateProfile profile = profile(CANDIDATE);
        profile.setResumeCloudinaryPublicId("pub-1");
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile));

        service.removeRejectedVersion(CANDIDATE, "pub-1");

        verify(resumeRepository).delete(rejected);
        assertNull(profile.getResumeCloudinaryPublicId());
        assertEquals(ChangeRequestStatus.REJECTED, profile.getResumeApprovalStatus());
    }

    @Test
    void getResumeStats_empty_returnsZerosAndNone() {
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of());

        Map<String, Object> stats = service.getResumeStats(CANDIDATE);

        assertEquals(0, stats.get("totalResumes"));
        assertEquals(0, stats.get("createdCount"));
        assertEquals(0, stats.get("uploadedCount"));
        assertNull(stats.get("lastUpdated"));
        assertEquals("None", stats.get("lastUpdatedFormatted"));
    }

    @Test
    void getResumeStats_multipleVersionsOfSameResume_countsAsOneResume() {
        CandidateResume v1 = version("r1", CANDIDATE, 1, false, "pub-1", ChangeRequestStatus.APPROVED);
        v1.setResumeGroupId("group-A");
        v1.setSource("UPLOADED");

        CandidateResume v2 = version("r2", CANDIDATE, 2, true, "pub-2", ChangeRequestStatus.APPROVED);
        v2.setResumeGroupId("group-A");
        v2.setSource("UPLOADED");

        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(v2, v1));

        Map<String, Object> stats = service.getResumeStats(CANDIDATE);

        // Crucial rule: "A resume should be counted as one resume, not once per version."
        assertEquals(1, stats.get("totalResumes"));
        assertEquals(0, stats.get("createdCount"));
        assertEquals(1, stats.get("uploadedCount"));
        assertNotNull(stats.get("lastUpdated"));
    }

    @Test
    void getResumeStats_createdAndUploadedResumes_correctCounts() {
        CandidateResume uploaded = version("r1", CANDIDATE, 1, true, "pub-1", ChangeRequestStatus.APPROVED);
        uploaded.setResumeGroupId("group-1");
        uploaded.setSource("UPLOADED");

        CandidateResume created = version("r2", CANDIDATE, 2, false, "pub-2", ChangeRequestStatus.APPROVED);
        created.setResumeGroupId("group-2");
        created.setSource("CREATED");

        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(created, uploaded));

        Map<String, Object> stats = service.getResumeStats(CANDIDATE);

        assertEquals(2, stats.get("totalResumes"));
        assertEquals(1, stats.get("createdCount"));
        assertEquals(1, stats.get("uploadedCount"));
    }

    @Test
    void dashboardCountsUpdateAfterCreatingResume_createdNotUploaded() {
        noEvaluations();
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(eq(CANDIDATE), any(MultipartFile.class)))
                .thenReturn(new FileStorageService.UploadResult(
                        "local:resumes/cand-1/myresume.pdf", "/signed", "My_Resume.pdf",
                        "application/pdf", 2048L));
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(Optional.empty());
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE)).thenReturn(List.of());
        List<CandidateResume> persisted = new ArrayList<>();
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            r.setId("r-created-" + (persisted.size() + 1));
            persisted.add(r);
            return r;
        });

        Map<String, Object> created = service.createResume(CANDIDATE, "My Resume", "modern", SAMPLE_CONTENT_HTML);

        // The repository now returns the persisted record (as a real DB would).
        List<CandidateResume> rows = new ArrayList<>(persisted);
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(rows);

        // The dashboard summary card reflects the persisted record.
        Map<String, Object> stats = service.getResumeStats(CANDIDATE);
        assertEquals(1, stats.get("totalResumes"));
        assertEquals(1, stats.get("createdCount"));
        assertEquals(0, stats.get("uploadedCount"));
        assertNotNull(stats.get("lastUpdated"));

        // The version history endpoint returns the new record with its real data.
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> history = (List<Map<String, Object>>) service.listResumes(CANDIDATE).get("content");
        assertEquals(1, history.size());
        Map<String, Object> row = history.get(0);
        assertEquals("My_Resume.pdf", row.get("originalFilename"));
        assertEquals("application/pdf", row.get("mimeType"));
        assertEquals("CREATED", row.get("source"));
        assertEquals("application/pdf", created.get("mimeType"));
        assertNull(row.get("ats"), "unevaluated resume must not carry a fabricated ATS score");
    }

    @Test
    void dashboardCountsAfterMultipleCreatedResumes_eachCountedOnce() {
        noEvaluations();
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(eq(CANDIDATE), any(MultipartFile.class)))
                .thenReturn(new FileStorageService.UploadResult(
                        "local:resumes/cand-1/x.pdf", "/signed", "x.pdf",
                        "application/pdf", 1024L));
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE)).thenReturn(List.of());
        List<CandidateResume> persisted = new ArrayList<>();
        // Answers must reflect the "database" state at call time, newest first.
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenAnswer(inv ->
                persisted.stream()
                        .sorted(java.util.Comparator.comparingInt(CandidateResume::getVersion).reversed())
                        .toList());
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenAnswer(inv -> persisted.stream().map(CandidateResume::getVersion)
                        .max(Integer::compareTo)
                        .map(v -> CandidateResume.builder().version(v).build()));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            r.setId("r-created-" + (persisted.size() + 1));
            persisted.add(r);
            r.setVersion(persisted.size());
            return r;
        });

        service.createResume(CANDIDATE, "First", "modern", SAMPLE_CONTENT_HTML);
        service.createResume(CANDIDATE, "Second", "tech", SAMPLE_CONTENT_HTML);

        Map<String, Object> stats = service.getResumeStats(CANDIDATE);
        // Each builder resume has its own group id, so both count exactly once.
        assertEquals(2, stats.get("totalResumes"));
        assertEquals(2, stats.get("createdCount"));
        assertEquals(0, stats.get("uploadedCount"));
    }

    @Test
    void deleteResume_removesResumeAndUpdatesStatus() {
        CandidateResume active = version("r1", CANDIDATE, 1, true, "pub-1", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(active));
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());

        Map<String, Object> res = service.deleteResume(CANDIDATE, "r1");

        verify(fileStorageService).deleteFile("pub-1");
        verify(resumeRepository).delete(active);
        assertEquals("Resume deleted successfully.", res.get("message"));
    }

    @Test
    void getBuilderData_byOwnedResumeId_returnsSavedData() {
        CandidateResume savedResume = version("r-created", CANDIDATE, 1, true, "pub-created", ChangeRequestStatus.APPROVED);
        savedResume.setSource("CREATED");
        savedResume.setTemplateId("executive");
        savedResume.setAccentColor("#14b8a6");
        Map<String, Object> data = Map.of("name", "Jane Doe", "title", "Lead Designer");
        savedResume.setResumeData(data);

        when(resumeRepository.findById("r-created")).thenReturn(Optional.of(savedResume));

        Map<String, Object> result = service.getBuilderData(CANDIDATE, "r-created");

        assertTrue((Boolean) result.get("hasSavedData"));
        assertEquals("r-created", result.get("resumeId"));
        assertEquals("executive", result.get("template"));
        assertEquals("#14b8a6", result.get("accent"));
        assertEquals(data, result.get("data"));
    }

    @Test
    void getBuilderData_withoutResumeId_neverLeaksDraftId() {
        CandidateResume savedResume = version("r-created", CANDIDATE, 1, true, "pub-created", ChangeRequestStatus.APPROVED);
        savedResume.setSource("CREATED");
        savedResume.setResumeData(Map.of("name", "Jane Doe"));
        // The candidate owns a created draft, but a create-intent load must
        // never adopt it: the next save always starts a new logical resume.
        when(userRepository.findById(CANDIDATE)).thenReturn(Optional.empty());
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.empty());

        Map<String, Object> result = service.getBuilderData(CANDIDATE, null);

        assertFalse((Boolean) result.get("hasSavedData"));
        assertNull(result.get("resumeId"));
        verify(resumeRepository, never()).findById(anyString());
    }

    @Test
    void getBuilderData_byForeignResumeId_isIgnored() {
        CandidateResume foreign = version("r-other", OTHER_CANDIDATE, 1, true, "pub-other",
                ChangeRequestStatus.APPROVED);
        foreign.setSource("CREATED");
        foreign.setResumeData(Map.of("name", "Someone Else"));
        when(userRepository.findById(CANDIDATE)).thenReturn(Optional.empty());
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.empty());
        when(resumeRepository.findById("r-other")).thenReturn(Optional.of(foreign));

        Map<String, Object> result = service.getBuilderData(CANDIDATE, "r-other");

        assertFalse((Boolean) result.get("hasSavedData"));
        assertNull(result.get("resumeId"));
    }

    @Test
    void getBuilderData_noSavedResume_prefillsFromProfileAndUser() {
        User user = User.builder().id(CANDIDATE).name("John Developer").email("john@example.com").build();
        CandidateProfile profile = profile(CANDIDATE);
        profile.setCurrentDesignation("Senior Software Engineer");
        profile.setPhone("+1234567890");
        profile.setLocation("New York, USA");
        profile.setBio("Experienced backend developer.");
        profile.setSkills(List.of("Java", "Spring Boot", "MongoDB"));

        when(userRepository.findById(CANDIDATE)).thenReturn(Optional.of(user));
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile));

        Map<String, Object> result = service.getBuilderData(CANDIDATE, null);

        assertFalse((Boolean) result.get("hasSavedData"));
        assertNull(result.get("resumeId"));
        Map<String, Object> prefill = (Map<String, Object>) result.get("data");
        assertEquals("John Developer", prefill.get("name"));
        assertEquals("Senior Software Engineer", prefill.get("title"));
        assertEquals("john@example.com", prefill.get("email"));
        assertEquals("+1234567890", prefill.get("phone"));
        assertEquals("New York, USA", prefill.get("location"));
        assertEquals("Experienced backend developer.", prefill.get("summary"));
        assertEquals("Java, Spring Boot, MongoDB", prefill.get("skills"));
    }

    @Test
    void saveBuilderData_newResume_persistsToRepositoryAndMirrorsProfile() {
        noEvaluations();
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(Optional.empty());
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE)).thenReturn(List.of());

        CandidateProfile profile = profile(CANDIDATE);
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile));

        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            r.setId("saved-123");
            return r;
        });

        Map<String, Object> resumeData = Map.of(
                "name", "Alice Smith",
                "title", "Full Stack Engineer",
                "phone", "9876543210",
                "location", "San Francisco, CA",
                "summary", "Passionate full-stack developer.",
                "skills", "React, Node.js, TypeScript"
        );

        Map<String, Object> payload = Map.of(
                "template", "modern",
                "accent", "#0d9488",
                "data", resumeData
        );

        Map<String, Object> response = service.saveBuilderData(CANDIDATE, payload);

        assertTrue((Boolean) response.get("success"));
        assertEquals("saved-123", response.get("resumeId"));

        ArgumentCaptor<CandidateResume> captor = ArgumentCaptor.forClass(CandidateResume.class);
        verify(resumeRepository, atLeastOnce()).save(captor.capture());
        CandidateResume saved = captor.getAllValues().get(0);
        assertEquals(CANDIDATE, saved.getCandidateUserId());
        assertEquals("CREATED", saved.getSource());
        assertEquals("Alice Smith - Full Stack Engineer", saved.getResumeTitle());
        assertEquals("modern", saved.getTemplateId());
        assertEquals("#0d9488", saved.getAccentColor());
        assertEquals(resumeData, saved.getResumeData());

        // Verify profile mirrored
        verify(profileRepository).save(profile);
        assertEquals("9876543210", profile.getPhone());
        assertEquals("San Francisco, CA", profile.getLocation());
        assertEquals("Full Stack Engineer", profile.getCurrentDesignation());
        assertEquals("Passionate full-stack developer.", profile.getBio());
        assertTrue(profile.getSkills().contains("React"));
        assertTrue(profile.getSkills().contains("Node.js"));
        assertTrue(profile.getSkills().contains("TypeScript"));
    }

    @Test
    void saveBuilderData_withoutResumeId_alwaysCreatesNewLogicalResumeEvenWhenDraftExists() {
        noEvaluations();
        CandidateResume draft = version("r1", CANDIDATE, 1, true, "local:old.pdf",
                ChangeRequestStatus.APPROVED);
        draft.setSource("CREATED");
        draft.setResumeData(Map.of("name", "Old"));
        draft.setResumeGroupId("group-A");
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(eq(CANDIDATE), any(MultipartFile.class)))
                .thenReturn(new FileStorageService.UploadResult(
                        "local:resumes/cand-1/new.pdf", "/signed", "New.pdf",
                        "application/pdf", 1024L));
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(Optional.of(draft));
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE)).thenReturn(List.of(draft));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = Map.of(
                "template", "modern",
                "accent", "",
                "data", Map.of("name", "New", "title", "Engineer"),
                "html", SAMPLE_CONTENT_HTML);

        service.saveBuilderData(CANDIDATE, payload);

        ArgumentCaptor<CandidateResume> captor = ArgumentCaptor.forClass(CandidateResume.class);
        verify(resumeRepository).save(captor.capture());
        CandidateResume saved = captor.getValue();
        // A save without a resumeId is a create intent: it must never adopt the
        // existing draft — neither its document nor its logical group.
        assertNotEquals("r1", saved.getId());
        assertNotEquals("group-A", saved.getResumeGroupId());
        assertEquals("CREATED", saved.getSource());
        assertEquals(2, saved.getVersion());
        // The draft's stored file must not be touched.
        verify(fileStorageService, never()).deleteFile("local:old.pdf");

        // Dashboard counts both logical resumes separately.
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(List.of(saved, draft));
        Map<String, Object> stats = service.getResumeStats(CANDIDATE);
        assertEquals(2, stats.get("totalResumes"));
        assertEquals(2, stats.get("createdCount"));
    }

    @Test
    void saveBuilderData_withForeignResumeId_createNewInsteadOfAdopting() {
        noEvaluations();
        CandidateResume foreign = version("r-other", OTHER_CANDIDATE, 1, true, "local:other.pdf",
                ChangeRequestStatus.APPROVED);
        foreign.setSource("CREATED");
        foreign.setResumeData(Map.of("name", "Someone Else"));
        foreign.setResumeGroupId("group-other");
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(eq(CANDIDATE), any(MultipartFile.class)))
                .thenReturn(new FileStorageService.UploadResult(
                        "local:resumes/cand-1/x.pdf", "/signed", "X.pdf",
                        "application/pdf", 1024L));
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenReturn(Optional.empty());
        when(resumeRepository.findByCandidateUserIdAndActiveTrue(CANDIDATE)).thenReturn(List.of());
        when(resumeRepository.findById("r-other")).thenReturn(Optional.of(foreign));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = Map.of(
                "resumeId", "r-other",
                "template", "modern",
                "accent", "",
                "data", Map.of("name", "New", "title", "Engineer"),
                "html", SAMPLE_CONTENT_HTML);

        service.saveBuilderData(CANDIDATE, payload);

        // The foreign id must be ignored, never written into.
        ArgumentCaptor<CandidateResume> captor = ArgumentCaptor.forClass(CandidateResume.class);
        verify(resumeRepository).save(captor.capture());
        CandidateResume saved = captor.getValue();
        assertEquals(CANDIDATE, saved.getCandidateUserId());
        assertNotEquals("group-other", saved.getResumeGroupId());
        assertNotEquals("local:other.pdf", saved.getStoredPublicId());
        verify(fileStorageService, never()).deleteFile("local:other.pdf");
    }

    @Test
    void saveBuilderData_withOwnedResumeId_updatesSameLogicalResume() {
        noEvaluations();
        CandidateResume previous = version("r1", CANDIDATE, 1, true, "local:old.pdf",
                ChangeRequestStatus.APPROVED);
        previous.setSource("CREATED");
        previous.setResumeData(Map.of("name", "Old"));
        previous.setResumeGroupId("group-A");
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(previous));
        when(resumePdfService.generateResumePdf(anyString(), anyString(), any()))
                .thenReturn(FAKE_PDF_BYTES);
        when(fileStorageService.uploadResume(eq(CANDIDATE), any(MultipartFile.class)))
                .thenReturn(new FileStorageService.UploadResult(
                        "local:resumes/cand-1/new.pdf", "/signed", "New.pdf",
                        "application/pdf", 2048L));
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile(CANDIDATE)));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> payload = Map.of(
                "resumeId", "r1",
                "template", "modern",
                "accent", "",
                "data", Map.of("name", "Updated", "title", "Engineer"),
                "html", SAMPLE_CONTENT_HTML);

        service.saveBuilderData(CANDIDATE, payload);

        // Editing with an explicit resumeId updates that record in place and
        // keeps its logical group, so dashboard counts are unchanged.
        ArgumentCaptor<CandidateResume> captor = ArgumentCaptor.forClass(CandidateResume.class);
        verify(resumeRepository).save(captor.capture());
        CandidateResume saved = captor.getValue();
        assertEquals("r1", saved.getId());
        assertEquals("group-A", saved.getResumeGroupId());
        assertEquals(1, saved.getVersion());
        // The database now references the new file, so the superseded one is removed.
        verify(fileStorageService).deleteFile("local:old.pdf");
    }

    @Test
    void ensureLegacyVersionMigrated_concurrentFirstRequests_createOnlyOneRecord() throws Exception {
        // Simulated database shared state so the in-lock double-check can see it.
        List<CandidateResume> db = new java.util.concurrent.CopyOnWriteArrayList<>();
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE))
                .thenAnswer(inv -> List.copyOf(db));
        when(resumeRepository.save(any(CandidateResume.class))).thenAnswer(inv -> {
            CandidateResume r = inv.getArgument(0);
            r.setId("legacy-" + db.size());
            db.add(r);
            return r;
        });
        when(evaluationRepository.findByCandidateUserIdAndResumeRef(eq(CANDIDATE), anyString()))
                .thenReturn(List.of());
        CandidateProfile profile = profile(CANDIDATE);
        profile.setResumeCloudinaryPublicId("local:resume.pdf");
        profile.setResumeOriginalFilename("paid-candidate-resume.pdf");
        profile.setResumeMimeType("application/pdf");
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile));

        // The dashboard fires several resume requests concurrently on load.
        int threads = 6;
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(threads);
        java.util.concurrent.CountDownLatch ready = new java.util.concurrent.CountDownLatch(threads);
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(threads);
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                ready.countDown();
                start.await();
                service.ensureLegacyVersionMigrated(CANDIDATE);
                done.countDown();
                return null;
            });
        }
        assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS));
        start.countDown();
        assertTrue(done.await(10, java.util.concurrent.TimeUnit.SECONDS));
        pool.shutdownNow();

        assertEquals(1, db.size(),
                "concurrent first requests after a DB wipe must materialise the legacy resume exactly once");
    }

    @Test
    void deleteResume_lastRemainingRecord_clearsProfileMirrorSoNothingResurrects() {
        noEvaluations();
        CandidateResume only = version("r1", CANDIDATE, 1, true, "local:old.pdf", ChangeRequestStatus.APPROVED);
        when(resumeRepository.findById("r1")).thenReturn(Optional.of(only));
        when(resumeRepository.findByCandidateUserIdOrderByVersionDesc(CANDIDATE)).thenReturn(List.of());
        CandidateProfile profile = profile(CANDIDATE);
        profile.setResumeCloudinaryPublicId("local:old.pdf");
        profile.setResumeOriginalFilename("paid-candidate-resume.pdf");
        profile.setResumeMimeType("application/pdf");
        when(profileRepository.findByUserId(CANDIDATE)).thenReturn(Optional.of(profile));

        Map<String, Object> res = service.deleteResume(CANDIDATE, "r1");

        // The legacy mirror on the profile is cleared, so wiping/losing the
        // version records can never resurrect this resume automatically.
        assertNull(profile.getResumeCloudinaryPublicId());
        assertNull(profile.getResumeOriginalFilename());
        verify(profileRepository).save(profile);
        verify(resumeRepository, never()).save(any(CandidateResume.class));
        @SuppressWarnings("unchecked")
        Map<String, Object> stats = (Map<String, Object>) res.get("stats");
        assertEquals(0, stats.get("totalResumes"));
    }
}
