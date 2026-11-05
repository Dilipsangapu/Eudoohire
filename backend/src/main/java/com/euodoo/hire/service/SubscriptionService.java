package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.PaymentRepository;
import com.euodoo.hire.repository.SubscriptionRepository;
import com.euodoo.hire.repository.UserRepository;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import jakarta.annotation.PostConstruct;
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
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Production-hardened service for Recruiter and Candidate subscription lifecycle.
 *
 * <p><b>Recruiter subscription (₹999):</b> Grants access to candidate search,
 * profiles, and contact details. Restricted unless subscription is ACTIVE.
 *
 * <p><b>Candidate subscription (₹499):</b> Single plan activating
 * candidate platform features (profile priority, ATS, etc.).
 *
 * <p>All prices and durations are server-authoritative and enforced cryptographically
 * and via server-side gateway API verification.
 */
@Service
@Slf4j
public class SubscriptionService {

    // ── Server-authoritative prices (paise = INR × 100) ──────────────────────
    public static final long RECRUITER_PLAN_PAISE = 99900L;    // ₹999
    public static final long CANDIDATE_PLAN_PAISE = 49900L;    // ₹499

    // ── Configurable durations ────────────────────────────────────────────────
    @Value("${app.subscription.recruiter-duration-days:30}")
    private int recruiterDurationDays;

    @Value("${app.subscription.candidate-duration-days:30}")
    private int candidateDurationDays;

    // ── Razorpay credentials ──────────────────────────────────────────────────
    @Value("${razorpay.key-id:${razorpay.api.key:rzp_test_38I5IEufjhiOFj}}")
    private String keyId;

    @Value("${razorpay.key-secret:${razorpay.api.secret:XCrXx93If1q1cuILOpXcggmb}}")
    private String keySecret;

    // ── Dependencies ──────────────────────────────────────────────────────────
    private final SubscriptionRepository subscriptionRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final MongoTemplate mongoTemplate;

    private RazorpayClient razorpayClient;
    private boolean configured;

    public SubscriptionService(SubscriptionRepository subscriptionRepository,
                               PaymentRepository paymentRepository,
                               UserRepository userRepository,
                               NotificationService notificationService,
                               AuditService auditService,
                               MongoTemplate mongoTemplate) {
        this.subscriptionRepository = subscriptionRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.mongoTemplate = mongoTemplate;
    }

