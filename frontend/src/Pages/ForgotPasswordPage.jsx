
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import "./ForgotPasswordPage.css";
import { toast } from "../components/Toast.jsx";

export default function ForgotPasswordPage({ accountType = "candidate" }) {
  const navigate = useNavigate();

  const isRecruiter = accountType === "recruiter";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loginPath = isRecruiter ? "/recruiter-login" : "/login";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, accountType })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const msg = data.message || "Password reset instructions have been sent to your email address.";
        setMessage(msg);
        toast.success(msg);
      } else {
        const msg = data.message || "Could not process password reset request.";
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "Network error. Please try again later.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page forgot-password-page">
      <button
        type="button"
        className="login-home-button"
        onClick={() => navigate("/")}
        aria-label="Go to home page"
        title="Home"
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
          <path d="M5 9v11h14V9" />
          <path d="M9 20v-7h6v7" />
        </svg>
      </button>

      <section
        className="login-brand-panel"
        aria-label="Euodoo Hire introduction"
      >
        <a
          className="login-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <span className="login-brand-mark" aria-hidden="true" />
          <span>EUODOO HIRE</span>
        </a>

        <div className="login-brand-copy">
          <div className="career-animation" aria-hidden="true">
            <div className="career-glow career-glow-one" />
            <div className="career-glow career-glow-two" />

            <div className="career-floating-card career-resume">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <circle cx="10" cy="9" r="2" />
                <path d="M7.5 15h9M7.5 18h6" />
              </svg>
              <span className="career-card-lines">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="career-floating-card career-briefcase">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
              </svg>
            </div>

            <span className="career-spark career-spark-one" />
            <span className="career-spark career-spark-two" />
            <span className="career-spark career-spark-three" />
          </div>

          <span className="login-kicker">ACCOUNT RECOVERY</span>

          <h1>Let's get you back on track.</h1>

          <p>
            {isRecruiter
              ? "Recover access to your recruiter account and continue building great teams with Euodoo Hire."
              : "Recover access to your account and get back to discovering opportunities with Euodoo Hire."}
          </p>
        </div>

        <div className="login-brand-footer">
          <span className="login-footer-dot" />
          Your next step starts here.
        </div>

        <div className="login-orb login-orb-one" aria-hidden="true" />
        <div className="login-orb login-orb-two" aria-hidden="true" />
      </section>

      <section className="login-form-panel forgot-password-form-panel">
        <form
          className="login-card forgot-password-card"
          onSubmit={handleSubmit}
          noValidate
        >
          <a
            className="login-mobile-brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
          >
            <span className="login-brand-mark" aria-hidden="true" />
            EUODOO HIRE
          </a>

          <div className="login-card-eyebrow">
            {isRecruiter ? "RECRUITER ACCOUNT" : "CANDIDATE ACCOUNT"}
          </div>

          <h2>Forgot password?</h2>

          <p className="login-subtitle">
            Enter your registered {isRecruiter ? "work " : ""}email address.
            We'll help you recover your account.
          </p>

          <label className="login-label" htmlFor="forgot-password-email">
            {isRecruiter ? "Work email" : "Email address"}
          </label>

          <div className="login-input-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m4 7 8 6 8-6" />
            </svg>

            <input
              id="forgot-password-email"
              type="email"
              autoComplete="email"
              placeholder={
                isRecruiter ? "recruiter@company.com" : "you@hrmodule.com"
              }
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
                setMessage("");
              }}
              required
            />
          </div>

          {error && (
            <p className="forgot-password-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="forgot-password-success" role="status">
              {message}
            </p>
          )}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Reset password"} <span aria-hidden="true">→</span>
          </button>

          <p className="forgot-password-back">
            Remember your password?{" "}
            <button
              type="button"
              onClick={() => navigate(loginPath)}
            >
              Back to sign in
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
