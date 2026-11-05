package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.CompanyRepository;
import com.euodoo.hire.repository.RecruiterProfileRepository;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;


@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CompanyRepository companyRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Registers a new candidate account with FREE plan and PENDING_APPROVAL status.
     *
     * @param name     Candidate's full name
     * @param email    Email address (normalized internally)
     * @param password Plaintext password (hashed before storage)
     */
    public User registerCandidate(String name, String email, String password) {
        return registerCandidate(name, email, password, null, null, null, null, null);
    }

    /**
     * Registers a new candidate account with profile details.
     */
    public User registerCandidate(String name, String email, String password,
                                  String phone, String location, String headline,
                                  Integer totalExperienceYears, java.util.List<String> skills) {
        String normalizedEmail = normalizeEmail(email);
        assertEmailNotTaken(normalizedEmail);

        User user = User.builder()
                .name(name.trim())
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password))
                .role(Role.CANDIDATE)
                .accountStatus(AccountStatus.PENDING_APPROVAL)
                .plan(PlanType.FREE)
                .planActivated(false)
                .build();

        User saved = userRepository.save(user);
        log.info("Candidate registered: {} [id={}]", normalizedEmail, saved.getId());

        CandidateProfile.CandidateProfileBuilder profileBuilder = CandidateProfile.builder()
                .userId(saved.getId())
                .profileApprovalStatus(ApprovalStatus.PENDING)
                .visibleToRecruiters(false);

        if (phone != null && !phone.isBlank()) profileBuilder.phone(phone.trim());
        if (location != null && !location.isBlank()) profileBuilder.location(location.trim());
        if (headline != null && !headline.isBlank()) profileBuilder.headline(headline.trim());
        if (totalExperienceYears != null) profileBuilder.totalExperienceYears(totalExperienceYears);
        if (skills != null && !skills.isEmpty()) profileBuilder.skills(skills);

        candidateProfileRepository.save(profileBuilder.build());

        return saved;
    }

    /**
     * Registers a new recruiter account with PENDING_APPROVAL status.
     * The account is inactive until a CLIENT_ADMIN approves the company and recruiter.
     *
     * @param name        Recruiter's full name
     * @param email       Email address
     * @param password    Plaintext password
     * @param designation Job title / designation
     * @param phone       Contact phone
     */
    public User registerRecruiter(String name, String email, String password,
                                   String designation, String phone) {
        String normalizedEmail = normalizeEmail(email);
        assertEmailNotTaken(normalizedEmail);

        User user = User.builder()
                .name(name.trim())
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password))
                .role(Role.RECRUITER)
                .accountStatus(AccountStatus.PENDING_APPROVAL)
                .build();

        User saved = userRepository.save(user);
        log.info("Recruiter registered: {} [id={}]", normalizedEmail, saved.getId());

        // Create recruiter profile (no company assigned yet — linked during approval)
        RecruiterProfile profile = RecruiterProfile.builder()
                .userId(saved.getId())
                .designation(designation)
                .phone(phone)
                .approvalStatus(ApprovalStatus.PENDING)
                .build();
        recruiterProfileRepository.save(profile);

        return saved;
    }

    /**
     * Links an existing company or creates a new pending company record for a registered recruiter.
     */
    public void linkRecruiterCompany(String recruiterUserId, String companyName, String website,
                                     String industry, String companySize, String cin) {
        if (companyName == null || companyName.isBlank()) return;

        Company company = companyRepository.findAll().stream()
                .filter(c -> companyName.trim().equalsIgnoreCase(c.getName()))
                .findFirst()
                .orElseGet(() -> {
                    Company c = Company.builder()
                            .name(companyName.trim())
                            .website(website)
                            .industry(industry)
                            .contactEmail(website)
                            .approvalStatus(ApprovalStatus.PENDING)
                            .authorizedRecruiterIds(new ArrayList<>(List.of(recruiterUserId)))
                            .createdAt(Instant.now())
                            .updatedAt(Instant.now())
                            .build();
                    return companyRepository.save(c);
                });

        if (company.getAuthorizedRecruiterIds() == null) {
            company.setAuthorizedRecruiterIds(new ArrayList<>());
        }
        if (!company.getAuthorizedRecruiterIds().contains(recruiterUserId)) {
            company.getAuthorizedRecruiterIds().add(recruiterUserId);
            companyRepository.save(company);
        }

        recruiterProfileRepository.findByUserId(recruiterUserId).ifPresent(p -> {
            p.setCompanyId(company.getId());
            recruiterProfileRepository.save(p);
        });
    }

    /**
     * Password reset request logging / dispatcher.
     */
    public void requestPasswordReset(String email) {
        userRepository.findByEmail(normalizeEmail(email)).ifPresent(user -> {
            log.info("Password reset requested for user [id={}, email={}]", user.getId(), user.getEmail());
        });
    }

    // --- Internal helpers ---

    private String normalizeEmail(String email) {
        if (email == null) {
            throw new BusinessException("INVALID_EMAIL", "Email must not be null.");
        }
        return email.trim().toLowerCase();
    }

    private void assertEmailNotTaken(String normalizedEmail) {
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BusinessException("DUPLICATE_EMAIL",
                    "An account with this email address already exists.");
        }
    }
}
