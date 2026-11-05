package com.euodoo.hire.controller;

import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.PlanType;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.SubscriptionService;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ConstraintViolation;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the role-specific login-page validation implemented in
 * AuthRestController.
 *
 * Covers the required matrix: every role attempted against every login
 * context, plus invalid credentials, unknown context, missing request
 * fields, and the guarantee that incompatible-role attempts never leave
 * an authenticated SecurityContext behind.
 */
@ExtendWith(MockitoExtension.class)
public class AuthRestControllerTest {

    private static final String PASSWORD_PLAIN = "Password@123";
    private static final String PASSWORD_HASH = "$2a$12$hashedvaluefromdatabase.faithfulexample000000000000000000";

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SubscriptionService subscriptionService;

    private AuthRestController controller;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient().when(subscriptionService.getSubscriptionStatus(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(java.util.Map.of("hasSubscription", false, "active", false));
        controller = new AuthRestController(authenticationManager, userRepository, subscriptionService);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User user(Role role, PlanType plan, boolean planActivated) {
        return User.builder()
                .id("u-" + role.name().toLowerCase())
                .name("Test User")
                .email("user@" + role.name().toLowerCase() + ".dev")
                .passwordHash(PASSWORD_HASH)
                .role(role)
                .accountStatus(AccountStatus.ACTIVE)
                .plan(plan)
                .planActivated(planActivated)
                .build();
    }

    private void stubSuccessfulAuthentication(User user) {
        when(authenticationManager.authenticate(any(Authentication.class))).thenAnswer(inv -> {
            Authentication raw = inv.getArgument(0);
            return new UsernamePasswordAuthenticationToken(
                    user.getEmail(),
                    raw.getCredentials(),
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        });
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
    }

    private ResponseEntity<Map<String, Object>> attemptLogin(User user, String loginContext) {
        stubSuccessfulAuthentication(user);
        return controller.login(
                new AuthRestController.LoginRequest(user.getEmail(), PASSWORD_PLAIN, loginContext),
                new MockHttpServletRequest(),
                new MockHttpServletResponse());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> body(ResponseEntity<Map<String, Object>> response) {
        return (Map<String, Object>) response.getBody();
    }

    // ------------------------------------------------------------------
    // Successful role-matched logins
    // ------------------------------------------------------------------

    @Test
    void clientAdmin_logsInThroughAdminLogin() {
        User admin = user(Role.CLIENT_ADMIN, null, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(admin, "admin");

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("/client-admin/dashboard", body(res).get("redirectUrl"));
        assertEquals("CLIENT_ADMIN", ((Map<String, Object>) body(res).get("user")).get("role"));
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void recruiter_logsInThroughRecruiterLogin() {
        User recruiter = user(Role.RECRUITER, null, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(recruiter, "recruiter");

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("/recruiter/dashboard", body(res).get("redirectUrl"));
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void unpaidCandidate_logsInThroughCandidateLogin_andRedirectsToUnpaidDashboard() {
        User candidate = user(Role.CANDIDATE, PlanType.FREE, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(candidate, "candidate");

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("/unpaid-dashboard", body(res).get("redirectUrl"));
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void paidCandidate_logsInThroughCandidateLogin_andRedirectsToPaidDashboard() {
        User candidate = user(Role.CANDIDATE, PlanType.BASIC, true);
        ResponseEntity<Map<String, Object>> res = attemptLogin(candidate, "candidate");

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("/paid-dashboard", body(res).get("redirectUrl"));
    }

    @Test
    void premiumPaidCandidate_logsInThroughCandidateLogin_andRedirectsToPaidDashboard() {
        User candidate = user(Role.CANDIDATE, PlanType.PREMIUM, true);
        ResponseEntity<Map<String, Object>> res = attemptLogin(candidate, "candidate");

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("/paid-dashboard", body(res).get("redirectUrl"));
    }

    // ------------------------------------------------------------------
    // Incompatible-role login attempts (must be rejected, no session)
    // ------------------------------------------------------------------

    @Test
    void candidateCredentials_rejectedOnRecruiterLogin() {
        User candidate = user(Role.CANDIDATE, PlanType.FREE, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(candidate, "recruiter");

        // Privacy: response must be identical to a wrong-password response —
        // no role name, no "correct login page", no account-existence hint.
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertFalse(body(res).containsKey("correctLoginPage"));
        assertFalse(body(res).containsKey("actualRole"));
        // No authenticated session may be left behind.
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void candidateCredentials_rejectedOnAdminLogin() {
        User candidate = user(Role.CANDIDATE, PlanType.FREE, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(candidate, "admin");

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertFalse(body(res).containsKey("correctLoginPage"));
        assertFalse(body(res).containsKey("actualRole"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void recruiterCredentials_rejectedOnCandidateLogin() {
        User recruiter = user(Role.RECRUITER, null, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(recruiter, "candidate");

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertFalse(body(res).containsKey("correctLoginPage"));
        assertFalse(body(res).containsKey("actualRole"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void recruiterCredentials_rejectedOnAdminLogin() {
        User recruiter = user(Role.RECRUITER, null, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(recruiter, "admin");

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void adminCredentials_rejectedOnCandidateLogin() {
        User admin = user(Role.CLIENT_ADMIN, null, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(admin, "candidate");

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertFalse(body(res).containsKey("correctLoginPage"));
        assertFalse(body(res).containsKey("actualRole"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void adminCredentials_rejectedOnRecruiterLogin() {
        User admin = user(Role.CLIENT_ADMIN, null, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(admin, "recruiter");

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void paidCandidateCredentials_rejectedOnRecruiterLogin() {
        User candidate = user(Role.CANDIDATE, PlanType.PREMIUM, true);
        ResponseEntity<Map<String, Object>> res = attemptLogin(candidate, "recruiter");

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    // ------------------------------------------------------------------
    // Invalid credentials and request hygiene
    // ------------------------------------------------------------------

    @Test
    void wrongPassword_rejectedWithGenericMessage() {
        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        ResponseEntity<Map<String, Object>> res = controller.login(
                new AuthRestController.LoginRequest("anyone@dev.dev", "wrong-pass", "candidate"),
                new MockHttpServletRequest(),
                new MockHttpServletResponse());

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void unknownLoginContext_rejected() {
        User candidate = user(Role.CANDIDATE, PlanType.FREE, false);
        stubSuccessfulAuthentication(candidate);

        ResponseEntity<Map<String, Object>> res = controller.login(
                new AuthRestController.LoginRequest(candidate.getEmail(), PASSWORD_PLAIN, "hacker"),
                new MockHttpServletRequest(),
                new MockHttpServletResponse());

        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertEquals("UNKNOWN_LOGIN_CONTEXT", body(res).get("error"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void blankLoginContext_stillAuthenticatesRoleAppropriately() {
        // Backward compatibility: callers not targeting a specific page.
        User candidate = user(Role.CANDIDATE, PlanType.FREE, false);
        ResponseEntity<Map<String, Object>> res = attemptLogin(candidate, " ");

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("/unpaid-dashboard", body(res).get("redirectUrl"));
    }

    @Test
    void loginRequest_missingFields_failBeanValidation() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

        Set<ConstraintViolation<AuthRestController.LoginRequest>> empty =
                validator.validate(new AuthRestController.LoginRequest("   ", "", null));
        Set<String> fields = empty.stream()
                .map(v -> v.getPropertyPath().toString())
                .collect(Collectors.toSet());

        assertTrue(fields.contains("email"), "blank email must fail validation");
        assertTrue(fields.contains("password"), "missing password must fail validation");
    }

    // ------------------------------------------------------------------
    // Session safety on mismatch
    // ------------------------------------------------------------------

    @Test
    void mismatchAttempt_doesNotCreateAnySession() {
        User admin = user(Role.CLIENT_ADMIN, null, false);
        stubSuccessfulAuthentication(admin);

        MockHttpServletRequest request = new MockHttpServletRequest();
        ResponseEntity<Map<String, Object>> res = controller.login(
                new AuthRestController.LoginRequest(admin.getEmail(), PASSWORD_PLAIN, "recruiter"),
                request,
                new MockHttpServletResponse());

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        // Rejection happens before any session/security context is persisted,
        // so no HTTP session (and no stored authentication) may exist.
        assertNull(request.getSession(false));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void existingSession_invalidatedOnRoleMismatch() {
        User candidate = user(Role.CANDIDATE, PlanType.FREE, false);
        stubSuccessfulAuthentication(candidate);

        MockHttpServletRequest request = new MockHttpServletRequest();
        org.springframework.mock.web.MockHttpSession session = (org.springframework.mock.web.MockHttpSession) request.getSession(true);
        assertNotNull(session);
        assertFalse(session.isInvalid());

        ResponseEntity<Map<String, Object>> res = controller.login(
                new AuthRestController.LoginRequest(candidate.getEmail(), PASSWORD_PLAIN, "recruiter"),
                request,
                new MockHttpServletResponse());

        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("INVALID_CREDENTIALS", body(res).get("error"));
        assertEquals(AuthRestController.GENERIC_AUTH_MESSAGE, body(res).get("message"));
        assertTrue(session.isInvalid());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void logout_clearsSecurityContextAndInvalidatesSession() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        org.springframework.mock.web.MockHttpSession session = (org.springframework.mock.web.MockHttpSession) request.getSession(true);
        assertNotNull(session);

        ResponseEntity<Map<String, String>> res = controller.logout(request);

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertTrue(session.isInvalid());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