    /** Package-private setter for testing with mocked gateway client. */
    void setRazorpayClient(RazorpayClient client) {
        this.razorpayClient = client;
        this.configured = (client != null);
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
            log.info("SubscriptionService: Razorpay gateway configured with keyId={}", keyId);
        } catch (RazorpayException e) {
            log.error("SubscriptionService: Failed to initialize Razorpay: {}", e.getMessage());
            configured = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ACCESS GUARDS & RECONCILIATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns {@code true} if the recruiter has an ACTIVE, non-expired subscription.
     * Enforces immediate expiration check regardless of background cron jobs.
     */
    public boolean hasActiveRecruiterSubscription(String recruiterUserId) {
        Optional<Subscription> latestOpt = subscriptionRepository
                .findFirstByUserIdAndStatusOrderByCreatedAtDesc(
                        recruiterUserId, SubscriptionStatus.ACTIVE);
        if (latestOpt.isEmpty()) {
            return false;
        }

        Subscription sub = latestOpt.get();
        if (sub.getExpiresAt() == null || !sub.getExpiresAt().isAfter(Instant.now())) {
            // Immediately mark expired in database to preserve consistency
            sub.setStatus(SubscriptionStatus.EXPIRED);
            sub.setUpdatedAt(Instant.now());
            subscriptionRepository.save(sub);
            log.info("Recruiter subscription [{}] has expired as of {}", sub.getId(), sub.getExpiresAt());
            return false;
        }
        return true;
    }

    /**
     * Checks active subscription and throws {@link BusinessException} if none found.
     * Call this at the start of any recruiter endpoint that accesses candidate data.
     */
    public void assertRecruiterSubscriptionActive(String recruiterUserId) {
        if (!hasActiveRecruiterSubscription(recruiterUserId)) {
            throw new BusinessException("SUBSCRIPTION_REQUIRED",
                    "An active Recruiter subscription is required to access candidate information. " +
                    "Please subscribe at ₹999 to continue.");
        }
    }

    /**
     * Checks if candidate has an active, non-expired subscription.
     * If expired, immediately reconciles candidate access back to FREE.
     */
    public boolean hasActiveCandidateSubscription(String candidateUserId) {
        Optional<Subscription> latestOpt = subscriptionRepository
                .findFirstByUserIdAndStatusOrderByCreatedAtDesc(
                        candidateUserId, SubscriptionStatus.ACTIVE);
        if (latestOpt.isEmpty()) {
            reconcileCandidateAccessIfExpired(candidateUserId);
            return false;
        }

        Subscription sub = latestOpt.get();
        if (sub.getExpiresAt() == null || !sub.getExpiresAt().isAfter(Instant.now())) {
            sub.setStatus(SubscriptionStatus.EXPIRED);
            sub.setUpdatedAt(Instant.now());
            subscriptionRepository.save(sub);
            reconcileCandidateAccessIfExpired(candidateUserId);
            log.info("Candidate subscription [{}] has expired as of {}", sub.getId(), sub.getExpiresAt());
            return false;
        }
        return true;
    }

    /**
     * Reconciles candidate user record: if they have no active subscription,
     * ensures plan is downgraded to FREE and planActivated is set to false.
     */
    public void reconcileCandidateAccessIfExpired(String candidateUserId) {
        userRepository.findById(candidateUserId).ifPresent(user -> {
            if (user.getRole() == Role.CANDIDATE) {
                boolean hasActive = subscriptionRepository
                        .findFirstByUserIdAndStatusOrderByCreatedAtDesc(candidateUserId, SubscriptionStatus.ACTIVE)
                        .map(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(Instant.now()))
                        .orElse(false);

                if (!hasActive && (user.isPlanActivated() || user.getPlan() == PlanType.PREMIUM)) {
                    user.setPlan(PlanType.FREE);
                    user.setPlanActivated(false);
                    userRepository.save(user);
                    log.info("Reconciled candidate [{}] plan to FREE (subscription expired)", candidateUserId);
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. STATUS QUERIES
    // ─────────────────────────────────────────────────────────────────────────

    /** Returns subscription status summary for the given user with lazy expiration check. */
    public Map<String, Object> getSubscriptionStatus(String userId) {
        List<Subscription> subs = subscriptionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        Map<String, Object> result = new LinkedHashMap<>();

        if (subs.isEmpty()) {
            result.put("hasSubscription", false);
            result.put("status", "NONE");
            result.put("active", false);
            return result;
        }

        Subscription latest = subs.get(0);
        boolean active = latest.getStatus() == SubscriptionStatus.ACTIVE
                && latest.getExpiresAt() != null
                && latest.getExpiresAt().isAfter(Instant.now());

        if (!active && latest.getStatus() == SubscriptionStatus.ACTIVE) {
            // Lazy expiration check
            latest.setStatus(SubscriptionStatus.EXPIRED);
            latest.setUpdatedAt(Instant.now());
            subscriptionRepository.save(latest);
            if (latest.getUserRole() == Role.CANDIDATE) {
                reconcileCandidateAccessIfExpired(userId);
            }
        }

        result.put("hasSubscription", true);
        result.put("subscriptionId", latest.getId());
        result.put("planName", latest.getPlanName());
        result.put("status", active ? "ACTIVE" : latest.getStatus().name());
        result.put("active", active);
        result.put("activatedAt", latest.getActivatedAt());
        result.put("expiresAt", latest.getExpiresAt());
        result.put("amountInr", latest.getAmountInr());
        result.put("durationDays",
                latest.getUserRole() == Role.RECRUITER ? recruiterDurationDays : candidateDurationDays);
        return result;
    }

    /** Admin: get subscription status for any user. */
    public Map<String, Object> getSubscriptionStatusForAdmin(String userId) {
        return getSubscriptionStatus(userId);
    }

    /** Admin: list all subscriptions paginated. */
    public List<Map<String, Object>> listAllSubscriptions(int page, int size) {
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(page, size,
                        org.springframework.data.domain.Sort.by("createdAt").descending());
        return subscriptionRepository.findAllByOrderByCreatedAtDesc(pageable)
                .stream()
                .map(this::toAdminView)
                .toList();
    }

    private Map<String, Object> toAdminView(Subscription s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("userId", s.getUserId());
        m.put("userRole", s.getUserRole() != null ? s.getUserRole().name() : null);
        m.put("planName", s.getPlanName());
        m.put("status", s.getStatus().name());
        m.put("amountInr", s.getAmountInr());
        m.put("activatedAt", s.getActivatedAt());
        m.put("expiresAt", s.getExpiresAt());
        m.put("createdAt", s.getCreatedAt());
        userRepository.findById(s.getUserId()).ifPresent(u -> {
            m.put("userName", u.getName());
            m.put("userEmail", u.getEmail());
        });
        boolean active = s.getStatus() == SubscriptionStatus.ACTIVE
                && s.getExpiresAt() != null
                && s.getExpiresAt().isAfter(Instant.now());
        m.put("active", active);
        return m;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. RECRUITER SUBSCRIPTION ORDER (₹999)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a Razorpay order for a recruiter subscription (strictly ₹999).
     */
    public Map<String, Object> createRecruiterSubscriptionOrder(String recruiterUserId) {
        assertConfigured();
        User user = userRepository.findById(recruiterUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", recruiterUserId));

        if (user.getRole() != Role.RECRUITER) {
            throw new BusinessException("INVALID_ROLE", "Only recruiters can purchase recruiter subscriptions.");
        }

        if (hasActiveRecruiterSubscription(recruiterUserId)) {
            throw new BusinessException("ALREADY_SUBSCRIBED",
                    "You already have an active Recruiter subscription.");
        }

        try {
            String receipt = "rsub_" + recruiterUserId + "_" + System.currentTimeMillis();
            JSONObject orderRequest = new JSONObject()
                    .put("amount", RECRUITER_PLAN_PAISE)
                    .put("currency", "INR")
                    .put("receipt", receipt)
                    .put("payment_capture", 1);

            Order gatewayOrder = razorpayClient.orders.create(orderRequest);
            String gatewayOrderId = gatewayOrder.get("id");

            Subscription sub = Subscription.builder()
                    .userId(recruiterUserId)
                    .userRole(Role.RECRUITER)
                    .planName("RECRUITER_PLAN")
                    .status(SubscriptionStatus.PENDING)
                    .gatewayOrderId(gatewayOrderId)
                    .amountInr(BigDecimal.valueOf(RECRUITER_PLAN_PAISE).movePointLeft(2))
                    .build();
            subscriptionRepository.save(sub);

            Payment payment = Payment.builder()
                    .payerUserId(recruiterUserId)
                    .purpose(PaymentPurpose.RECRUITER_SUBSCRIPTION)
                    .amountInr(BigDecimal.valueOf(RECRUITER_PLAN_PAISE).movePointLeft(2))
                    .currency("INR")
                    .gatewayOrderId(gatewayOrderId)
                    .status(PaymentStatus.PENDING)
                    .verified(false)
                    .build();
            paymentRepository.save(payment);

            log.info("Recruiter subscription order created [orderId={}] for recruiter [{}] for ₹999",
                    gatewayOrderId, recruiterUserId);

            return Map.of(
                    "gatewayOrderId", gatewayOrderId,
                    "orderId", gatewayOrderId,
                    "amountPaise", RECRUITER_PLAN_PAISE,
                    "amount", RECRUITER_PLAN_PAISE,
                    "currency", "INR",
                    "keyId", keyId,
                    "planName", "RECRUITER_PLAN",
                    "durationDays", recruiterDurationDays
            );
        } catch (RazorpayException e) {
            log.error("Failed to create recruiter subscription order: {}", e.getMessage());
            throw new BusinessException("ORDER_CREATION_FAILED", "Payment gateway error: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CANDIDATE SUBSCRIPTION ORDER (₹499)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a Razorpay order for candidate subscription (strictly ₹499).
     */
    public Map<String, Object> createCandidateSubscriptionOrder(String candidateUserId) {
        assertConfigured();
        User user = userRepository.findById(candidateUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", candidateUserId));

        if (user.getRole() != Role.CANDIDATE) {
            throw new BusinessException("INVALID_ROLE", "Only candidates can purchase candidate subscriptions.");
        }

        if (subscriptionRepository.existsByUserIdAndStatus(candidateUserId, SubscriptionStatus.ACTIVE)) {
            Optional<Subscription> active = subscriptionRepository
                    .findFirstByUserIdAndStatusOrderByCreatedAtDesc(candidateUserId, SubscriptionStatus.ACTIVE);
            boolean stillActive = active
                    .map(s -> s.getExpiresAt() != null && s.getExpiresAt().isAfter(Instant.now()))
                    .orElse(false);
            if (stillActive) {
                throw new BusinessException("ALREADY_SUBSCRIBED",
                        "You already have an active Candidate subscription.");
            }
        }

        try {
            String receipt = "csub_" + candidateUserId + "_" + System.currentTimeMillis();
            JSONObject orderRequest = new JSONObject()
                    .put("amount", CANDIDATE_PLAN_PAISE)
                    .put("currency", "INR")
                    .put("receipt", receipt)
                    .put("payment_capture", 1);

            Order gatewayOrder = razorpayClient.orders.create(orderRequest);
            String gatewayOrderId = gatewayOrder.get("id");

            Subscription sub = Subscription.builder()
                    .userId(candidateUserId)
                    .userRole(Role.CANDIDATE)
                    .planName("CANDIDATE_PLAN")
                    .status(SubscriptionStatus.PENDING)
                    .gatewayOrderId(gatewayOrderId)
                    .amountInr(BigDecimal.valueOf(CANDIDATE_PLAN_PAISE).movePointLeft(2))
                    .build();
            subscriptionRepository.save(sub);

            Payment payment = Payment.builder()
                    .payerUserId(candidateUserId)
                    .purpose(PaymentPurpose.CANDIDATE_SUBSCRIPTION)
                    .targetPlan(PlanType.PREMIUM)
                    .amountInr(BigDecimal.valueOf(CANDIDATE_PLAN_PAISE).movePointLeft(2))
                    .currency("INR")
                    .gatewayOrderId(gatewayOrderId)
                    .status(PaymentStatus.PENDING)
                    .verified(false)
                    .build();
            paymentRepository.save(payment);

            log.info("Candidate subscription order created [orderId={}] for candidate [{}] for ₹499",
                    gatewayOrderId, candidateUserId);

            return Map.of(
                    "gatewayOrderId", gatewayOrderId,
                    "orderId", gatewayOrderId,
                    "amountPaise", CANDIDATE_PLAN_PAISE,
                    "amount", CANDIDATE_PLAN_PAISE,
                    "currency", "INR",
                    "keyId", keyId,
                    "planName", "CANDIDATE_PLAN",
                    "durationDays", candidateDurationDays
            );
        } catch (RazorpayException e) {
            log.error("Failed to create candidate subscription order: {}", e.getMessage());
            throw new BusinessException("ORDER_CREATION_FAILED", "Payment gateway error: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. VERIFICATION & UNIFIED ACTIVATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Checks payment idempotency.
     * If the paymentId was already processed, validates that it matches the authenticated user,
     * the order ID, and the expected payment purpose before returning status.
     *
     * @return true if already processed legitimately (idempotent replay), false if new payment
     * @throws AccessDeniedBusinessException if paymentId belongs to another user
     * @throws BusinessException if paymentId is attached to a different order or purpose
     */
    public boolean validatePaymentIdempotency(String userId, String gatewayOrderId,
                                             String gatewayPaymentId, PaymentPurpose expectedPurpose) {
        Optional<Payment> existingPaymentOpt = paymentRepository.findByGatewayPaymentId(gatewayPaymentId);
        if (existingPaymentOpt.isPresent()) {
            Payment existingPayment = existingPaymentOpt.get();

            // 1. Verify user ownership
            if (!existingPayment.getPayerUserId().equals(userId)) {
                log.warn("Security alert: User [{}] attempted to verify payment [{}] belonging to user [{}]",
                        userId, gatewayPaymentId, existingPayment.getPayerUserId());
                throw new AccessDeniedBusinessException(
                        "Payment ID does not belong to the authenticated user.");
            }

            // 2. Verify order correlation
            if (!gatewayOrderId.equals(existingPayment.getGatewayOrderId())) {
                log.warn("Security alert: User [{}] attempted to verify payment [{}] with mismatched orderId [{}] (actual: [{}])",
                        userId, gatewayPaymentId, gatewayOrderId, existingPayment.getGatewayOrderId());
                throw new BusinessException("PAYMENT_ORDER_MISMATCH",
                        "Payment ID does not correspond to the requested order ID.");
            }

            // 3. Verify payment purpose
            if (existingPayment.getPurpose() != expectedPurpose) {
                log.warn("Security alert: User [{}] attempted to verify payment [{}] with mismatched purpose [{}] (actual: [{}])",
                        userId, gatewayPaymentId, expectedPurpose, existingPayment.getPurpose());
                throw new BusinessException("PAYMENT_PURPOSE_MISMATCH",
                        "Payment ID purpose does not match the requested subscription plan.");
            }

            log.info("Idempotent payment replay verified for user [{}] order [{}] payment [{}]",
                    userId, gatewayOrderId, gatewayPaymentId);
            return true;
        }
        return false;
    }

    /**
     * Server-side gateway verification: queries the Razorpay API to verify status, amount, currency, and order ID.
     */
    public void verifyGatewayPayment(String gatewayPaymentId, String gatewayOrderId, long expectedAmountPaise) {
        if (!configured || razorpayClient == null) {
            throw new BusinessException("PAYMENT_NOT_CONFIGURED",
                    "Payment gateway is not configured on this server.");
        }

        try {
            com.razorpay.Payment rzpPayment = razorpayClient.payments.fetch(gatewayPaymentId);
            if (rzpPayment == null) {
                throw new BusinessException("PAYMENT_NOT_FOUND", "Payment record not found on gateway.");
            }

            // 1. Status check: must be captured or authorized
            String status = rzpPayment.get("status");
            if ("authorized".equalsIgnoreCase(status)) {
                try {
                    JSONObject captureRequest = new JSONObject();
                    captureRequest.put("amount", expectedAmountPaise);
                    captureRequest.put("currency", "INR");
                    rzpPayment = razorpayClient.payments.capture(gatewayPaymentId, captureRequest);
                    status = rzpPayment.get("status");
                } catch (Exception e) {
                    log.error("Failed to capture authorized payment [{}]: {}", gatewayPaymentId, e.getMessage());
                }
            }

            if (!"captured".equalsIgnoreCase(status)) {
                log.warn("Gateway payment [{}] has invalid status: {}", gatewayPaymentId, status);
                throw new BusinessException("INVALID_PAYMENT_STATUS",
                        "Payment has not been captured by the gateway (status: " + status + ").");
            }

            // 2. Amount check (must be exact)
            Number amountNum = rzpPayment.get("amount");
            long actualAmount = amountNum != null ? amountNum.longValue() : 0L;
            if (actualAmount != expectedAmountPaise) {
                log.warn("Payment [{}] amount mismatch: expected {} paise, got {} paise",
                        gatewayPaymentId, expectedAmountPaise, actualAmount);
                throw new BusinessException("AMOUNT_MISMATCH",
                        "Payment amount does not match the required plan amount.");
            }

            // 3. Currency check
            String currency = rzpPayment.get("currency");
            if (!"INR".equalsIgnoreCase(currency)) {
                log.warn("Payment [{}] currency mismatch: expected INR, got {}", gatewayPaymentId, currency);
                throw new BusinessException("CURRENCY_MISMATCH",
                        "Payment currency must be INR.");
            }

            // 4. Order ID check
            String rzpOrderId = rzpPayment.get("order_id");
            if (!gatewayOrderId.equals(rzpOrderId)) {
                log.warn("Payment [{}] order mismatch: expected {}, got {}",
                        gatewayPaymentId, gatewayOrderId, rzpOrderId);
                throw new BusinessException("ORDER_MISMATCH",
                        "Payment was not created for the specified order.");
            }

            log.info("Gateway verification successful for payment [{}] order [{}] amount {} INR",
                    gatewayPaymentId, gatewayOrderId, actualAmount / 100);

        } catch (RazorpayException e) {
            log.error("Razorpay API error fetching payment [{}]: {}", gatewayPaymentId, e.getMessage());
            throw new BusinessException("GATEWAY_ERROR", "Payment gateway verification error: " + e.getMessage());
        }
    }

    /**
     * Verifies Razorpay signature and gateway details, then activates the subscription.
     * Uses unified activation logic and atomic updates to prevent race conditions and duplicate activations.
     */
    public Map<String, Object> verifyAndActivateSubscription(String userId,
                                                              String gatewayOrderId,
                                                              String gatewayPaymentId,
                                                              String signature,
                                                              PaymentPurpose expectedPurpose,
                                                              long expectedAmountPaise) {
        // 1. Idempotency validation
        if (validatePaymentIdempotency(userId, gatewayOrderId, gatewayPaymentId, expectedPurpose)) {
            return getSubscriptionStatus(userId);
        }

        // 2. Signature verification
        verifySignature(gatewayOrderId, gatewayPaymentId, signature);

        // 3. Server-side gateway verification
        verifyGatewayPayment(gatewayPaymentId, gatewayOrderId, expectedAmountPaise);

        // 4. Unified atomic activation
        return processSubscriptionActivation(userId, gatewayOrderId, gatewayPaymentId, expectedPurpose, expectedAmountPaise);
    }

    /**
     * Atomic subscription activation used by checkout verification.
     * Prevents race conditions, concurrent duplicate activations, and duplicate transactions.
     */
    public Map<String, Object> processSubscriptionActivation(
            String userId,
            String gatewayOrderId,
            String gatewayPaymentId,
            PaymentPurpose purpose,
            long expectedAmountPaise) {

        Instant now = Instant.now();

        // 1. Atomic payment capture update
        Query paymentQuery = new Query(Criteria.where("gatewayOrderId").is(gatewayOrderId)
                .and("status").ne(PaymentStatus.CAPTURED));
        Update paymentUpdate = new Update()
                .set("gatewayPaymentId", gatewayPaymentId)
                .set("gatewaySignatureVerified", "VERIFIED")
                .set("status", PaymentStatus.CAPTURED)
                .set("verified", true)
                .set("capturedAt", now)
                .set("updatedAt", now);

        Payment payment = mongoTemplate.findAndModify(
                paymentQuery, paymentUpdate,
                FindAndModifyOptions.options().returnNew(true), Payment.class);

        if (payment == null) {
            // Already captured concurrently
            payment = paymentRepository.findByGatewayOrderId(gatewayOrderId)
                    .orElseThrow(() -> new ResourceNotFoundException("Payment for order", gatewayOrderId));
            log.info("Payment for order [{}] was already CAPTURED concurrently.", gatewayOrderId);
        }

        // 2. Atomic subscription activation update
        Subscription existingSub = subscriptionRepository.findByGatewayOrderId(gatewayOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription for order", gatewayOrderId));

        int durationDays = existingSub.getUserRole() == Role.RECRUITER
                ? recruiterDurationDays : candidateDurationDays;

        Query subQuery = new Query(Criteria.where("gatewayOrderId").is(gatewayOrderId)
                .and("status").ne(SubscriptionStatus.ACTIVE));
        Update subUpdate = new Update()
                .set("status", SubscriptionStatus.ACTIVE)
                .set("paymentId", payment.getId())
                .set("gatewayPaymentId", gatewayPaymentId)
                .set("activatedAt", now)
                .set("expiresAt", now.plus(durationDays, ChronoUnit.DAYS))
                .set("updatedAt", now);

        Subscription sub = mongoTemplate.findAndModify(
                subQuery, subUpdate,
                FindAndModifyOptions.options().returnNew(true), Subscription.class);

        if (sub != null) {
            // This thread performed the activation transition -> execute side-effects once
            activatePlatformAccess(sub);

            log.info("Subscription activated [subId={}] user={} role={} expires={}",
                    sub.getId(), userId, sub.getUserRole(), sub.getExpiresAt());

            auditService.log(userId,
                    sub.getUserRole() != null ? sub.getUserRole().name() : "USER",
                    "Subscription", sub.getId(), "SUBSCRIPTION_ACTIVATED",
                    Map.of("plan", sub.getPlanName(), "expiresAt", sub.getExpiresAt().toString()));

            notificationService.notify(userId, "SUBSCRIPTION_ACTIVATED",
                    "Your " + sub.getPlanName() + " subscription is now active until "
                            + sub.getExpiresAt().toString().substring(0, 10) + "!",
                    sub.getId(), "Subscription");
        } else {
            log.info("Subscription for order [{}] was already ACTIVE concurrently.", gatewayOrderId);
        }

        return getSubscriptionStatus(userId);
    }

    /**
     * Mark subscription as FAILED.
     * Prevents overwriting already ACTIVE subscriptions.
     */
    public void markSubscriptionFailed(String gatewayOrderId) {
        subscriptionRepository.findByGatewayOrderId(gatewayOrderId).ifPresent(sub -> {
            if (sub.getStatus() == SubscriptionStatus.ACTIVE) {
                log.warn("Refusing to mark subscription FAILED for orderId={} because it is already ACTIVE.", gatewayOrderId);
                return;
            }
            sub.setStatus(SubscriptionStatus.FAILED);
            sub.setUpdatedAt(Instant.now());
            subscriptionRepository.save(sub);
            log.info("Subscription marked FAILED [subId={}] user={}", sub.getId(), sub.getUserId());
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private void activatePlatformAccess(Subscription sub) {
        if (sub.getUserRole() == Role.CANDIDATE) {
            userRepository.findById(sub.getUserId()).ifPresent(user -> {
                user.setPlan(PlanType.PREMIUM);
                user.setPlanActivated(true);
                userRepository.save(user);
                log.info("Candidate plan activated via subscription: userId={}", user.getId());
            });
        }
    }

    private void verifySignature(String orderId, String paymentId, String signature) {
        if (!configured) {
            throw new BusinessException("PAYMENT_NOT_CONFIGURED", "Payment gateway is not configured.");
        }
        String payload = orderId + "|" + paymentId;
        String computed = hmacSha256(keySecret, payload);
        if (!safeEquals(computed, signature)) {
            log.warn("Subscription payment signature verification failed for orderId={}", orderId);
            throw new BusinessException("INVALID_SIGNATURE",
                    "Payment verification failed. Please contact support.");
        }
    }

    private String hmacSha256(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC computation failed", e);
        }
    }

    private boolean safeEquals(String a, String b) {
        if (a == null || b == null) return false;
        byte[] aBytes = a.getBytes(StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(StandardCharsets.UTF_8);
        if (aBytes.length != bBytes.length) return false;
        int result = 0;
        for (int i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i];
        return result == 0;
    }

    private void assertConfigured() {
        if (!configured) {
            throw new BusinessException("PAYMENT_NOT_CONFIGURED",
                    "Payment processing is not configured. Contact support.");
        }
    }

    /**
     * Automated job to mark past-due ACTIVE subscriptions as EXPIRED.
     * Runs hourly to ensure database status reflects expiration.
     */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 * * * *")
    public void expirePastDueSubscriptions() {
        Instant now = Instant.now();
        List<Subscription> activeSubs = subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE);
        for (Subscription sub : activeSubs) {
            if (sub.getExpiresAt() != null && sub.getExpiresAt().isBefore(now)) {
                sub.setStatus(SubscriptionStatus.EXPIRED);
                sub.setUpdatedAt(now);
                subscriptionRepository.save(sub);
                log.info("Automatically marked subscription [{}] as EXPIRED for user [{}]", sub.getId(), sub.getUserId());
                if (sub.getUserRole() == Role.CANDIDATE) {
                    reconcileCandidateAccessIfExpired(sub.getUserId());
                }
            }
        }
    }
}
