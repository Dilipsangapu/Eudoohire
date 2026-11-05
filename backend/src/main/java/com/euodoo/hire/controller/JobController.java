package com.euodoo.hire.controller;

import com.euodoo.hire.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.euodoo.hire.model.Job;

/**
 * Job-related REST endpoints accessible to authenticated candidates and recruiters.
 * Role checks are applied per endpoint.
 */
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @GetMapping("/{jobId}")
    @PreAuthorize("hasAnyRole('CANDIDATE', 'RECRUITER', 'CLIENT_ADMIN')")
    public ResponseEntity<Job> getJob(@PathVariable String jobId) {
        return ResponseEntity.ok(jobService.findById(jobId));
    }
}
