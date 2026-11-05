package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Invoice issued after a confirmed payment.
 *
 * Invoice numbers are unique and sequential within the platform.
 * Only the authorized payer may retrieve their own invoices.
 *
 * Tax details (GST) are placeholders; confirm rates with accountants before launch.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "invoices")
public class Invoice {

    @Id
    private String id;

    /** Unique invoice number, e.g. INV-2024-000001. */
    @Indexed(unique = true)
    private String invoiceNumber;

    @Indexed
    private String payerUserId;

    @Indexed(unique = true)
    private String paymentId;

    private BigDecimal amountInr;

    @Builder.Default
    private String currency = "INR";

    private InvoiceType invoiceType;

    @Builder.Default
    private InvoiceStatus status = InvoiceStatus.ISSUED;

    private Instant issuedAt;

    // --- Tax information (to be confirmed with accountants) ---
    private String gstNumber;
    private BigDecimal gstRatePercent;
    private BigDecimal gstAmountInr;

    // --- Payer snapshot at invoice time ---
    private String payerName;
    private String payerEmail;

    private String description;
}
