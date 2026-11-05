package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.*;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;


@Service
@Slf4j
public class PaymentService {

    // Pricing in paise (INR × 100) — server-authoritative values
    // Candidate subscription is strictly ONE plan: Premium Career Pro at ₹499
    private static final long PREMIUM_PLAN_PAISE = 49900L;  // ₹499

    @Value("${razorpay.key-id:${razorpay.api.key:rzp_test_38I5IEufjhiOFj}}")
    private String keyId;

    @Value("${razorpay.key-secret:${razorpay.api.secret:XCrXx93If1q1cuILOpXcggmb}}")
    private String keySecret;

    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final HiringRequestRepository hiringRequestRepository;
    private final InvoiceService invoiceService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final MongoTemplate mongoTemplate;

    private RazorpayClient razorpayClient;
    private boolean configured;

    public PaymentService(PaymentRepository paymentRepository,
                          UserRepository userRepository,
                          HiringRequestRepository hiringRequestRepository,
                          InvoiceService invoiceService,
                          NotificationService notificationService,
                          AuditService auditService,
                          MongoTemplate mongoTemplate) {
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.hiringRequestRepository = hiringRequestRepository;
        this.invoiceService = invoiceService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.mongoTemplate = mongoTemplate;
    }

    @PostConstruct
    public void init() {
        if (keyId == null || keyId.isBlank()) {
            keyId = "rzp_test_38I5IEufjhiOFj";
        }
        if (keySecret == null || keySecret.isBlank()) {
            keySecret = "XCrXx93If1q1cuILOpXcggmb";
        }
        try {
            razorpayClient = new RazorpayClient(keyId, keySecret);
            configured = true;
            log.info("Razorpay payment gateway configured with keyId={}.", keyId);
        } catch (RazorpayException e) {
            log.error("Failed to initialize Razorpay client: {}", e.getMessage());
            configured = false;
        }
    }

