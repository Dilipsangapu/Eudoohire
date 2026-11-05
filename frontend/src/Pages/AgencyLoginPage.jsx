import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "../components/Toast";
import "./AgencyLogin.css";

export default function AgencyLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState(
    localStorage.getItem("rememberAgencyEmail") || ""
  );
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(
    Boolean(localStorage.getItem("rememberAgencyEmail"))
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState("");
  const [alertType, setAlertType] = useState("info");
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);

  // Live status lookup when agency enters official email (with anti-stale check)
  useEffect(() => {
    let active = true;
    const clean = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setLiveStatus(null);
      setIsPendingApproval(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/agencies/registration-status?identifier=${encodeURIComponent(clean)}`,
          { signal: controller.signal }
        );
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          setLiveStatus(data);
          if (
            data.registrationStatus &&
            data.registrationStatus !== "APPROVED" &&
            data.registrationStatus !== "REJECTED"
          ) {
            setIsPendingApproval(true);
          } else if (data.registrationStatus === "APPROVED") {
            setIsPendingApproval(false);
          } else if (data.registrationStatus === "REJECTED") {
            setIsPendingApproval(false);
          }
        } else {
          if (active) setLiveStatus(null);
        }
      } catch (err) {
        if (err.name !== "AbortError" && active) {
          setLiveStatus(null);
        }
      }
    }, 400);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [email]);

  async function submit(e) {
    e.preventDefault();
    setAlert("");
    setIsPendingApproval(false);

    const cleanEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setAlert("Please enter a valid agency email address.");
      setAlertType("error");
      return;
    }

    if (password.length < 6) {
      setAlert("Password must be at least 6 characters.");
      setAlertType("error");
      return;
    }

    if (remember) {
      localStorage.setItem("rememberAgencyEmail", cleanEmail);
    } else {
      localStorage.removeItem("rememberAgencyEmail");
    }

    setLoading(true);

    try {
      await login(cleanEmail, password, "agency");
      toast.success("Agency authenticated successfully. Redirecting...");
      navigate("/agency-dashboard", { replace: true });
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const data = err?.data || err?.response?.data;
      if (
        status === 403 ||
        data?.error === "ACCOUNT_NOT_ACTIVE" ||
        data?.error === "ACCOUNT_LOCKED" ||
        data?.status === "PENDING_APPROVAL" ||
        err?.message?.includes("PENDING_APPROVAL") ||
        err?.message?.includes("ACCOUNT_LOCKED") ||
        err?.message?.includes("locked or pending approval") ||
        err?.message?.includes("administrator must approve") ||
        (liveStatus && liveStatus.registrationStatus && liveStatus.registrationStatus !== "APPROVED" && liveStatus.registrationStatus !== "REJECTED")
      ) {
        setIsPendingApproval(true);
        setAlert(
          "Your agency registration is currently under review by the platform administrator. You will be able to log in once approved."
        );
        setAlertType("warning");
      } else if (
        data?.status === "REJECTED" ||
        err?.message?.includes("REJECTED") ||
        (liveStatus && liveStatus.registrationStatus === "REJECTED")
      ) {
        setIsPendingApproval(false);
        const reason = liveStatus?.rejectionReason ? ` Reason: ${liveStatus.rejectionReason}` : "";
        setAlert(
          `Your agency registration was not approved by the administrator.${reason}`
        );
        setAlertType("error");
      } else {
        setIsPendingApproval(false);
        setAlert(
          data?.message || err?.message || "Invalid agency email or password. Please verify your credentials."
        );
        setAlertType("error");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="agency-login-page">
      {/* Home button */}
      <button
        type="button"
        className="agency-home-button"
        aria-label="Go to home page"
        title="Back to home"
        onClick={() => navigate("/")}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9" />
          <path d="M9 21v-7h6v7" />
        </svg>
      </button>

      {/* Left branding panel */}
      <section className="agency-brand-panel" aria-label="Euodoo Hire Agency introduction">
        <header className="agency-brand-header">
          <Link to="/" className="agency-auth-logo" aria-label="Euodoo Hire home">
            <span className="agency-auth-logo-badge">E</span>
            <strong>
              Euodoo<em>Hire</em>
            </strong>
          </Link>
        </header>

        <div className="agency-brand-center">
          <div className="agency-auth-pill">
            <span className="pill-dot" aria-hidden="true" />
            JOB CONSULTANCY PORTAL
          </div>

          <div className="agency-brand-hero">
            <h1>
              Welcome back to
              <br />
              your agency portal
            </h1>
            <p>
              Log in to manage candidates, track client submissions, and fulfill live enterprise requirements seamlessly.
            </p>
          </div>

          {/* Floating decorative metric pill */}
          <div className="agency-brand-floating-chip" aria-hidden="true">
            <span className="chip-icon">⚡</span>
            <div className="chip-text">
              <strong>Verified Agency Network</strong>
              <small>Real-time candidate submission pipeline</small>
            </div>
          </div>
        </div>

        <div className="agency-brand-footer">
          <ul className="agency-auth-benefits">
            <li>
              <span className="check-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              </span>
              <span>Manage your dedicated candidate pool</span>
            </li>
            <li>
              <span className="check-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              </span>
              <span>Track every interview & placement status</span>
            </li>
            <li>
              <span className="check-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                </svg>
              </span>
              <span>Access active mandates from top employers</span>
            </li>
          </ul>

          <div className="agency-brand-meta">
            <span className="agency-meta-dot" aria-hidden="true" />
            <span>Trusted recruitment consultancy platform</span>
          </div>
        </div>

        {/* Decorative background ambient elements */}
        <div className="login-orb-one" aria-hidden="true" />
        <div className="login-orb-two" aria-hidden="true" />
        <div className="login-grid-pattern" aria-hidden="true" />
      </section>

      {/* Right login section */}
      <section className="agency-form-panel">
        <div className="agency-login-card">
          {/* Mobile-only brand header */}
          <div className="agency-mobile-brand">
            <Link to="/" className="agency-auth-logo">
              <span className="agency-auth-logo-badge">E</span>
              <strong>
                Euodoo<em>Hire</em>
              </strong>
            </Link>
          </div>

          <header className="form-header">
            <span className="form-eyebrow">OFFICIAL CONSULTANCY ACCESS</span>
            <h2 className="form-title">Agency Login</h2>
            <p className="form-subtitle">
              Enter your registered official email and password to continue.
            </p>
          </header>

          <form className="login-form" onSubmit={submit}>
            <div className="form-group">
              <label className="form-label" htmlFor="agency-login-email">
                Email Address <span className="required-star">*</span>
              </label>

              <div className="input-wrapper with-icon">
                <svg
                  className="input-field-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <polyline points="3 7 12 13 21 7" />
                </svg>
                <input
                  id="agency-login-email"
                  className="form-input"
                  type="email"
                  autoComplete="email"
                  placeholder="name@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Live Status indicator when typing */}
              {liveStatus && (
                <div
                  className={`agency-live-status-pill ${
                    liveStatus.registrationStatus === "APPROVED"
                      ? "approved"
                      : liveStatus.registrationStatus === "REJECTED"
                        ? "rejected"
                        : "pending"
                  }`}
                >
                  {liveStatus.registrationStatus === "APPROVED" && (
                    <span>
                      ✅ <strong>Verified Agency</strong>: {liveStatus.agencyName} is approved.
                    </span>
                  )}
                  {liveStatus.registrationStatus === "REJECTED" && (
                    <span>
                      ❌ <strong>Registration Rejected</strong>: {liveStatus.agencyName} was not approved. {liveStatus.rejectionReason || ""}
                    </span>
                  )}
                  {liveStatus.registrationStatus !== "APPROVED" &&
                    liveStatus.registrationStatus !== "REJECTED" && (
                      <span>
                        ⏳ <strong>Live Status</strong>: {liveStatus.agencyName || "Agency"} is <strong>Under Admin Review</strong>.
                      </span>
                    )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="agency-login-password">
                Password <span className="required-star">*</span>
              </label>

              <div className="input-wrapper with-icon password-input-wrapper">
                <svg
                  className="input-field-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="agency-login-password"
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <path d="m1 1 22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <Link className="forgot-link-btn" to="/agency-forgot-password">
                Forgot Password?
              </Link>
            </div>

            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? (
                <span className="submit-spinner-wrap">
                  <span className="submit-spinner" aria-hidden="true" />
                  Signing in...
                </span>
              ) : (
                <span>Login</span>
              )}
            </button>

            {/* Prominent Under Admin Review Banner */}
            {isPendingApproval ? (
              <div className="agency-approval-card" role="alert">
                <div className="agency-approval-badge">
                  <span className="approval-dot" aria-hidden="true" /> Under Admin Review
                </div>
                <h4 className="agency-approval-title">
                  Agency Registration Awaiting Administrator Verification
                </h4>
                <p className="agency-approval-desc">
                  Your registration has been submitted and is currently being reviewed by our platform administration team. You will be able to log in to access the Agency Dashboard immediately once your account is approved.
                </p>
                <div className="agency-approval-footer">
                  <span>
                    Need fast verification? Contact support at{" "}
                    <strong>admin@euodoo.dev</strong>
                  </span>
                </div>
              </div>
            ) : alert ? (
              <div className={`form-alert ${alertType}`} role="status">
                {alert}
              </div>
            ) : null}

            <div className="form-footer">
              <span className="footer-text">New to Euodoo Hire?</span>
              <Link className="register-link-btn" to="/agency-register">
                Register as an Agency →
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
