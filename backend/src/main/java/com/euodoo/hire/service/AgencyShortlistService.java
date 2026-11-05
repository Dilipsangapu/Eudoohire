package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.CandidateShortlistRequest;
import com.euodoo.hire.dto.response.CandidateShortlistResponse;
import com.euodoo.hire.model.ShortlistStatus;
import com.euodoo.hire.exception.AgencyExceptions.CandidateNotFoundException;
import com.euodoo.hire.exception.AgencyExceptions.JobNotFoundException;
import com.euodoo.hire.model.CandidateShortlist;
import com.euodoo.hire.repository.CandidateShortlistRepository;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.CandidateProfile;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyShortlistService {

    private final CandidateShortlistRepository shortlistRepository;
    private final CandidateProfileRepository candidateProfileRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public CandidateShortlistResponse shortlistCandidate(String agencyId, String userId, CandidateShortlistRequest request) {
        String candidateUserId = resolveCandidateUserId(request.getCandidateId());
        CandidateProfile profile = candidateProfileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new CandidateNotFoundException(candidateUserId));

        Job job = jobRepository.findByIdAndAgencyId(request.getJobId(), agencyId)
                .orElseThrow(() -> new JobNotFoundException(request.getJobId()));

        // Matching calculations
        List<String> jobSkills = new ArrayList<>();
        if (job.getTechStack() != null) jobSkills.addAll(job.getTechStack());
        if (job.getPreferredSkills() != null) jobSkills.addAll(job.getPreferredSkills());

        List<String> candidateSkills = profile.getSkills() != null ? profile.getSkills() : List.of();
        List<String> matchedSkills = new ArrayList<>();
        for (String js : jobSkills) {
            for (String cs : candidateSkills) {
                if (js.trim().equalsIgnoreCase(cs.trim())) {
                    if (!matchedSkills.contains(cs)) {
                        matchedSkills.add(cs);
                    }
                }
            }
        }

        double skillMatchPct = jobSkills.isEmpty() ? 100.0 : ((double) matchedSkills.size() / jobSkills.size()) * 100.0;
        boolean expMatch = profile.getTotalExperienceYears() >= job.getMinExperienceYears();
        boolean salaryMatch = job.getMaxSalaryInr() <= 0 || profile.getExpectedAnnualSalaryInr() <= job.getMaxSalaryInr();
        boolean qualMatch = true;

        // Weighted total matching score
        double totalScore = (skillMatchPct * 0.6) + (expMatch ? 20.0 : 0.0) + (salaryMatch ? 20.0 : 0.0);
        totalScore = Math.min(100.0, Math.round(totalScore * 10.0) / 10.0);

        CandidateShortlist shortlist = shortlistRepository
                .findByAgencyIdAndJobIdAndCandidateId(agencyId, job.getId(), candidateUserId)
                .orElse(CandidateShortlist.builder()
                        .agencyId(agencyId)
                        .candidateId(candidateUserId)
                        .jobId(job.getId())
                        .build());

        shortlist.setMatchingSkills(matchedSkills);
        shortlist.setMatchingPercentage(totalScore);
        shortlist.setExperienceMatch(expMatch);
        shortlist.setQualificationMatch(qualMatch);
        shortlist.setSalaryMatch(salaryMatch);
        shortlist.setShortlistingNotes(request.getNotes());
        shortlist.setShortlistedByUserId(userId);
        shortlist.setShortlistStatus(ShortlistStatus.ACTIVE);

        CandidateShortlist saved = shortlistRepository.save(shortlist);

        auditService.log(userId, "AGENCY_USER", "CandidateShortlist", saved.getId(),
                "CANDIDATE_SHORTLISTED", Map.of("candidateId", candidateUserId, "jobId", job.getId(), "match", String.valueOf(totalScore)));

        return toResponse(saved, profile, job);
    }

    public Page<CandidateShortlistResponse> getShortlists(String agencyId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<CandidateShortlist> paged = shortlistRepository.findByAgencyIdAndShortlistStatus(agencyId, ShortlistStatus.ACTIVE, pageRequest);

        List<CandidateShortlistResponse> list = paged.getContent().stream()
                .map(this::populateDetails)
                .collect(Collectors.toList());

        return new PageImpl<>(list, pageRequest, paged.getTotalElements());
    }

    public List<CandidateShortlistResponse> getJobShortlists(String agencyId, String jobId) {
        return shortlistRepository.findByAgencyIdAndJobIdAndShortlistStatus(agencyId, jobId, ShortlistStatus.ACTIVE).stream()
                .map(this::populateDetails)
                .collect(Collectors.toList());
    }

    public void removeShortlist(String agencyId, String shortlistId) {
        CandidateShortlist shortlist = shortlistRepository.findByIdAndAgencyId(shortlistId, agencyId)
                .orElseThrow(() -> new ResourceNotFoundException("CandidateShortlist", shortlistId));
        shortlist.setShortlistStatus(ShortlistStatus.REMOVED);
        shortlistRepository.save(shortlist);
    }

    private String resolveCandidateUserId(String candidateId) {
        if (candidateProfileRepository.findByUserId(candidateId).isPresent() || userRepository.findById(candidateId).isPresent()) {
            return candidateId;
        }
        return candidateProfileRepository.findById(candidateId)
                .map(CandidateProfile::getUserId)
                .orElse(candidateId);
    }

    private CandidateShortlistResponse populateDetails(CandidateShortlist s) {
        CandidateProfile profile = candidateProfileRepository.findByUserId(s.getCandidateId()).orElse(null);
        Job job = jobRepository.findById(s.getJobId()).orElse(null);
        return toResponse(s, profile, job);
    }

    private CandidateShortlistResponse toResponse(CandidateShortlist s, CandidateProfile profile, Job job) {
        String candName = "Candidate";
        String candEmail = "";
        if (s.getCandidateId() != null) {
            Optional<User> u = userRepository.findById(s.getCandidateId());
            if (u.isPresent()) {
                candName = u.get().getName();
                candEmail = u.get().getEmail();
            }
        }
        return CandidateShortlistResponse.builder()
                .id(s.getId())
                .agencyId(s.getAgencyId())
                .candidateId(s.getCandidateId())
                .candidateName(candName)
                .candidateEmail(candEmail)
                .candidateHeadline(profile != null ? profile.getHeadline() : null)
                .candidateLocation(profile != null ? profile.getLocation() : null)
                .candidateTotalExperienceYears(profile != null ? profile.getTotalExperienceYears() : 0)
                .jobId(s.getJobId())
                .jobTitle(job != null ? job.getTitle() : "Job")
                .matchingSkills(s.getMatchingSkills())
                .matchingPercentage(s.getMatchingPercentage())
                .experienceMatch(s.isExperienceMatch())
                .qualificationMatch(s.isQualificationMatch())
                .salaryMatch(s.isSalaryMatch())
                .shortlistingNotes(s.getShortlistingNotes())
                .shortlistedByUserId(s.getShortlistedByUserId())
                .shortlistStatus(s.getShortlistStatus())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
