package com.euodoo.hire.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;


@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "candidate_profiles")
public class CandidateProfile {

    @Id
    private String id;

    /** Reference to the User document. */
    @Indexed(unique = true)
    private String userId;

    // --- Personal and contact information ---
    private String phone;
    private String location;
    private String headline;
    private String bio;

    // --- Professional details ---
    @Builder.Default
    private List<String> skills = new ArrayList<>();
    private String currentDesignation;
    private String currentCompany;
    private int totalExperienceYears;
    private int noticePeriodDays;

    /** Expected annual salary in INR. Stored as long to avoid float issues. */
    private long expectedAnnualSalaryInr;

    @Builder.Default
    private List<ExperienceEntry> experiences = new ArrayList<>();

    // --- Resume ---
    /** Internal Cloudinary storage ID — never exposed in API responses. */
    @JsonIgnore
    private String resumeCloudinaryPublicId;
    private String resumeOriginalFilename;
    private String resumeMimeType;
    private long resumeFileSizeBytes;
    private Instant resumeUploadedAt;

    /**
     * Approval status of the most recently uploaded resume.
     * Set to PENDING on upload; updated to APPROVED or REJECTED after admin review.
     * Null if no resume has ever been uploaded.
     */
    private ChangeRequestStatus resumeApprovalStatus;

    // --- Profile picture ---
    /** Internal Cloudinary storage ID — never exposed in API responses. */
    @JsonIgnore
    private String profilePictureCloudinaryPublicId;
    private String profilePictureUrl;
    private Instant profilePictureUploadedAt;

    // --- Portfolio ---
    @Builder.Default
    private List<PortfolioProject> portfolioProjects = new ArrayList<>();

    // --- Visibility and approval ---
    /**
     * Controls recruiter visibility. Only approved profiles appear in searches.
     * Recruiters cannot view contact details until releasedToRecruiterId is set.
     */
    @Builder.Default
    private ApprovalStatus profileApprovalStatus = ApprovalStatus.PENDING;

    /** Set to true by candidate to opt into search listings. */
    @Builder.Default
    private boolean visibleToRecruiters = false;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    // --- Nested value types ---

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExperienceEntry {
        private String company;
        private String designation;
        private String description;
        private String startMonth; // e.g. "2021-03"
        private String endMonth;   // null if current
        private boolean current;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PortfolioProject {
        private String title;
        private String description;
        private String projectUrl;
        private String repoUrl;
        @Builder.Default
        private List<String> techStack = new ArrayList<>();
    }
}
