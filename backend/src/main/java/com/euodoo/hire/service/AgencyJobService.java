package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyJobRequest;
import com.euodoo.hire.dto.response.AgencyJobResponse;
import com.euodoo.hire.exception.AgencyExceptions.JobNotFoundException;
import com.euodoo.hire.service.AgencyMapper;
import com.euodoo.hire.model.AgencyClient;
import com.euodoo.hire.repository.AgencyClientRepository;
import com.euodoo.hire.repository.AgencyPlacementRepository;
import com.euodoo.hire.repository.CandidateShortlistRepository;
import com.euodoo.hire.repository.CandidateSubmissionRepository;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.JobStatus;
import com.euodoo.hire.model.ShortlistStatus;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyJobService {

    private final JobRepository jobRepository;
    private final AgencyClientRepository agencyClientRepository;
    private final CandidateShortlistRepository shortlistRepository;
    private final CandidateSubmissionRepository submissionRepository;
    private final AgencyPlacementRepository placementRepository;
    private final AuditService auditService;

    public AgencyJobResponse createJob(String agencyId, String userId, AgencyJobRequest request) {
        String clientCompanyName = "Client Company";
        String companyId = null;
        if (request.getClientCompanyId() != null) {
            AgencyClient client = agencyClientRepository.findByIdAndAgencyId(request.getClientCompanyId(), agencyId).orElse(null);
            if (client != null) {
                clientCompanyName = client.getCompanyName();
                companyId = client.getCompanyId();
            }
        }

        Job job = Job.builder()
                .title(request.getTitle().trim())
                .description(request.getDescription())
                .responsibilities(request.getResponsibilities())
                .additionalRequirements(request.getAdditionalRequirements())
                .agencyId(agencyId)
                .clientCompanyId(request.getClientCompanyId())
                .companyId(companyId)
                .creatorUserId(userId)
                .creatorRole("AGENCY_ADMIN")
                .location(request.getLocation())
                .country(request.getCountry())
                .city(request.getCity())
                .workMode(request.getWorkMode())
                .employmentType(request.getEmploymentType() != null ? request.getEmploymentType().name() : "FULL_TIME")
                .techStack(request.getTechStack())
                .preferredSkills(request.getPreferredSkills())
                .minExperienceYears(request.getMinExperienceYears())
                .maxExperienceYears(request.getMaxExperienceYears())
                .minSalaryInr(request.getMinSalaryInr())
                .maxSalaryInr(request.getMaxSalaryInr())
                .educationRequirements(request.getEducationRequirements())
                .numberOfVacancies(request.getNumberOfVacancies())
                .applicationDeadline(request.getApplicationDeadline())
                .status(JobStatus.ACTIVE)
                .publishedAt(Instant.now())
                .build();

        Job saved = jobRepository.save(job);

        auditService.log(userId, "AGENCY_USER", "Job", saved.getId(),
                "AGENCY_JOB_CREATED", Map.of("title", saved.getTitle(), "agencyId", agencyId));

        return AgencyMapper.toJobResponse(saved, clientCompanyName, 0, 0, 0);
    }

    public Page<AgencyJobResponse> getJobs(String agencyId, int page, int size, String search, String clientCompanyId, JobStatus status) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<Job> all = jobRepository.findByAgencyId(agencyId);

        List<Job> filtered = all.stream()
                .filter(j -> status == null || j.getStatus() == status)
                .filter(j -> clientCompanyId == null || clientCompanyId.isBlank() || clientCompanyId.equals(j.getClientCompanyId()))
                .filter(j -> search == null || search.isBlank() ||
                        (j.getTitle() != null && j.getTitle().toLowerCase().contains(search.toLowerCase())) ||
                        (j.getDescription() != null && j.getDescription().toLowerCase().contains(search.toLowerCase())) ||
                        (j.getLocation() != null && j.getLocation().toLowerCase().contains(search.toLowerCase())))
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), filtered.size());
        int end = Math.min((start + pageRequest.getPageSize()), filtered.size());
        List<AgencyJobResponse> pageContent = filtered.subList(start, end).stream()
                .map(j -> buildJobResponse(j, agencyId))
                .collect(Collectors.toList());

        return new PageImpl<>(pageContent, pageRequest, filtered.size());
    }

    public AgencyJobResponse getJob(String agencyId, String jobId) {
        Job job = jobRepository.findByIdAndAgencyId(jobId, agencyId)
                .orElseThrow(() -> new JobNotFoundException(jobId));
        return buildJobResponse(job, agencyId);
    }

    public AgencyJobResponse updateJob(String agencyId, String jobId, AgencyJobRequest request, String userId) {
        Job job = jobRepository.findByIdAndAgencyId(jobId, agencyId)
                .orElseThrow(() -> new JobNotFoundException(jobId));

        if (request.getTitle() != null) job.setTitle(request.getTitle().trim());
        if (request.getDescription() != null) job.setDescription(request.getDescription());
        if (request.getResponsibilities() != null) job.setResponsibilities(request.getResponsibilities());
        if (request.getAdditionalRequirements() != null) job.setAdditionalRequirements(request.getAdditionalRequirements());
        if (request.getLocation() != null) job.setLocation(request.getLocation());
        if (request.getCountry() != null) job.setCountry(request.getCountry());
        if (request.getCity() != null) job.setCity(request.getCity());
        if (request.getWorkMode() != null) job.setWorkMode(request.getWorkMode());
        if (request.getEmploymentType() != null) job.setEmploymentType(request.getEmploymentType().name());
        if (request.getTechStack() != null) job.setTechStack(request.getTechStack());
        if (request.getPreferredSkills() != null) job.setPreferredSkills(request.getPreferredSkills());
        if (request.getMinExperienceYears() > 0) job.setMinExperienceYears(request.getMinExperienceYears());
        if (request.getMaxExperienceYears() > 0) job.setMaxExperienceYears(request.getMaxExperienceYears());
        if (request.getMinSalaryInr() > 0) job.setMinSalaryInr(request.getMinSalaryInr());
        if (request.getMaxSalaryInr() > 0) job.setMaxSalaryInr(request.getMaxSalaryInr());
        if (request.getEducationRequirements() != null) job.setEducationRequirements(request.getEducationRequirements());
        if (request.getNumberOfVacancies() != null) job.setNumberOfVacancies(request.getNumberOfVacancies());
        if (request.getApplicationDeadline() != null) job.setApplicationDeadline(request.getApplicationDeadline());

        job.setLastModifiedByUserId(userId);
        job.setLastModifiedByRole("AGENCY_USER");

        Job saved = jobRepository.save(job);

        auditService.log(userId, "AGENCY_USER", "Job", saved.getId(),
                "AGENCY_JOB_UPDATED", Map.of("title", saved.getTitle()));

        return buildJobResponse(saved, agencyId);
    }

    public AgencyJobResponse updateStatus(String agencyId, String jobId, JobStatus status, String userId) {
        Job job = jobRepository.findByIdAndAgencyId(jobId, agencyId)
                .orElseThrow(() -> new JobNotFoundException(jobId));

        job.setStatus(status);
        if (status == JobStatus.CLOSED) {
            job.setClosedAt(Instant.now());
        }
        job.setLastModifiedByUserId(userId);
        job.setLastModifiedByRole("AGENCY_USER");

        Job saved = jobRepository.save(job);

        auditService.log(userId, "AGENCY_USER", "Job", saved.getId(),
                "AGENCY_JOB_STATUS_CHANGED", Map.of("status", status.name()));

        return buildJobResponse(saved, agencyId);
    }

    private AgencyJobResponse buildJobResponse(Job job, String agencyId) {
        String clientCompanyName = "Client Company";
        if (job.getClientCompanyId() != null) {
            AgencyClient client = agencyClientRepository.findByIdAndAgencyId(job.getClientCompanyId(), agencyId).orElse(null);
            if (client != null) {
                clientCompanyName = client.getCompanyName();
            }
        }
        long candidateCount = shortlistRepository.countByAgencyIdAndJobIdAndShortlistStatus(
                agencyId, job.getId(), ShortlistStatus.ACTIVE);
        long submissionCount = submissionRepository.countByAgencyIdAndJobId(agencyId, job.getId());
        long placementCount = placementRepository.findByJobId(job.getId()).stream()
                .filter(p -> agencyId.equals(p.getAgencyId()))
                .count();

        return AgencyMapper.toJobResponse(job, clientCompanyName, candidateCount, submissionCount, placementCount);
    }
}
