package com.euodoo.hire.controller;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.PaymentPurpose;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.PaymentRepository;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Subscription endpoints for Recruiter and Candidate subscription plans.
 *
 * <p>Recruiter plan: ₹999 — grants access to candidate search, profiles, contacts.
 * <p>Candidate plan: ₹499 — activates candidate platform features.
 *
 * <p>All endpoints are CSRF-exempt (see SecurityConfig ignoringRequestMatchers
 * for /api/subscriptions/**) and use session-based authentication.
 *
 * <p>Ownership check: verifyAndActivate validates that the authenticated user
 * is the payer of the given order, preventing cross-user payment hijacking.
 */
@RestController
@RequestMapping("/api/subscriptions")
@RequiredArgsConstructor
@Slf4j
public class SubscriptionController {

    private final SubscriptionService subscriptionService;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns subscription status for the authenticated user (any role).
     */
    @GetMapping("/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getStatus(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(subscriptionService.getSubscriptionStatus(userId));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RECRUITER SUBSCRIPTION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a Razorpay payment order for the recruiter subscription (₹999).
     * Returns the order details needed by the Razorpay checkout SDK.
     */
    @PostMapping("/recruiter/order")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<Map<String, Object>> createRecruiterOrder(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        Map<String, Object> order = subscriptionService.createRecruiterSubscriptionOrder(userId);
        return ResponseEntity.ok(order);
    }

    /**
     * Verifies the recruiter's completed Razorpay payment and activates subscription.
     * Performs ownership check: the authenticated user must own the given order.
     */
    @PostMapping("/recruiter/verify")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<Map<String, Object>> verifyRecruiterPayment(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam String orderId,
            @RequestParam String paymentId,
            @RequestParam String signature) {
        if (orderId == null || orderId.isBlank() || paymentId == null || paymentId.isBlank() || signature == null || signature.isBlank()) {
            throw new BusinessException("INVALID_ARGUMENTS", "orderId, paymentId, and signature are required.");
        }
        String userId = resolveUserId(principal);
        assertOrderBelongsToUser(orderId, userId);
        Map<String, Object> result = subscriptionService.verifyAndActivateSubscription(
                userId, orderId, paymentId, signature,
                PaymentPurpose.RECRUITER_SUBSCRIPTION, SubscriptionService.RECRUITER_PLAN_PAISE);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CANDIDATE SUBSCRIPTION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a Razorpay payment order for the candidate subscription (₹499).
     */
    @PostMapping("/candidate/order")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> createCandidateOrder(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        Map<String, Object> order = subscriptionService.createCandidateSubscriptionOrder(userId);
        return ResponseEntity.ok(order);
    }

    /**
     * Verifies the candidate's completed Razorpay payment and activates subscription.
     * Performs ownership check: the authenticated user must own the given order.
     */
    @PostMapping("/candidate/verify")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> verifyCandidatePayment(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam String orderId,
            @RequestParam String paymentId,
            @RequestParam String signature) {
        if (orderId == null || orderId.isBlank() || paymentId == null || paymentId.isBlank() || signature == null || signature.isBlank()) {
            throw new BusinessException("INVALID_ARGUMENTS", "orderId, paymentId, and signature are required.");
        }
        String userId = resolveUserId(principal);
        assertOrderBelongsToUser(orderId, userId);
        Map<String, Object> result = subscriptionService.verifyAndActivateSubscription(
                userId, orderId, paymentId, signature,
                PaymentPurpose.CANDIDATE_SUBSCRIPTION, SubscriptionService.CANDIDATE_PLAN_PAISE);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Admin: list all subscriptions (paginated, newest first).
     */
    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('CLIENT_ADMIN')")
    public ResponseEntity<?> listAllSubscriptions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(subscriptionService.listAllSubscriptions(page, size));
    }

    /**
     * Admin: get subscription status for any specific user.
     */
    @GetMapping("/admin/user/{userId}")
    @PreAuthorize("hasRole('CLIENT_ADMIN')")
    public ResponseEntity<Map<String, Object>> getUserSubscription(@PathVariable String userId) {
        return ResponseEntity.ok(subscriptionService.getSubscriptionStatusForAdmin(userId));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private String resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .map(User::getId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User with email", principal.getUsername()));
    }

    /**
     * Prevents a user from verifying another user's payment order.
     */
    private void assertOrderBelongsToUser(String gatewayOrderId, String userId) {
        // Check Payment collection first (created before checkout)
        paymentRepository.findByGatewayOrderId(gatewayOrderId).ifPresent(payment -> {
            if (!payment.getPayerUserId().equals(userId)) {
                log.warn("User [{}] attempted to verify order [{}] belonging to user [{}]",
                        userId, gatewayOrderId, payment.getPayerUserId());
                throw new AccessDeniedBusinessException(
                        "You are not authorized to verify this payment.");
            }
        });
    }
}
