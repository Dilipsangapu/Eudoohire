package com.euodoo.hire.config;

import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.CompanyRepository;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.repository.RecruiterProfileRepository;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Development and local integration data initializer.
 * Runs in all non-production environments to seed essential test accounts and sample jobs.
 * Never overwrites existing accounts or resets passwords.
 */
@Component
@Profile("!prod")
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;
    private final com.euodoo.hire.repository.AgencyRepository agencyRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        initDevAdmin();
        initDevRecruiter();
        initDevCandidates();
        initDevAgency();
        initSampleJobs();
    }

    private void initDevAdmin() {
        String adminEmail = "admin@euodoo.dev";
        if (userRepository.existsByEmail(adminEmail)) {
            return;
        }

        String password = System.getenv("DEV_ADMIN_PASSWORD");
        if (password == null || password.isBlank()) {
            password = "DevAdmin@2024!";
        }

        User admin = User.builder()
                .name("Dev Admin")
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(password))
                .role(Role.CLIENT_ADMIN)
                .accountStatus(AccountStatus.ACTIVE)
                .build();

        userRepository.save(admin);
        log.info("[DEV] Created dev admin account: {} (role=CLIENT_ADMIN)", adminEmail);
    }

    private void initDevRecruiter() {
        String recruiterEmail = "recruiter@euodoo.dev";
        User recruiter = userRepository.findByEmail(recruiterEmail).orElse(null);

        Company company = companyRepository.findAll().stream().findFirst().orElseGet(() -> {
            Company c = Company.builder()
                    .name("TechNova Solutions")
                    .industry("Information Technology")
                    .description("Leading provider of digital transformation and modern cloud software.")
                    .headquarters("Bengaluru, Karnataka")
                    .approvalStatus(ApprovalStatus.APPROVED)
                    .authorizedRecruiterIds(new ArrayList<>())
                    .build();
            return companyRepository.save(c);
        });

        if (recruiter == null) {
            recruiter = User.builder()
                    .name("Kiran Sharma")
                    .email(recruiterEmail)
                    .passwordHash(passwordEncoder.encode("Recruiter@2024!"))
                    .role(Role.RECRUITER)
                    .accountStatus(AccountStatus.ACTIVE)
                    .build();
            recruiter = userRepository.save(recruiter);
            log.info("[DEV] Created dev recruiter account: {} (role=RECRUITER)", recruiterEmail);
        }

        final User finalRecruiter = recruiter;
        RecruiterProfile profile = recruiterProfileRepository.findByUserId(finalRecruiter.getId()).orElseGet(() -> {
            RecruiterProfile p = RecruiterProfile.builder()
                    .userId(finalRecruiter.getId())
                    .companyId(company.getId())
                    .designation("Lead Technical Recruiter")
                    .phone("+91 98765 43299")
                    .approvalStatus(ApprovalStatus.APPROVED)
                    .build();
            return recruiterProfileRepository.save(p);
        });

        if (profile.getCompanyId() == null || profile.getCompanyId().isBlank()) {
            profile.setCompanyId(company.getId());
            recruiterProfileRepository.save(profile);
        }

        if (company.getAuthorizedRecruiterIds() == null) {
            company.setAuthorizedRecruiterIds(new ArrayList<>());
        }
        if (!company.getAuthorizedRecruiterIds().contains(finalRecruiter.getId())) {
            List<String> list = new ArrayList<>(company.getAuthorizedRecruiterIds());
            list.add(finalRecruiter.getId());
            company.setAuthorizedRecruiterIds(list);
            companyRepository.save(company);
            log.info("[DEV] Synced recruiter {} to authorized list for company {}", recruiterEmail, company.getName());
        }
    }

    private void initDevCandidates() {
        // Clean up any previously seeded synthetic dummy candidate accounts so recruiter and admin dashboards are clean
        List<String> syntheticEmails = List.of(
                "rohan.iyer@euodoo.dev", "sneha.kulkarni@euodoo.dev", "vikram.singh@euodoo.dev",
                "ishita.rao@euodoo.dev", "karthik.reddy@euodoo.dev", "ananya.nair@euodoo.dev",
                "meera.joshi@euodoo.dev", "sanjay.gupta@euodoo.dev"
        );
        for (String syntheticEmail : syntheticEmails) {
            userRepository.findByEmail(syntheticEmail).ifPresent(u -> {
                candidateProfileRepository.findByUserId(u.getId()).ifPresent(candidateProfileRepository::delete);
                userRepository.delete(u);
                log.info("[DEV] Cleaned up synthetic dummy candidate: {}", syntheticEmail);
            });
        }

        // 1. Paid Candidate Dev Account
        String paidEmail = "candidate.paid@euodoo.dev";
        User paidUser = userRepository.findByEmail(paidEmail).orElse(null);
        if (paidUser == null) {
            paidUser = User.builder()
                    .name("Paid Candidate")
                    .email(paidEmail)
                    .passwordHash(passwordEncoder.encode("Candidate@2024!"))
                    .role(Role.CANDIDATE)
                    .accountStatus(AccountStatus.ACTIVE)
                    .plan(PlanType.PREMIUM)
                    .planActivated(true)
                    .build();
            User savedPaid = userRepository.save(paidUser);

            CandidateProfile paidProfile = CandidateProfile.builder()
                    .userId(savedPaid.getId())
                    .headline("Senior Frontend Architect")
                    .bio("Forward-thinking Senior Software Developer with 5+ years of experience architecting high-performance React and TypeScript applications.")
                    .phone("+91 98765 43210")
                    .location("Bengaluru, Karnataka")
                    .skills(List.of("React", "TypeScript", "JavaScript", "Next.js", "GraphQL", "Tailwind CSS", "Node.js", "Docker", "Git"))
                    .currentDesignation("Senior Frontend Developer")
                    .currentCompany("TechNova Solutions")
                    .totalExperienceYears(5)
                    .noticePeriodDays(30)
                    .expectedAnnualSalaryInr(2800000L)
                    .profileApprovalStatus(ApprovalStatus.APPROVED)
                    .visibleToRecruiters(true)
                    .build();
            candidateProfileRepository.save(paidProfile);
            log.info("[DEV] Created dev paid candidate account: {}", paidEmail);
        } else if ("Aarav Menon".equalsIgnoreCase(paidUser.getName())) {
            paidUser.setName("Paid Candidate");
            userRepository.save(paidUser);
        }

        // 2. Free / Unpaid Candidate Dev Account
        String freeEmail = "candidate.free@euodoo.dev";
        User freeUser = userRepository.findByEmail(freeEmail).orElse(null);
        if (freeUser == null) {
            freeUser = User.builder()
                    .name("Free Candidate")
                    .email(freeEmail)
                    .passwordHash(passwordEncoder.encode("Candidate@2024!"))
                    .role(Role.CANDIDATE)
                    .accountStatus(AccountStatus.ACTIVE)
                    .plan(PlanType.FREE)
                    .planActivated(false)
                    .build();
            User savedFree = userRepository.save(freeUser);

            CandidateProfile freeProfile = CandidateProfile.builder()
                    .userId(savedFree.getId())
                    .headline("Software Developer")
                    .bio("Passionate junior web developer focusing on React, modern JavaScript, and building accessible web apps.")
                    .phone("+91 98765 43211")
                    .location("Bengaluru, Karnataka")
                    .skills(List.of("React", "JavaScript", "HTML5", "CSS3", "Git", "REST APIs"))
                    .currentDesignation("Junior Frontend Developer")
                    .totalExperienceYears(2)
                    .noticePeriodDays(15)
                    .expectedAnnualSalaryInr(1200000L)
                    .profileApprovalStatus(ApprovalStatus.APPROVED)
                    .visibleToRecruiters(true)
                    .build();
            candidateProfileRepository.save(freeProfile);
            log.info("[DEV] Created dev free candidate account: {}", freeEmail);
        } else if ("Aarav Patel".equalsIgnoreCase(freeUser.getName())) {
            freeUser.setName("Free Candidate");
            userRepository.save(freeUser);
        }
    }

    private void initSampleJobs() {
        if (jobRepository.count() > 0) {
            return;
        }

        Company company = companyRepository.findAll().stream().findFirst().orElseGet(() -> {
            Company c = Company.builder()
                    .name("TechNova Solutions")
                    .industry("Information Technology")
                    .description("Leading provider of digital transformation and modern cloud software.")
                    .headquarters("Bengaluru, Karnataka")
                    .approvalStatus(ApprovalStatus.APPROVED)
                    .build();
            return companyRepository.save(c);
        });

        List<Job> sampleJobs = List.of(
                Job.builder()
                        .title("Senior React Developer")
                        .companyId(company.getId())
                        .location("Bengaluru, Karnataka")
                        .workMode(WorkMode.HYBRID)
                        .minExperienceYears(3)
                        .maxExperienceYears(6)
                        .minSalaryInr(2200000L)
                        .maxSalaryInr(3000000L)
                        .techStack(List.of("React", "TypeScript", "Redux", "Tailwind CSS", "REST APIs"))
                        .description("Build responsive web experiences with our core product engineering team. Work on modern React development, reusable design systems, and frontend architecture.")
                        .status(JobStatus.ACTIVE)
                        .build(),
                Job.builder()
                        .title("HR Business Partner")
                        .companyId(company.getId())
                        .location("Mumbai, Maharashtra")
                        .workMode(WorkMode.WFO)
                        .minExperienceYears(4)
                        .maxExperienceYears(7)
                        .minSalaryInr(1200000L)
                        .maxSalaryInr(1800000L)
                        .techStack(List.of("HR Management", "Talent Acquisition", "Employee Engagement", "Performance Review"))
                        .description("Partner with business leaders on employee engagement, workforce planning, performance processes, and people initiatives.")
                        .status(JobStatus.ACTIVE)
                        .build(),
                Job.builder()
                        .title("Product Designer (UX)")
                        .companyId(company.getId())
                        .location("Remote")
                        .workMode(WorkMode.WFH)
                        .minExperienceYears(3)
                        .maxExperienceYears(5)
                        .minSalaryInr(1800000L)
                        .maxSalaryInr(2400000L)
                        .techStack(List.of("Figma", "UI/UX", "Design Systems", "Prototyping", "User Research"))
                        .description("Create intuitive product journeys through user research, wireframes, interactive prototypes, and design systems.")
                        .status(JobStatus.ACTIVE)
                        .build(),
                Job.builder()
                        .title("Payroll Specialist")
                        .companyId(company.getId())
                        .location("Hyderabad, Telangana")
                        .workMode(WorkMode.WFO)
                        .minExperienceYears(2)
                        .maxExperienceYears(4)
                        .minSalaryInr(800000L)
                        .maxSalaryInr(1200000L)
                        .techStack(List.of("Payroll", "Compliance", "Taxation", "Excel", "HRIS"))
                        .description("Manage payroll processing, employee tax records, statutory compliance, and reporting in coordination with finance.")
                        .status(JobStatus.ACTIVE)
                        .build(),
                Job.builder()
                        .title("Talent Acquisition Lead")
                        .companyId(company.getId())
                        .location("Pune, Maharashtra")
                        .workMode(WorkMode.HYBRID)
                        .minExperienceYears(5)
                        .maxExperienceYears(8)
                        .minSalaryInr(1600000L)
                        .maxSalaryInr(2200000L)
                        .techStack(List.of("Recruiting", "Sourcing", "Applicant Tracking", "Interviewing"))
                        .description("Lead end-to-end recruitment pipelines, talent sourcing strategy, interview coordination, and positive candidate experience.")
                        .status(JobStatus.ACTIVE)
                        .build(),
                Job.builder()
                        .title("Data Analyst")
                        .companyId(company.getId())
                        .location("Chennai, Tamil Nadu")
                        .workMode(WorkMode.HYBRID)
                        .minExperienceYears(2)
                        .maxExperienceYears(5)
                        .minSalaryInr(1000000L)
                        .maxSalaryInr(1600000L)
                        .techStack(List.of("SQL", "Python", "PowerBI", "Tableau", "Analytics"))
                        .description("Turn business data into actionable insights through robust reporting, data modeling, dashboards, and KPI analysis.")
                        .status(JobStatus.ACTIVE)
                        .build()
        );

        jobRepository.saveAll(sampleJobs);
        log.info("[DEV] Seeded {} sample active jobs.", sampleJobs.size());
    }

    private void initDevAgency() {
        String agencyEmail = "agency@euodoo.dev";
        User agencyUser = userRepository.findByEmail(agencyEmail).orElse(null);
        if (agencyUser == null) {
            agencyUser = User.builder()
                    .name("Apex Talent Admin")
                    .email(agencyEmail)
                    .passwordHash(passwordEncoder.encode("Agency@2024!"))
                    .role(Role.AGENCY_ADMIN)
                    .accountStatus(AccountStatus.ACTIVE)
                    .build();
            agencyUser = userRepository.save(agencyUser);
            log.info("[DEV] Created dev agency user account: {} (role=AGENCY_ADMIN)", agencyEmail);
        }

        if (!agencyRepository.existsByOfficialEmailIgnoreCase(agencyEmail)) {
            Agency agency = Agency.builder()
                    .agencyName("Apex Global Staffing")
                    .agencyType(AgencyType.RECRUITMENT_AGENCY)
                    .businessRegistrationNumber("AGY-2024-APEX01")
                    .panNumber("ABCDE1234F")
                    .gstNumber("27ABCDE1234F1Z5")
                    .officialEmail(agencyEmail)
                    .contactNumber("9876543210")
                    .website("https://apexstaffing.example.com")
                    .registrationStatus(AgencyRegistrationStatus.APPROVED)
                    .registeredUserId(agencyUser.getId())
                    .representative(AgencyRepresentative.builder()
                            .fullName("Rajesh Verma")
                            .designation("Managing Director")
                            .officialEmail(agencyEmail)
                            .mobileNumber("9876543210")
                            .build())
                    .officeAddress(AgencyAddress.builder()
                            .country("India")
                            .state("Maharashtra")
                            .city("Mumbai")
                            .officeAddress("Tower B, Cyber City, BKC")
                            .pinCode("400051")
                            .build())
                    .build();
            agencyRepository.save(agency);
            log.info("[DEV] Seeded pre-approved dev agency: Apex Global Staffing ({})", agencyEmail);
        }
    }
}
