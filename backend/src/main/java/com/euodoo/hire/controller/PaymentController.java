package com.euodoo.hire.controller;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.Invoice;
import com.euodoo.hire.model.Payment;
import com.euodoo.hire.model.PlanType;
import com.euodoo.hire.repository.PaymentRepository;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.InvoiceService;
import com.euodoo.hire.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Payment endpoints for plan upgrades and hiring fee payments.
 *
 * FIX H1/H2: principal.getUsername() returns email (Spring Security username = email).
 * PaymentService methods expect a MongoDB user ID. We resolve via UserRepository first.
 *
 * FIX H3: verifyAndActivatePayment now checks that the order being verified belongs
 * to the authenticated user — prevents one user from verifying another user's payment.
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;

    @PostMapping("/plan-order")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Object>> createPlanOrder(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "PREMIUM") String plan) {
        PlanType targetPlan;
        try {
            targetPlan = PlanType.valueOf(plan.toUpperCase().trim());
        } catch (IllegalArgumentException e) {
            throw new com.euodoo.hire.exception.BusinessException("INVALID_PLAN",
                    "Invalid plan: " + plan + ". Candidate subscription is strictly Premium Career Pro (₹499).");
        }
        // Resolve MongoDB userId from the authenticated principal's email
        String userId = resolveUserId(principal);
        Map<String, Object> order = paymentService.createPlanUpgradeOrder(userId, targetPlan);
        return ResponseEntity.ok(order);
    }

    @PostMapping("/verify")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, String>> verifyPayment(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam String orderId,
            @RequestParam String paymentId,
            @RequestParam String signature) {
        // FIX H3: verify the order belongs to the authenticated user before activating
        String userId = resolveUserId(principal);
        assertOrderBelongsToUser(orderId, userId);
        Invoice invoice = paymentService.verifyAndActivatePayment(orderId, paymentId, signature);

        Map<String, String> response = new java.util.HashMap<>();
        response.put("message", "Payment verified and plan activated.");
        if (invoice != null) {
            response.put("invoiceId", invoice.getId());
            response.put("invoiceNumber", invoice.getInvoiceNumber());
            response.put("downloadUrl", "/api/invoices/" + invoice.getId() + "/download");
        } else {
            response.put("downloadUrl", "/api/invoices/latest/download");
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/hiring-fee-order")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<Map<String, Object>> createHiringFeeOrder(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam String hiringRequestId) {
        // Resolve MongoDB userId from the authenticated principal's email
        String userId = resolveUserId(principal);
        Map<String, Object> order = paymentService.createHiringFeeOrder(userId, hiringRequestId);
        return ResponseEntity.ok(order);
    }

    /**
     * FIX H1 (RECRUITER hiring fee verify): Recruiters verify their own hiring fee payments.
     */
    @PostMapping("/hiring-fee-verify")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<Map<String, String>> verifyHiringFeePayment(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam String orderId,
            @RequestParam String paymentId,
            @RequestParam String signature) {
        String userId = resolveUserId(principal);
        assertOrderBelongsToUser(orderId, userId);
        paymentService.verifyAndActivatePayment(orderId, paymentId, signature);
        return ResponseEntity.ok(Map.of("message", "Hiring fee payment verified."));
    }

    // --- Helpers ---

    /**
     * Resolves the MongoDB user ID from the authenticated principal's email.
     */
    private String resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .map(u -> u.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User with email", principal.getUsername()));
    }

    /**
     * FIX H3: Ensures the Razorpay order being verified belongs to the authenticated user.
     * Prevents a user from verifying (and thus activating) another user's payment order.
     */
    private void assertOrderBelongsToUser(String gatewayOrderId, String userId) {
        Payment payment = paymentRepository.findByGatewayOrderId(gatewayOrderId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No payment found for orderId: " + gatewayOrderId));
        if (!payment.getPayerUserId().equals(userId)) {
            log.warn("User [{}] attempted to verify order [{}] belonging to user [{}]",
                    userId, gatewayOrderId, payment.getPayerUserId());
            throw new AccessDeniedBusinessException(
                    "You are not authorized to verify this payment.");
        }
    }
}
