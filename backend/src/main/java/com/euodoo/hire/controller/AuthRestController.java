package com.euodoo.hire.controller;

import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.PlanType;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.SubscriptionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * REST controller for authentication endpoints consumed by the React single-page application.
 * Manages session-based authentication conforming to existing Spring Security configuration.
 *
 * Login pages are role-specific. Every login request carries a `loginContext`
 * ("candidate" | "recruiter" | "admin") identifying WHICH login page submitted
 * the credentials. The account role (from MongoDB, never from the browser) is
 * validated against that context BEFORE any authenticated session is created.
 * Incompatible-role attempts are rejected with no session established and no
 * security context saved.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@Validated
public class AuthRestController {

    /**
     * The one user-facing message for every failed attempt to sign in through
     * one of the role-specific login pages (wrong email, wrong password,
     * credentials belonging to another role, incompatible login context).
     * It deliberately reveals nothing about whether an email exists or which
     * role it belongs to. Detailed role/context diagnostics stay in server
     * logs only.
     */
    static final String GENERIC_AUTH_MESSAGE =
            "Invalid credentials. Please check your details and try again.";

    /**
     * Login-page context → the only role allowed to authenticate through it.
     * These are the backend identities of the three existing login pages;
     * they are NOT derived from frontend-supplied role values.
     */
    static final Map<String, Role> LOGIN_CONTEXT_ROLES = Map.of(
            "candidate", Role.CANDIDATE,
            "recruiter", Role.RECRUITER,
            "admin", Role.CLIENT_ADMIN,
            "agency", Role.AGENCY_ADMIN
    );

    /** Context → the only role allowed to authenticate through it. */

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final SubscriptionService subscriptionService;
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

