package com.euodoo.hire.service;

import com.euodoo.hire.model.CandidateAssociationStatus;
import com.euodoo.hire.model.CandidateConsentStatus;
import com.euodoo.hire.exception.AgencyExceptions.CandidateNotFoundException;
import com.euodoo.hire.model.CandidateAgencyAssociation;
import com.euodoo.hire.repository.CandidateAgencyAssociationRepository;
import com.euodoo.hire.repository.CandidateSubmissionRepository;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.CandidateResumeRepository;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import com.euodoo.hire.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyCandidateService {

    private final CandidateAgencyAssociationRepository associationRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final CandidateResumeRepository candidateResumeRepository;
    private final CandidateSubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final AuditService auditService;

    public CandidateAgencyAssociation associateCandidate(String agencyId, String candidateId, String userId) {
        // Candidate can be specified by User ID or Profile ID
        String candidateUserId = resolveCandidateUserId(candidateId);

        Optional<CandidateAgencyAssociation> existing = associationRepository.findByAgencyIdAndCandidateId(agencyId, candidateUserId);
        if (existing.isPresent()) {
            CandidateAgencyAssociation assoc = existing.get();
            assoc.setStatus(CandidateAssociationStatus.ACTIVE);
            return associationRepository.save(assoc);
        }

        CandidateAgencyAssociation assoc = CandidateAgencyAssociation.builder()
                .agencyId(agencyId)
                .candidateId(candidateUserId)
                .addedByUserId(userId)
                .consentStatus(CandidateConsentStatus.GRANTED)
                .status(CandidateAssociationStatus.ACTIVE)
                .build();

        CandidateAgencyAssociation saved = associationRepository.save(assoc);

        auditService.log(userId, "AGENCY_USER", "CandidateAgencyAssociation", saved.getId(),
                "CANDIDATE_ASSOCIATED_WITH_AGENCY", Map.of("candidateId", candidateUserId, "agencyId", agencyId));

        return saved;
    }

    public Page<Map<String, Object>> getCandidates(String agencyId, int page, int size, String skill, Integer minExp, String location) {
        PageRequest pageRequest = PageRequest.of(page, size);

        // Fetch candidates associated with this agency
        List<CandidateAgencyAssociation> associations = associationRepository.findByAgencyId(agencyId);
        List<String> candidateUserIds = associations.stream()
                .filter(a -> a.getStatus() == CandidateAssociationStatus.ACTIVE)
                .map(CandidateAgencyAssociation::getCandidateId)
                .collect(Collectors.toList());

        List<CandidateProfile> profiles = candidateProfileRepository.findAll().stream()
                .filter(p -> candidateUserIds.contains(p.getUserId()) || candidateUserIds.isEmpty())
                .filter(p -> skill == null || skill.isBlank() ||
                        p.getSkills().stream().anyMatch(s -> s.equalsIgnoreCase(skill.trim())))
                .filter(p -> minExp == null || p.getTotalExperienceYears() >= minExp)
                .filter(p -> location == null || location.isBlank() ||
                        (p.getLocation() != null && p.getLocation().toLowerCase().contains(location.toLowerCase())))
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), profiles.size());
        int end = Math.min((start + pageRequest.getPageSize()), profiles.size());

        List<Map<String, Object>> result = profiles.subList(start, end).stream()
                .map(p -> buildCandidateMap(p, agencyId))
                .collect(Collectors.toList());

        return new PageImpl<>(result, pageRequest, profiles.size());
    }

    public Map<String, Object> getCandidateDetails(String agencyId, String candidateId) {
        String candidateUserId = resolveCandidateUserId(candidateId);
        CandidateProfile profile = candidateProfileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new CandidateNotFoundException(candidateId));

        Map<String, Object> data = buildCandidateMap(profile, agencyId);

        // Include resume history
        List<CandidateResume> resumes = candidateResumeRepository.findByCandidateUserIdOrderByVersionDesc(candidateUserId);
        List<Map<String, Object>> resumeList = resumes.stream().map(r -> {
            Map<String, Object> rm = new HashMap<>();
            rm.put("id", r.getId());
            rm.put("originalFilename", r.getOriginalFilename());
            rm.put("version", r.getVersion());
            rm.put("active", r.isActive());
            rm.put("uploadedAt", r.getUploadedAt());
            return rm;
        }).collect(Collectors.toList());
        data.put("resumes", resumeList);

        // Include submission history for this agency
        data.put("submissions", submissionRepository.findByAgencyId(agencyId).stream()
                .filter(s -> candidateUserId.equals(s.getCandidateId()))
                .collect(Collectors.toList()));

        return data;
    }

    public CandidateResume uploadResumeForCandidate(String agencyId, String candidateId, MultipartFile file, String userId) {
        String candidateUserId = resolveCandidateUserId(candidateId);

        fileStorageService.validateResume(file);
        FileStorageService.UploadResult uploadResult = fileStorageService.uploadResume(candidateUserId, file);

        // Versioning: bump version number
        List<CandidateResume> existing = candidateResumeRepository.findByCandidateUserIdOrderByVersionDesc(candidateUserId);
        int maxVer = existing.stream().mapToInt(CandidateResume::getVersion).max().orElse(0);

        // Deactivate older resumes
        existing.forEach(r -> {
            if (r.isActive()) {
                r.setActive(false);
                candidateResumeRepository.save(r);
            }
        });

        CandidateResume resume = CandidateResume.builder()
                .candidateUserId(candidateUserId)
                .version(maxVer + 1)
                .storedPublicId(uploadResult.publicId())
                .originalFilename(uploadResult.originalFilename())
                .mimeType(uploadResult.mimeType())
                .fileSizeBytes(uploadResult.fileSizeBytes())
                .uploadedAt(Instant.now())
                .active(true)
                .approvalStatus(ChangeRequestStatus.APPROVED)
                .source("AGENCY_UPLOADED")
                .build();

        CandidateResume saved = candidateResumeRepository.save(resume);

        // Update profile
        candidateProfileRepository.findByUserId(candidateUserId).ifPresent(p -> {
            p.setResumeOriginalFilename(uploadResult.originalFilename());
            p.setResumeMimeType(uploadResult.mimeType());
            p.setResumeFileSizeBytes(uploadResult.fileSizeBytes());
            p.setResumeUploadedAt(Instant.now());
            p.setResumeApprovalStatus(ChangeRequestStatus.APPROVED);
            candidateProfileRepository.save(p);
        });

        auditService.log(userId, "AGENCY_USER", "CandidateResume", saved.getId(),
                "AGENCY_UPLOADED_CANDIDATE_RESUME", Map.of("candidateId", candidateUserId, "filename", uploadResult.originalFilename()));

        return saved;
    }

    private String resolveCandidateUserId(String candidateId) {
        if (candidateProfileRepository.findByUserId(candidateId).isPresent() || userRepository.findById(candidateId).isPresent()) {
            return candidateId;
        }
        Optional<CandidateProfile> profileOpt = candidateProfileRepository.findById(candidateId);
        if (profileOpt.isPresent()) {
            return profileOpt.get().getUserId();
        }
        return candidateId;
    }

    private Map<String, Object> buildCandidateMap(CandidateProfile profile, String agencyId) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("candidateId", profile.getUserId());
        map.put("profileId", profile.getId());
        userRepository.findById(profile.getUserId()).ifPresent(u -> {
            map.put("name", u.getName());
            map.put("email", u.getEmail());
        });
        map.put("phone", profile.getPhone());
        map.put("location", profile.getLocation());
        map.put("headline", profile.getHeadline());
        map.put("skills", profile.getSkills());
        map.put("totalExperienceYears", profile.getTotalExperienceYears());
        map.put("expectedAnnualSalaryInr", profile.getExpectedAnnualSalaryInr());
        map.put("noticePeriodDays", profile.getNoticePeriodDays());
        map.put("currentDesignation", profile.getCurrentDesignation());
        map.put("currentCompany", profile.getCurrentCompany());
        map.put("approvalStatus", profile.getProfileApprovalStatus());

        Optional<CandidateResume> activeResume = candidateResumeRepository.findByCandidateUserIdAndActiveTrue(profile.getUserId()).stream().findFirst();
        map.put("hasResume", activeResume.isPresent());
        map.put("resumeFilename", activeResume.map(CandidateResume::getOriginalFilename).orElse(null));

        Optional<CandidateAgencyAssociation> assoc = associationRepository.findByAgencyIdAndCandidateId(agencyId, profile.getUserId());
        map.put("associated", assoc.isPresent());
        map.put("consentStatus", assoc.map(a -> a.getConsentStatus().name()).orElse("NONE"));

        return map;
    }
}
