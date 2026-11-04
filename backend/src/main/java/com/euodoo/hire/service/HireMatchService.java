package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.CandidateProfile;
import com.euodoo.hire.model.Company;
import com.euodoo.hire.model.HiringRequest;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.CompanyRepository;
import com.euodoo.hire.repository.HiringRequestRepository;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.repository.RecruiterProfileRepository;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the hire match details payload shown when a user opens a
 * "Hire Match" notification from their dashboard.
 *
 * Authorization is derived exclusively from the HiringRequest record and the
 * authenticated session user — never from any frontend-supplied identity.
 * Confidential information (candidate contact details, resume document,
 * recruiter email) is only included for the viewers the platform already
 * allows it to.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HireMatchService {

    private final HiringRequestRepository hiringRequestRepository;
    private final UserRepository userRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;
    private final FileStorageService fileStorageService;

    private static final String CONTACT_LOCKED = "Locked until candidate release";
    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a").withZone(ZoneId.of("Asia/Kolkata"));

    /**
     * Returns the full hire match details for the authenticated viewer.
     *
     * @throws ResourceNotFoundException    when the HiringRequest does not exist (-> 404)
     * @throws AccessDeniedBusinessException when the viewer is not the candidate,
     *                                      recruiter, or a client admin (-> 403)
     */
    public Map<String, Object> getHireMatchDetails(String hiringRequestId,
                                                   String requestingUserId,
                                                   boolean isClientAdmin) {
        HiringRequest hire = hiringRequestRepository.findById(hiringRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("HireMatch", hiringRequestId));

        boolean isCandidate = requestingUserId != null
                && requestingUserId.equals(hire.getCandidateUserId());
        boolean isRecruiter = requestingUserId != null
                && requestingUserId.equals(hire.getRecruiterUserId());

        if (!isCandidate && !isRecruiter && !isClientAdmin) {
            throw new AccessDeniedBusinessException(
                    "You are not authorized to view these hire match details.");
        }

        String viewerRole = isCandidate ? "CANDIDATE" : (isRecruiter ? "RECRUITER" : "CLIENT_ADMIN");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", hire.getId());
        result.put("viewerRole", viewerRole);
        result.put("approvalStatus", hire.getApprovalStatus() != null ? hire.getApprovalStatus().name() : "PENDING");
        result.put("approvedAt", hire.getApprovedAt());
        result.put("approvedAtDisplay", format(hire.getApprovedAt()));
        result.put("createdAt", hire.getCreatedAt());
        result.put("createdAtDisplay", format(hire.getCreatedAt()));
        result.put("candidateReleased", hire.isCandidateReleased());
        result.put("paymentStatus", hire.getPaymentStatus() != null ? hire.getPaymentStatus().name() : "PENDING");
        result.put("agreedAnnualSalaryInr", hire.getAgreedAnnualSalaryInr());
        result.put("calculatedHiringFeeInr", hire.getCalculatedHiringFeeInr());
        result.put("hiringFeePercentage", hire.getHiringFeePercentage());

        result.put("job", buildJobSection(hire));
        result.put("companyName", resolveCompanyName(hire));
        result.put("candidate", buildCandidateSection(hire, viewerRole));
        result.put("recruiter", buildRecruiterSection(hire, viewerRole));
        result.put("nextSteps", buildNextSteps(hire, viewerRole));
        return result;
    }

    // ─────────────────────────────────────────────────
    // Job details (only what the record actually stores)
    // ─────────────────────────────────────────────────
    private Map<String, Object> buildJobSection(HiringRequest hire) {
        if (hire.getJobId() == null) {
            return null;
        }
        Job job = jobRepository.findById(hire.getJobId()).orElse(null);
        if (job == null) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", job.getId());
        m.put("title", job.getTitle());
        m.put("description", job.getDescription());
        m.put("location", job.getLocation());
        m.put("workMode", job.getWorkMode() != null ? job.getWorkMode().name() : null);
        m.put("techStack", job.getTechStack());
        m.put("minExperienceYears", job.getMinExperienceYears());
        m.put("maxExperienceYears", job.getMaxExperienceYears());
        m.put("minSalaryInr", job.getMinSalaryInr());
        m.put("maxSalaryInr", job.getMaxSalaryInr());
        return m;
    }

    private String resolveCompanyName(HiringRequest hire) {
        String companyId = hire.getCompanyId();
        if ((companyId == null || companyId.isBlank())) {
            if (hire.getJobId() != null) {
                companyId = jobRepository.findById(hire.getJobId()).map(Job::getCompanyId).orElse(null);
            }
        }
        if (companyId == null || companyId.isBlank()) {
            return null;
        }
        return companyRepository.findById(companyId).map(Company::getName).orElse(null);
    }

    // ─────────────────────────────────────────────────
    // Candidate section — profile is public once approved;
    // confidential fields depend on the viewer.
    // ─────────────────────────────────────────────────
    private Map<String, Object> buildCandidateSection(HiringRequest hire, String viewerRole) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", hire.getCandidateUserId());

        User candidateUser = userRepository.findById(hire.getCandidateUserId()).orElse(null);

        // Recruiters only get the candidate's contact details after release
        // (same rule the recruiter dashboard enforces: "Locked until release").
        boolean contactUnlocked = hire.isCandidateReleased() || "CANDIDATE".equals(viewerRole);
        if (contactUnlocked) {
            m.put("name", candidateUser != null ? candidateUser.getName() : null);
            m.put("email", candidateUser != null ? candidateUser.getEmail() : null);
        } else {
            m.put("name", candidateUser != null ? candidateUser.getName() : null);
            m.put("email", CONTACT_LOCKED);
        }

        CandidateProfile profile = candidateProfileRepository.findByUserId(hire.getCandidateUserId()).orElse(null);
        if (profile != null) {
            m.put("headline", profile.getHeadline());
            m.put("location", profile.getLocation());
            m.put("skills", profile.getSkills() != null ? profile.getSkills() : new ArrayList<>());
            m.put("totalExperienceYears", profile.getTotalExperienceYears());
            m.put("currentDesignation", profile.getCurrentDesignation());
            m.put("currentCompany", profile.getCurrentCompany());
            m.put("experiences", profile.getExperiences());
            m.put("phone", contactUnlocked ? profile.getPhone() : CONTACT_LOCKED);
            m.put("profilePictureUrl", profile.getProfilePictureUrl());

            // Resume: exposed only where authorized.
            // - the candidate always sees their own resume
            // - recruiters only when the resume was verified/approved by the admin
            //   (that is exactly what the RESUME_APPROVED notification grants)
            // - client admins during their review workflow
            if ("CANDIDATE".equals(viewerRole)
                    || "CLIENT_ADMIN".equals(viewerRole)
                    || (profile.getResumeApprovalStatus() != null
                        && profile.getResumeApprovalStatus() == com.euodoo.hire.model.ChangeRequestStatus.APPROVED)) {
                m.put("resumeFileName", profile.getResumeOriginalFilename());
                m.put("resumeDownloadUrl", buildResumeUrl(profile));
            }
        }

        // Recruiter-provided candidate context kept out of candidate view
        if (!"CANDIDATE".equals(viewerRole) && candidateUser != null) {
            m.put("accountStatus", candidateUser.getAccountStatus() != null
                    ? candidateUser.getAccountStatus().name() : null);
        }
        return m;
    }

    private String buildResumeUrl(CandidateProfile profile) {
        if (profile.getResumeCloudinaryPublicId() == null) {
            return null;
        }
        try {
            return fileStorageService.getSecureUrl(
                    profile.getResumeCloudinaryPublicId(), profile.getResumeMimeType());
        } catch (Exception e) {
            log.warn("Could not generate resume URL for candidate {}: {}",
                    profile.getUserId(), e.getMessage());
            return null;
        }
    }

    // ─────────────────────────────────────────────────
    // Recruiter section — email only disclosed once the
    // candidate has been released (both sides unlocked).
    // ─────────────────────────────────────────────────
    private Map<String, Object> buildRecruiterSection(HiringRequest hire, String viewerRole) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", hire.getRecruiterUserId());
        User recruiterUser = userRepository.findById(hire.getRecruiterUserId()).orElse(null);
        m.put("name", recruiterUser != null ? recruiterUser.getName() : "Recruiter");
        if (hire.isCandidateReleased()) {
            m.put("email", recruiterUser != null ? recruiterUser.getEmail() : null);
        } else if (!"RECRUITER".equals(viewerRole)) {
            m.put("email", CONTACT_LOCKED);
        }
        recruiterProfileRepository.findByUserId(hire.getRecruiterUserId()).ifPresent(rp ->
                m.put("designation", rp.getDesignation()));
        return m;
    }

    // ─────────────────────────────────────────────────
    // Next steps derived from the current record state
    // ─────────────────────────────────────────────────
    private List<String> buildNextSteps(HiringRequest hire, String viewerRole) {
        List<String> steps = new ArrayList<>();
        if ("CANDIDATE".equals(viewerRole)) {
            if (hire.isCandidateReleased()) {
                steps.add("Your contact details are unlocked. The recruiter will reach out to you directly.");
            } else {
                steps.add("Your profile will be released to the recruiter after the hiring fee is verified.");
            }
            if (hire.getApprovalStatus() == com.euodoo.hire.model.ApprovalStatus.APPROVED) {
                steps.add("Watch your notifications — we will update you as soon as the recruiter contacts you.");
            }
        } else {
            if (hire.getApprovalStatus() == com.euodoo.hire.model.ApprovalStatus.APPROVED
                    && !hire.isCandidateReleased()) {
                if (hire.getPaymentStatus() == com.euodoo.hire.model.PaymentStatus.CAPTURED) {
                    steps.add("Payment verified — the client admin will release the candidate shortly.");
                } else {
                    steps.add("Complete the hiring fee payment to release the candidate's contact details.");
                }
            } else if (hire.isCandidateReleased()) {
                steps.add("Contact details unlocked — you can now reach the candidate directly.");
            }
        }
        return steps;
    }

    private String format(java.time.Instant instant) {
        if (instant == null) return null;
        return DATE_FMT.format(instant);
    }
}