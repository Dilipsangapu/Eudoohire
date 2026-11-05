package com.euodoo.hire.controller;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.User;
import com.euodoo.hire.service.AuthService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Handles candidate and recruiter self-registration endpoints.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@Validated
public class RegistrationController {

    private final AuthService authService;

    /**
     * Register a new candidate account.
     *
     * POST /api/auth/register/candidate
     * Body: { "name": "...", "email": "...", "password": "..." }
     *
     * Response: 201 Created with user ID and email.
     * Status: PENDING_APPROVAL — account must be approved by admin before login.
     */
    @PostMapping("/register/candidate")
    public ResponseEntity<Map<String, Object>> registerCandidate(
            @RequestBody @Validated RegistrationRequest request) {
        User user = authService.registerCandidate(
                request.name(), request.email(), request.password(),
                request.phone(), request.location(), request.jobTitle(),
                request.totalExperienceYears(), request.skills());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Candidate registration successful. Your account is pending admin approval.",
                "userId", user.getId(),
                "email", user.getEmail(),
                "status", user.getAccountStatus().name()
        ));
    }

    /**
     * Register a new recruiter account.
     *
     * POST /api/auth/register/recruiter
     * Body: { "name": "...", "email": "...", "password": "...", "designation": "...", "phone": "..." }
     */
    @PostMapping("/register/recruiter")
    public ResponseEntity<Map<String, Object>> registerRecruiter(
            @RequestBody RecruiterRegistrationRequest request) {
        String email = request.workEmail() != null && !request.workEmail().isBlank()
                ? request.workEmail().trim() : (request.email() != null ? request.email().trim() : null);
        if (email == null || email.isBlank()) {
            throw new BusinessException("INVALID_EMAIL", "Work email or email is required.");
        }
        String name = request.name() != null && !request.name().isBlank()
                ? request.name().trim()
                : (request.companyName() != null && !request.companyName().isBlank()
                        ? request.companyName().trim() + " Recruiter" : "Recruiter");
        String password = request.password() != null && !request.password().isBlank()
                ? request.password() : "Recruiter@" + (int) (Math.random() * 9000 + 1000);
        String designation = request.designation() != null && !request.designation().isBlank()
                ? request.designation().trim() : "Recruiter";

        User user = authService.registerRecruiter(
                name, email, password,
                designation, request.department(), request.phone());

        // Create or link company if companyName provided
        if (request.companyName() != null && !request.companyName().isBlank()) {
            authService.linkRecruiterCompany(user.getId(), request.companyName(),
                    request.website(), request.companyType(), request.companySize(), request.cin());
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Recruiter registration successful. Awaiting company and account approval.",
                "userId", user.getId(),
                "email", user.getEmail(),
                "status", user.getAccountStatus().name()
        ));
    }

    /**
     * POST /api/auth/forgot-password
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @RequestBody Map<String, String> body) {
        String email = body != null ? body.get("email") : null;
        if (email != null && !email.isBlank()) {
            authService.requestPasswordReset(email.trim());
        }
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "If an account exists with this email address, password reset instructions have been dispatched."
        ));
    }

    // --- Request records (no DTO package — defined as nested records) ---

    public record RegistrationRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 128) String password,
            String phone,
            String location,
            String qualification,
            String college,
            String passoutYear,
            String designation,
            Integer totalExperienceYears,
            String jobTitle,
            java.util.List<String> skills,
            java.util.List<String> certifications
    ) {
        public RegistrationRequest(String name, String email, String password) {
            this(name, email, password, null, null, null, null, null, null, null, null, null, null);
        }
    }

    public record RecruiterRegistrationRequest(
            String name,
            String email,
            String workEmail,
            String password,
            String designation,
            String department,
            String phone,
            String companyName,
            String companyType,
            String companySize,
            String website,
            String cin
    ) {
        public RecruiterRegistrationRequest(String name, String email, String password, String designation, String phone) {
            this(name, email, email, password, designation, null, phone, null, null, null, null, null);
        }
    }
}
