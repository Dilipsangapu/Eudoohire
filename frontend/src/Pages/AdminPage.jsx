
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, GENERIC_LOGIN_ERROR } from "../services/api";
import { toast } from "../components/Toast";
import "./LoginPage.css";
import "./AdminPage.css";

export default function AdminPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);
      // This private admin page only accepts accounts whose backend role is
      // CLIENT_ADMIN; the backend validates that before creating a session.
      const res = await authApi.login(email.trim(), password, "admin");
      toast.success("Logged in successfully. Redirecting...");
      const dest = res?.redirectUrl;
      if (dest) {
        // Admin dashboard is a Thymeleaf route served by Spring Boot.
        window.location.href = dest;
      }
    } catch (err) {
      // Privacy: every failed attempt (wrong credentials or an account of
      // another role) shows the SAME generic message — nothing is revealed
      // about account existence or its role.
      setError(GENERIC_LOGIN_ERROR);
      toast.error(GENERIC_LOGIN_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page admin-login-page">
      {/* Home icon */}
      <button
        type="button"
        className="admin-home-button"
        aria-label="Go to home page"
        title="Home"
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
      <section
        className="login-brand-panel"
        aria-label="Euodoo Hire administration"
      >
        <a
          href="/"
          className="login-brand"
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

          <span className="login-kicker">ADMINISTRATION PORTAL</span>
          <h1>Manage your platform with confidence.</h1>
          <p>
            Oversee recruitment activities, manage users, and keep
            your hiring platform running smoothly with Euodoo Hire.
          </p>
        </div>

        <div className="login-brand-footer">
          <span className="login-footer-dot" />
          One platform. Complete control.
        </div>

        <div className="login-orb login-orb-one" aria-hidden="true" />
        <div className="login-orb login-orb-two" aria-hidden="true" />
      </section>

      {/* Right login panel */}
      <section className="login-form-panel admin-form-panel">
        <form
          className="login-card admin-login-card"
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

          <div className="login-card-eyebrow">ADMIN PORTAL</div>

          <h2>Welcome, Admin</h2>

          <p className="login-subtitle">
            Sign in to access your administration dashboard.
          </p>

          <div className="admin-security-note">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <span>Secure administrator access</span>
          </div>

          <label className="login-label" htmlFor="admin-email">
            Admin email
          </label>

          <div className="login-input-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m4 7 8 6 8-6" />
            </svg>

            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              placeholder="admin@company.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              required
            />
          </div>

          <div className="admin-password-heading">
            <label className="login-label" htmlFor="admin-password">
              Password
            </label>
          </div>

          <div className="login-input-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>

            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              required
            />

            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7s-1.3 2.5-3.5 4.3M6.2 6.2C3.5 8.1 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <p className="admin-login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in to admin portal"}
            <span aria-hidden="true"> →</span>
          </button>

          <p className="admin-login-footer">
            Authorized administrators only.
          </p>
        </form>
      </section>
    </main>
  );
}
