package com.euodoo.hire.service;

import com.euodoo.hire.dto.response.ApplicationTrackingResponse;
import com.euodoo.hire.model.ApplicationTracking;
import com.euodoo.hire.repository.ApplicationTrackingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationTrackingService {

    private final ApplicationTrackingRepository trackingRepository;

    public void recordStatusChange(String submissionId, String previousStatus, String currentStatus,
                                   String updatedByUserId, String updatedByRole, String comments) {
        ApplicationTracking tracking = ApplicationTracking.builder()
                .submissionId(submissionId)
                .previousStatus(previousStatus)
                .currentStatus(currentStatus)
                .updatedByUserId(updatedByUserId)
                .updatedByRole(updatedByRole)
                .comments(comments)
                .timestamp(Instant.now())
                .build();

        trackingRepository.save(tracking);
        log.debug("Recorded tracking for submission {}: {} -> {}", submissionId, previousStatus, currentStatus);
    }

    public List<ApplicationTrackingResponse> getTimeline(String submissionId) {
        return trackingRepository.findBySubmissionIdOrderByTimestampAsc(submissionId).stream()
                .map(t -> ApplicationTrackingResponse.builder()
                        .id(t.getId())
                        .submissionId(t.getSubmissionId())
                        .previousStatus(t.getPreviousStatus())
                        .currentStatus(t.getCurrentStatus())
                        .updatedByUserId(t.getUpdatedByUserId())
                        .updatedByRole(t.getUpdatedByRole())
                        .comments(t.getComments())
                        .timestamp(t.getTimestamp())
                        .build())
                .collect(Collectors.toList());
    }
}
