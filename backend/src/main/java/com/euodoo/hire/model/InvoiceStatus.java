package com.euodoo.hire.model;

/**
 * Legal and accounting lifecycle states of a customer Invoice.
 */
public enum InvoiceStatus {
    /** Valid, finalized invoice generated upon confirmed payment capture. */
    ISSUED,
    /** Cancelled or voided invoice invalidating previous billing record. */
    VOID
}
