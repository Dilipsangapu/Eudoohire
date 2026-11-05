package com.euodoo.hire.config;

import com.euodoo.hire.service.CustomUserDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.session.HttpSessionEventPublisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Spring Security configuration.
 *
 * Key decisions:
 * - CSRF is enabled for all browser endpoints.
 * - Session fixation protection is enabled (default: migrateSession).
 * - Passwords are hashed with BCrypt (strength 12).
 * - Role-based access control is enforced at the URL and method levels.
 * - API endpoints under /api/** return JSON 401/403, not HTML redirects.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://eudoohire.vercel.app}")
    private String allowedOrigins;

    private final CustomUserDetailsService userDetailsService;
    private final CustomAuthenticationSuccessHandler successHandler;
    private final RateLimitingFilter rateLimitingFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        provider.setHideUserNotFoundExceptions(true); // Prevent user enumeration
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN", "X-CSRF-TOKEN", "Accept", "Origin", "X-Requested-With"));
        configuration.setExposedHeaders(List.of("X-XSRF-TOKEN", "Set-Cookie"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        CsrfTokenRequestAttributeHandler csrfRequestHandler = new CsrfTokenRequestAttributeHandler();
        // Null request attribute name tells Spring Security to use the raw token without XOR BREACH masking
        // so that standard SPAs sending the raw cookie value in X-XSRF-TOKEN succeed.
        csrfRequestHandler.setCsrfRequestAttributeName(null);

        http
            // --- CORS ---
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // --- Rate Limiting ---
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)

            // --- CSRF ---
            // CsrfCookieFilter ensures XSRF-TOKEN cookie is populated on responses for SPAs.
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(csrfRequestHandler)
                // ATS evaluate is a fetch-based POST from the candidate React dashboards
                // (same SPA pattern the recruiter/notifications APIs already follow).
                .ignoringRequestMatchers("/api/payments/**", "/api/subscriptions/**",
                        "/api/resume/analyze", "/api/auth/**",
                        "/api/notifications/**", "/api/recruiter/**", "/api/candidate/ats-evaluate",
                        "/api/candidate/resume", "/api/candidate/resumes/**",
                        "/api/candidate/portfolio/**", "/api/candidate/certifications/**",
                        "/api/agencies/register", "/api/agencies/draft", "/api/agencies/submit")
            )
            .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)

            // --- Endpoint authorization ---
            .authorizeHttpRequests(auth -> auth
                // Public pages and static resources
                .requestMatchers(
                    "/", "/public/**",
                    "/login", "/register",
                    "/register/candidate", "/register/recruiter",
                    "/forgot-password",
                    "/recruiter-login", "/recruiter-register", "/recruiter-forgot-password",
                    "/admin-page",
                    "/index.html",
                    "/dashboard", "/paid-dashboard/**", "/unpaid-dashboard/**",
                    "/agency/**", "/agency-login", "/agency-register",
                    "/auth/login", "/auth/logout",
                    "/auth/register", "/auth/register/**",
                    "/api/auth/**",
                    "/api/public/**",
                    "/api/agencies/register", "/api/agencies/draft", "/api/agencies/submit",
                    "/api/agencies/registration-status",
                    "/api/resume/**",
                    "/api/files/local",
                    "/css/**", "/js/**", "/images/**", "/static/**",
                    "/assets/**", "/favicon.svg", "/icons.svg", "/favicon.ico", "/sw.js",
                    // Deployment health probe — shown without component details,
                    // so it never exposes connection state or infrastructure names.
                    "/actuator/health",
                    "/error"
                ).permitAll()

                // Subscription status — any authenticated user
                .requestMatchers("/api/subscriptions/status").authenticated()
                // Subscription admin — CLIENT_ADMIN, ADMIN, SUPER_ADMIN
                .requestMatchers("/api/subscriptions/admin/**").hasAnyRole("CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN")
                // Recruiter subscription — RECRUITER only
                .requestMatchers("/api/subscriptions/recruiter/**").hasRole("RECRUITER")
                // Candidate subscription — CANDIDATE only
                .requestMatchers("/api/subscriptions/candidate/**").hasRole("CANDIDATE")

                // Candidate-only areas
                .requestMatchers("/candidate/**", "/resume-templates/**", "/api/candidate/**")
                    .hasRole("CANDIDATE")

                // Recruiter-only areas
                .requestMatchers("/recruiter/**", "/api/recruiter/**")
                    .hasAnyRole("RECRUITER", "CLIENT_ADMIN")

                // Client-admin and admin areas
                .requestMatchers("/client-admin/**", "/admin/**", "/api/admin/**")
                    .hasAnyRole("CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN")

                // Agency areas
                .requestMatchers("/api/agency/**", "/api/agencies/**")
                    .hasAnyRole("AGENCY_ADMIN", "AGENCY_STAFF", "CLIENT_ADMIN", "ADMIN", "SUPER_ADMIN")

                // Everything else requires authentication
                .anyRequest().authenticated()
            )

            // --- Form login ---
            .formLogin(form -> form
                .loginPage("/login")
                .loginProcessingUrl("/auth/login")
                .usernameParameter("email")
                .passwordParameter("password")
                .successHandler(successHandler)
                .failureHandler(authenticationFailureHandler())
                .permitAll()
            )

            // --- Logout ---
            .logout(logout -> logout
                .logoutUrl("/auth/logout")
                .logoutSuccessUrl("/login?logout=true")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .permitAll()
            )

            // --- Session management ---
            .sessionManagement(session -> session
                .sessionFixation().migrateSession()
                .maximumSessions(1)
                .maxSessionsPreventsLogin(false) // Allow new login, expire old session
            )

            // --- Security headers ---
            .headers(headers -> headers
                .frameOptions(fo -> fo.deny())
                .contentTypeOptions(cto -> {})
                .referrerPolicy(rp -> rp
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
            )

            // --- Exception handling ---
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    String uri = request.getRequestURI();
                    if (uri != null && uri.contains("/api/")) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json");
                        response.setCharacterEncoding("UTF-8");
                        response.getWriter().write("{\"error\":\"UNAUTHORIZED\",\"message\":\"Authentication required\"}");
                    } else {
                        response.sendRedirect(request.getContextPath() + "/login");
                    }
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    String uri = request.getRequestURI();
                    if (uri != null && uri.contains("/api/")) {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("application/json");
                        response.setCharacterEncoding("UTF-8");
                        response.getWriter().write("{\"error\":\"FORBIDDEN\",\"message\":\"Access denied\"}");
                    } else {
                        response.sendRedirect(request.getContextPath() + "/error/403");
                    }
                })
            )

            // --- Authentication provider ---
            .authenticationProvider(authenticationProvider());

        return http.build();
    }

    @Bean
    public AuthenticationFailureHandler authenticationFailureHandler() {
        return (request, response, exception) -> {
            String reason = "invalid_credentials";
            if (exception instanceof org.springframework.security.authentication.LockedException) {
                reason = "account_pending_or_locked";
            } else if (exception instanceof org.springframework.security.authentication.DisabledException) {
                reason = "account_disabled";
            }
            response.sendRedirect(request.getContextPath() + "/login?error=" + reason);
        };
    }

    /**
     * Ensures the deferred CSRF token is loaded on every request so the CookieCsrfTokenRepository
     * writes the XSRF-TOKEN cookie to the response for single-page applications and AJAX clients.
     */
    static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request,
                                        HttpServletResponse response,
                                        FilterChain filterChain) throws ServletException, IOException {
            CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (csrfToken != null) {
                csrfToken.getToken(); // Forces deferred token resolution
            }
            filterChain.doFilter(request, response);
        }
    }
}
