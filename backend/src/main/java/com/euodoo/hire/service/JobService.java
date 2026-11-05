package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;


@Service
@RequiredArgsConstructor
@Slf4j
public class JobService {

    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;

    public Page<Job> findActiveJobs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return jobRepository.findByStatus(JobStatus.ACTIVE, pageable);
    }

    public Job findById(String jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
    }

    public Company registerCompany(String recruiterUserId, String name, String description,
                                    String website, String industry, String headquarters,
                                    String contactEmail, String contactPhone) {
        if (companyRepository.existsByNameIgnoreCase(name)) {
            throw new BusinessException("DUPLICATE_COMPANY",
                    "A company with this name already exists.");
        }

        Company company = Company.builder()
                .name(name)
                .description(description)
                .website(website)
                .industry(industry)
                .headquarters(headquarters)
                .contactEmail(contactEmail)
                .contactPhone(contactPhone)
                .approvalStatus(ApprovalStatus.PENDING)
                .authorizedRecruiterIds(new ArrayList<>(List.of(recruiterUserId)))
                .build();

        Company saved = companyRepository.save(company);
        log.info("Company registered: {} [id={}] by recruiter [{}]",
                name, saved.getId(), recruiterUserId);
        return saved;
    }

    public Company getCompanyById(String companyId) {
        return companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", companyId));
    }

    public List<Company> getCompaniesForRecruiter(String recruiterUserId) {
        return companyRepository.findByAuthorizedRecruiterIdsContaining(recruiterUserId);
    }
}
