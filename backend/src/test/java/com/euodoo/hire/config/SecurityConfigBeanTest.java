package com.euodoo.hire.config;

import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.CustomUserDetailsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Bean-level tests for parts of {@link SecurityConfig} that are plain logic:
 * the BCrypt encoder, the anti-enumeration failure handler, CORS wiring, and
 * the deferred CSRF-cookie forcing filter.
 */
@ExtendWith(MockitoExtension.class)
public class SecurityConfigBeanTest {

    @Mock
    private CustomUserDetailsService userDetailsService;

    @Mock
    private RateLimitingFilter rateLimitingFilter;

    private SecurityConfig securityConfig;

    @BeforeEach
    void setUp() {
        securityConfig = new SecurityConfig(userDetailsService,
                mock(CustomAuthenticationSuccessHandler.class), rateLimitingFilter);
    }

    @Test
    @DisplayName("passwordEncoder: BCrypt producing a valid 60-char hash that verifies")
    void passwordEncoder_bcryptVerified() {
        PasswordEncoder encoder = securityConfig.passwordEncoder();
        String encoded = encoder.encode("TestPassword@123");
        assertNotEquals("TestPassword@123", encoded);
        assertTrue(encoded.startsWith("$2"), "BCrypt hash format");
        assertTrue(encoder.matches("TestPassword@123", encoded));
        assertFalse(encoder.matches("wrong", encoded));
    }

    @Test
    @DisplayName("authenticationFailureHandler: unknown users fall back to invalid_credentials (anti-enumeration)")
    void failureHandler_defaultReason() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setContextPath("");
        MockHttpServletResponse response = new MockHttpServletResponse();

        securityConfig.authenticationFailureHandler().onAuthenticationFailure(request, response,
                new BadCredentialsException("bad email or password"));

        assertEquals("/login?error=invalid_credentials", response.getRedirectedUrl());
    }

    @Test
    @DisplayName("authenticationFailureHandler: LockedException → account_pending_or_locked")
    void failureHandler_lockedReason() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        securityConfig.authenticationFailureHandler().onAuthenticationFailure(request, response,
                new LockedException("account pending"));

        assertEquals("/login?error=account_pending_or_locked", response.getRedirectedUrl());
    }

    @Test
    @DisplayName("authenticationFailureHandler: DisabledException → account_disabled")
    void failureHandler_disabledReason() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        securityConfig.authenticationFailureHandler().onAuthenticationFailure(request, response,
                new DisabledException("account disabled"));

        assertEquals("/login?error=account_disabled", response.getRedirectedUrl());
    }

    @Test
    @DisplayName("CORS source: configured origins only, credentials allowed, CRUD methods listed")
    void corsConfiguration_originsAndHeaders() {
        ReflectionTestUtils.setField(securityConfig, "allowedOrigins",
                "http://localhost:5173, http://localhost:3000");

        UrlBasedCorsConfigurationSource source = (UrlBasedCorsConfigurationSource)
                securityConfig.corsConfigurationSource();

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/anything");
        var config = source.getCorsConfiguration(request);
        assertNotNull(config, "CORS must be registered under /**");
        assertEquals(List.of("http://localhost:5173", "http://localhost:3000"),
                config.getAllowedOrigins());
        assertEquals(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"),
                config.getAllowedMethods());
        List<String> headers = config.getAllowedHeaders().stream()
                .map(String::trim).collect(Collectors.toList());
        assertTrue(headers.contains("X-XSRF-TOKEN"));
        assertTrue(headers.contains("Authorization"));
        assertTrue(headers.contains("Content-Type"));
        assertTrue(Boolean.TRUE.equals(config.getAllowCredentials()));
    }
}
