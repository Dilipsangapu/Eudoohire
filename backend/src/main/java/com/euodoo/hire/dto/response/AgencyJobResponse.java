package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.EmploymentType;
import com.euodoo.hire.model.JobStatus;
import com.euodoo.hire.model.WorkMode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyJobResponse {

    private String id;
    private String title;
    private String description;
    private String responsibilities;
    private String additionalRequirements;
    private String agencyId;
    private String clientCompanyId;
    private String clientCompanyName;
    private String location;
    private String country;
    private String city;
    private WorkMode workMode;
    private EmploymentType employmentType;
    private List<String> techStack;
    private List<String> preferredSkills;
    private int minExperienceYears;
    private int maxExperienceYears;
    private long minSalaryInr;
    private long maxSalaryInr;
    private String educationRequirements;
    private Integer numberOfVacancies;
    private Instant applicationDeadline;
    private JobStatus status;
    private long candidateCount;
    private long submissionCount;
    private long placementCount;
    private Instant createdAt;
    private Instant updatedAt;
}
