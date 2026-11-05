package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.HiringRequestRepository;
import com.euodoo.hire.repository.PaymentRepository;
import com.euodoo.hire.repository.UserRepository;
import com.razorpay.Order;
import com.razorpay.OrderClient;
import com.razorpay.RazorpayClient;
import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private UserRepository userRepository;
    @Mock private HiringRequestRepository hiringRequestRepository;
    @Mock private InvoiceService invoiceService;
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private RazorpayClient razorpayClient;
    @Mock private OrderClient orderClient;

    private PaymentService paymentService;

    private final String candidateId = "cand-001";
    private final String recruiterId = "rec-001";

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(
                paymentRepository,
                userRepository,
                hiringRequestRepository,
                invoiceService,
                notificationService,
                auditService,
                mongoTemplate
        );
        ReflectionTestUtils.setField(paymentService, "keyId", "rzp_test_key123");
        ReflectionTestUtils.setField(paymentService, "keySecret", "rzp_secret_xyz456");
        ReflectionTestUtils.setField(paymentService, "configured", true);
        ReflectionTestUtils.setField(paymentService, "razorpayClient", razorpayClient);
    }

    @Test
    void createPlanUpgradeOrder_whenBasicPlanRequested_throwsPlanDiscontinued() {
        User candidate = User.builder()
                .id(candidateId)
                .role(Role.CANDIDATE)
                .plan(PlanType.FREE)
                .planActivated(false)
                .build();
        when(userRepository.findById(candidateId)).thenReturn(Optional.of(candidate));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> paymentService.createPlanUpgradeOrder(candidateId, PlanType.BASIC));

        assertEquals("PLAN_DISCONTINUED", ex.getErrorCode());
        assertTrue(ex.getMessage().contains("discontinued") || ex.getMessage().contains("Premium Career Pro"));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void createPlanUpgradeOrder_whenFreePlanRequested_throwsInvalidPlan() {
        User candidate = User.builder()
                .id(candidateId)
                .role(Role.CANDIDATE)
                .plan(PlanType.FREE)
                .planActivated(false)
                .build();
        when(userRepository.findById(candidateId)).thenReturn(Optional.of(candidate));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> paymentService.createPlanUpgradeOrder(candidateId, PlanType.FREE));

        assertEquals("INVALID_PLAN", ex.getErrorCode());
    }

    @Test
    void createPlanUpgradeOrder_whenPremiumPlanRequested_creates499Order() throws Exception {
        User candidate = User.builder()
                .id(candidateId)
                .role(Role.CANDIDATE)
                .plan(PlanType.FREE)
                .planActivated(false)
                .build();
        when(userRepository.findById(candidateId)).thenReturn(Optional.of(candidate));

        // Mock RazorpayClient.orders
        ReflectionTestUtils.setField(razorpayClient, "orders", orderClient);
        JSONObject mockOrderJson = new JSONObject();
        mockOrderJson.put("id", "order_rzp_499_abc");
        Order mockOrder = new Order(mockOrderJson);
        when(orderClient.create(any(JSONObject.class))).thenReturn(mockOrder);

        Map<String, Object> result = paymentService.createPlanUpgradeOrder(candidateId, PlanType.PREMIUM);

        assertNotNull(result);
        assertEquals("order_rzp_499_abc", result.get("gatewayOrderId"));
        assertEquals(49900L, result.get("amountPaise"));
        assertEquals("INR", result.get("currency"));

        verify(paymentRepository, times(1)).save(argThat(payment ->
                payment.getPayerUserId().equals(candidateId)
                && payment.getPurpose() == PaymentPurpose.CANDIDATE_PLAN_PREMIUM
                && payment.getTargetPlan() == PlanType.PREMIUM
                && payment.getGatewayOrderId().equals("order_rzp_499_abc")
                && payment.getStatus() == PaymentStatus.PENDING
        ));
    }

    @Test
    void createPlanUpgradeOrder_whenUserNotCandidate_throwsInvalidRole() {
        User recruiter = User.builder()
                .id(recruiterId)
                .role(Role.RECRUITER)
                .build();
        when(userRepository.findById(recruiterId)).thenReturn(Optional.of(recruiter));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> paymentService.createPlanUpgradeOrder(recruiterId, PlanType.PREMIUM));

        assertEquals("INVALID_ROLE", ex.getErrorCode());
    }

    @Test
    void createPlanUpgradeOrder_whenAlreadyOnPremium_throwsAlreadyOnPlan() {
        User candidate = User.builder()
                .id(candidateId)
                .role(Role.CANDIDATE)
                .plan(PlanType.PREMIUM)
                .planActivated(true)
                .build();
        when(userRepository.findById(candidateId)).thenReturn(Optional.of(candidate));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> paymentService.createPlanUpgradeOrder(candidateId, PlanType.PREMIUM));

        assertEquals("ALREADY_ON_PLAN", ex.getErrorCode());
    }
}
