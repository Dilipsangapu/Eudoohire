import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";
import { toast } from "../components/Toast";
import "./LoginPage.css";
import "./RecruiterLoginPage.css";
import "./RecruiterRegistrationPage.css";

const initialForm = {
    name: "",
    designation: "",
    department: "",
    companyType: "",
    companySize: "",
    companyName: "",
    website: "",
    cin: "",
    workEmail: "",
    phone: "",
    password: "",
};

export default function RecruiterRegistrationPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    function handleChange(event) {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setSuccessMessage("");

        if (!form.workEmail.trim()) {
            setError("Work email is required.");
            return;
        }

        if (!form.password || form.password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                ...form,
                email: form.workEmail.trim(),
                name: form.name.trim() || form.companyName.trim() + " Recruiter",
            };
            const res = await authApi.registerRecruiter(payload);
            toast.success("Recruiter registration submitted successfully! Your account is under review.");
            setSuccessMessage(
                res?.message ||
                "Recruiter registration submitted successfully! Your account and company profile are under review."
            );
        } catch (err) {
            setError(err.message || "Failed to register recruiter account.");
            toast.error(err.message || "Failed to register recruiter account.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="login-page recruiter-login-page recruiter-registration-page">
            <a
                href="/"
                className="recruiter-registration-home"
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

                    <span className="login-kicker">GROW YOUR TEAM</span>
                    <h1>Build your next great team.</h1>
                    <p>
                        Create your recruiter profile and get ready to discover talented
                        candidates with Euodoo Hire.
                    </p>
                </div>

                <div className="login-brand-footer">
                    <span className="login-footer-dot" />
                    Better hiring starts here.
                </div>

                <div className="login-orb login-orb-one" aria-hidden="true" />
                <div className="login-orb login-orb-two" aria-hidden="true" />
            </section>

            <section className="login-form-panel recruiter-registration-panel">
                <form
                    className="login-card recruiter-registration-card"
                    onSubmit={handleSubmit}
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

                    <div className="login-card-eyebrow">RECRUITER REGISTRATION</div>
                    <h2>Create your recruiter profile</h2>
                    <p className="login-subtitle">
                        Enter your professional and company details to get started.
                    </p>

                    {error && (
                        <div className="login-error-banner" role="alert" style={{ marginBottom: "16px" }}>
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="login-info-banner" role="status" style={{ marginBottom: "16px", background: "#f0fdf4", borderColor: "#86efac", color: "#166534" }}>
                            <span>✓</span>
                            <span>{successMessage}</span>
                        </div>
                    )}

                    <div className="recruiter-registration-fields">
                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="name">
                                Your full name
                            </label>
                            <input
                                className="recruiter-registration-input"
                                id="name"
                                name="name"
                                type="text"
                                placeholder="e.g. Sarah Jenkins"
                                value={form.name}
                                onChange={handleChange}
                                autoComplete="name"
                                required
                            />
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="designation">
                                Designation of recruiter
                            </label>
                            <input
                                className="recruiter-registration-input"
                                id="designation"
                                name="designation"
                                type="text"
                                placeholder="e.g. HR Manager"
                                value={form.designation}
                                onChange={handleChange}
                                autoComplete="organization-title"
                                required
                            />
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="department">
                                Department
                            </label>
                            <select
                                className="recruiter-registration-input"
                                id="department"
                                name="department"
                                value={form.department}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select department</option>
                                <option value="Human Resources">Human Resources</option>
                                <option value="Talent Acquisition">Talent Acquisition</option>
                                <option value="Recruitment">Recruitment</option>
                                <option value="Administration">Administration</option>
                                <option value="Management">Management</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="companyType">
                                Type of company
                            </label>
                            <select
                                className="recruiter-registration-input"
                                id="companyType"
                                name="companyType"
                                value={form.companyType}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select company type</option>
                                <option value="Private Limited">Private Limited</option>
                                <option value="Public Limited">Public Limited</option>
                                <option value="LLP">Limited Liability Partnership (LLP)</option>
                                <option value="Partnership">Partnership</option>
                                <option value="Proprietorship">Proprietorship</option>
                                <option value="Startup">Startup</option>
                                <option value="Recruitment Agency">Recruitment Agency</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="companySize">
                                Company size
                            </label>
                            <select
                                className="recruiter-registration-input"
                                id="companySize"
                                name="companySize"
                                value={form.companySize}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select company size</option>
                                <option value="1-10">1–10 employees</option>
                                <option value="11-50">11–50 employees</option>
                                <option value="51-200">51–200 employees</option>
                                <option value="201-500">201–500 employees</option>
                                <option value="501-1000">501–1,000 employees</option>
                                <option value="1001-5000">1,001–5,000 employees</option>
                                <option value="5001+">5,001+ employees</option>
                            </select>
                        </div>


                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="companyName">
                                Company name
                            </label>

                            <input
                                className="recruiter-registration-input"
                                id="companyName"
                                name="companyName"
                                type="text"
                                placeholder="Enter your company name"
                                value={form.companyName}
                                onChange={handleChange}
                                autoComplete="organization"
                                required
                            />
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="website">
                                Company official website
                            </label>
                            <input
                                className="recruiter-registration-input"
                                id="website"
                                name="website"
                                type="url"
                                placeholder="https://www.company.com"
                                value={form.website}
                                onChange={handleChange}
                                autoComplete="url"
                                required
                            />
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="cin">
                                CIN
                            </label>
                            <input
                                className="recruiter-registration-input"
                                id="cin"
                                name="cin"
                                type="text"
                                placeholder="Enter company CIN"
                                value={form.cin}
                                onChange={handleChange}
                                maxLength={21}
                                autoCapitalize="characters"
                                required
                            />
                            <small className="recruiter-registration-hint">
                                Enter your company's Corporate Identification Number.
                            </small>
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="workEmail">
                                Work email
                            </label>
                            <input
                                className="recruiter-registration-input"
                                id="workEmail"
                                name="workEmail"
                                type="email"
                                placeholder="you@company.com"
                                value={form.workEmail}
                                onChange={handleChange}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="phone">
                                Phone number
                            </label>
                            <input
                                className="recruiter-registration-input"
                                id="phone"
                                name="phone"
                                type="tel"
                                placeholder="+1 (555) 000-0000"
                                value={form.phone}
                                onChange={handleChange}
                                autoComplete="tel"
                            />
                        </div>

                        <div className="recruiter-registration-field">
                            <label className="login-label" htmlFor="password">
                                Account password
                            </label>
                            <div className="login-input-wrap">
                                <input
                                    className="recruiter-registration-input"
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Minimum 8 characters"
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    className="login-eye"
                                    onClick={() => setShowPassword((v) => !v)}
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
                        </div>
                    </div>

                    <button className="login-submit" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Registering..." : "Register as recruiter"} <span aria-hidden="true">→</span>
                    </button>

                    <p className="recruiter-switch-link">
                        Already registered?{" "}
                        <button type="button" onClick={() => navigate("/recruiter-login")}>
                            Sign in
                        </button>
                    </p>

                    {/* <p className="login-back-link">
                        <button type="button" onClick={() => navigate("/")}>
                            ← Back to home
                        </button>
                    </p> */}
                </form>
            </section>
        </main>
    );
}
