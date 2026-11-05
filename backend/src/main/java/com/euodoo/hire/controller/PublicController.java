package com.euodoo.hire.controller;

import com.euodoo.hire.model.Company;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.repository.CompanyRepository;
import com.euodoo.hire.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Publicly accessible controller.
 *
 * The React SPA (Vite build) is served by Spring Boot's static resource handler
 * from classpath:/static/. The SPA handles client-side routing for all React routes.
 * We forward React routes to /index.html so the browser loads the SPA bundle.
 *
 * Thymeleaf routes (/recruiter/**, /client-admin/**, /admin/**) are handled
 * by their own dedicated controllers and are NOT forwarded here.
 */
@Controller
@RequiredArgsConstructor
public class PublicController {

    private final JobService jobService;
    private final CompanyRepository companyRepository;

    /**
     * Serve the React SPA for the root and known React client-side routes.
     * Spring Boot's static resource handler will resolve /index.html from
     * the dist output copied to src/main/resources/static/index.html.
     */
    @GetMapping({
        "/",
        "/login",
        "/register",
        "/dashboard",
        "/paid-dashboard",
        "/unpaid-dashboard",
        "/paid-dashboard/**",
        "/unpaid-dashboard/**",
        "/forgot-password",
        "/recruiter-login",
        "/recruiter-register",
        "/recruiter-forgot-password",
        "/admin-page",
        "/public"
    })
    public String spaForward() {
        return "forward:/index.html";
    }

    /**
     * Public job listing API (limited preview, no contact details).
     * GET /api/public/jobs?page=0&size=10
     *
     * Rows keep the page envelope the SPA expects and additionally carry the
     * job's REAL company name resolved from the companies collection, so the
     * landing page never needs a fabricated company name.
     */
    @GetMapping("/api/public/jobs")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> publicJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        int safeSize = Math.min(size, 20);
        Page<Job> result = jobService.findActiveJobs(page, safeSize);

        Set<String> companyIds = new LinkedHashSet<>();
        for (Job job : result.getContent()) {
            if (job.getCompanyId() != null && !job.getCompanyId().isBlank()) {
                companyIds.add(job.getCompanyId());
            }
        }
        Map<String, String> companyNameById = new HashMap<>();
        if (!companyIds.isEmpty()) {
            for (Company c : companyRepository.findAllById(companyIds)) {
                companyNameById.put(c.getId(), c.getName());
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Job job : result.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", job.getId());
            row.put("title", job.getTitle());
            row.put("company", job.getCompanyId() != null
                    ? companyNameById.get(job.getCompanyId()) : null);
            row.put("location", job.getLocation());
            row.put("workMode", job.getWorkMode() != null ? job.getWorkMode().name() : null);
            row.put("minSalaryInr", job.getMinSalaryInr());
            row.put("maxSalaryInr", job.getMaxSalaryInr());
            row.put("minExperienceYears", job.getMinExperienceYears());
            row.put("maxExperienceYears", job.getMaxExperienceYears());
            row.put("techStack", job.getTechStack());
            row.put("description", job.getDescription());
            row.put("createdAt", job.getCreatedAt());
            rows.add(row);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("content", rows);
        payload.put("page", result.getNumber());
        payload.put("size", result.getSize());
        payload.put("totalElements", result.getTotalElements());
        return ResponseEntity.ok(payload);
    }
}
