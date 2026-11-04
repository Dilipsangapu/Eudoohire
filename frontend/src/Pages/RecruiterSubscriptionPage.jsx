/**
 * RecruiterSubscriptionPage
 *
 * Displays the recruiter subscription plan (₹999) with Razorpay checkout.
 * Shown as a modal/overlay when recruiter tries to access candidate search
 * without an active subscription, or via the "Subscribe" button in dashboard.
 *
 * Usage:
 *   import RecruiterSubscriptionPage from "./RecruiterSubscriptionPage";
 *   <RecruiterSubscriptionPage onSuccess={handleSuccess} onClose={handleClose} />
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

export default function RecruiterSubscriptionPage({ onSuccess, onClose }) {
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

      const order = await subscriptionApi.createRecruiterOrder();

      const options = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Euodoo Hire",
        description: "Recruiter Subscription Plan",
        order_id: order.gatewayOrderId,
        prefill: {},
        theme: { color: "#0f9488" },
        handler: async (response) => {
          try {
            const result = await subscriptionApi.verifyRecruiterPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            toast.success("🎉 Recruiter subscription activated! You can now search candidates.");
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
    <div
      className="sub-page-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="sub-page-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Recruiter Subscription"
      >
        {onClose && (
          <button
            className="sub-modal-close"
            onClick={onClose}
            aria-label="Close subscription dialog"
          >
            ✕
          </button>
        )}

        <div className="sub-modal-header">
          <div className="sub-plan-icon">🔓</div>
          <h2 className="sub-modal-title">Recruiter Plan</h2>
          <p className="sub-modal-subtitle">
            Access candidate profiles, search talent, and view contact details.
          </p>
        </div>

        {loading ? (
          <div className="sub-loading">Loading subscription status…</div>
        ) : (
          <>
            {isActive ? (
              <div className="sub-status-banner sub-status-active">
                <span className="sub-status-dot" />
                <div>
                  <strong>Subscription Active</strong>
                  <div className="sub-status-detail">
                    Valid until {expiresDate} &nbsp;·&nbsp; Candidates access: Unlocked
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
                      ? `Expired on ${expiresDate}. Renew to continue accessing candidates.`
                      : "Payment failed or was cancelled. Subscribe below."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="sub-status-banner sub-status-none">
                <span className="sub-status-dot" />
                <div>
                  <strong>Subscription Required</strong>
                  <div className="sub-status-detail">
                    Subscribe to unlock candidate search and contact details.
                  </div>
                </div>
              </div>
            )}

            <div className="sub-plan-card">
              <div className="sub-plan-price-row">
                <span className="sub-plan-currency">₹</span>
                <span className="sub-plan-amount">999</span>
                <span className="sub-plan-period">/ {status?.durationDays ?? 30} days</span>
              </div>

              <ul className="sub-plan-features">
                <li>✓ Full candidate profile access</li>
                <li>✓ Email & phone contact details</li>
                <li>✓ Advanced candidate search & filters</li>
                <li>✓ Shortlist and track candidates</li>
                <li>✓ Resume download access</li>
                <li>✓ Direct hire request submission</li>
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
                  {paying ? "Processing…" : "Subscribe Now — ₹999"}
                </button>
              )}
            </div>

            <p className="sub-modal-footer-note">
              Payments are processed securely by Razorpay. Access is granted immediately after payment verification.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
