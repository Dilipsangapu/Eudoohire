package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Company registered in the platform.
 *
 * A company must be approved before its recruiters can access recruiter features.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "companies")
public class Company {

    @Id
    private String id;

    @NotBlank
    private String name;

    private String description;
    private String website;
    private String industry;
    private String companyType;
    private String companySize;
    private String cin;
    private String headquarters;

    // --- Contact ---
    private String contactEmail;
    private String contactPhone;

    // --- Verification and approval ---
    @Builder.Default
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    private String reviewedByAdminId;
    private String rejectionReason;
    private Instant approvedAt;

    /** User IDs of recruiters authorized to manage this company's jobs. */
    @Builder.Default
    private List<String> authorizedRecruiterIds = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
