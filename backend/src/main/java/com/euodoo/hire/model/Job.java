package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Job listing posted by a recruiter or admin.
 *
 * Company and recruiter references are stored for fast filtered queries.
 * Indexes support search by company, status, location and work mode.
 *
 * Audit trail: creatorUserId / creatorRole capture who originally posted the job.
 * lastModifiedByUserId / lastModifiedByRole are updated on every edit.
 * The original creator is NEVER overwritten during edits.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "jobs")
@CompoundIndexes({
    @CompoundIndex(name = "company_status_idx", def = "{'companyId': 1, 'status': 1}"),
    @CompoundIndex(name = "location_workMode_idx", def = "{'location': 1, 'workMode': 1}"),
    @CompoundIndex(name = "status_createdAt_idx", def = "{'status': 1, 'createdAt': -1}")
})
public class Job {

    @Id
    private String id;

    @NotBlank
    private String title;

    @NotBlank
    private String description;

    private String responsibilities;

    /** Reference to Company document. */
    @Indexed
    private String companyId;

    /** Reference to Agency document when job was created by an agency. */
    @Indexed
    private String agencyId;

    /** Reference to AgencyClient document for the client company this job is for. */
    @Indexed
    private String clientCompanyId;

    /** Reference to User (recruiter) document. Preserved for ownership checks. */
    @Indexed
    private String recruiterUserId;

    // ─── Audit ─────────────────────────────────────────
    /**
     * User ID of the account that originally created this job (Recruiter or Admin).
     * Never overwritten during edits.
     */
    private String creatorUserId;

    /**
     * Role of the original creator ("RECRUITER" or "CLIENT_ADMIN").
     * Never overwritten during edits.
     */
    private String creatorRole;

    /** User ID of the last account that modified this job. Updated on every save. */
    private String lastModifiedByUserId;

    /** Role of the last modifier. */
    private String lastModifiedByRole;

    // ─── Location / work details ────────────────────────
    private String location;

    private String country;

    private String city;

    /** ISO currency code the min/max salary values are expressed in (INR, USD, ...). */
    @Builder.Default
    private String salaryCurrency = "INR";

    @NotNull
    @Builder.Default
    private WorkMode workMode = WorkMode.WFO;

    @Builder.Default
    private List<String> techStack = new ArrayList<>();

    @Builder.Default
    private List<String> preferredSkills = new ArrayList<>();

    private int minExperienceYears;
    private int maxExperienceYears;

    /** Minimum annual salary in INR. Stored as long. */
    private long minSalaryInr;

    /** Maximum annual salary in INR. Stored as long. */
    private long maxSalaryInr;

    private String employmentType;

    private String educationRequirements;

    @Builder.Default
    private List<String> certifications = new ArrayList<>();

    private Integer numberOfVacancies;

    private Instant applicationDeadline;

    private String additionalRequirements;

    // ─── Status ─────────────────────────────────────────
    @NotNull
    @Builder.Default
    private JobStatus status = JobStatus.DRAFT;

    private Instant publishedAt;
    private Instant deactivatedAt;
    private Instant closedAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
