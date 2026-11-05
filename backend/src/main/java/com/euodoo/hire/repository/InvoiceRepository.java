package com.euodoo.hire.repository;

import com.euodoo.hire.model.Invoice;
import com.euodoo.hire.model.InvoiceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for Invoice documents.
 * invoiceNumber has a unique index declared on the model.
 */
@Repository
public interface InvoiceRepository extends MongoRepository<Invoice, String> {

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    Optional<Invoice> findByPaymentId(String paymentId);

    boolean existsByPaymentId(String paymentId);

    Page<Invoice> findByPayerUserId(String payerUserId, Pageable pageable);

    Page<Invoice> findByPayerUserIdAndInvoiceType(
            String payerUserId, InvoiceType type, Pageable pageable);

    /**
     * Finds the most recent invoice to derive the next sequential number.
     */
    Optional<Invoice> findTopByOrderByIssuedAtDesc();
}
