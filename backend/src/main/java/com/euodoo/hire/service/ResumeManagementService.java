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
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.AtsEvaluationRepository;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.CandidateResumeRepository;
import com.euodoo.hire.repository.ResumeApprovalRequestRepository;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
/**
 * Resume Management: real, versioned resume records backed by the existing
 * file storage integration.
 *
 * Business rules preserved from the previous single-resume implementation:
 *  - only an active, storage-backed resume is mirrored on the candidate profile
 *    (recruiter search / hire-match / ATS "stored resume" flows read it),
 *  - every upload starts a new PENDING admin approval request,
 *  - only APPROVED resumes are visible to recruiters,
 *  - candidates may only ever touch their own resumes.
 *
 * New behaviour required by the Resume Management page: uploads create a new
 * version instead of destroying the previous file, each version keeps its own
 * identifier and storage reference, and a version can be re-activated later.
 *
 * The internal storage public id is NEVER returned by any method here.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ResumeManagementService {

    private final CandidateResumeRepository resumeRepository;
    private final CandidateProfileRepository profileRepository;
    private final ResumeApprovalRequestRepository approvalRequestRepository;
    private final AtsEvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final ResumePdfService resumePdfService;
    private final AuditService auditService;

    /**
     * One lock per candidate for the legacy one-time migration. The dashboard
     * issues several resume requests concurrently on first load; without this,
     * two threads can both observe an empty version list and each materialise
     * a duplicate copy of the profile's legacy resume.
     */
    private final Map<String, Object> legacyMigrationLocks = new ConcurrentHashMap<>();

    private static final DateTimeFormatter STATS_DATE_FMT =
            DateTimeFormatter.ofPattern("MMM dd, yyyy").withZone(ZoneId.of("UTC"));

    // ─────────────────────────────────────────────────
    // Listing & Statistics
    // ─────────────────────────────────────────────────

    /**
     * Calculates real resume statistics for the authenticated candidate:
     * - Total resumes (counted once per logical resume, not once per version)
     * - Created in-app resumes count
     * - Uploaded resumes count
     * - Last updated timestamp
     */
    public Map<String, Object> getResumeStats(String candidateUserId) {
        ensureLegacyVersionMigrated(candidateUserId);
        List<CandidateResume> versions =
                resumeRepository.findByCandidateUserIdOrderByVersionDesc(candidateUserId);

        Map<String, Object> stats = new LinkedHashMap<>();
        if (versions.isEmpty()) {
            stats.put("totalResumes", 0);
            stats.put("createdCount", 0);
            stats.put("uploadedCount", 0);
            stats.put("lastUpdated", null);
            stats.put("lastUpdatedFormatted", "None");
            return stats;
        }

        // Group versions by logical resume (resumeGroupId, or fallback to legacy lineage)
        // Rule: A resume is counted as one resume, not once per version.
        Map<String, List<CandidateResume>> groups = new LinkedHashMap<>();
        Instant latestTimestamp = null;

        for (CandidateResume resume : versions) {
            String groupKey = (resume.getResumeGroupId() != null && !resume.getResumeGroupId().isBlank())
                    ? resume.getResumeGroupId()
                    : (resume.getOriginalFilename() != null && !resume.getOriginalFilename().isBlank()
                            ? resume.getOriginalFilename().toLowerCase().trim()
                            : resume.getId());

            groups.computeIfAbsent(groupKey, k -> new ArrayList<>()).add(resume);

            Instant ts = resume.getUpdatedAt() != null ? resume.getUpdatedAt()
                    : (resume.getUploadedAt() != null ? resume.getUploadedAt() : resume.getCreatedAt());
            if (ts != null && (latestTimestamp == null || ts.isAfter(latestTimestamp))) {
                latestTimestamp = ts;
            }
        }

        int createdCount = 0;
        int uploadedCount = 0;

        for (List<CandidateResume> list : groups.values()) {
            CandidateResume rep = list.get(0); // newest version in group
            if ("CREATED".equalsIgnoreCase(rep.getSource())) {
                createdCount++;
            } else {
                uploadedCount++;
            }
        }

        int totalResumes = groups.size();

        stats.put("totalResumes", totalResumes);
        stats.put("createdCount", createdCount);
        stats.put("uploadedCount", uploadedCount);
        stats.put("lastUpdated", latestTimestamp);
        stats.put("lastUpdatedFormatted", latestTimestamp != null
                ? STATS_DATE_FMT.format(latestTimestamp) : "None");
        return stats;
    }

    /**
     * Returns the authenticated candidate's real resume versions, newest first.
     * Each row carries the latest ATS evaluation that actually scored THAT
     * version (never a score from a different version or job).
     */
    public Map<String, Object> listResumes(String candidateUserId) {
        ensureLegacyVersionMigrated(candidateUserId);
        List<CandidateResume> versions =
                resumeRepository.findByCandidateUserIdOrderByVersionDesc(candidateUserId);

        List<Map<String, Object>> rows = new ArrayList<>(versions.size());
        for (CandidateResume resume : versions) {
            rows.add(toRow(candidateUserId, resume));
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("content", rows);
        res.put("totalElements", rows.size());
        return res;
    }

    /** The single active version, or null when the candidate has none. */
    public CandidateResume getActiveResume(String candidateUserId) {
        List<CandidateResume> active =
                resumeRepository.findByCandidateUserIdAndActiveTrue(candidateUserId);
        return active.isEmpty() ? null : active.get(0);
    }

    // ─────────────────────────────────────────────────
    // Upload / replace
    // ─────────────────────────────────────────────────

    /**
     * Stores a new resume version and makes it the active primary resume.
     *
     * Validation happens before storage; the database record is only written
     * after the file upload succeeded, so a failed upload can never create a
     * record or disturb the existing active resume.
     *
     * @param replacing true when invoked from "Replace Resume" (audit label
     *                  only — both actions add a version, which is what the
     *                  version history has always represented)
     */
    public Map<String, Object> uploadResume(String candidateUserId, MultipartFile file,
                                            boolean replacing) {
        assertPaidPlan(candidateUserId);
        fileStorageService.validateResume(file);

        CandidateProfile profile = getProfile(candidateUserId);
        ensureLegacyVersionMigrated(candidateUserId);

        CandidateResume previousActive = getActiveResume(candidateUserId);
        int nextVersion = resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(candidateUserId)
                .map(r -> r.getVersion() + 1)
                .orElse(1);

        String groupId;
        if (replacing && previousActive != null) {
            groupId = (previousActive.getResumeGroupId() != null && !previousActive.getResumeGroupId().isBlank())
                    ? previousActive.getResumeGroupId()
                    : previousActive.getId();
            if (previousActive.getResumeGroupId() == null) {
                previousActive.setResumeGroupId(groupId);
                resumeRepository.save(previousActive);
            }
        } else {
            groupId = UUID.randomUUID().toString();
        }

        // 1. Store the actual file first — no DB record exists if this fails.
        FileStorageService.UploadResult stored = fileStorageService.uploadResume(candidateUserId, file);

        // 2. Persist the version, then flip the previous active version off.
        CandidateResume resume = CandidateResume.builder()
                .candidateUserId(candidateUserId)
                .version(nextVersion)
                .storedPublicId(stored.publicId())
                .originalFilename(stored.originalFilename())
                .resumeTitle(stored.originalFilename())
                .mimeType(stored.mimeType())
                .fileSizeBytes(stored.fileSizeBytes())
                .uploadedAt(Instant.now())
                .active(true)
                .approvalStatus(ChangeRequestStatus.PENDING)
                .source("UPLOADED")
                .resumeGroupId(groupId)
                .build();
        CandidateResume saved;
        try {
            saved = resumeRepository.save(resume);
        } catch (RuntimeException e) {
            // The file exists but could not be registered: remove it so storage
            // does not accumulate orphans, then surface an honest failure.
            fileStorageService.deleteFile(stored.publicId());
            throw e;
        }
        if (previousActive != null) {
            previousActive.setActive(false);
            resumeRepository.save(previousActive);
        }

        // 3. Mirror the active version onto the profile (legacy compatibility).
        mirrorActiveToProfile(profile, saved);

        // 4. Start the existing admin approval workflow for this new version.
        //    The request records exactly which version was submitted and, when
        //    replacing, which previously active version it would supersede, so
        //    a resume review never has to guess at the change it is approving.
        ResumeApprovalRequest approvalRequest = ResumeApprovalRequest.builder()
                .candidateUserId(candidateUserId)
                .cloudinaryPublicId(saved.getStoredPublicId())
                .originalFilename(saved.getOriginalFilename())
                .mimeType(saved.getMimeType())
                .fileSizeBytes(saved.getFileSizeBytes())
                .resumeId(saved.getId())
                .resumeVersion(saved.getVersion())
                .changeType(previousActive == null
                        ? ResumeApprovalRequest.CHANGE_NEW : ResumeApprovalRequest.CHANGE_UPDATE)
                .previousResumeId(previousActive != null ? previousActive.getId() : null)
                .previousResumeVersion(previousActive != null ? previousActive.getVersion() : null)
                .previousFilename(previousActive != null ? previousActive.getOriginalFilename() : null)
                .status(ChangeRequestStatus.PENDING)
                .build();
        approvalRequestRepository.save(approvalRequest);

        auditService.log(candidateUserId, "CANDIDATE", "CandidateResume", saved.getId(),
                replacing ? "RESUME_REPLACED" : "RESUME_UPLOADED",
                Map.of("version", String.valueOf(saved.getVersion())));
        log.info("Resume version {} stored for candidate [userId={}]",
                saved.getVersion(), candidateUserId);

        Map<String, Object> res = new LinkedHashMap<>(toRow(candidateUserId, saved));
        res.put("message", replacing
                ? "Resume replaced. The previous version is kept in your history."
                : "Resume uploaded successfully.");
        return res;
    }

    /**
     * Creates an in-app generated / template resume for the candidate.
     *
     * The resume HTML rendered by the builder is converted into a genuine PDF
     * ({@link ResumePdfService}), which is validated and then stored through
     * the shared {@link FileStorageService} abstraction. A file is only stored
     * after a successful conversion and a database record only after a
     * successful storage, so a failure can never leave an HTML file that is
     * merely renamed to ".pdf" or a resume record pointing at it.
     */
    public Map<String, Object> createResume(String candidateUserId, String title,
                                             String templateName, String contentHtml) {
        CandidateProfile profile = getProfile(candidateUserId);
        ensureLegacyVersionMigrated(candidateUserId);

        int nextVersion = resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(candidateUserId)
                .map(r -> r.getVersion() + 1)
                .orElse(1);

        String effectiveTitle = (title != null && !title.isBlank())
                ? title.trim()
                : (templateName != null ? templateName.trim() + " Resume" : "Created Resume");

        // 1. Convert the rendered HTML into a genuine, validated PDF first.
        //    Empty/invalid content must fail here, before anything is stored.
        String fragment = (contentHtml != null && !contentHtml.isBlank())
                ? contentHtml : fallbackResumeFragment(effectiveTitle);
        byte[] pdfBytes = resumePdfService.generateResumePdf(fragment, templateName, null);

        String filename = effectiveTitle.replaceAll("[^a-zA-Z0-9.-]", "_") + ".pdf";

        // 2. Store the generated PDF.
        FileStorageService.UploadResult stored = fileStorageService.uploadResume(candidateUserId,
                new InMemoryMultipartFile("file", filename, "application/pdf", pdfBytes));

        String groupId = UUID.randomUUID().toString();

        CandidateResume resume = CandidateResume.builder()
                .candidateUserId(candidateUserId)
                .version(nextVersion)
                .storedPublicId(stored.publicId())
                .originalFilename(filename)
                .resumeTitle(effectiveTitle)
                .mimeType("application/pdf")
                .fileSizeBytes(stored.fileSizeBytes())
                .uploadedAt(Instant.now())
                .active(false)
                .approvalStatus(ChangeRequestStatus.APPROVED)
                .source("CREATED")
                .resumeGroupId(groupId)
                .build();

        CandidateResume saved;
        try {
            if (getActiveResume(candidateUserId) == null) {
                resume.setActive(true);
            }
            saved = resumeRepository.save(resume);
        } catch (RuntimeException e) {
            // The PDF exists but could not be registered: remove it so storage
            // does not accumulate orphans, then surface an honest failure.
            fileStorageService.deleteFile(stored.publicId());
            throw e;
        }

        if (saved.isActive()) {
            mirrorActiveToProfile(profile, saved);
        }

        auditService.log(candidateUserId, "CANDIDATE", "CandidateResume", saved.getId(),
                "RESUME_CREATED", Map.of("version", String.valueOf(saved.getVersion()), "title", effectiveTitle));

        Map<String, Object> res = new LinkedHashMap<>(toRow(candidateUserId, saved));
        res.put("message", "Resume created successfully.");
        return res;
    }

    /** Minimal valid resume markup for the rare case the client sends no content. */
    private String fallbackResumeFragment(String effectiveTitle) {
        String safe = effectiveTitle
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
        return "<div class=\"resume tpl-modern l-single f-sans\" style=\"--accent:#2563eb\">"
                + "<div class=\"r-section\"><h1 class=\"r-name\">" + safe + "</h1></div>"
                + "</div>";
    }

    /**
     * Loads saved resume builder data for the candidate, or pre-populates default fields
     * from their CandidateProfile and User account.
     *
     * When {@code resumeId} is supplied (edit intent), that owned record's saved
     * data is returned so the builder continues updating the same logical resume.
     * Without it (create intent), no existing draft id is leaked — saving always
     * starts a new logical resume; the form is pre-filled from the profile.
     */
    public Map<String, Object> getBuilderData(String candidateUserId, String resumeId) {
        if (resumeId != null && !resumeId.isBlank()) {
            CandidateResume editTarget = resumeRepository.findById(resumeId)
                    .filter(r -> candidateUserId.equals(r.getCandidateUserId()))
                    .orElse(null);
            if (editTarget != null && editTarget.getResumeData() != null
                    && !editTarget.getResumeData().isEmpty()) {
                Map<String, Object> res = new LinkedHashMap<>();
                res.put("hasSavedData", true);
                res.put("resumeId", editTarget.getId());
                res.put("template", editTarget.getTemplateId() != null ? editTarget.getTemplateId() : "modern");
                res.put("accent", editTarget.getAccentColor() != null ? editTarget.getAccentColor() : "");
                res.put("data", editTarget.getResumeData());
                res.put("lastUpdated", editTarget.getUpdatedAt() != null ? editTarget.getUpdatedAt() : editTarget.getCreatedAt());
                return res;
            }
            // Unknown id, another candidate's id, or a record without saved
            // data: fall through to profile pre-fill in create mode ("resumeId": null).
        }

        // Pre-fill from user and candidate profile
        User user = userRepository.findById(candidateUserId).orElse(null);
        CandidateProfile profile = profileRepository.findByUserId(candidateUserId).orElse(null);

        Map<String, Object> prefill = new LinkedHashMap<>();
        prefill.put("name", user != null && user.getName() != null ? user.getName() : "");
        prefill.put("title", profile != null && profile.getCurrentDesignation() != null ? profile.getCurrentDesignation() : "");
        prefill.put("email", user != null && user.getEmail() != null ? user.getEmail() : "");
        prefill.put("phone", profile != null && profile.getPhone() != null ? profile.getPhone() : "");
        prefill.put("location", profile != null && profile.getLocation() != null ? profile.getLocation() : "");
        prefill.put("website", "");
        prefill.put("summary", profile != null && profile.getBio() != null ? profile.getBio()
                : (profile != null && profile.getHeadline() != null ? profile.getHeadline() : ""));

        if (profile != null && profile.getSkills() != null && !profile.getSkills().isEmpty()) {
            prefill.put("skills", String.join(", ", profile.getSkills()));
        } else {
            prefill.put("skills", "");
        }
        prefill.put("languages", "");

        List<Map<String, Object>> exps = new ArrayList<>();
        if (profile != null && profile.getExperiences() != null && !profile.getExperiences().isEmpty()) {
            for (CandidateProfile.ExperienceEntry exp : profile.getExperiences()) {
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("role", exp.getDesignation() != null ? exp.getDesignation() : "");
                e.put("company", exp.getCompany() != null ? exp.getCompany() : "");
                e.put("start", exp.getStartMonth() != null ? exp.getStartMonth() : "");
                e.put("end", exp.isCurrent() ? "Present" : (exp.getEndMonth() != null ? exp.getEndMonth() : ""));
                e.put("details", exp.getDescription() != null ? exp.getDescription() : "");
                exps.add(e);
            }
        } else {
            Map<String, Object> defaultExp = new LinkedHashMap<>();
            defaultExp.put("role", "");
            defaultExp.put("company", "");
            defaultExp.put("start", "");
            defaultExp.put("end", "");
            defaultExp.put("details", "");
            exps.add(defaultExp);
        }
        prefill.put("experience", exps);

        List<Map<String, Object>> edus = new ArrayList<>();
        Map<String, Object> defaultEdu = new LinkedHashMap<>();
        defaultEdu.put("degree", "");
        defaultEdu.put("school", "");
        defaultEdu.put("year", "");
        defaultEdu.put("note", "");
        edus.add(defaultEdu);
        prefill.put("education", edus);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("hasSavedData", false);
        res.put("resumeId", null);
        res.put("template", "modern");
        res.put("accent", "");
        res.put("data", prefill);
        return res;
    }

    /**
     * Persists template builder data to CandidateResume and mirrors profile info
     * to CandidateProfile. Payloads WITH an explicit resumeId update that
     * logical resume in place; payloads WITHOUT one always create a new logical
     * resume (new version + new resume groupId), so the dashboard Total and
     * Created counts increment on every fresh creation.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> saveBuilderData(String candidateUserId, Map<String, Object> payload) {
        if (payload == null) {
            throw new BusinessException("Payload cannot be empty");
        }

        Map<String, Object> data = (Map<String, Object>) payload.get("data");
        if (data == null) {
            data = new LinkedHashMap<>();
        }

        String template = (String) payload.getOrDefault("template", "modern");
        String accent = (String) payload.getOrDefault("accent", "");
        String explicitResumeId = (String) payload.get("resumeId");
        String htmlContent = (String) payload.get("html");

        String name = (String) data.getOrDefault("name", "");
        String title = (String) data.getOrDefault("title", "");
        String effectiveTitle = (!name.isBlank() ? name : "Resume") + (!title.isBlank() ? " - " + title : "");

        CandidateResume targetResume = null;
        if (explicitResumeId != null && !explicitResumeId.isBlank()) {
            // Editing an existing resume from its history entry: the payload's
            // resumeId selects the exact version to update. A foreign id is
            // ignored (never adopted) so one candidate can never write into
            // another candidate's resume.
            targetResume = resumeRepository.findById(explicitResumeId)
                    .filter(r -> candidateUserId.equals(r.getCandidateUserId()))
                    .orElse(null);
        }
        // Without an explicit resumeId this is a "create" intent: always start
        // a NEW logical resume (fresh history row and count), never silently
        // bind to a previous created draft. The create branch below assigns a
        // fresh resumeGroupId and next version number.

        // Convert the builder's rendered HTML into a genuine, validated PDF and
        // store it through the shared file-storage abstraction. Generation or
        // storage failures must surface to the caller (the builder UI then
        // shows "Saved locally" instead of a success state) and must never
        // leave a HTML file with a .pdf name or a record pointing at one. When
        // an existing resume is re-saved and the new file cannot be stored, the
        // previous valid reference is kept untouched.
        String previousPublicId = targetResume != null ? targetResume.getStoredPublicId() : null;
        String storedPublicId = previousPublicId;
        String filename = effectiveTitle.replaceAll("[^a-zA-Z0-9.-]", "_") + ".pdf";
        long fileSizeBytes = 0;
        boolean newFileStored = false;

        if (htmlContent != null && !htmlContent.isBlank()) {
            String templateIdForPdf = (template == null || template.isBlank())
                    ? (targetResume != null && targetResume.getTemplateId() != null
                        ? targetResume.getTemplateId() : null)
                    : template;
            String accentForPdf = (accent == null || accent.isBlank())
                    ? (targetResume != null ? targetResume.getAccentColor() : null)
                    : accent;
            byte[] pdfBytes;
            try {
                pdfBytes = resumePdfService.generateResumePdf(htmlContent, templateIdForPdf, accentForPdf);
            } catch (BusinessException e) {
                throw e;
            } catch (RuntimeException e) {
                log.warn("Could not convert resume html to PDF: {}", e.getMessage());
                throw new BusinessException("PDF_GENERATION_FAILED",
                        "The resume could not be converted to PDF. Please try again.");
            }
            try {
                FileStorageService.UploadResult stored = fileStorageService.uploadResume(candidateUserId,
                        new InMemoryMultipartFile("file", filename, "application/pdf", pdfBytes));
                storedPublicId = stored.publicId();
                fileSizeBytes = stored.fileSizeBytes();
                newFileStored = true;
            } catch (RuntimeException e) {
                log.warn("Could not upload resume PDF to file storage: {}", e.getMessage());
                throw e;
            }
        }

        CandidateResume saved;
        try {
            if (targetResume != null) {
                targetResume.setResumeTitle(effectiveTitle);
                targetResume.setTemplateId(template);
                targetResume.setAccentColor(accent);
                targetResume.setResumeData(data);
                if (storedPublicId != null) {
                    targetResume.setStoredPublicId(storedPublicId);
                    targetResume.setOriginalFilename(filename);
                    targetResume.setMimeType("application/pdf");
                    if (fileSizeBytes > 0) targetResume.setFileSizeBytes(fileSizeBytes);
                }
                targetResume.setUpdatedAt(Instant.now());
                saved = resumeRepository.save(targetResume);
            } else {
                int nextVersion = resumeRepository.findFirstByCandidateUserIdOrderByVersionDesc(candidateUserId)
                        .map(r -> r.getVersion() + 1)
                        .orElse(1);

                boolean makeActive = getActiveResume(candidateUserId) == null;

                targetResume = CandidateResume.builder()
                        .candidateUserId(candidateUserId)
                        .version(nextVersion)
                        .storedPublicId(storedPublicId)
                        .originalFilename(storedPublicId != null ? filename : null)
                        .resumeTitle(effectiveTitle)
                        .mimeType(storedPublicId != null ? "application/pdf" : null)
                        .fileSizeBytes(fileSizeBytes)
                        .uploadedAt(Instant.now())
                        .active(makeActive)
                        .approvalStatus(ChangeRequestStatus.APPROVED)
                        .source("CREATED")
                        .resumeGroupId(UUID.randomUUID().toString())
                        .templateId(template)
                        .accentColor(accent)
                        .resumeData(data)
                        .build();
                saved = resumeRepository.save(targetResume);
            }
        } catch (RuntimeException e) {
            // The record was not updated, so the freshly stored PDF is an
            // orphan: remove it and leave the previous reference (and file)
            // exactly as it was.
            if (newFileStored) {
                try {
                    fileStorageService.deleteFile(storedPublicId);
                } catch (Exception cleanupError) {
                    log.warn("Could not remove unregistered resume PDF [id={}]: {}",
                            storedPublicId, cleanupError.getMessage());
                }
            }
            throw e;
        }

        // The database now references the new file, so the superseded one can be
        // removed. Best effort: a leftover orphan is harmless, a dangling
        // reference (deleting the old file before a failed save) is not.
        if (newFileStored && previousPublicId != null && !previousPublicId.equals(storedPublicId)) {
            try {
                fileStorageService.deleteFile(previousPublicId);
            } catch (Exception ex) {
                log.warn("Could not delete old resume file [id={}]: {}", previousPublicId, ex.getMessage());
            }
        }

        // Mirror relevant fields to CandidateProfile
        try {
            CandidateProfile profile = profileRepository.findByUserId(candidateUserId).orElse(null);
            if (profile != null) {
                boolean changed = false;
                String phone = (String) data.get("phone");
                if (phone != null && !phone.isBlank() && !phone.equals(profile.getPhone())) {
                    profile.setPhone(phone.trim());
                    changed = true;
                }
                String location = (String) data.get("location");
                if (location != null && !location.isBlank() && !location.equals(profile.getLocation())) {
                    profile.setLocation(location.trim());
                    changed = true;
                }
                String desig = (String) data.get("title");
                if (desig != null && !desig.isBlank() && !desig.equals(profile.getCurrentDesignation())) {
                    profile.setCurrentDesignation(desig.trim());
                    changed = true;
                }
                String summary = (String) data.get("summary");
                if (summary != null && !summary.isBlank() && !summary.equals(profile.getBio())) {
                    profile.setBio(summary.trim());
                    changed = true;
                }
                String skillsStr = (String) data.get("skills");
                if (skillsStr != null && !skillsStr.isBlank()) {
                    List<String> parsedSkills = new ArrayList<>();
                    for (String s : skillsStr.split(",")) {
                        String trimmed = s.trim();
                        if (!trimmed.isEmpty() && !parsedSkills.contains(trimmed)) {
                            parsedSkills.add(trimmed);
                        }
                    }
                    if (!parsedSkills.isEmpty()) {
                        profile.setSkills(parsedSkills);
                        changed = true;
                    }
                }
                if (saved.isActive()) {
                    mirrorActiveToProfile(profile, saved);
                } else if (changed) {
                    profileRepository.save(profile);
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to mirror builder data to CandidateProfile: {}", ex.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("resumeId", saved.getId());
        result.put("message", "Resume saved to database successfully");
        result.put("updatedAt", saved.getUpdatedAt() != null ? saved.getUpdatedAt() : saved.getCreatedAt());
        return result;
    }

    /**
     * Deletes a candidate's owned resume and updates active status if needed.
     */
    public Map<String, Object> deleteResume(String candidateUserId, String resumeId) {
        CandidateResume resume = requireOwnedResume(candidateUserId, resumeId);
        boolean wasActive = resume.isActive();

        if (resume.getStoredPublicId() != null) {
            try {
                fileStorageService.deleteFile(resume.getStoredPublicId());
            } catch (Exception e) {
                log.warn("Could not delete stored resume file [publicId={}]: {}",
                        resume.getStoredPublicId(), e.getMessage());
            }
        }
        resumeRepository.delete(resume);

        CandidateProfile profile = profileRepository.findByUserId(candidateUserId).orElse(null);
        if (wasActive) {
            Optional<CandidateResume> fallback = resumeRepository
                    .findByCandidateUserIdOrderByVersionDesc(candidateUserId).stream()
                    .filter(r -> r.getApprovalStatus() == ChangeRequestStatus.APPROVED)
                    .findFirst();
            if (fallback.isPresent()) {
                CandidateResume promoted = fallback.get();
                promoted.setActive(true);
                resumeRepository.save(promoted);
                if (profile != null) mirrorActiveToProfile(profile, promoted);
            } else {
                Optional<CandidateResume> anyRemaining = resumeRepository
                        .findByCandidateUserIdOrderByVersionDesc(candidateUserId).stream()
                        .findFirst();
                if (anyRemaining.isPresent()) {
                    CandidateResume promoted = anyRemaining.get();
                    promoted.setActive(true);
                    resumeRepository.save(promoted);
                    if (profile != null) mirrorActiveToProfile(profile, promoted);
                } else {
                    clearProfileResume(profile, null);
                }
            }
        }

        auditService.log(candidateUserId, "CANDIDATE", "CandidateResume", resumeId,
                "RESUME_DELETED", Map.of("version", String.valueOf(resume.getVersion())));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", "Resume deleted successfully.");
        res.put("stats", getResumeStats(candidateUserId));
        return res;
    }

    // ─────────────────────────────────────────────────
    // Set active
    // ─────────────────────────────────────────────────

    /**
     * Promotes one of the candidate's own versions to the active primary resume.
     * The candidate has exactly one active resume after this call, and the
     * profile mirror is updated so recruiter-facing flows follow the change.
     */
    public Map<String, Object> setActiveResume(String candidateUserId, String resumeId) {
        assertPaidPlan(candidateUserId);

        CandidateResume target = requireOwnedResume(candidateUserId, resumeId);
        if (target.getApprovalStatus() != ChangeRequestStatus.APPROVED) {
            throw new BusinessException("RESUME_NOT_APPROVED",
                    "This resume version has not been approved yet and cannot be set as primary.");
        }

        for (CandidateResume resume : resumeRepository.findByCandidateUserIdAndActiveTrue(candidateUserId)) {
            if (!resume.getId().equals(target.getId())) {
                resume.setActive(false);
                resumeRepository.save(resume);
            }
        }
        target.setActive(true);
        CandidateResume saved = resumeRepository.save(target);

        CandidateProfile profile = getProfile(candidateUserId);
        mirrorActiveToProfile(profile, saved);

        auditService.log(candidateUserId, "CANDIDATE", "CandidateResume", saved.getId(),
                "RESUME_ACTIVATED", Map.of("version", String.valueOf(saved.getVersion())));
        return toRow(candidateUserId, saved);
    }

    // ─────────────────────────────────────────────────
    // File access (preview / download)
    // ─────────────────────────────────────────────────

    /**
     * Loads the exact requested resume for its owner and returns the stored
     * bytes plus metadata. Ownership is enforced here, so a resume id belonging
     * to another candidate always yields 403 — never a fallback file.
     */
    public StoredResumeFile loadOwnedResumeFile(String candidateUserId, String resumeId) {
        CandidateResume resume = requireOwnedResume(candidateUserId, resumeId);
        if (resume.getStoredPublicId() == null || resume.getStoredPublicId().isBlank()) {
            throw new ResourceNotFoundException("The stored file for this resume version is missing.");
        }
        byte[] bytes = fileStorageService.fetchFile(resume.getStoredPublicId(), resume.getMimeType());
        if (bytes == null || bytes.length == 0) {
            throw new ResourceNotFoundException("The stored file for this resume version is missing.");
        }
        return new StoredResumeFile(bytes, resume.getOriginalFilename(), resume.getMimeType(),
                resume.getVersion());
    }

    /** Resolves a resume by id and verifies it belongs to the authenticated candidate. */
    public CandidateResume requireOwnedResume(String candidateUserId, String resumeId) {
        CandidateResume resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new ResourceNotFoundException("Resume", resumeId));
        if (!candidateUserId.equals(resume.getCandidateUserId())) {
            throw new AccessDeniedBusinessException("You do not own this resume.");
        }
        return resume;
    }

    // ─────────────────────────────────────────────────
    // Approval workflow hooks (called by the admin service)
    // ─────────────────────────────────────────────────

    /** Marks the version matching the approved storage id as APPROVED. */
    public void markApproved(String candidateUserId, String storedPublicId) {
        if (storedPublicId == null) return;
        for (CandidateResume resume : resumeRepository.findByCandidateUserIdAndStoredPublicId(
                candidateUserId, storedPublicId)) {
            resume.setApprovalStatus(ChangeRequestStatus.APPROVED);
            resumeRepository.save(resume);
        }
    }

    /**
     * Deletes the rejected version. When it was the active one, the newest
     * remaining APPROVED version (if any) becomes active again so the candidate
     * is not left without a usable primary resume; otherwise the profile mirror
     * is cleared exactly like the previous single-resume implementation.
     */
    public void removeRejectedVersion(String candidateUserId, String storedPublicId) {
        if (storedPublicId == null) return;
        for (CandidateResume resume : resumeRepository.findByCandidateUserIdAndStoredPublicId(
                candidateUserId, storedPublicId)) {
            boolean wasActive = resume.isActive();
            resumeRepository.delete(resume);
            if (!wasActive) continue;

            Optional<CandidateResume> fallback = resumeRepository
                    .findByCandidateUserIdOrderByVersionDesc(candidateUserId).stream()
                    .filter(r -> r.getApprovalStatus() == ChangeRequestStatus.APPROVED)
                    .findFirst();
            CandidateProfile profile = profileRepository.findByUserId(candidateUserId).orElse(null);
            if (fallback.isPresent()) {
                CandidateResume promoted = fallback.get();
                promoted.setActive(true);
                resumeRepository.save(promoted);
                if (profile != null) mirrorActiveToProfile(profile, promoted);
            } else {
                clearProfileResume(profile, ChangeRequestStatus.REJECTED);
            }
        }
    }

    // ─────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────

    /**
     * Existing candidates have a single resume stored on their profile (no
     * version records). The first time we touch the history we materialise that
     * resume as version 1 so the page shows the real stored file instead of an
     * empty history.
     */
    void ensureLegacyVersionMigrated(String candidateUserId) {
        if (!resumeRepository.findByCandidateUserIdOrderByVersionDesc(candidateUserId).isEmpty()) {
            return;
        }
        Object lock = legacyMigrationLocks.computeIfAbsent(candidateUserId, key -> new Object());
        synchronized (lock) {
            try {
                // Re-check inside the lock: another concurrent request may have
                // completed the migration after the outer check.
                if (!resumeRepository.findByCandidateUserIdOrderByVersionDesc(candidateUserId).isEmpty()) {
                    return;
                }
                migrateLegacyResume(candidateUserId);
            } finally {
                legacyMigrationLocks.remove(candidateUserId);
            }
        }
    }

    private void migrateLegacyResume(String candidateUserId) {
        CandidateProfile profile = profileRepository.findByUserId(candidateUserId).orElse(null);
        if (profile == null || profile.getResumeCloudinaryPublicId() == null
                || profile.getResumeCloudinaryPublicId().isBlank()) {
            return;
        }
        CandidateResume legacy = CandidateResume.builder()
                .candidateUserId(candidateUserId)
                .version(1)
                .storedPublicId(profile.getResumeCloudinaryPublicId())
                .originalFilename(profile.getResumeOriginalFilename())
                .resumeTitle(profile.getResumeOriginalFilename())
                .mimeType(profile.getResumeMimeType())
                .fileSizeBytes(profile.getResumeFileSizeBytes())
                .uploadedAt(profile.getResumeUploadedAt() != null
                        ? profile.getResumeUploadedAt() : Instant.now())
                .active(true)
                .approvalStatus(profile.getResumeApprovalStatus() != null
                        ? profile.getResumeApprovalStatus() : ChangeRequestStatus.PENDING)
                .source("UPLOADED")
                .resumeGroupId(UUID.randomUUID().toString())
                .build();
        resumeRepository.save(legacy);
        // Attach any evaluations that already scored this exact stored file so a
        // genuine historical score is not lost when the history is introduced.
        List<AtsEvaluation> prior = evaluationRepository.findByCandidateUserIdAndResumeRef(
                candidateUserId, "STORED:" + legacy.getStoredPublicId());
        for (AtsEvaluation evaluation : prior) {
            if (evaluation.getResumeId() == null) {
                evaluation.setResumeId(legacy.getId());
                evaluation.setResumeVersion(legacy.getVersion());
                if (evaluation.getResumeFilename() == null) {
                    evaluation.setResumeFilename(legacy.getOriginalFilename());
                }
                evaluationRepository.save(evaluation);
            }
        }
        log.info("Migrated legacy profile resume to version history [userId={}]", candidateUserId);
    }

    private void mirrorActiveToProfile(CandidateProfile profile, CandidateResume resume) {
        profile.setResumeCloudinaryPublicId(resume.getStoredPublicId());
        profile.setResumeOriginalFilename(resume.getOriginalFilename());
        profile.setResumeMimeType(resume.getMimeType());
        profile.setResumeFileSizeBytes(resume.getFileSizeBytes());
        profile.setResumeUploadedAt(resume.getUploadedAt());
        profile.setResumeApprovalStatus(resume.getApprovalStatus());
        profileRepository.save(profile);
    }

    /**
     * Mirrors {@code CandidateService.hasPaidActivePlan}: a paid plan only
     * counts after a server-verified activation. Resume Management is a paid
     * dashboard feature.
     */
    private void assertPaidPlan(String candidateUserId) {
        User user = userRepository.findById(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", candidateUserId));
        boolean paidActive = user.isPlanActivated()
                && (user.getPlan() == PlanType.BASIC || user.getPlan() == PlanType.PREMIUM);
        if (!paidActive) {
            throw new AccessDeniedBusinessException(
                    "This feature requires an active BASIC or PREMIUM subscription.");
        }
    }

    private CandidateProfile getProfile(String candidateUserId) {
        return profileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "CandidateProfile for user", candidateUserId));
    }

    private void clearProfileResume(CandidateProfile profile, ChangeRequestStatus status) {
        if (profile == null) return;
        profile.setResumeCloudinaryPublicId(null);
        profile.setResumeOriginalFilename(null);
        profile.setResumeMimeType(null);
        profile.setResumeFileSizeBytes(0);
        profile.setResumeUploadedAt(null);
        profile.setResumeApprovalStatus(status);
        profileRepository.save(profile);
    }

    /**
     * Builds the API row. Only the latest evaluation that actually scored this
     * resume version is attached, and its job is identified explicitly.
     */
    private Map<String, Object> toRow(String candidateUserId, CandidateResume resume) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", resume.getId());
        row.put("version", resume.getVersion());
        row.put("versionLabel", "v" + resume.getVersion());
        row.put("originalFilename", resume.getOriginalFilename());
        row.put("resumeTitle", resume.getResumeTitle() != null ? resume.getResumeTitle() : resume.getOriginalFilename());
        row.put("source", resume.getSource() != null ? resume.getSource() : "UPLOADED");
        row.put("resumeGroupId", resume.getResumeGroupId());
        row.put("mimeType", resume.getMimeType());
        row.put("fileSizeBytes", resume.getFileSizeBytes());
        row.put("uploadedAt", resume.getUploadedAt());
        row.put("createdAt", resume.getCreatedAt());
        row.put("updatedAt", resume.getUpdatedAt());
        row.put("active", resume.isActive());
        row.put("approvalStatus", resume.getApprovalStatus() != null
                ? resume.getApprovalStatus().name() : null);
        row.put("ats", latestAtsForResume(candidateUserId, resume.getId()));
        return row;
    }

    private Map<String, Object> latestAtsForResume(String candidateUserId, String resumeId) {
        var page = evaluationRepository.findByCandidateUserIdAndResumeIdAndKindOrderByCreatedAtDesc(
                candidateUserId, resumeId, AtsEvaluation.KIND_CANDIDATE_SELF,
                PageRequest.of(0, 1, Sort.by("createdAt").descending()));
        if (page.isEmpty()) return null;
        AtsEvaluation evaluation = page.getContent().get(0);
        Map<String, Object> ats = new LinkedHashMap<>();
        ats.put("evaluationId", evaluation.getId());
        ats.put("score", evaluation.getScore());
        ats.put("jobId", evaluation.getJobId());
        ats.put("jobTitle", evaluation.getJobTitle());
        ats.put("evaluatedAt", evaluation.getCreatedAt());
        return ats;
    }

    /** Removes every stored resume version for a deleted account. */
    public void deleteAllVersions(String candidateUserId) {
        for (CandidateResume resume : resumeRepository.findByCandidateUserIdOrderByVersionDesc(candidateUserId)) {
            if (resume.getStoredPublicId() != null) {
                fileStorageService.deleteFile(resume.getStoredPublicId());
            }
        }
        resumeRepository.deleteByCandidateUserId(candidateUserId);
    }

    /** Raw stored file plus the metadata needed to serve it safely. */
    public record StoredResumeFile(byte[] bytes, String filename, String mimeType, int version) {
    }

    /** Simple in-memory MultipartFile implementation for generated resumes. */
    public static class InMemoryMultipartFile implements MultipartFile {
        private final String name;
        private final String originalFilename;
        private final String contentType;
        private final byte[] content;

        public InMemoryMultipartFile(String name, String originalFilename, String contentType, byte[] content) {
            this.name = name;
            this.originalFilename = originalFilename;
            this.contentType = contentType;
            this.content = content != null ? content : new byte[0];
        }

        @Override public String getName() { return name; }
        @Override public String getOriginalFilename() { return originalFilename; }
        @Override public String getContentType() { return contentType; }
        @Override public boolean isEmpty() { return content.length == 0; }
        @Override public long getSize() { return content.length; }
        @Override public byte[] getBytes() { return content; }
        @Override public java.io.InputStream getInputStream() { return new java.io.ByteArrayInputStream(content); }
        @Override public void transferTo(java.io.File dest) throws java.io.IOException {
            java.nio.file.Files.write(dest.toPath(), content);
        }
    }
}
