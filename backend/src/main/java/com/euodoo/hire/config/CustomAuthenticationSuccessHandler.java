package com.euodoo.hire.config;

import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.PlanType;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Routes authenticated users to the correct dashboard after login.
 *
 * Routing is based on the server-side Role and, for candidates, the
 * server-verified planActivated flag and PlanType. Browser-supplied
 * values are never trusted.
 *
 * Routing table:
 *   CANDIDATE, planActivated=false or FREE → /unpaid-dashboard
 *   CANDIDATE, planActivated=true, BASIC   → /paid-dashboard
 *   CANDIDATE, planActivated=true, PREMIUM → /paid-dashboard
 *   RECRUITER (approved)                   → /recruiter/dashboard
 *   CLIENT_ADMIN                           → /client-admin/dashboard
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CustomAuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final UserRepository userRepository;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication)
            throws IOException, ServletException {

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found in DB: " + email));

        // Double-check account status — should already be enforced by UserDetailsService
        if (user.getAccountStatus() != AccountStatus.ACTIVE) {
            log.warn("Non-ACTIVE user passed authentication check: {} [{}]", email, user.getAccountStatus());
            response.sendRedirect(request.getContextPath() + "/auth/login?error=account_status");
            return;
        }

        String destination = resolveDestination(user, request.getContextPath());
        log.info("Login success: {} [{}] → {}", email, user.getRole(), destination);
        response.sendRedirect(destination);
    }

    private String resolveDestination(User user, String contextPath) {
        return switch (user.getRole()) {
            case CANDIDATE -> resolveCandidateDestination(user, contextPath);
            case RECRUITER -> contextPath + "/recruiter/dashboard";
            case CLIENT_ADMIN, ADMIN, SUPER_ADMIN -> contextPath + "/client-admin/dashboard";
            case AGENCY_ADMIN, AGENCY_STAFF -> contextPath + "/agency/dashboard";
        };
    }

    private String resolveCandidateDestination(User user, String contextPath) {
        boolean hasPaidActivePlan = user.isPlanActivated()
                && (user.getPlan() == PlanType.BASIC || user.getPlan() == PlanType.PREMIUM);
        if (hasPaidActivePlan) {
            return contextPath + "/paid-dashboard";
        }
        return contextPath + "/unpaid-dashboard";
    }
}
