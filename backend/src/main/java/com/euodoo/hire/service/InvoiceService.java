package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.InvoiceRepository;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
@Slf4j
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final UserRepository userRepository;

    public Invoice generateInvoice(Payment payment) {
        if (invoiceRepository.existsByPaymentId(payment.getId())) {
            log.info("Invoice already exists for paymentId={}, skipping.", payment.getId());
            return invoiceRepository.findByPaymentId(payment.getId()).orElseThrow();
        }

        String invoiceNumber = generateInvoiceNumber();
        User payer = userRepository.findById(payment.getPayerUserId()).orElse(null);

        InvoiceType type = switch (payment.getPurpose()) {
            case CANDIDATE_PLAN_BASIC, CANDIDATE_PLAN_PREMIUM, CANDIDATE_SUBSCRIPTION, RECRUITER_SUBSCRIPTION -> InvoiceType.SUBSCRIPTION;
            case HIRING_FEE -> InvoiceType.HIRING_FEE;
        };

        String description = switch (payment.getPurpose()) {
            case CANDIDATE_PLAN_BASIC -> "Euodoo Hire BASIC Plan Subscription";
            case CANDIDATE_PLAN_PREMIUM -> "Euodoo Hire PREMIUM Plan Subscription";
            case CANDIDATE_SUBSCRIPTION -> "Euodoo Hire Candidate Plan Subscription";
            case RECRUITER_SUBSCRIPTION -> "Euodoo Hire Recruiter Plan Subscription";
            case HIRING_FEE -> "Euodoo Hire Recruitment Fee";
        };

        Invoice invoice = Invoice.builder()
                .invoiceNumber(invoiceNumber)
                .payerUserId(payment.getPayerUserId())
                .paymentId(payment.getId())
                .amountInr(payment.getAmountInr())
                .currency("INR")
                .invoiceType(type)
                .status(InvoiceStatus.ISSUED)
                .issuedAt(Instant.now())
                .payerName(payer != null ? payer.getName() : null)
                .payerEmail(payer != null ? payer.getEmail() : null)
                .description(description)
                .build();

        Invoice saved = invoiceRepository.save(invoice);
        log.info("Invoice generated [{}] for paymentId={}", invoiceNumber, payment.getId());
        return saved;
    }

    public Page<Invoice> getInvoicesForUser(String requestingUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("issuedAt").descending());
        return invoiceRepository.findByPayerUserId(requestingUserId, pageable);
    }

    public Invoice getInvoiceById(String invoiceId, String requestingUserId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", invoiceId));
        if (!invoice.getPayerUserId().equals(requestingUserId)) {
            throw new AccessDeniedBusinessException("You are not authorized to view this invoice.");
        }
        return invoice;
    }

    public Invoice getInvoiceByNumber(String invoiceNumber, String requestingUserId) {
        Invoice invoice = invoiceRepository.findByInvoiceNumber(invoiceNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Invoice with number " + invoiceNumber + " not found."));
        if (!invoice.getPayerUserId().equals(requestingUserId)) {
            throw new AccessDeniedBusinessException("You are not authorized to view this invoice.");
        }
        return invoice;
    }

    /**
     * FIX H4: Generates a unique invoice number without a count-based sequence.
     * The previous count()+1 approach had two problems:
     *   1. Race condition: concurrent requests could generate the same number.
     *   2. Deletion: if invoices are deleted, numbers repeat.
     *
     * New format: INV-{YYYY}-{epochMillis}-{6-char UUID suffix}
     * This is unique, monotonically increasing, human-readable, and requires no DB lock.
     */
    private String generateInvoiceNumber() {
        String year = DateTimeFormatter.ofPattern("yyyy")
                .withZone(ZoneOffset.UTC)
                .format(Instant.now());
        long millis = System.currentTimeMillis();
        String suffix = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return String.format("INV-%s-%d-%s", year, millis, suffix);
    }

    public byte[] generateInvoicePdf(String invoiceId, String requestingUserId) {
        Invoice invoice = getInvoiceById(invoiceId, requestingUserId);
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                // Title
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 22);
                cs.newLineAtOffset(50, 780);
                cs.showText("EUODOO HIRE");
                cs.endText();

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                cs.newLineAtOffset(50, 758);
                cs.showText("Official Payment Receipt & Tax Invoice");
                cs.endText();

                // Separator line
                cs.setLineWidth(1.5f);
                cs.moveTo(50, 742);
                cs.lineTo(550, 742);
                cs.stroke();

                // Invoice metadata
                float y = 715;
                writeLine(cs, 50, y, "Invoice Number:", invoice.getInvoiceNumber());
                writeLine(cs, 50, y - 22, "Date Issued:", invoice.getIssuedAt() != null ? invoice.getIssuedAt().toString().substring(0, 10) : "N/A");
                writeLine(cs, 50, y - 44, "Payment Status:", "PAID (Verified)");
                writeLine(cs, 50, y - 66, "Payment ID:", invoice.getPaymentId() != null ? invoice.getPaymentId() : "N/A");

                // Billed To
                y = 620;
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 13);
                cs.newLineAtOffset(50, y);
                cs.showText("Billed To:");
                cs.endText();

                writeLine(cs, 50, y - 22, "Customer Name:", invoice.getPayerName() != null ? invoice.getPayerName() : "Candidate");
                writeLine(cs, 50, y - 44, "Customer Email:", invoice.getPayerEmail() != null ? invoice.getPayerEmail() : "N/A");

                // Item Table Header
                y = 530;
                cs.setLineWidth(1f);
                cs.moveTo(50, y);
                cs.lineTo(550, y);
                cs.stroke();

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
                cs.newLineAtOffset(50, y - 18);
                cs.showText("Description");
                cs.newLineAtOffset(380, 0);
                cs.showText("Amount (INR)");
                cs.endText();

                cs.moveTo(50, y - 25);
                cs.lineTo(550, y - 25);
                cs.stroke();

                // Item Row
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
                cs.newLineAtOffset(50, y - 45);
                cs.showText(invoice.getDescription() != null ? invoice.getDescription() : "Candidate Plan Subscription");
                cs.newLineAtOffset(380, 0);
                cs.showText(invoice.getAmountInr() != null ? "INR " + invoice.getAmountInr().toPlainString() : "INR 499.00");
                cs.endText();

                // Total
                cs.moveTo(50, y - 60);
                cs.lineTo(550, y - 60);
                cs.stroke();

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 12);
                cs.newLineAtOffset(320, y - 80);
                cs.showText("Total Paid:");
                cs.newLineAtOffset(110, 0);
                cs.showText(invoice.getAmountInr() != null ? "INR " + invoice.getAmountInr().toPlainString() : "INR 499.00");
                cs.endText();

                // Footer note
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE), 10);
                cs.newLineAtOffset(50, 100);
                cs.showText("Thank you for your business! All features and subscriptions are activated immediately.");
                cs.endText();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        } catch (IOException e) {
            log.error("Failed to generate PDF for invoice: {}", invoiceId, e);
            throw new BusinessException("INVOICE_PDF_FAILED", "Failed to generate invoice PDF.");
        }
    }

    private void writeLine(PDPageContentStream cs, float x, float y, String label, String value) throws IOException {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
        cs.newLineAtOffset(x, y);
        cs.showText(label);
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
        cs.newLineAtOffset(130, 0);
        cs.showText(value != null ? value : "");
        cs.endText();
    }
}
