/**
 * CandidateSubscriptionPage
 *
 * Displays the candidate subscription plan (₹499) with status and Razorpay checkout.
 * Loaded inline in the UnPaid/Paid dashboard via the "Upgrade to Pro" / "Plan & Upgrade"
 * buttons — rendered as a modal or dedicated section.
 *
 * Usage:
 *   import CandidateSubscriptionPage from "./CandidateSubscriptionPage";
 *   <CandidateSubscriptionPage onSuccess={handleSuccess} onClose={handleClose} />
 */
import { useState, useEffect, useCallback } from "react";
import { subscriptionApi } from "../services/api";
import { toast } from "../components/Toast";
import "./SubscriptionPage.css";

const RAZORPAY_SDK_URL = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK_URL;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CandidateSubscriptionPage({ onSuccess, onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await subscriptionApi.getStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSubscribe = async () => {
    setPaying(true);
    try {
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        toast.error("Failed to load payment gateway. Please refresh and try again.");
        return;
      }

      const order = await subscriptionApi.createCandidateOrder();

      const options = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Euodoo Hire",
        description: "Candidate Subscription Plan",
        order_id: order.gatewayOrderId,
        prefill: {},
        theme: { color: "#0f9488" },
        handler: async (response) => {
          try {
            const result = await subscriptionApi.verifyCandidatePayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            toast.success("🎉 Subscription activated! Welcome to Euodoo Hire Premium.");
            await fetchStatus();
            if (onSuccess) onSuccess(result);
          } catch (err) {
            toast.error(
              err?.message || "Payment verification failed. Contact support if amount was deducted."
            );
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            toast.warning("Payment cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setPaying(false);
        toast.error("Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err) {
      toast.error(err?.message || "Could not initiate payment. Please try again.");
      setPaying(false);
    }
  };

  const isActive =
    status?.active &&
    status?.expiresAt &&
    new Date(status.expiresAt) > new Date();

  const expiresDate = status?.expiresAt
    ? new Date(status.expiresAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="sub-page-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sub-page-modal" role="dialog" aria-modal="true" aria-label="Candidate Subscription">
        {/* Close */}
        {onClose && (
          <button className="sub-modal-close" onClick={onClose} aria-label="Close subscription dialog">
            ✕
          </button>
        )}

        <div className="sub-modal-header">
          <div className="sub-plan-icon">👑</div>
          <h2 className="sub-modal-title">Premium Career Pro</h2>
          <p className="sub-modal-subtitle">
            Unlock full platform access — gold crown profile badge, top recruiter priority, ATS optimizer, and portfolio hosting.
          </p>
        </div>

        {loading ? (
          <div className="sub-loading">Loading subscription status…</div>
        ) : (
          <>
            {/* Current Status Banner */}
            {isActive ? (
              <div className="sub-status-banner sub-status-active">
                <span className="sub-status-dot" />
                <div>
                  <strong>Subscription Active</strong>
                  <div className="sub-status-detail">
                    Valid until {expiresDate} &nbsp;·&nbsp; Plan: {status?.planName || "CANDIDATE_PLAN"}
                  </div>
                </div>
              </div>
            ) : status?.hasSubscription ? (
              <div className="sub-status-banner sub-status-expired">
                <span className="sub-status-dot" />
                <div>
                  <strong>Subscription {status?.status}</strong>
                  <div className="sub-status-detail">
                    {status?.status === "EXPIRED"
                      ? `Expired on ${expiresDate}. Renew below to restore access.`
                      : "Payment failed or was cancelled. Subscribe below to activate."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="sub-status-banner sub-status-none">
                <span className="sub-status-dot" />
                <div>
                  <strong>No Active Subscription</strong>
                  <div className="sub-status-detail">Subscribe to unlock premium features.</div>
                </div>
              </div>
            )}

            {/* Plan Card */}
            <div className="sub-plan-card">
              <div className="sub-plan-price-row">
                <span className="sub-plan-currency">₹</span>
                <span className="sub-plan-amount">499</span>
                <span className="sub-plan-period">/ {status?.durationDays ?? 30} days</span>
              </div>

              <ul className="sub-plan-features">
                <li>✓ Resume Templates — 40+ designs</li>
                <li>✓ ATS Optimizer — unlimited checks</li>
                <li>✓ Portfolio Website Builder</li>
                <li>✓ Priority placement to recruiters</li>
                <li>✓ Profile view alerts</li>
                <li>✓ Document cloud storage</li>
              </ul>

              <div className="sub-plan-note">
                One-time payment · No auto-renewal · Secure via Razorpay
              </div>

              {isActive ? (
                <div className="sub-plan-btn sub-plan-btn--active" aria-disabled="true">
                  ✓ Already Subscribed
                </div>
              ) : (
                <button
                  className="sub-plan-btn sub-plan-btn--buy"
                  onClick={handleSubscribe}
                  disabled={paying}
                >
                  {paying ? "Processing…" : "Subscribe Now — ₹499"}
                </button>
              )}
            </div>

            <p className="sub-modal-footer-note">
              Payments are processed securely by Razorpay. Your financial data is never stored on our servers.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