    /**
     * Authenticates a user with email and password via Spring Security's AuthenticationManager,
     * creates an authenticated HTTP session, and returns safe user details and dashboard route.
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody @Validated LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email().trim().toLowerCase(), request.password())
            );

            User user = userRepository.findByEmail(auth.getName())
                    .orElseThrow(() -> new ResourceNotFoundException("User", auth.getName()));

            if (user.getAccountStatus() != AccountStatus.ACTIVE) {
                SecurityContextHolder.clearContext();
                HttpSession session = httpRequest.getSession(false);
                if (session != null) {
                    session.invalidate();
                }
                log.warn("Login rejected for user with status {}: {}", user.getAccountStatus(), user.getEmail());
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "error", "ACCOUNT_NOT_ACTIVE",
                        "message", "Your account is " + user.getAccountStatus() + ". An administrator must approve it before you can log in.",
                        "status", user.getAccountStatus().name()
                ));
            }

            // --- Role-specific login-page validation -------------------------
            // Credentials may be correct, but the account must also be authorized
            // to use the login page that submitted them. This runs BEFORE any
            // session or security context is established, so an incompatible-role
            // attempt never leaves partially authenticated state behind.
            ResponseEntity<Map<String, Object>> mismatch = rejectIfLoginContextMismatch(user, request.loginContext(), httpRequest);
            if (mismatch != null) {
                return mismatch;
            }

            // Session fixation & account switching protection: clean any previous session before binding new credentials
            HttpSession existingSession = httpRequest.getSession(false);
            if (existingSession != null) {
                existingSession.invalidate();
            }

            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);
            securityContextRepository.saveContext(context, httpRequest, httpResponse);

            String destination = resolveDestination(user);
            log.info("API login success: {} [{}] -> {}", user.getEmail(), user.getRole(), destination);

            if (user.getRole() == Role.CANDIDATE) {
                subscriptionService.reconcileCandidateAccessIfExpired(user.getId());
                user = userRepository.findById(user.getId()).orElse(user);
            }

            Map<String, Object> subStatus = subscriptionService.getSubscriptionStatus(user.getId());
            if (user.getRole() == Role.CANDIDATE && !Boolean.TRUE.equals(subStatus.get("active"))) {
                user = userRepository.findById(user.getId()).orElse(user);
            }

            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("name", user.getName());
            userData.put("email", user.getEmail());
            userData.put("role", user.getRole().name());
            userData.put("agencyId", user.getAgencyId());
            userData.put("plan", user.getPlan() != null ? user.getPlan().name() : "FREE");
            userData.put("planActivated", user.isPlanActivated());
            userData.put("accountStatus", user.getAccountStatus().name());

            userData.put("subscriptionActive", subStatus.get("active"));
            userData.put("subscriptionPlan", subStatus.get("planName"));
            userData.put("subscriptionExpiresAt", subStatus.get("expiresAt"));

            return ResponseEntity.ok(Map.of(
                    "message", "Login successful.",
                    "user", userData,
                    "redirectUrl", destination
            ));
        } catch (BadCredentialsException e) {
            SecurityContextHolder.clearContext();
            HttpSession session = httpRequest.getSession(false);
            if (session != null) session.invalidate();
            log.warn("API login failed (invalid credentials) for email: {}", request.email());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "INVALID_CREDENTIALS",
                    "message", GENERIC_AUTH_MESSAGE
            ));
        } catch (LockedException e) {
            SecurityContextHolder.clearContext();
            HttpSession session = httpRequest.getSession(false);
            if (session != null) session.invalidate();
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "ACCOUNT_LOCKED",
                    "message", "Account is locked or pending approval."
            ));
        } catch (DisabledException e) {
            SecurityContextHolder.clearContext();
            HttpSession session = httpRequest.getSession(false);
            if (session != null) session.invalidate();
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "ACCOUNT_DISABLED",
                    "message", "Account has been disabled."
            ));
        }
    }

    /**
     * Returns the currently authenticated user's session profile.
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(@AuthenticationPrincipal UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "authenticated", false,
                    "message", "Not authenticated"
            ));
        }

        User user = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User", principal.getUsername()));

        if (user.getRole() == Role.CANDIDATE) {
            subscriptionService.reconcileCandidateAccessIfExpired(user.getId());
            user = userRepository.findById(user.getId()).orElse(user);
        }

        Map<String, Object> subStatus = subscriptionService.getSubscriptionStatus(user.getId());
        if (user.getRole() == Role.CANDIDATE && !Boolean.TRUE.equals(subStatus.get("active"))) {
            user = userRepository.findById(user.getId()).orElse(user);
        }

        Map<String, Object> userData = new HashMap<>();
        userData.put("id", user.getId());
        userData.put("name", user.getName());
        userData.put("email", user.getEmail());
        userData.put("role", user.getRole().name());
        userData.put("agencyId", user.getAgencyId());
        userData.put("plan", user.getPlan() != null ? user.getPlan().name() : "FREE");
        userData.put("planActivated", user.isPlanActivated());
        userData.put("accountStatus", user.getAccountStatus().name());

        userData.put("subscriptionActive", subStatus.get("active"));
        userData.put("subscriptionPlan", subStatus.get("planName"));
        userData.put("subscriptionExpiresAt", subStatus.get("expiresAt"));

        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "user", userData,
                "redirectUrl", resolveDestination(user)
        ));
    }

    /**
     * Terminates the current HTTP session.
     */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok(Map.of("message", "Logged out successfully."));
    }

    /**
     * Exposes the current CSRF token to SPA clients.
     */
    @GetMapping("/csrf")
    public ResponseEntity<Map<String, String>> getCsrfToken(HttpServletRequest request) {
        CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        return ResponseEntity.ok(Map.of(
                "token", token != null ? token.getToken() : "",
                "headerName", token != null ? token.getHeaderName() : "X-XSRF-TOKEN",
                "parameterName", token != null ? token.getParameterName() : "_csrf"
        ));
    }

    private String resolveDestination(User user) {
        return switch (user.getRole()) {
            case CANDIDATE -> {
                boolean hasPaidActivePlan = user.isPlanActivated()
                        && (user.getPlan() == PlanType.BASIC || user.getPlan() == PlanType.PREMIUM);
                yield hasPaidActivePlan ? "/paid-dashboard" : "/unpaid-dashboard";
            }
            case RECRUITER -> "/recruiter/dashboard";
            case CLIENT_ADMIN, ADMIN, SUPER_ADMIN -> "/client-admin/dashboard";
            case AGENCY_ADMIN, AGENCY_STAFF -> "/agency/dashboard";
        };
    }

    /**
     * Validates that the account role (from MongoDB) matches the login page that
     * submitted the credentials. Returns a 403 response body if incompatible,
     * or {@code null} if the attempt may proceed.
     *
     * A null/blank login context is only tolerated for backward compatibility
     * with clients that do not target a specific page; all role-specific login
     * pages always send an explicit context.
     */
    private ResponseEntity<Map<String, Object>> rejectIfLoginContextMismatch(User user, String loginContext, HttpServletRequest httpRequest) {
        if (loginContext == null || loginContext.isBlank()) {
            return null;
        }

        String normalizedContext = loginContext.trim().toLowerCase();
        if (!isKnownLoginContext(normalizedContext)) {
            SecurityContextHolder.clearContext();
            HttpSession session = httpRequest != null ? httpRequest.getSession(false) : null;
            if (session != null) session.invalidate();
            log.warn("Login rejected: unknown login context '{}' for {}", normalizedContext, user.getEmail());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "UNKNOWN_LOGIN_CONTEXT",
                    "message", "The login page context is unrecognized. Please use one of the portal login pages."
            ));
        }

        if (!isRolePermittedForContext(user.getRole(), normalizedContext)) {
            SecurityContextHolder.clearContext();
            HttpSession session = httpRequest != null ? httpRequest.getSession(false) : null;
            if (session != null) session.invalidate();
            // Privacy: the response is byte-for-byte identical to the wrong-password
            // response. Only the server-side log records the real role/context details.
            log.warn("Login rejected: role-context mismatch. Database role={} attempted login context '{}' (email={})",
                    user.getRole(), normalizedContext, user.getEmail());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "INVALID_CREDENTIALS",
                    "message", GENERIC_AUTH_MESSAGE
            ));
        }
        return null;
    }

    private boolean isKnownLoginContext(String context) {
        return "candidate".equals(context) || "recruiter".equals(context)
                || "admin".equals(context) || "agency".equals(context);
    }

    private boolean isRolePermittedForContext(Role role, String context) {
        return switch (context) {
            case "candidate" -> role == Role.CANDIDATE;
            case "recruiter" -> role == Role.RECRUITER;
            case "admin" -> role == Role.CLIENT_ADMIN || role == Role.ADMIN || role == Role.SUPER_ADMIN;
            case "agency" -> role == Role.AGENCY_ADMIN || role == Role.AGENCY_STAFF;
            default -> false;
        };
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password,
            String loginContext
    ) {}
}
