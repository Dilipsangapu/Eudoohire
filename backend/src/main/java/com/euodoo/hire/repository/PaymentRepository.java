package com.euodoo.hire.repository;

import com.euodoo.hire.model.Payment;
import com.euodoo.hire.model.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for Payment documents.
 * Unique indexes on gatewayOrderId and gatewayPaymentId enforce idempotency.
 */
@Repository
public interface PaymentRepository extends MongoRepository<Payment, String> {

    Optional<Payment> findByGatewayOrderId(String gatewayOrderId);

    Optional<Payment> findByGatewayPaymentId(String gatewayPaymentId);

    boolean existsByGatewayPaymentId(String gatewayPaymentId);

    Page<Payment> findByPayerUserId(String payerUserId, Pageable pageable);

    Page<Payment> findByPayerUserIdAndStatus(String payerUserId, PaymentStatus status, Pageable pageable);

    Optional<Payment> findByHiringRequestId(String hiringRequestId);
}