    public Map<String, Object> createPlanUpgradeOrder(String candidateUserId, PlanType targetPlan) {
        assertConfigured();
        User user = userRepository.findById(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", candidateUserId));

        if (user.getRole() != Role.CANDIDATE) {
            throw new BusinessException("INVALID_ROLE", "Only candidates can upgrade plans.");
        }
        if (targetPlan == PlanType.BASIC) {
            throw new BusinessException("PLAN_DISCONTINUED",
                    "The Basic plan (₹199) is discontinued. Candidate subscription is strictly Premium Career Pro (₹499).");
        }
        if (targetPlan != PlanType.PREMIUM) {
            throw new BusinessException("INVALID_PLAN", "Only Premium Career Pro (₹499) plan can be purchased.");
        }
        if (user.isPlanActivated() && user.getPlan() == PlanType.PREMIUM) {
            throw new BusinessException("ALREADY_ON_PLAN", "You are already on the Premium Career Pro plan.");
        }

        long amountPaise = PREMIUM_PLAN_PAISE;
        PaymentPurpose purpose = PaymentPurpose.CANDIDATE_PLAN_PREMIUM;

        try {
            JSONObject orderRequest = new JSONObject()
                    .put("amount", amountPaise)
                    .put("currency", "INR")
                    .put("receipt", "plan_" + candidateUserId + "_" + System.currentTimeMillis())
                    .put("payment_capture", 1);

            Order gatewayOrder = razorpayClient.orders.create(orderRequest);
            String gatewayOrderId = gatewayOrder.get("id");

            // Persist pending payment
            Payment payment = Payment.builder()
                    .payerUserId(candidateUserId)
                    .purpose(purpose)
                    .targetPlan(targetPlan)
                    .amountInr(BigDecimal.valueOf(amountPaise).movePointLeft(2))
                    .currency("INR")
                    .gatewayOrderId(gatewayOrderId)
                    .status(PaymentStatus.PENDING)
                    .verified(false)
                    .build();
            paymentRepository.save(payment);

            log.info("Razorpay order created [orderId={}] for candidate [{}] plan={}", 
                     gatewayOrderId, candidateUserId, targetPlan);

            return Map.of(
                    "gatewayOrderId", gatewayOrderId,
                    "amountPaise", amountPaise,
                    "currency", "INR",
                    "keyId", keyId  // Public key ID — safe to expose
            );
        } catch (RazorpayException e) {
            log.error("Failed to create Razorpay order: {}", e.getMessage());
            throw new BusinessException("ORDER_CREATION_FAILED",
                    "Payment gateway error. Please try again.");
        }
    }

    /**
     * Creates a Razorpay order for a recruiter hiring fee.
     */
    public Map<String, Object> createHiringFeeOrder(String recruiterUserId,
                                                      String hiringRequestId) {
        assertConfigured();
        HiringRequest request = hiringRequestRepository.findById(hiringRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("HiringRequest", hiringRequestId));

        if (!request.getRecruiterUserId().equals(recruiterUserId)) {
            throw new AccessDeniedBusinessException("You are not the recruiter for this hiring request.");
        }
        if (request.getApprovalStatus() != ApprovalStatus.APPROVED) {
            throw new BusinessException("NOT_APPROVED",
                    "This hiring request must be approved before payment.");
        }
        if (request.getPaymentStatus() == PaymentStatus.CAPTURED) {
            throw new BusinessException("ALREADY_PAID", "This hiring fee has already been paid.");
        }

        long amountPaise = request.getCalculatedHiringFeeInr()
                .multiply(BigDecimal.valueOf(100))
                .longValue();

        try {
            JSONObject orderRequest = new JSONObject()
                    .put("amount", amountPaise)
                    .put("currency", "INR")
                    .put("receipt", "hiring_" + hiringRequestId)
                    .put("payment_capture", 1);

            Order gatewayOrder = razorpayClient.orders.create(orderRequest);
            String gatewayOrderId = gatewayOrder.get("id");

            Payment payment = Payment.builder()
                    .payerUserId(recruiterUserId)
                    .purpose(PaymentPurpose.HIRING_FEE)
                    .hiringRequestId(hiringRequestId)
                    .amountInr(request.getCalculatedHiringFeeInr())
                    .currency("INR")
                    .gatewayOrderId(gatewayOrderId)
                    .status(PaymentStatus.PENDING)
                    .verified(false)
                    .build();
            paymentRepository.save(payment);

            log.info("Hiring fee order created [orderId={}] for recruiter [{}] hiringRequestId={}",
                     gatewayOrderId, recruiterUserId, hiringRequestId);

            return Map.of(
                    "gatewayOrderId", gatewayOrderId,
                    "amountPaise", amountPaise,
                    "currency", "INR",
                    "keyId", keyId
            );
        } catch (RazorpayException e) {
            log.error("Failed to create hiring fee order: {}", e.getMessage());
            throw new BusinessException("ORDER_CREATION_FAILED", "Payment gateway error. Please try again.");
        }
    }

    public Invoice verifyAndActivatePayment(String gatewayOrderId, String gatewayPaymentId,
                                          String gatewaySignature) {
        Payment payment = paymentRepository.findByGatewayOrderId(gatewayOrderId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No pending payment found for orderId: " + gatewayOrderId));

        // Idempotency: skip if already processed
        if (paymentRepository.existsByGatewayPaymentId(gatewayPaymentId)) {
            log.info("Payment already processed [gatewayPaymentId={}], checking ownership and order.", gatewayPaymentId);
            Payment p = paymentRepository.findByGatewayPaymentId(gatewayPaymentId).orElse(null);
            if (p != null) {
                if (!p.getPayerUserId().equals(payment.getPayerUserId())) {
                    throw new AccessDeniedBusinessException("Payment ID does not belong to the user.");
                }
                if (!gatewayOrderId.equals(p.getGatewayOrderId())) {
                    throw new BusinessException("PAYMENT_ORDER_MISMATCH", "Payment ID does not match the order ID.");
                }
                return invoiceService.getInvoicesForUser(p.getPayerUserId(), 0, 1).stream().findFirst().orElse(null);
            }
            return null;
        }

        // Verify signature
        verifySignature(gatewayOrderId, gatewayPaymentId, gatewaySignature);

        // Atomic update to CAPTURED
        Query query = new Query(Criteria.where("gatewayOrderId").is(gatewayOrderId)
                .and("status").ne(PaymentStatus.CAPTURED));
        Update update = new Update()
                .set("gatewayPaymentId", gatewayPaymentId)
                .set("gatewaySignatureVerified", "VERIFIED")
                .set("status", PaymentStatus.CAPTURED)
                .set("verified", true)
                .set("capturedAt", Instant.now())
                .set("updatedAt", Instant.now());

        Payment updatedPayment = mongoTemplate.findAndModify(query, update,
                FindAndModifyOptions.options().returnNew(true), Payment.class);

        if (updatedPayment != null) {
            return activateAfterPayment(updatedPayment);
        } else {
            return invoiceService.getInvoicesForUser(payment.getPayerUserId(), 0, 1).stream().findFirst().orElse(null);
        }
    }

    private Invoice activateAfterPayment(Payment payment) {
        switch (payment.getPurpose()) {
            case CANDIDATE_PLAN_BASIC, CANDIDATE_PLAN_PREMIUM, CANDIDATE_SUBSCRIPTION ->
                    activateCandidatePlan(payment);
            case HIRING_FEE -> markHiringFeePaid(payment);
            case RECRUITER_SUBSCRIPTION -> log.info(
                    "Recruiter subscription payment captured [paymentId={}] — activation handled by SubscriptionService.",
                    payment.getId());
        }

        Invoice invoice = invoiceService.generateInvoice(payment);
        log.info("Payment activated [id={}] purpose={}", payment.getId(), payment.getPurpose());
        return invoice;
    }

    private void activateCandidatePlan(Payment payment) {
        userRepository.findById(payment.getPayerUserId()).ifPresent(user -> {
            user.setPlan(payment.getTargetPlan());
            user.setPlanActivated(true);
            userRepository.save(user);
            auditService.log(payment.getPayerUserId(), "CANDIDATE", "User",
                    user.getId(), "PLAN_ACTIVATED",
                    Map.of("plan", payment.getTargetPlan().name()));
            notificationService.notify(payment.getPayerUserId(), "PLAN_ACTIVATED",
                    "Your " + payment.getTargetPlan().name() + " plan is now active!",
                    payment.getId(), "Payment");
            log.info("Plan activated: userId={} plan={}", user.getId(), payment.getTargetPlan());
        });
    }

    private void markHiringFeePaid(Payment payment) {
        if (payment.getHiringRequestId() != null) {
            hiringRequestRepository.findById(payment.getHiringRequestId()).ifPresent(request -> {
                request.setPaymentStatus(PaymentStatus.CAPTURED);
                request.setPaymentId(payment.getId());
                request.setPaidAt(Instant.now());
                hiringRequestRepository.save(request);
                auditService.log(payment.getPayerUserId(), "RECRUITER", "HiringRequest",
                        request.getId(), "HIRING_FEE_PAID", null);
                log.info("Hiring fee paid: hiringRequestId={}", request.getId());
            });
        }
    }

    private void verifySignature(String orderId, String paymentId, String signature) {
        if (!configured) {
            throw new BusinessException("PAYMENT_NOT_CONFIGURED",
                    "Payment gateway is not configured.");
        }
        String payload = orderId + "|" + paymentId;
        String computed = hmacSha256(keySecret, payload);
        if (!safeEquals(computed, signature)) {
            log.warn("Payment signature verification failed for orderId={}", orderId);
            throw new BusinessException("INVALID_SIGNATURE",
                    "Payment verification failed. Please contact support.");
        }
    }

    private String hmacSha256(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC computation failed", e);
        }
    }

    /** Constant-time string comparison to prevent timing attacks. */
    private boolean safeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] aBytes = a.getBytes(StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(StandardCharsets.UTF_8);
        if (aBytes.length != bBytes.length) return false;
        int result = 0;
        for (int i = 0; i < aBytes.length; i++) {
            result |= aBytes[i] ^ bBytes[i];
        }
        return result == 0;
    }

    private void assertConfigured() {
        if (!configured) {
            throw new BusinessException("PAYMENT_NOT_CONFIGURED",
                    "Payment processing is not configured. Contact support.");
        }
    }
}
