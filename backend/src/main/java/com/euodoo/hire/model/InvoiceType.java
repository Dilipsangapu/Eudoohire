package com.euodoo.hire.model;

/**
 * Classification of invoices according to the billed platform service.
 */
public enum InvoiceType {
    /** Invoice issued for candidate subscription plan purchases or upgrades. */
    SUBSCRIPTION,
    /** Invoice issued to recruiters for successful candidate placement hiring fees. */
    HIRING_FEE
}
