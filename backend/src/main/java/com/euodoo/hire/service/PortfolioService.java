package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.CandidateProfile;
import com.euodoo.hire.model.ChangeRequestStatus;
import com.euodoo.hire.model.PortfolioChangeRequest;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.PortfolioChangeRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Portfolio change-review workflow.
 *
 * Portfolio changes are a candidate-submitted change request, completely
 * separate from ATS scoring: this service never touches AtsEvaluation and the
 * ATS engine never creates a PortfolioChangeRequest.
 *
 * The approved portfolio lives on {@code CandidateProfile.portfolioProjects}.
 * A submission is stored as JSON on the change request until a reviewer acts:
 *  - approve -> the proposed projects are applied to the profile
 *  - reject  -> the previously approved projects are left untouched
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioService {

    /** Safety cap — a portfolio is a small curated list, not a data dump. */
    private static final int MAX_PROJECTS = 25;
    private static final int MAX_TITLE_CHARS = 160;
    private static final int MAX_TEXT_CHARS = 2000;

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final CandidateProfileRepository profileRepository;
    private final PortfolioChangeRequestRepository changeRequestRepository;

    // ─────────────────────────────────────────────────
    // Candidate submission
    // ─────────────────────────────────────────────────

    /**
     * Submits proposed portfolio projects for review. Only one PENDING request
     * may exist per candidate at a time, so the review queue stays meaningful.
     */
    public PortfolioChangeRequest submitChangeRequest(String candidateUserId,
                                                     String title,
                                                     List<PortfolioProjectInput> projects) {
        if (candidateUserId == null || candidateUserId.isBlank()) {
            throw new BusinessException("INVALID_CANDIDATE", "A candidate is required to submit a portfolio change.");
        }
        if (changeRequestRepository.existsByCandidateUserIdAndStatus(
                candidateUserId, ChangeRequestStatus.PENDING)) {
            throw new BusinessException("CHANGE_REQUEST_PENDING",
                    "You already have a portfolio change awaiting review. Please wait for it to be reviewed.");
        }

        CandidateProfile profile = profileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "CandidateProfile for user", candidateUserId));

        List<CandidateProfile.PortfolioProject> proposed = normalize(projects);

        PortfolioChangeRequest request = PortfolioChangeRequest.builder()
                .candidateUserId(candidateUserId)
                .title(resolveTitle(title, proposed))
                .proposedChangesJson(writeJson(proposed))
                .previousChangesJson(writeJson(
                        profile.getPortfolioProjects() != null
                                ? profile.getPortfolioProjects() : List.of()))
                .status(ChangeRequestStatus.PENDING)
                .createdAt(Instant.now())
                .build();
        PortfolioChangeRequest saved = changeRequestRepository.save(request);
        log.info("Portfolio change request {} submitted by candidate [userId={}]",
                saved.getId(), candidateUserId);
        return saved;
    }

    // ─────────────────────────────────────────────────
    // Candidate view
    // ─────────────────────────────────────────────────

    /** Approved projects plus the status of the candidate's latest submission. */
    public Map<String, Object> getPortfolioState(String candidateUserId) {
        CandidateProfile profile = profileRepository.findByUserId(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "CandidateProfile for user", candidateUserId));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("projects", profile.getPortfolioProjects() != null
                ? profile.getPortfolioProjects() : List.of());

        Optional<PortfolioChangeRequest> pending =
                changeRequestRepository.findTopByCandidateUserIdAndStatusOrderByCreatedAtDesc(
                        candidateUserId, ChangeRequestStatus.PENDING);
        Optional<PortfolioChangeRequest> latest = pending.isPresent() ? pending
                : changeRequestRepository.findByCandidateUserIdOrderByCreatedAtDesc(candidateUserId)
                    .stream().findFirst();

        res.put("hasPendingChange", pending.isPresent());
        latest.ifPresent(req -> {
            Map<String, Object> request = new LinkedHashMap<>();
            request.put("id", req.getId());
            request.put("title", req.getTitle());
            request.put("status", req.getStatus() != null ? req.getStatus().name() : null);
            request.put("reviewNote", req.getReviewNote());
            request.put("createdAt", req.getCreatedAt());
            request.put("reviewedAt", req.getReviewedAt());
            request.put("proposedProjects", readJson(req.getProposedChangesJson()));
            res.put("latestChangeRequest", request);
        });
        return res;
    }

    // ─────────────────────────────────────────────────
    // Reviewer application
    // ─────────────────────────────────────────────────

    /**
     * Applies an approved request's proposed portfolio to the candidate profile.
     * Called only after the request has been marked APPROVED.
     */
    public void applyApprovedChanges(PortfolioChangeRequest request) {
        if (request == null || request.getCandidateUserId() == null) return;
        List<CandidateProfile.PortfolioProject> proposed =
                readProjects(request.getProposedChangesJson());
        profileRepository.findByUserId(request.getCandidateUserId()).ifPresent(profile -> {
            profile.setPortfolioProjects(new ArrayList<>(proposed));
            profileRepository.save(profile);
            log.info("Portfolio change request {} applied for candidate [userId={}]",
                    request.getId(), request.getCandidateUserId());
        });
    }

    // ─────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────

    private List<CandidateProfile.PortfolioProject> normalize(List<PortfolioProjectInput> projects) {
        if (projects == null) return List.of();
        if (projects.size() > MAX_PROJECTS) {
            throw new BusinessException("TOO_MANY_PROJECTS",
                    "A portfolio can contain at most " + MAX_PROJECTS + " projects.");
        }
        List<CandidateProfile.PortfolioProject> result = new ArrayList<>();
        for (PortfolioProjectInput input : projects) {
            if (input == null) continue;
            String title = trim(input.title(), MAX_TITLE_CHARS);
            if (title == null) continue; // a project without a title is not a project
            result.add(CandidateProfile.PortfolioProject.builder()
                    .title(title)
                    .description(trim(input.description(), MAX_TEXT_CHARS))
                    .projectUrl(trim(input.projectUrl(), MAX_TEXT_CHARS))
                    .repoUrl(trim(input.repoUrl(), MAX_TEXT_CHARS))
                    .techStack(normalizeTech(input.techStack()))
                    .build());
        }
        return result;
    }

    private List<String> normalizeTech(List<String> techStack) {
        if (techStack == null) return new ArrayList<>();
        List<String> cleaned = new ArrayList<>();
        for (String tech : techStack) {
            String value = trim(tech, 60);
            if (value != null && !cleaned.contains(value)) cleaned.add(value);
        }
        return cleaned;
    }

    private String resolveTitle(String title, List<CandidateProfile.PortfolioProject> projects) {
        String value = trim(title, MAX_TITLE_CHARS);
        if (value != null) return value;
        if (projects.isEmpty()) return "Portfolio update";
        return projects.size() == 1
                ? projects.get(0).getTitle()
                : projects.size() + " portfolio projects";
    }

    private String trim(String value, int max) {
        if (value == null) return null;
        String cleaned = value.trim();
        if (cleaned.isEmpty()) return null;
        return cleaned.length() > max ? cleaned.substring(0, max) : cleaned;
    }

    private String writeJson(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception e) {
            throw new BusinessException("PORTFOLIO_SERIALIZATION_FAILED",
                    "The portfolio changes could not be saved. Please try again.");
        }
    }

    private List<CandidateProfile.PortfolioProject> readProjects(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return JSON.readValue(json,
                    new TypeReference<List<CandidateProfile.PortfolioProject>>() {});
        } catch (Exception e) {
            log.warn("Could not parse stored portfolio JSON: {}", e.getMessage());
            return List.of();
        }
    }

    /** Raw submitted projects parsed back for the candidate's own view. */
    private Object readJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return JSON.readValue(json, Object.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    /** Inbound payload project (loose shape coming from the candidate UI). */
    public record PortfolioProjectInput(
            String title,
            String description,
            String projectUrl,
            String repoUrl,
            List<String> techStack
    ) {}
}
