
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, GENERIC_LOGIN_ERROR } from "../services/api";
import { toast } from "../components/Toast";
import "./LoginPage.css";
import "./RecruiterLoginPage.css";

function RecruiterLoginSkeleton() {
  return (
    <div
      className="login-skeleton-card"
      role="status"
      aria-label="Loading recruiter sign-in form"
    >
      <span className="login-skeleton login-skeleton-brand" />
      <span className="login-skeleton login-skeleton-eyebrow" />
      <span className="login-skeleton login-skeleton-title" />
      <span className="login-skeleton login-skeleton-subtitle" />

      <div className="login-skeleton-socials">
        <span className="login-skeleton login-skeleton-social" />
        <span className="login-skeleton login-skeleton-social" />
      </div>

      <span className="login-skeleton login-skeleton-divider" />
      <span className="login-skeleton login-skeleton-label" />
      <span className="login-skeleton login-skeleton-input" />
      <span className="login-skeleton login-skeleton-label" />
      <span className="login-skeleton login-skeleton-input login-skeleton-password" />
      <span className="login-skeleton login-skeleton-remember" />
      <span className="login-skeleton login-skeleton-submit" />
      <span className="login-skeleton login-skeleton-back" />

      <span className="sr-only">Loading recruiter sign-in form...</span>
    </div>
  );
}

export default function RecruiterLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    () => localStorage.getItem("euodoo-recruiter-email") || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(
    Boolean(localStorage.getItem("euodoo-recruiter-email"))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsLoading(false);
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, []);

  /**
   * Follows the redirect destination issued by the backend after a successful
   * login. The URL always comes from server-side identity data, never from
   * frontend-supplied role values.
   */
  function followBackendRedirect(res) {
    const dest = res?.redirectUrl;
    if (!dest) return false;
    if (/^\/(recruiter|client-admin|admin)(\/|$)/.test(dest)) {
      window.location.href = dest; // Thymeleaf dashboards served by Spring Boot
    } else {
      navigate(dest); // React routes (defensive fallback)
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (remember) {
      localStorage.setItem("euodoo-recruiter-email", email.trim());
    } else {
      localStorage.removeItem("euodoo-recruiter-email");
    }

    try {
      setIsSubmitting(true);
      // This page only accepts accounts whose backend role is RECRUITER; the
      // backend validates that before creating a session.
      const res = await authApi.login(email.trim(), password, "recruiter");
      toast.success("Logged in successfully. Redirecting...");
      followBackendRedirect(res);
    } catch (err) {
      // Privacy: every failed attempt (wrong credentials or an account of
      // another role) shows the SAME generic message — nothing is revealed
      // about account existence or its role.
      setError(GENERIC_LOGIN_ERROR);
      toast.error(GENERIC_LOGIN_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className={`login-page recruiter-login-page${isLoading ? " is-loading" : ""}`}
    >
      <a
        href="/"
        className="recruiter-home-button"
        aria-label="Go to home page"
        title="Home"
        onClick={(event) => {
          event.preventDefault();
          navigate("/");
        }}
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
      </a>
      <section
        className="login-brand-panel"
        aria-label="Euodoo Hire recruiter introduction"
      >
        <a
          className="login-brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
          aria-label="Euodoo Hire home"
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

          <span className="login-kicker">YOUR TALENT. YOUR NEXT HIRE.</span>
          <h1>Build great teams, one hire at a time.</h1>
          <p>
            Discover talented candidates, manage job opportunities, and make
            your recruitment process simpler with Euodoo Hire.
          </p>
        </div>

        <div className="login-brand-footer">
          <span className="login-footer-dot" />
          Find talent. Create opportunities.
        </div>

        <div className="login-orb login-orb-one" aria-hidden="true" />
        <div className="login-orb login-orb-two" aria-hidden="true" />
      </section>

      <section className="login-form-panel recruiter-form-panel">
        {isLoading ? (
          <RecruiterLoginSkeleton />
        ) : (
          <form className="login-card recruiter-login-card" onSubmit={handleSubmit}>
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

            <div className="login-card-eyebrow">RECRUITER PORTAL</div>
            <h2>Welcome back, Recruiter</h2>
            <p className="login-subtitle">
              Sign in to manage your hiring activities.
            </p>

            {/* <div className="login-social-row">
              <button
                type="button"
                className="login-social"
                onClick={() =>
                  window.alert(
                    "Connect Google recruiter authentication to your backend."
                  )
                }
              >
                <svg
                  className="google-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 18l6.8-5.3Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M24 12.2c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.2 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.1 11.4-8.1Z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                className="login-social"
                onClick={() =>
                  window.alert(
                    "Connect LinkedIn recruiter authentication to your backend."
                  )
                }
              >
                <span className="linkedin-in">in</span>
                <span>LinkedIn</span>
              </button>
            </div> */}

            {/* <div className="login-divider">
              <span />
              <small>OR CONTINUE WITH EMAIL</small>
              <span />
            </div> */}

            {error && (
              <div className="login-error-banner" role="alert" style={{ marginBottom: "16px" }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <label className="login-label" htmlFor="recruiter-email">
              Work email
            </label>
            <div className="login-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
              <input
                id="recruiter-email"
                type="email"
                autoComplete="username"
                placeholder="recruiter@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="login-password-heading">
              <label className="login-label" htmlFor="recruiter-password">
                Password
              </label>
              <button
                type="button"
                className="login-text-button"
                onClick={() => navigate("/recruiter-forgot-password")}
              >
                Forgot password?
              </button>
            </div>

            <div className="login-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="recruiter-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.8M6.2 6.2C3.5 8.1 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                )}
              </button>
            </div>

            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>Remember me on this device</span>
            </label>

            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in to recruiter portal"} <span aria-hidden="true">→</span>
            </button>

            {/* <p className="recruiter-switch-link">
              Looking for a job?{" "}
              <button type="button" onClick={() => navigate("/login")}>
                Candidate login
              </button>
            </p> */}

            <p className="recruiter-register-link">
              New to Euodoo Hire?{" "}
              <button
                type="button"
                onClick={() => navigate("/recruiter-register")}
              >
                Register as recruiter →
              </button>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
