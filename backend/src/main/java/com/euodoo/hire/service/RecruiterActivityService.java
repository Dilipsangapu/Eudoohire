package com.euodoo.hire.service;

import com.euodoo.hire.model.Company;
import com.euodoo.hire.model.HiringRequest;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.RecruiterActivity;
import com.euodoo.hire.model.RecruiterProfile;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.CompanyRepository;
import com.euodoo.hire.repository.HiringRequestRepository;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.repository.RecruiterActivityRepository;
import com.euodoo.hire.repository.RecruiterProfileRepository;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Records and serves recruiter engagement activity.
 *
 * Writes happen ONLY from backend code paths that already validated
 * authorization AND completed the underlying action successfully.
 * Never throws to callers — a logging failure must never break the
 * business operation that produced the event.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecruiterActivityService {

    /** Same recruiter viewing the same candidate's profile inside this
     *  window is treated as one visit (guards against re-renders and retries). */
    private static final long PROFILE_VIEW_DEDUP_MINUTES = 10;

    /** Window for the "recent visits" counter on the activity table. */
    private static final long RECENT_WINDOW_DAYS = 7;

    private final RecruiterActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final RecruiterProfileRepository recruiterProfileRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final HiringRequestRepository hiringRequestRepository;
    private final MongoTemplate mongoTemplate;

    private static final String CONTACT_LOCKED_MESSAGE =
            "Locked until candidate release";

    // ─────────────────────────────────────────────────
    // Recording
    // ─────────────────────────────────────────────────

    /**
     * Records an action performed by an authenticated recruiter on a candidate.
     * All IDs must come from validated backend records, never from request payloads.
     */
    public void recordRecruiterAction(String eventType,
                                      String recruiterUserId,
                                      String candidateUserId,
                                      String jobId,
                                      String jobApplicationId,
                                      String hiringRequestId,
                                      String companyId,
                                      Map<String, String> metadata) {
        try {
            if (recruiterUserId == null || candidateUserId == null) {
                return; // Without both sides the event is not meaningful
            }
            if (RecruiterActivity.EVENT_VIEWED_PROFILE.equals(eventType)
                    && isDuplicateProfileView(recruiterUserId, candidateUserId)) {
                log.debug("Suppressed duplicate profile view [recruiter={}, candidate={}]",
                        recruiterUserId, candidateUserId);
                return;
            }

            RecruiterActivity activity = RecruiterActivity.builder()
                    .recruiterUserId(recruiterUserId)
                    .candidateUserId(candidateUserId)
                    .eventType(eventType)
                    .description(descriptionFor(eventType))
                    .jobId(jobId)
                    .jobApplicationId(jobApplicationId)
                    .hiringRequestId(hiringRequestId)
                    .companyId(companyId)
                    .timestamp(Instant.now())
                    .metadata(sanitize(metadata))
                    .build();
            activityRepository.save(activity);
        } catch (Exception e) {
            // Activity logging must never break the operation that produced the event
            log.error("Failed to record activity [event={}, recruiter={}, candidate={}]: {}",
                    eventType, recruiterUserId, candidateUserId, e.getMessage());
        }
    }

    /**
     * Records a candidate-initiated ATS evaluation with the actual score the
     * evaluation produced. There is no recruiter/job association because the
     * platform's ATS evaluation is a candidate self-service action.
     */
    public void recordAtsEvaluation(String candidateUserId, Object score, String filename) {
        try {
            if (candidateUserId == null) {
                return; // Unauthenticated (public demo analyze) — nothing to attribute
            }
            Map<String, String> metadata = new LinkedHashMap<>();
            if (score instanceof Number) {
                metadata.put("score", String.valueOf(((Number) score).intValue()));
            }
            if (filename != null && !filename.isBlank()) {
                metadata.put("filename", filename);
            }
            RecruiterActivity activity = RecruiterActivity.builder()
                    .candidateUserId(candidateUserId)
                    .eventType(RecruiterActivity.EVENT_ATS_EVALUATED)
                    .description("Evaluated Resume (ATS)")
                    .timestamp(Instant.now())
                    .metadata(sanitize(metadata))
                    .build();
            activityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to record ATS evaluation for candidate {}: {}",
                    candidateUserId, e.getMessage());
        }
    }

    /**
     * Records a RECRUITER-initiated ATS evaluation with the real score the
     * backend engine produced. Called only after the evaluation persisted
     * successfully — failed evaluations never create activity records.
     * Recruiter evaluations never affect the candidate's own free-check
     * allowance (they are accounted as their own usage kind).
     */
    public void recordRecruiterAtsEvaluation(String recruiterUserId,
                                             String candidateUserId,
                                             String jobId,
                                             String jobApplicationId,
                                             String companyId,
                                             Object score) {
        try {
            Map<String, String> metadata = new LinkedHashMap<>();
            if (score instanceof Number) {
                metadata.put("score", String.valueOf(((Number) score).intValue()));
            }
            RecruiterActivity activity = RecruiterActivity.builder()
                    .recruiterUserId(recruiterUserId)
                    .candidateUserId(candidateUserId)
                    .eventType(RecruiterActivity.EVENT_ATS_EVALUATED)
                    .description("Evaluated Candidate (ATS)")
                    .jobId(jobId)
                    .jobApplicationId(jobApplicationId)
                    .companyId(companyId)
                    .timestamp(Instant.now())
                    .metadata(sanitize(metadata))
                    .build();
            activityRepository.save(activity);
        } catch (Exception e) {
            log.error("Failed to record recruiter ATS evaluation [recruiter={}, candidate={}]: {}",
                    recruiterUserId, candidateUserId, e.getMessage());
        }
    }

    private boolean isDuplicateProfileView(String recruiterUserId, String candidateUserId) {
        Instant windowStart = Instant.now().minus(PROFILE_VIEW_DEDUP_MINUTES, ChronoUnit.MINUTES);
        return activityRepository
                .findFirstByRecruiterUserIdAndCandidateUserIdAndEventTypeOrderByTimestampDesc(
                        recruiterUserId, candidateUserId,
                        RecruiterActivity.EVENT_VIEWED_PROFILE)
                .map(prev -> prev.getTimestamp() != null && prev.getTimestamp().isAfter(windowStart))
                .orElse(false);
    }

    private Map<String, String> sanitize(Map<String, String> metadata) {
        if (metadata == null) return null;
        Map<String, String> safe = new LinkedHashMap<>();
        metadata.forEach((k, v) -> {
            if (k != null && v != null) {
                // Bound stored metadata; never store secrets here
                safe.put(k, v.length() > 300 ? v.substring(0, 300) : v);
            }
        });
        return safe;
    }

    private String descriptionFor(String eventType) {
        if (eventType == null) return "Interacted With Candidate";
        return switch (eventType) {
            case RecruiterActivity.EVENT_VIEWED_PROFILE -> "Viewed Candidate Profile";
            case RecruiterActivity.EVENT_VIEWED_APPLICATION -> "Reviewed Job Application";
            case RecruiterActivity.EVENT_DOWNLOADED_RESUME -> "Downloaded Resume";
            case RecruiterActivity.EVENT_SHORTLISTED -> "Shortlisted Candidate";
            case RecruiterActivity.EVENT_REJECTED -> "Marked Application Rejected";
            case RecruiterActivity.EVENT_HIRE_REQUESTED -> "Raised Hire Request";
            case RecruiterActivity.EVENT_ATS_EVALUATED -> "Evaluated Candidate (ATS)";
            default -> "Interacted With Candidate";
        };
    }

    // ─────────────────────────────────────────────────
    // Candidate-facing retrieval
    // ─────────────────────────────────────────────────

    /**
     * Recruiter engagement activities recorded against the given candidate,
     * newest first, with recruiter/company/job display fields joined from real
     * records.
     *
     * Only events with a real authenticated recruiter on both sides are listed:
     * candidate-initiated records (e.g. the candidate's own ATS self-check)
     * have no recruiter and would otherwise render as rows with no recruiter
     * name in the "recruiter activity" table. They stay persisted for audit
     * and remain visible in the candidate's own ATS history; they are simply
     * not recruiter engagement and are excluded here (and from the impressions
     * stat, which already requires a recruiter).
     */
    public Map<String, Object> getActivitiesForCandidate(String candidateUserId, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        Page<RecruiterActivity> activities =
                activityRepository.findByCandidateUserIdAndRecruiterUserIdIsNotNullOrderByTimestampDesc(
                        candidateUserId, pageable);

        List<Map<String, Object>> rows = new ArrayList<>();
        if (!activities.isEmpty()) {
            // Batch-load referenced records so deleted documents degrade gracefully
            Set<String> recruiterIds = activities.getContent().stream()
                    .map(RecruiterActivity::getRecruiterUserId)
                    .filter(id -> id != null && !id.isBlank())
                    .collect(Collectors.toSet());
            Map<String, User> recUsers = recruiterIds.isEmpty() ? Map.of()
                    : userRepository.findAllById(recruiterIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));
            Map<String, RecruiterProfile> recProfiles = recruiterIds.isEmpty() ? Map.of()
                    : recruiterProfileRepository.findByUserIdIn(recruiterIds).stream()
                        .collect(Collectors.toMap(RecruiterProfile::getUserId, p -> p));
            Set<String> referencedJobIds = activities.getContent().stream()
                    .map(RecruiterActivity::getJobId)
                    .filter(id -> id != null && !id.isBlank())
                    .collect(Collectors.toSet());
            Map<String, Job> jobs = referencedJobIds.isEmpty() ? Map.of()
                    : jobRepository.findAllById(referencedJobIds).stream()
                        .collect(Collectors.toMap(Job::getId, j -> j));

            for (RecruiterActivity a : activities.getContent()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", a.getId());
                row.put("eventType", a.getEventType());
                row.put("actionType", uiActionType(a.getEventType()));
                row.put("description", a.getDescription());
                row.put("timestamp", a.getTimestamp());

                User recruiterUser = a.getRecruiterUserId() != null
                        ? recUsers.get(a.getRecruiterUserId()) : null;
                RecruiterProfile recProfile = a.getRecruiterUserId() != null
                        ? recProfiles.get(a.getRecruiterUserId()) : null;

                Map<String, Object> recruiter = new LinkedHashMap<>();
                recruiter.put("userId", a.getRecruiterUserId());
                recruiter.put("name", recruiterUser != null ? recruiterUser.getName() : null);
                recruiter.put("initials", recruiterUser != null ? initials(recruiterUser.getName()) : null);
                recruiter.put("designation", recProfile != null ? recProfile.getDesignation() : null);
                if (recProfile != null && recProfile.getCompanyId() != null) {
                    recruiter.put("company", companyRepository.findById(recProfile.getCompanyId())
                            .map(Company::getName).orElse(null));
                } else {
                    recruiter.put("company", null);
                }
                row.put("recruiter", recruiter);

                Job job = a.getJobId() != null ? jobs.get(a.getJobId()) : null;
                row.put("jobTitle", job != null ? job.getTitle() : null);

                // Discovery context: only what was genuinely recorded.
                String searchQuery = a.getMetadata() != null ? a.getMetadata().get("searchQuery") : null;
                if (searchQuery != null && !searchQuery.isBlank()) {
                    row.put("discoverySource", "Found via \"" + searchQuery + "\"");
                } else if (job != null) {
                    row.put("discoverySource", "Applied to \"" + job.getTitle() + "\"");
                } else {
                    row.put("discoverySource", null);
                }

                // Contact is offered only when this candidate was actually released
                // to this specific recruiter (existing HiringRequest workflow).
                boolean contactUnlocked = false;
                String recruiterEmail = null;
                if (a.getRecruiterUserId() != null) {
                    Optional<HiringRequest> released = hiringRequestRepository
                            .findFirstByCandidateUserIdAndRecruiterUserIdAndCandidateReleasedTrueOrderByIdDesc(
                                    candidateUserId, a.getRecruiterUserId());
                    if (released.isPresent()) {
                        contactUnlocked = true;
                        recruiterEmail = recruiterUser != null ? recruiterUser.getEmail() : null;
                    }
                }
                row.put("contactUnlocked", contactUnlocked);
                row.put("recruiterEmail", contactUnlocked ? recruiterEmail : CONTACT_LOCKED_MESSAGE);

                if (a.getMetadata() != null && a.getMetadata().containsKey("score")) {
                    row.put("atsScore", a.getMetadata().get("score"));
                }
                rows.add(row);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", rows);
        result.put("page", activities.getNumber());
        result.put("size", activities.getSize());
        result.put("totalElements", activities.getTotalElements());
        result.put("stats", buildCandidateStats(candidateUserId));
        return result;
    }

    private Map<String, Object> buildCandidateStats(String candidateUserId) {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("impressions",
                activityRepository.countByCandidateUserIdAndRecruiterUserIdIsNotNull(candidateUserId));
        stats.put("resumeDownloads",
                activityRepository.countByCandidateUserIdAndEventType(
                        candidateUserId, RecruiterActivity.EVENT_DOWNLOADED_RESUME));
        stats.put("interviewPipeline",
                activityRepository.countByCandidateUserIdAndEventType(candidateUserId,
                        RecruiterActivity.EVENT_SHORTLISTED)
                        + activityRepository.countByCandidateUserIdAndEventType(
                        candidateUserId, RecruiterActivity.EVENT_HIRE_REQUESTED));
        stats.put("recentVisits",
                activityRepository.countByCandidateUserIdAndRecruiterUserIdIsNotNullAndTimestampAfter(
                        candidateUserId, Instant.now().minus(RECENT_WINDOW_DAYS, ChronoUnit.DAYS)));
        stats.put("companies", countDistinctCompanies(candidateUserId));
        return stats;
    }

    private long countDistinctCompanies(String candidateUserId) {
        try {
            List<String> companyIds = mongoTemplate
                    .getCollection(mongoTemplate.getCollectionName(RecruiterActivity.class))
                    .distinct("companyId",
                            new Document("candidateUserId", candidateUserId)
                                    .append("recruiterUserId", new Document("$ne", null)),
                            String.class)
                    .into(new ArrayList<>());
            return new java.util.HashSet<>(
                    companyIds.stream().filter(c -> c != null && !c.isBlank())
                            .collect(Collectors.toList())).size();
        } catch (Exception e) {
            log.warn("Could not count distinct companies for candidate {}: {}",
                    candidateUserId, e.getMessage());
            return 0;
        }
    }

    // ─────────────────────────────────────────────────
    // Recruiter-facing retrieval (own activity feed)
    // ─────────────────────────────────────────────────

    public Map<String, Object> getActivitiesForRecruiter(String recruiterUserId, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        Page<RecruiterActivity> activities =
                activityRepository.findByRecruiterUserIdOrderByTimestampDesc(recruiterUserId, pageable);

        Set<String> candidateIds = activities.getContent().stream()
                .map(RecruiterActivity::getCandidateUserId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        Map<String, User> candUsers = candidateIds.isEmpty() ? Map.of()
                : userRepository.findAllById(candidateIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u));
        Set<String> referencedJobIds = activities.getContent().stream()
                .map(RecruiterActivity::getJobId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        Map<String, Job> jobs = referencedJobIds.isEmpty() ? Map.of()
                : jobRepository.findAllById(referencedJobIds).stream()
                    .collect(Collectors.toMap(Job::getId, j -> j));

        List<Map<String, Object>> rows = activities.getContent().stream().map(a -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", a.getId());
            row.put("eventType", a.getEventType());
            row.put("actionType", uiActionType(a.getEventType()));
            row.put("description", a.getDescription());
            row.put("timestamp", a.getTimestamp());
            row.put("candidateName",
                    a.getCandidateUserId() != null && candUsers.containsKey(a.getCandidateUserId())
                            ? candUsers.get(a.getCandidateUserId()).getName() : null);
            Job job = a.getJobId() != null ? jobs.get(a.getJobId()) : null;
            row.put("jobTitle", job != null ? job.getTitle() : null);
            Map<String, String> meta = a.getMetadata();
            row.put("searchQuery", meta != null ? meta.get("searchQuery") : null);
            row.put("score", meta != null ? meta.get("score") : null);
            row.put("filename", meta != null ? meta.get("filename") : null);
            return row;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", rows);
        result.put("page", activities.getNumber());
        result.put("size", activities.getSize());
        result.put("totalElements", activities.getTotalElements());
        return result;
    }

    /** Maps stored event types to the badge styles that already exist in the UI. */
    private String uiActionType(String eventType) {
        if (eventType == null) return "save";
        return switch (eventType) {
            case RecruiterActivity.EVENT_DOWNLOADED_RESUME -> "download";
            case RecruiterActivity.EVENT_SHORTLISTED, RecruiterActivity.EVENT_HIRE_REQUESTED -> "shortlist";
            default -> "save";
        };
    }

    private String initials(String name) {
        if (name == null || name.isBlank()) return null;
        String[] parts = name.trim().split("\\s+");
        return parts.length > 1
                ? ("" + parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
                : ("" + parts[0].charAt(0)).toUpperCase();
    }
}
