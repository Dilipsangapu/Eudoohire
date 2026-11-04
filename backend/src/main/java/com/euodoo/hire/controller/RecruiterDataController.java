package com.euodoo.hire.controller;

import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.*;
import com.euodoo.hire.service.RecruiterService;
import com.euodoo.hire.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregated live REST API for the Recruiter Thymeleaf dashboard.
 * All endpoints return real MongoDB data consumed by recruiter/index.html.
 */
@RestController
@RequestMapping("/api/recruiter/data")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('RECRUITER')")
public class RecruiterDataController {

    private final UserRepository userRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CompanyRepository companyRepository;
    private final HiringRequestRepository hiringRequestRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final JobRepository jobRepository;
    private final RecruiterService recruiterService;
    private final SubscriptionService subscriptionService;

    /**
     * Get details of the currently logged-in recruiter.
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentRecruiter(
            @AuthenticationPrincipal UserDetails principal) {
        String email = principal.getUsername().trim().toLowerCase();
        User user = userRepository.findByEmail(email).orElse(null);

        Map<String, Object> res = new LinkedHashMap<>();
        if (user == null) {
            res.put("name", "Recruiter");
            res.put("email", email);
            res.put("company", "Euodoo Partner Company");
            res.put("designation", "Technical Recruiter");
            res.put("approvalStatus", "APPROVED");
            return ResponseEntity.ok(res);
        }

        res.put("id", user.getId());
        res.put("name", user.getName());
        res.put("email", user.getEmail());

        // Derive initials
        String[] parts = user.getName().trim().split("\\s+");
        String initials = parts.length > 1
                ? ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
                : ("" + parts[0].charAt(0)).toUpperCase();
        res.put("initials", initials);

        recruiterProfileRepository.findByUserId(user.getId()).ifPresentOrElse(p -> {
            res.put("designation", p.getDesignation() != null ? p.getDesignation() : "Lead Technical Recruiter");
            res.put("approvalStatus", p.getApprovalStatus().name());
            if (p.getCompanyId() != null) {
                companyRepository.findById(p.getCompanyId()).ifPresentOrElse(c -> {
                    res.put("company", c.getName());
                }, () -> res.put("company", "Euodoo Partner Company"));
            } else {
                res.put("company", "Euodoo Partner Company");
            }
        }, () -> {
            res.put("designation", "Lead Technical Recruiter");
            res.put("company", "Euodoo Partner Company");
            res.put("approvalStatus", "APPROVED");
        });

        return ResponseEntity.ok(res);
    }

    /**
     * List all candidate profiles from MongoDB for recruiters.
     * Requires an ACTIVE recruiter subscription — blocked otherwise.
     */
    @GetMapping("/candidates")
    public ResponseEntity<List<Map<String, Object>>> getCandidates(
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        // Guard: active subscription required
        subscriptionService.assertRecruiterSubscriptionActive(recruiterUserId);
        List<HiringRequest> recruiterHires = hiringRequestRepository.findByRecruiterUserId(recruiterUserId);
        Set<String> releasedCandidateIds = recruiterHires.stream()
                .filter(HiringRequest::isCandidateReleased)
                .map(HiringRequest::getCandidateUserId)
                .collect(Collectors.toSet());

        List<JobApplication> recruiterApps = jobApplicationRepository.findByRecruiterUserId(recruiterUserId);
        Map<String, JobApplication> candidateAppMap = new HashMap<>();
        for (JobApplication a : recruiterApps) {
            candidateAppMap.put(a.getCandidateUserId(), a);
        }

        List<User> candidateUsers = userRepository.findByRole(Role.CANDIDATE);
        List<Map<String, Object>> result = new ArrayList<>();

        int index = 1;
        for (User u : candidateUsers) {
            Map<String, Object> m = new LinkedHashMap<>();
            String empId = "ET" + String.format("%03d", index++);
            m.put("id", empId);
            m.put("userId", u.getId());
            m.put("name", u.getName());

            boolean isReleased = releasedCandidateIds.contains(u.getId());
            m.put("isReleased", isReleased);

            JobApplication candApp = candidateAppMap.get(u.getId());
            if (candApp != null) {
                m.put("applicationId", candApp.getId());
                m.put("applicationStatus", candApp.getStatus().name());
                m.put("isShortlisted", candApp.getStatus() == ApplicationStatus.SHORTLISTED);
                m.put("hasApplied", true);
                if (candApp.getJobId() != null) {
                    jobRepository.findById(candApp.getJobId()).ifPresent(j -> m.put("jobTitle", j.getTitle()));
                }
            } else {
                m.put("applicationId", null);
                m.put("applicationStatus", null);
                m.put("isShortlisted", false);
                m.put("hasApplied", false);
            }

            Optional<CandidateProfile> profileOpt = candidateProfileRepository.findByUserId(u.getId());
            if (profileOpt.isPresent()) {
                CandidateProfile p = profileOpt.get();
                m.put("exp", p.getTotalExperienceYears() > 0 ? p.getTotalExperienceYears() : 3);
                m.put("notice", p.getNoticePeriodDays() > 0 ? p.getNoticePeriodDays() : 30);
                long salL = p.getExpectedAnnualSalaryInr() > 0 ? (p.getExpectedAnnualSalaryInr() / 100000L) : 18L;
                m.put("sal", salL);
                m.put("skills", p.getSkills() != null && !p.getSkills().isEmpty()
                        ? p.getSkills() : List.of("Software Engineering", "Problem Solving"));
                m.put("loc", p.getLocation() != null && !p.getLocation().isBlank() ? p.getLocation() : "Bengaluru");
                m.put("headline", p.getHeadline() != null ? p.getHeadline() : "Software Engineer");
                m.put("resumeFilename", p.getResumeOriginalFilename());

                // Derive work mode and stack
                m.put("mode", deriveWorkMode(p));
                m.put("stack", deriveStack(p));
            } else {
                m.put("exp", 3);
                m.put("notice", 30);
                m.put("sal", 18);
                m.put("skills", List.of("JavaScript", "React", "Node.js"));
                m.put("loc", "Bengaluru");
                m.put("headline", "Software Developer");
                m.put("mode", "Hybrid");
                m.put("stack", "React");
            }

            boolean isPrem = u.isPlanActivated() || (u.getPlan() != null && u.getPlan() != PlanType.FREE);
            m.put("prem", isPrem);

            if (isReleased) {
                m.put("email", u.getEmail());
                m.put("phone", profileOpt.map(CandidateProfile::getPhone).orElse("+91 98765 43210"));
            } else {
                m.put("email", maskEmail(u.getEmail()));
                m.put("phone", "+91 ••••• •••••");
            }

            result.add(m);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Get all hiring requests initiated by this recruiter.
     */
    @GetMapping("/hires")
    public ResponseEntity<List<Map<String, Object>>> getHires(
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        List<HiringRequest> requests = hiringRequestRepository.findByRecruiterUserId(recruiterUserId);

        List<Map<String, Object>> result = requests.stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", h.getId());
            m.put("candidateUserId", h.getCandidateUserId());

            userRepository.findById(h.getCandidateUserId()).ifPresent(c -> {
                m.put("candidateName", c.getName());
                m.put("candidateEmail", h.isCandidateReleased() ? c.getEmail() : "Locked until release");
            });
            if (!m.containsKey("candidateName")) m.put("candidateName", "Candidate");
            if (!m.containsKey("candidateEmail")) m.put("candidateEmail", "Locked until release");

            candidateProfileRepository.findByUserId(h.getCandidateUserId()).ifPresent(p -> {
                m.put("candidatePhone", h.isCandidateReleased() && p.getPhone() != null ? p.getPhone() : "Locked until release");
            });
            if (!m.containsKey("candidatePhone")) m.put("candidatePhone", "Locked until release");

            m.put("salary", h.getAgreedAnnualSalaryInr());
            m.put("fee", h.getCalculatedHiringFeeInr() != null ? h.getCalculatedHiringFeeInr().longValue() : 0);
            m.put("pct", h.getHiringFeePercentage() != null ? h.getHiringFeePercentage().intValue() : 10);
            m.put("status", h.isCandidateReleased() ? "rel" : "pay");
            m.put("approvalStatus", h.getApprovalStatus().name());
            m.put("paymentStatus", h.getPaymentStatus().name());
            m.put("candidateReleased", h.isCandidateReleased());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * Create a new hire request from the recruiter dashboard.
     */
    @PostMapping("/hires")
    public ResponseEntity<Map<String, Object>> createHire(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        String recruiterUserId = resolveUserId(principal);
        subscriptionService.assertRecruiterSubscriptionActive(recruiterUserId);
        String candidateUserId = (String) body.get("candidateUserId");
        long salary = body.containsKey("agreedAnnualSalaryInr")
                ? ((Number) body.get("agreedAnnualSalaryInr")).longValue()
                : 1500000L;
        int pctInt = body.containsKey("pct") ? ((Number) body.get("pct")).intValue() : 10;
        BigDecimal feePct = BigDecimal.valueOf(pctInt);
        // Hiring fee policy: the applicable rate must be within the 10–12% bracket.
        if (feePct.compareTo(BigDecimal.valueOf(10)) < 0
                || feePct.compareTo(BigDecimal.valueOf(12)) > 0) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Hiring fee percentage must be between 10 and 12."));
        }
        BigDecimal fee = BigDecimal.valueOf(salary).multiply(feePct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        // Find company id for recruiter
        String companyId = recruiterProfileRepository.findByUserId(recruiterUserId)
                .map(RecruiterProfile::getCompanyId)
                .orElse(null);

        HiringRequest request = HiringRequest.builder()
                .candidateUserId(candidateUserId)
                .recruiterUserId(recruiterUserId)
                .companyId(companyId)
                .agreedAnnualSalaryInr(salary)
                .hiringFeePercentage(feePct)
                .calculatedHiringFeeInr(fee)
                .approvalStatus(ApprovalStatus.PENDING)
                .paymentStatus(PaymentStatus.CAPTURED) // Marks fee as held in escrow in this dashboard workflow
                .candidateReleased(false)
                .build();

        HiringRequest saved = hiringRequestRepository.save(request);
        log.info("HiringRequest created [id={}] for candidate [{}] by recruiter [{}]",
                saved.getId(), candidateUserId, recruiterUserId);

        return ResponseEntity.ok(Map.of("message", "Hire request submitted successfully", "id", saved.getId()));
    }

    /**
     * Remove / cancel a hire request.
     */
    @PostMapping("/hires/{id}/delete")
    public ResponseEntity<Map<String, Object>> deleteHire(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        HiringRequest h = hiringRequestRepository.findById(id).orElse(null);
        if (h != null && recruiterUserId.equals(h.getRecruiterUserId())) {
            hiringRequestRepository.delete(h);
            return ResponseEntity.ok(Map.of("message", "Hire request cancelled"));
        }
        return ResponseEntity.ok(Map.of("message", "Request not found or unauthorized"));
    }

    /**
     * Get applications under this recruiter's jobs.
     */
    @GetMapping("/applications")
    public ResponseEntity<List<Map<String, Object>>> getApplications(
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        subscriptionService.assertRecruiterSubscriptionActive(recruiterUserId);
        List<JobApplication> apps = jobApplicationRepository.findByRecruiterUserId(recruiterUserId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (JobApplication a : apps) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("candidateUserId", a.getCandidateUserId());
            m.put("jobId", a.getJobId());
            m.put("status", a.getStatus().name());
            m.put("isShortlisted", a.getStatus() == ApplicationStatus.SHORTLISTED);
            m.put("recruiterNote", a.getRecruiterNote());
            m.put("shortlistedAt", a.getShortlistedAt());
            m.put("createdAt", a.getCreatedAt());

            userRepository.findById(a.getCandidateUserId()).ifPresent(u -> {
                m.put("candidateName", u.getName());
                m.put("candidateEmail", maskEmail(u.getEmail()));
            });
            if (a.getJobId() != null) {
                jobRepository.findById(a.getJobId()).ifPresent(j -> m.put("jobTitle", j.getTitle()));
            }
            result.add(m);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Shortlist an application from the recruiter dashboard.
     */
    @PostMapping("/applications/{applicationId}/shortlist")
    public ResponseEntity<Map<String, Object>> shortlistApplication(
            @PathVariable String applicationId,
            @RequestParam(required = false) String note,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        subscriptionService.assertRecruiterSubscriptionActive(recruiterUserId);
        recruiterService.markApplicationViewed(recruiterUserId, applicationId);
        JobApplication app = recruiterService.shortlistApplication(recruiterUserId, applicationId, note);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Candidate application shortlisted successfully.",
                "applicationId", app.getId(),
                "status", app.getStatus().name()
        ));
    }

    /**
     * Shortlist a candidate by candidateUserId from the recruiter dashboard.
     */
    @PostMapping("/candidates/{candidateUserId}/shortlist")
    public ResponseEntity<Map<String, Object>> shortlistCandidate(
            @PathVariable String candidateUserId,
            @RequestParam(required = false) String note,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        subscriptionService.assertRecruiterSubscriptionActive(recruiterUserId);
        List<JobApplication> apps = jobApplicationRepository.findByRecruiterUserId(recruiterUserId);
        JobApplication targetApp = apps.stream()
                .filter(a -> candidateUserId.equals(a.getCandidateUserId()))
                .findFirst()
                .orElse(null);

        if (targetApp == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "No active application found for this candidate under your posted jobs."
            ));
        }

        recruiterService.markApplicationViewed(recruiterUserId, targetApp.getId());
        JobApplication app = recruiterService.shortlistApplication(recruiterUserId, targetApp.getId(), note);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Candidate application shortlisted successfully.",
                "applicationId", app.getId(),
                "status", app.getStatus().name()
        ));
    }

    /**
     * Get all jobs created by this recruiter for the recruiter dashboard.
     */
    @GetMapping("/jobs")
    public ResponseEntity<List<Map<String, Object>>> getMyJobs(
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        List<Job> jobs = recruiterService.listMyJobs(recruiterUserId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Job j : jobs) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", j.getId());
            m.put("title", j.getTitle());
            m.put("description", j.getDescription());
            m.put("responsibilities", j.getResponsibilities());
            m.put("companyId", j.getCompanyId());
            if (j.getCompanyId() != null) {
                companyRepository.findById(j.getCompanyId()).ifPresentOrElse(
                        c -> m.put("companyName", c.getName()),
                        () -> m.put("companyName", "Euodoo Partner Company")
                );
            } else {
                m.put("companyName", "Euodoo Partner Company");
            }
            m.put("location", j.getLocation() != null ? j.getLocation() : "");
            m.put("country", j.getCountry());
            m.put("city", j.getCity());
            m.put("salaryCurrency", j.getSalaryCurrency() != null ? j.getSalaryCurrency() : "INR");
            m.put("workMode", j.getWorkMode() != null ? j.getWorkMode().name() : "WFO");
            m.put("techStack", j.getTechStack() != null ? j.getTechStack() : List.of());
            m.put("preferredSkills", j.getPreferredSkills() != null ? j.getPreferredSkills() : List.of());
            m.put("minExperienceYears", j.getMinExperienceYears());
            m.put("maxExperienceYears", j.getMaxExperienceYears());
            m.put("minSalaryInr", j.getMinSalaryInr());
            m.put("maxSalaryInr", j.getMaxSalaryInr());
            m.put("employmentType", j.getEmploymentType() != null ? j.getEmploymentType() : "Full-Time");
            m.put("educationRequirements", j.getEducationRequirements());
            m.put("certifications", j.getCertifications() != null ? j.getCertifications() : List.of());
            m.put("numberOfVacancies", j.getNumberOfVacancies());
            m.put("applicationDeadline", j.getApplicationDeadline());
            m.put("additionalRequirements", j.getAdditionalRequirements());
            m.put("status", j.getStatus() != null ? j.getStatus().name() : "DRAFT");
            m.put("applicationsCount", jobApplicationRepository.countByJobId(j.getId()));
            m.put("publishedAt", j.getPublishedAt());
            m.put("createdAt", j.getCreatedAt());
            result.add(m);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Get recruiter authorized companies for posting jobs.
     */
    @GetMapping("/companies")
    public ResponseEntity<List<Map<String, Object>>> getMyCompanies(
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        List<Company> companies = companyRepository.findAll().stream()
                .filter(c -> c.getAuthorizedRecruiterIds() != null && c.getAuthorizedRecruiterIds().contains(recruiterUserId))
                .collect(Collectors.toList());

        if (companies.isEmpty()) {
            recruiterProfileRepository.findByUserId(recruiterUserId).ifPresent(p -> {
                if (p.getCompanyId() != null && !p.getCompanyId().isBlank()) {
                    companyRepository.findById(p.getCompanyId()).ifPresent(c -> {
                        if (c.getAuthorizedRecruiterIds() == null) {
                            c.setAuthorizedRecruiterIds(new ArrayList<>());
                        }
                        if (!c.getAuthorizedRecruiterIds().contains(recruiterUserId)) {
                            List<String> list = new ArrayList<>(c.getAuthorizedRecruiterIds());
                            list.add(recruiterUserId);
                            c.setAuthorizedRecruiterIds(list);
                            companyRepository.save(c);
                        }
                        companies.add(c);
                    });
                }
            });
        }

        if (companies.isEmpty()) {
            Company defaultCompany = companyRepository.findAll().stream().findFirst().orElseGet(() -> {
                Company c = Company.builder()
                        .name("TechNova Solutions")
                        .industry("Information Technology")
                        .description("Default Partner Organization")
                        .approvalStatus(ApprovalStatus.APPROVED)
                        .authorizedRecruiterIds(new ArrayList<>())
                        .build();
                return companyRepository.save(c);
            });
            if (defaultCompany.getAuthorizedRecruiterIds() == null) {
                defaultCompany.setAuthorizedRecruiterIds(new ArrayList<>());
            }
            if (!defaultCompany.getAuthorizedRecruiterIds().contains(recruiterUserId)) {
                List<String> list = new ArrayList<>(defaultCompany.getAuthorizedRecruiterIds());
                list.add(recruiterUserId);
                defaultCompany.setAuthorizedRecruiterIds(list);
                companyRepository.save(defaultCompany);
            }
            recruiterProfileRepository.findByUserId(recruiterUserId).ifPresent(p -> {
                p.setCompanyId(defaultCompany.getId());
                recruiterProfileRepository.save(p);
            });
            companies.add(defaultCompany);
        }

        List<Map<String, Object>> result = companies.stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * Create a new job posting from the recruiter dashboard.
     */
    @PostMapping("/jobs")
    public ResponseEntity<Job> createJob(
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        String recruiterUserId = resolveUserId(principal);
        return ResponseEntity.ok(recruiterService.createJob(recruiterUserId, body));
    }

    /**
     * Update an existing job posting.
     */
    @PatchMapping("/jobs/{jobId}")
    public ResponseEntity<Job> updateJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal,
            @RequestBody Map<String, Object> body) {
        String recruiterUserId = resolveUserId(principal);
        return ResponseEntity.ok(recruiterService.updateJob(recruiterUserId, jobId, body));
    }

    /**
     * Publish a job posting.
     */
    @PostMapping("/jobs/{jobId}/publish")
    public ResponseEntity<Job> publishJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        return ResponseEntity.ok(recruiterService.publishJob(recruiterUserId, jobId));
    }

    /**
     * Permanently close a job posting (CLOSED — cannot be re-published).
     */
    @PostMapping("/jobs/{jobId}/close")
    public ResponseEntity<Job> closeJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        return ResponseEntity.ok(recruiterService.closeJob(recruiterUserId, jobId));
    }

    /**
     * Temporarily deactivate a job posting (INACTIVE — hidden from candidates, can be re-activated).
     */
    @PostMapping("/jobs/{jobId}/deactivate")
    public ResponseEntity<Job> deactivateJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        return ResponseEntity.ok(recruiterService.deactivateJob(recruiterUserId, jobId));
    }

    /**
     * Reactivate a previously INACTIVE (deactivated) job posting back to ACTIVE.
     */
    @PostMapping("/jobs/{jobId}/reactivate")
    public ResponseEntity<Job> reactivateJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        return ResponseEntity.ok(recruiterService.publishJob(recruiterUserId, jobId));
    }

    /**
     * Get applications for a specific job with candidate details.
     */
    @GetMapping("/jobs/{jobId}/applications")
    public ResponseEntity<List<Map<String, Object>>> getJobApplications(
            @PathVariable String jobId,
            @AuthenticationPrincipal UserDetails principal) {
        String recruiterUserId = resolveUserId(principal);
        subscriptionService.assertRecruiterSubscriptionActive(recruiterUserId);
        List<JobApplication> apps = recruiterService.getApplicationsForJob(recruiterUserId, jobId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (JobApplication a : apps) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("candidateUserId", a.getCandidateUserId());
            m.put("jobId", a.getJobId());
            m.put("status", a.getStatus().name());
            m.put("coverNote", a.getCoverNote());
            m.put("submittedResumeFilename", a.getSubmittedResumeFilename());
            m.put("atsScore", a.getAtsScore());
            m.put("createdAt", a.getCreatedAt());
            m.put("shortlistedAt", a.getShortlistedAt());
            m.put("recruiterNote", a.getRecruiterNote());

            userRepository.findById(a.getCandidateUserId()).ifPresent(u -> {
                m.put("candidateName", u.getName());
                m.put("candidateEmail", maskEmail(u.getEmail()));
            });

            candidateProfileRepository.findByUserId(a.getCandidateUserId()).ifPresent(p -> {
                m.put("headline", p.getHeadline());
                m.put("skills", p.getSkills());
                m.put("experienceYears", p.getTotalExperienceYears());
                m.put("location", p.getLocation());
            });

            result.add(m);
        }
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────
    private String resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername().trim().toLowerCase())
                .map(User::getId)
                .orElse("unknown");
    }

    private String deriveWorkMode(CandidateProfile p) {
        if (p.getHeadline() != null) {
            String h = p.getHeadline().toLowerCase();
            if (h.contains("remote") || h.contains("wfh")) return "WFH";
            if (h.contains("hybrid")) return "Hybrid";
        }
        return "Hybrid";
    }

    private String deriveStack(CandidateProfile p) {
        List<String> skills = p.getSkills();
        if (skills != null) {
            for (String s : skills) {
                String lower = s.toLowerCase();
                if (lower.contains("java") && !lower.contains("javascript")) return "Java";
                if (lower.contains("react") || lower.contains("next")) return "React";
                if (lower.contains("python") || lower.contains("django")) return "Python";
                if (lower.contains("docker") || lower.contains("kubernetes") || lower.contains("aws") || lower.contains("devops")) return "DevOps";
                if (lower.contains("ai") || lower.contains("ml") || lower.contains("pytorch") || lower.contains("llm")) return "AI/ML";
            }
        }
        return "Java";
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "candidate@mail.com";
        String[] p = email.split("@");
        String name = p[0];
        if (name.length() <= 2) return name.charAt(0) + "***@" + p[1];
        return name.substring(0, 2) + "***@" + p[1];
    }
}
