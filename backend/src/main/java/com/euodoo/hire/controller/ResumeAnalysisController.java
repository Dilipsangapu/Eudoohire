package com.euodoo.hire.controller;

import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.RecruiterActivityService;
import com.euodoo.hire.service.ResumeAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * REST endpoint for ATS resume analysis requested by Paid and UnPaid candidate dashboards.
 *
 * The platform's ATS evaluation is a candidate self-service action (there is no
 * recruiter-triggered evaluation yet), so the recorded event is attributed to
 * the candidate with the actual score the evaluation produced. Unauthenticated
 * calls are still permitted by config but produce no activity record.
 */
@RestController
@RequestMapping("/api/resume")
@RequiredArgsConstructor
public class ResumeAnalysisController {

    private final ResumeAnalysisService resumeAnalysisService;
    private final UserRepository userRepository;
    private final RecruiterActivityService recruiterActivityService;

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> analyzeResumeFile(
            @RequestParam(value = "resume", required = false) MultipartFile resumeFile,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "text", required = false) String text,
            @AuthenticationPrincipal UserDetails principal) {
        MultipartFile targetFile = resumeFile != null ? resumeFile : file;
        Map<String, Object> result = resumeAnalysisService.analyze(targetFile, text);
        recordEvaluation(principal, result,
                targetFile != null ? targetFile.getOriginalFilename() : null);
        return ResponseEntity.ok(result);
    }

    @PostMapping(value = "/analyze", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> analyzeResumeText(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        String text = body != null ? body.get("text") : "";
        Map<String, Object> result = resumeAnalysisService.analyze(null, text);
        recordEvaluation(principal, result, null);
        return ResponseEntity.ok(result);
    }

    /**
     * Persists the evaluation with the real returned score after the analysis
     * succeeded. Never throws — recording must not break the analysis response.
     */
    private void recordEvaluation(UserDetails principal, Map<String, Object> result,
                                  String filename) {
        try {
            if (principal == null || principal.getUsername() == null) {
                return;
            }
            String userId = userRepository
                    .findByEmail(principal.getUsername().trim().toLowerCase())
                    .map(User::getId)
                    .orElse(null);
            if (userId != null) {
                recruiterActivityService.recordAtsEvaluation(userId, result.get("score"), filename);
            }
        } catch (Exception ignored) {
            // Recording must never break the analysis response
        }
    }
}
