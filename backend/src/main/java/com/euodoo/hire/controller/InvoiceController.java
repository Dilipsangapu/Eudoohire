package com.euodoo.hire.controller;

import com.euodoo.hire.model.Invoice;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.InvoiceService;
import com.euodoo.hire.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * Invoice retrieval endpoints.
 * Only the authorized payer can view their own invoices.
 *
 * CRITICAL FIX C3: principal.getUsername() returns the email (Spring Security
 * uses email as username). InvoiceService.getInvoicesForUser expects a MongoDB
 * user ID. We resolve the userId from the email before calling the service,
 * which ensures ownership checks compare like-for-like values.
 */
@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Page<Invoice>> getMyInvoices(
            @AuthenticationPrincipal UserDetails principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(invoiceService.getInvoicesForUser(userId, page, Math.min(size, 50)));
    }

    @GetMapping("/{invoiceId}")
    public ResponseEntity<Invoice> getInvoice(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String invoiceId) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(invoiceService.getInvoiceById(invoiceId, userId));
    }

    @GetMapping("/number/{invoiceNumber}")
    public ResponseEntity<Invoice> getByNumber(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String invoiceNumber) {
        String userId = resolveUserId(principal);
        return ResponseEntity.ok(invoiceService.getInvoiceByNumber(invoiceNumber, userId));
    }

    @GetMapping("/{invoiceId}/download")
    public ResponseEntity<byte[]> downloadInvoicePdf(
            @AuthenticationPrincipal UserDetails principal,
            @PathVariable String invoiceId) {
        String userId = resolveUserId(principal);
        Invoice invoice = invoiceService.getInvoiceById(invoiceId, userId);
        byte[] pdfBytes = invoiceService.generateInvoicePdf(invoiceId, userId);

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.APPLICATION_PDF_VALUE)
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"Invoice-" + invoice.getInvoiceNumber() + ".pdf\"")
                .body(pdfBytes);
    }

    @GetMapping("/latest/download")
    public ResponseEntity<byte[]> downloadLatestInvoicePdf(
            @AuthenticationPrincipal UserDetails principal) {
        String userId = resolveUserId(principal);
        Page<Invoice> invoices = invoiceService.getInvoicesForUser(userId, 0, 1);
        if (invoices.isEmpty()) {
            throw new ResourceNotFoundException("No invoice found for user", userId);
        }
        Invoice latest = invoices.getContent().get(0);
        return downloadInvoicePdf(principal, latest.getId());
    }

    /**
     * Resolves the MongoDB user ID from the authenticated principal's email.
     * Spring Security stores email as the username; service layer requires the MongoDB ID.
     */
    private String resolveUserId(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .map(u -> u.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User with email", principal.getUsername()));
    }
}
