package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.PaymentRepository;
import com.euodoo.hire.repository.SubscriptionRepository;
import com.euodoo.hire.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SubscriptionServiceTest {

    @Mock private SubscriptionRepository subscriptionRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;
    @Mock private MongoTemplate mongoTemplate;

    private SubscriptionService subscriptionService;

    private final String recruiterId = "rec-123";
    private final String candidateId = "cand-456";

    @BeforeEach
    void setUp() {
        subscriptionService = new SubscriptionService(
                subscriptionRepository,
                paymentRepository,
                userRepository,
                notificationService,
                auditService,
                mongoTemplate
        );
    }

    @Test
    void hasActiveRecruiterSubscription_whenNoSubscription_returnsFalse() {
        when(subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(recruiterId, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.empty());

        assertFalse(subscriptionService.hasActiveRecruiterSubscription(recruiterId));
    }

    @Test
    void hasActiveRecruiterSubscription_whenActiveNotExpired_returnsTrue() {
        Subscription activeSub = Subscription.builder()
                .userId(recruiterId)
                .userRole(Role.RECRUITER)
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(Instant.now().plus(15, ChronoUnit.DAYS))
                .build();

        when(subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(recruiterId, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(activeSub));

        assertTrue(subscriptionService.hasActiveRecruiterSubscription(recruiterId));
    }

    @Test
    void hasActiveRecruiterSubscription_whenActiveExpired_returnsFalse() {
        Subscription expiredSub = Subscription.builder()
                .userId(recruiterId)
                .userRole(Role.RECRUITER)
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(Instant.now().minus(1, ChronoUnit.DAYS))
                .build();

        when(subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(recruiterId, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(expiredSub));

        assertFalse(subscriptionService.hasActiveRecruiterSubscription(recruiterId));
    }

    @Test
    void assertRecruiterSubscriptionActive_whenNoSubscription_throwsBusinessException() {
        when(subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(recruiterId, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> subscriptionService.assertRecruiterSubscriptionActive(recruiterId));

        assertEquals("SUBSCRIPTION_REQUIRED", ex.getErrorCode());
    }

    @Test
    void assertRecruiterSubscriptionActive_whenActive_succeeds() {
        Subscription activeSub = Subscription.builder()
                .userId(recruiterId)
                .userRole(Role.RECRUITER)
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(Instant.now().plus(20, ChronoUnit.DAYS))
                .build();

        when(subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(recruiterId, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(activeSub));

        assertDoesNotThrow(() -> subscriptionService.assertRecruiterSubscriptionActive(recruiterId));
    }

    @Test
    void getSubscriptionStatus_whenNoSubscriptions_returnsHasSubscriptionFalse() {
        when(subscriptionRepository.findByUserIdOrderByCreatedAtDesc(candidateId))
                .thenReturn(List.of());

        Map<String, Object> status = subscriptionService.getSubscriptionStatus(candidateId);

        assertFalse((Boolean) status.get("hasSubscription"));
        assertFalse((Boolean) status.get("active"));
        assertEquals("NONE", status.get("status"));
    }

    @Test
    void expirePastDueSubscriptions_updatesExpiredStatus() {
        Subscription pastDueSub = Subscription.builder()
                .id("sub-999")
                .userId(recruiterId)
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(Instant.now().minus(2, ChronoUnit.HOURS))
                .build();

        when(subscriptionRepository.findByStatus(SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(pastDueSub));

        subscriptionService.expirePastDueSubscriptions();

        assertEquals(SubscriptionStatus.EXPIRED, pastDueSub.getStatus());
        verify(subscriptionRepository, times(1)).save(pastDueSub);
    }

    @Test
    void validatePaymentIdempotency_whenPaymentNotFound_returnsFalse() {
        when(paymentRepository.findByGatewayPaymentId("pay_nonexistent")).thenReturn(Optional.empty());

        boolean isReplay = subscriptionService.validatePaymentIdempotency(
                recruiterId, "order_123", "pay_nonexistent", PaymentPurpose.RECRUITER_SUBSCRIPTION);

        assertFalse(isReplay);
    }

    @Test
    void validatePaymentIdempotency_whenPaymentMatches_returnsTrue() {
        Payment existingPayment = Payment.builder()
                .id("pmt-1")
                .payerUserId(recruiterId)
                .gatewayOrderId("order_123")
                .gatewayPaymentId("pay_existing")
                .purpose(PaymentPurpose.RECRUITER_SUBSCRIPTION)
                .status(PaymentStatus.CAPTURED)
                .build();

        when(paymentRepository.findByGatewayPaymentId("pay_existing")).thenReturn(Optional.of(existingPayment));

        boolean isReplay = subscriptionService.validatePaymentIdempotency(
                recruiterId, "order_123", "pay_existing", PaymentPurpose.RECRUITER_SUBSCRIPTION);

        assertTrue(isReplay);
    }

    @Test
    void validatePaymentIdempotency_whenPayerUserIdMismatches_throwsSecurityException() {
        Payment existingPayment = Payment.builder()
                .id("pmt-1")
                .payerUserId("other-user")
                .gatewayOrderId("order_123")
                .gatewayPaymentId("pay_hijack")
                .purpose(PaymentPurpose.RECRUITER_SUBSCRIPTION)
                .build();

        when(paymentRepository.findByGatewayPaymentId("pay_hijack")).thenReturn(Optional.of(existingPayment));

        assertThrows(com.euodoo.hire.exception.AccessDeniedBusinessException.class, () ->
                subscriptionService.validatePaymentIdempotency(
                        recruiterId, "order_123", "pay_hijack", PaymentPurpose.RECRUITER_SUBSCRIPTION));
    }

    @Test
    void validatePaymentIdempotency_whenGatewayOrderIdMismatches_throwsSecurityException() {
        Payment existingPayment = Payment.builder()
                .id("pmt-1")
                .payerUserId(recruiterId)
                .gatewayOrderId("order_different")
                .gatewayPaymentId("pay_mismatch")
                .purpose(PaymentPurpose.RECRUITER_SUBSCRIPTION)
                .build();

        when(paymentRepository.findByGatewayPaymentId("pay_mismatch")).thenReturn(Optional.of(existingPayment));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                subscriptionService.validatePaymentIdempotency(
                        recruiterId, "order_expected", "pay_mismatch", PaymentPurpose.RECRUITER_SUBSCRIPTION));

        assertEquals("PAYMENT_ORDER_MISMATCH", ex.getErrorCode());
    }

    @Test
    void validatePaymentIdempotency_whenPurposeMismatches_throwsSecurityException() {
        Payment existingPayment = Payment.builder()
                .id("pmt-1")
                .payerUserId(recruiterId)
                .gatewayOrderId("order_123")
                .gatewayPaymentId("pay_purpose_diff")
                .purpose(PaymentPurpose.CANDIDATE_SUBSCRIPTION)
                .build();

        when(paymentRepository.findByGatewayPaymentId("pay_purpose_diff")).thenReturn(Optional.of(existingPayment));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                subscriptionService.validatePaymentIdempotency(
                        recruiterId, "order_123", "pay_purpose_diff", PaymentPurpose.RECRUITER_SUBSCRIPTION));

        assertEquals("PAYMENT_PURPOSE_MISMATCH", ex.getErrorCode());
    }

    @Test
    void markSubscriptionFailed_whenActiveSubscription_doesNotOverwriteStatus() {
        Subscription activeSub = Subscription.builder()
                .id("sub-active")
                .gatewayOrderId("order_active")
                .status(SubscriptionStatus.ACTIVE)
                .build();

        when(subscriptionRepository.findByGatewayOrderId("order_active")).thenReturn(Optional.of(activeSub));

        subscriptionService.markSubscriptionFailed("order_active");

        assertEquals(SubscriptionStatus.ACTIVE, activeSub.getStatus());
        verify(subscriptionRepository, never()).save(activeSub);
    }

    @Test
    void markSubscriptionFailed_whenPendingSubscription_marksFailed() {
        Subscription pendingSub = Subscription.builder()
                .id("sub-pending")
                .gatewayOrderId("order_pending")
                .status(SubscriptionStatus.PENDING)
                .build();

        when(subscriptionRepository.findByGatewayOrderId("order_pending")).thenReturn(Optional.of(pendingSub));

        subscriptionService.markSubscriptionFailed("order_pending");

        assertEquals(SubscriptionStatus.FAILED, pendingSub.getStatus());
        verify(subscriptionRepository, times(1)).save(pendingSub);
    }

    @Test
    void reconcileCandidateAccessIfExpired_whenNoActiveSubAndUserHasPremium_downgradesToFree() {
        User candidate = User.builder()
                .id(candidateId)
                .role(Role.CANDIDATE)
                .plan(PlanType.PREMIUM)
                .planActivated(true)
                .build();

        when(userRepository.findById(candidateId)).thenReturn(Optional.of(candidate));
        when(subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(candidateId, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.empty());

        subscriptionService.reconcileCandidateAccessIfExpired(candidateId);

        assertEquals(PlanType.FREE, candidate.getPlan());
        assertFalse(candidate.isPlanActivated());
        verify(userRepository, times(1)).save(candidate);
    }

    @Test
    void reconcileCandidateAccessIfExpired_whenActiveSubExists_preservesPremium() {
        User candidate = User.builder()
                .id(candidateId)
                .role(Role.CANDIDATE)
                .plan(PlanType.PREMIUM)
                .planActivated(true)
                .build();

        Subscription activeSub = Subscription.builder()
                .id("sub-active")
                .userId(candidateId)
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(Instant.now().plus(10, ChronoUnit.DAYS))
                .build();

        when(userRepository.findById(candidateId)).thenReturn(Optional.of(candidate));
        when(subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(candidateId, SubscriptionStatus.ACTIVE))
                .thenReturn(Optional.of(activeSub));

        subscriptionService.reconcileCandidateAccessIfExpired(candidateId);

        assertEquals(PlanType.PREMIUM, candidate.getPlan());
        assertTrue(candidate.isPlanActivated());
        verify(userRepository, never()).save(candidate);
    }

    @Test
    void verifyAndActivateSubscription_whenSignatureInvalid_throwsException() {
        ReflectionTestUtils.setField(subscriptionService, "keySecret", "testSecret");
        ReflectionTestUtils.setField(subscriptionService, "configured", true);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                subscriptionService.verifyAndActivateSubscription(
                        recruiterId, "order_123", "pay_123", "invalid_signature",
                        PaymentPurpose.RECRUITER_SUBSCRIPTION, 99900L));

        assertEquals("INVALID_SIGNATURE", ex.getErrorCode());
    }

    @Test
    void verifyAndActivateSubscription_forRecruiter_activatesSuccessfully() throws Exception {
        String secret = "testSecret";
        String orderId = "order_rec_123";
        String paymentId = "pay_rec_123";
        String signature = computeSignature(secret, orderId + "|" + paymentId);

        com.razorpay.RazorpayClient mockClient = mock(com.razorpay.RazorpayClient.class);
        com.razorpay.PaymentClient mockPaymentClient = mock(com.razorpay.PaymentClient.class);
        com.razorpay.Payment mockRzpPayment = mock(com.razorpay.Payment.class);

        mockClient.payments = mockPaymentClient;
        when(mockPaymentClient.fetch(paymentId)).thenReturn(mockRzpPayment);
        when(mockRzpPayment.get("status")).thenReturn("captured");
        when(mockRzpPayment.get("amount")).thenReturn(99900L);
        when(mockRzpPayment.get("currency")).thenReturn("INR");
        when(mockRzpPayment.get("order_id")).thenReturn(orderId);

        subscriptionService.setRazorpayClient(mockClient);
        ReflectionTestUtils.setField(subscriptionService, "keySecret", secret);

        when(paymentRepository.findByGatewayPaymentId(paymentId)).thenReturn(Optional.empty());

        Payment updatedPayment = Payment.builder()
                .id("pmt-rec")
                .payerUserId(recruiterId)
                .gatewayOrderId(orderId)
                .gatewayPaymentId(paymentId)
                .status(PaymentStatus.CAPTURED)
                .purpose(PaymentPurpose.RECRUITER_SUBSCRIPTION)
                .build();

        Subscription updatedSub = Subscription.builder()
                .id("sub-rec")
                .userId(recruiterId)
                .userRole(Role.RECRUITER)
                .planName("RECRUITER_PLAN")
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
                .gatewayOrderId(orderId)
                .gatewayPaymentId(paymentId)
                .build();

        when(mongoTemplate.findAndModify(any(), any(), any(), eq(Payment.class))).thenReturn(updatedPayment);
        when(mongoTemplate.findAndModify(any(), any(), any(), eq(Subscription.class))).thenReturn(updatedSub);
        when(subscriptionRepository.findByGatewayOrderId(orderId)).thenReturn(Optional.of(updatedSub));
        when(subscriptionRepository.findByUserIdOrderByCreatedAtDesc(recruiterId)).thenReturn(List.of(updatedSub));

        Map<String, Object> result = subscriptionService.verifyAndActivateSubscription(
                recruiterId, orderId, paymentId, signature, PaymentPurpose.RECRUITER_SUBSCRIPTION, 99900L);

        assertNotNull(result);
        assertEquals(true, result.get("active"));
        assertEquals("RECRUITER_PLAN", result.get("planName"));
        verify(notificationService, times(1)).notify(eq(recruiterId), eq("SUBSCRIPTION_ACTIVATED"), anyString(), eq("sub-rec"), eq("Subscription"));
        verify(auditService, times(1)).log(eq(recruiterId), eq("RECRUITER"), eq("Subscription"), eq("sub-rec"), eq("SUBSCRIPTION_ACTIVATED"), any());
    }

    @Test
    void verifyAndActivateSubscription_forCandidate_activatesAndUpgradesPlan() throws Exception {
        String secret = "testSecret";
        String orderId = "order_cand_123";
        String paymentId = "pay_cand_123";
        String signature = computeSignature(secret, orderId + "|" + paymentId);

        com.razorpay.RazorpayClient mockClient = mock(com.razorpay.RazorpayClient.class);
        com.razorpay.PaymentClient mockPaymentClient = mock(com.razorpay.PaymentClient.class);
        com.razorpay.Payment mockRzpPayment = mock(com.razorpay.Payment.class);

        mockClient.payments = mockPaymentClient;
        when(mockPaymentClient.fetch(paymentId)).thenReturn(mockRzpPayment);
        when(mockRzpPayment.get("status")).thenReturn("captured");
        when(mockRzpPayment.get("amount")).thenReturn(49900L);
        when(mockRzpPayment.get("currency")).thenReturn("INR");
        when(mockRzpPayment.get("order_id")).thenReturn(orderId);

        subscriptionService.setRazorpayClient(mockClient);
        ReflectionTestUtils.setField(subscriptionService, "keySecret", secret);

        when(paymentRepository.findByGatewayPaymentId(paymentId)).thenReturn(Optional.empty());

        Payment updatedPayment = Payment.builder()
                .id("pmt-cand")
                .payerUserId(candidateId)
                .gatewayOrderId(orderId)
                .gatewayPaymentId(paymentId)
                .status(PaymentStatus.CAPTURED)
                .purpose(PaymentPurpose.CANDIDATE_SUBSCRIPTION)
                .build();

        Subscription updatedSub = Subscription.builder()
                .id("sub-cand")
                .userId(candidateId)
                .userRole(Role.CANDIDATE)
                .planName("CANDIDATE_PLAN")
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
                .gatewayOrderId(orderId)
                .gatewayPaymentId(paymentId)
                .build();

        User user = User.builder()
                .id(candidateId)
                .role(Role.CANDIDATE)
                .plan(PlanType.FREE)
                .planActivated(false)
                .build();

        when(mongoTemplate.findAndModify(any(), any(), any(), eq(Payment.class))).thenReturn(updatedPayment);
        when(mongoTemplate.findAndModify(any(), any(), any(), eq(Subscription.class))).thenReturn(updatedSub);
        when(subscriptionRepository.findByGatewayOrderId(orderId)).thenReturn(Optional.of(updatedSub));
        when(userRepository.findById(candidateId)).thenReturn(Optional.of(user));
        when(subscriptionRepository.findByUserIdOrderByCreatedAtDesc(candidateId)).thenReturn(List.of(updatedSub));

        Map<String, Object> result = subscriptionService.verifyAndActivateSubscription(
                candidateId, orderId, paymentId, signature, PaymentPurpose.CANDIDATE_SUBSCRIPTION, 49900L);

        assertNotNull(result);
        assertEquals(true, result.get("active"));
        assertEquals(PlanType.PREMIUM, user.getPlan());
        assertTrue(user.isPlanActivated());
        verify(userRepository, times(1)).save(user);
    }

    private String computeSignature(String secret, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
