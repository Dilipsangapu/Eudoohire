package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.EmploymentType;
import com.euodoo.hire.model.WorkMode;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyJobRequest {

    @NotBlank(message = "Job title is required")
    private String title;

    @NotBlank(message = "Job description is required")
    private String description;

    @NotBlank(message = "Client company ID is required")
    private String clientCompanyId;

    private String responsibilities;

    private String additionalRequirements;

    private String location;

    private String country;

    private String city;

    @Builder.Default
    private WorkMode workMode = WorkMode.WFO;

    @Builder.Default
    private EmploymentType employmentType = EmploymentType.FULL_TIME;

    @Builder.Default
    private List<String> techStack = new ArrayList<>();

    @Builder.Default
    private List<String> preferredSkills = new ArrayList<>();

    private int minExperienceYears;

    private int maxExperienceYears;

    private long minSalaryInr;

    private long maxSalaryInr;

    private String educationRequirements;

    private Integer numberOfVacancies;

    private Instant applicationDeadline;
}
