package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Portfolio change request submitted by a candidate for admin review.
 *
 * Candidates with PREMIUM plan or above may update certain profile sections
 * without immediate effect. The changes are queued here for CLIENT_ADMIN approval.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "portfolio_change_requests")
public class PortfolioChangeRequest {

    @Id
    private String id;

    @Indexed
    private String candidateUserId;

    /** Short human-readable summary of the submitted change (e.g. portfolio title). */
    private String title;

    /**
     * JSON-serialized representation of the proposed portfolio projects.
     * This is the submitted-but-not-yet-approved version.
     */
    private String proposedChangesJson;

    /**
     * Snapshot of the previously approved portfolio (JSON) that this request
     * would replace. Kept so the reviewer can diff and so a rejected request
     * leaves the approved portfolio untouched.
     */
    private String previousChangesJson;

    @Builder.Default
    private ChangeRequestStatus status = ChangeRequestStatus.PENDING;

    /** CLIENT_ADMIN who reviewed this request. */
    private String reviewedByAdminId;

    private String reviewNote;

    @CreatedDate
    private Instant createdAt;

    private Instant reviewedAt;
}
