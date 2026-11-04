package com.euodoo.hire.controller;

import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.HireMatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Hire match details endpoint used by the notification click handlers.
 *
 * Any authenticated role (candidate, recruiter, client admin) may query, but
 * HireMatchService verifies the caller is actually part of that hire match.
 * Returns 404 when the record does not exist and 403 when the user is not
 * authorized — handled by GlobalExceptionHandler.
 */
@RestController
@RequestMapping("/api/hire-matches")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("isAuthenticated()")
public class HireMatchController {

    private final HireMatchService hireMatchService;
    private final UserRepository userRepository;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getHireMatchDetails(
            @PathVariable String id,
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        boolean isClientAdmin = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority() != null
                        && a.getAuthority().toUpperCase().contains("CLIENT_ADMIN"));
        return ResponseEntity.ok(hireMatchService.getHireMatchDetails(id, userId, isClientAdmin));
    }

    private String resolveUserId(UserDetails principal) {
        if (principal == null || principal.getUsername() == null) {
            throw new ResourceNotFoundException("User", "unauthenticated");
        }
        User user = userRepository.findByEmail(principal.getUsername().trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User", principal.getUsername()));
        return user.getId();
    }
}