package com.euodoo.hire.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationTrackingResponse {

    private String id;
    private String submissionId;
    private String previousStatus;
    private String currentStatus;
    private String updatedByUserId;
    private String updatedByRole;
    private String comments;
    private Instant timestamp;
}
