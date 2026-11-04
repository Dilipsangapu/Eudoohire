package com.euodoo.hire.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * In-memory rate limiting filter for sensitive endpoints (auth & payments).
 *
 * Protects against credential brute force and payment spam by enforcing request rate
 * thresholds per client IP address within a 60-second sliding window.
 */
@Component
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    public static final int AUTH_LIMIT_PER_MINUTE = 10;
    public static final int PAYMENT_LIMIT_PER_MINUTE = 20;
    private static final long WINDOW_MS = 60_000L;

    private final Map<String, RequestCounter> requestCounts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        int limit = resolveLimit(path, method);

        if (limit > 0) {
            String clientIp = resolveClientIp(request);
            String bucketKey = clientIp + ":" + getEndpointCategory(path);

            long now = System.currentTimeMillis();
            pruneExpiredEntries(now);

            RequestCounter counter = requestCounts.compute(bucketKey, (k, existing) -> {
                if (existing == null || now - existing.windowStart > WINDOW_MS) {
                    return new RequestCounter(now, new AtomicInteger(1));
                }
                existing.count.incrementAndGet();
                return existing;
            });

            if (counter.count.get() > limit) {
                log.warn("Rate limit exceeded for IP [{}] on endpoint [{}] (limit: {}/min)", clientIp, path, limit);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", "60");
                response.getWriter().write(
                        "{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Rate limit exceeded. Please try again later.\"}"
                );
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private int resolveLimit(String path, String method) {
        if ("POST".equalsIgnoreCase(method) && ("/auth/login".equals(path) || path.startsWith("/api/auth/"))) {
            return AUTH_LIMIT_PER_MINUTE;
        }
        if (path.startsWith("/api/payments/")) {
            return PAYMENT_LIMIT_PER_MINUTE;
        }
        return 0;
    }

    private String getEndpointCategory(String path) {
        if (path.startsWith("/api/payments/")) {
            return "PAYMENTS";
        }
        return "AUTH";
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void pruneExpiredEntries(long now) {
        if (requestCounts.size() > 500) {
            requestCounts.entrySet().removeIf(entry -> now - entry.getValue().windowStart > WINDOW_MS * 2);
        }
    }

    // Exposed for testing
    void clear() {
        requestCounts.clear();
    }

    private static class RequestCounter {
        final long windowStart;
        final AtomicInteger count;

        RequestCounter(long windowStart, AtomicInteger count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
