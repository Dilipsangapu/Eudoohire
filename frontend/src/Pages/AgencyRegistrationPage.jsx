import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "../components/Toast";
import { csrfHeaders } from "../services/api";
import "./LoginPage.css";
import "./RecruiterLoginPage.css";
import "./AgencyRegistration.css";

const steps = ["Agency Details", "Representative", "Office Address", "Documents & Credentials"];

const initial = {
  agencyName: "",
  agencyType: "Recruitment Agency",
  regNumber: "",
  establishmentYear: "",
  website: "",
  email: "",
  phone: "",
  altPhone: "",
  repName: "",
  designation: "Owner / Founder",
  repEmail: "",
  repMobile: "",
  linkedin: "",
  address1: "",
  address2: "",
  country: "India",
  state: "",
  city: "",
  pin: "",
  officeModel: "Physical Office",
  pan: "",
  repId: "",
  password: "",
  confirmPassword: "",
  declaration: false,
};

const fields = [
  [
    { key: "agencyName", label: "Agency / Company Name", required: true },
    {
      key: "agencyType",
      label: "Agency Type",
      type: "select",
      options: ["Recruitment Agency", "Job Consultancy", "Staffing Agency"],
      required: true,
    },
    { key: "regNumber", label: "Registration / License Number", required: true },
    { key: "establishmentYear", label: "Year of Establishment", type: "number", required: true },
    { key: "website", label: "Agency Website", type: "text", required: true },
    { key: "email", label: "Official Email Address", type: "email", required: true },
    { key: "phone", label: "Contact Number", type: "tel", required: true },
    { key: "altPhone", label: "Alternate Contact Number", type: "tel" },
  ],
  [
    { key: "repName", label: "Authorized Representative Name", required: true },
    {
      key: "designation",
      label: "Designation / Role",
      type: "select",
      options: ["Owner / Founder", "Director", "Recruitment Manager", "HR Manager", "Authorized Signatory", "Other"],
      required: true,
    },
    { key: "repEmail", label: "Representative Email", type: "email", required: true },
    { key: "repMobile", label: "Direct Mobile Number", type: "tel", required: true },
    { key: "linkedin", label: "LinkedIn Profile URL", type: "url" },
  ],
  [
    { key: "address1", label: "Office Address Line 1", required: true },
    { key: "address2", label: "Office Address Line 2" },
    { key: "country", label: "Country", required: true },
    { key: "state", label: "State / Union Territory", required: true },
    { key: "city", label: "City / District", required: true },
    { key: "pin", label: "Postal PIN Code", required: true },
    {
      key: "officeModel",
      label: "Office Presence Model",
      type: "select",
      options: ["Physical Office", "Remote / Virtual", "Hybrid"],
      required: true,
    },
  ],
  [
    { key: "pan", label: "Agency PAN Number", required: true },
    { key: "repId", label: "Authorized Representative ID", required: true },
    { key: "password", label: "Account Password", type: "password", required: true },
    { key: "confirmPassword", label: "Confirm Password", type: "password", required: true },
  ],
];

function playTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 740;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
    osc.onended = () => ctx.close();
  } catch {
    /* Audio is optional */
  }
}

const validateField = (key, value) => {
  const v = String(value || "").trim();

  const rules = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    repEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[6-9]\d{9}$/,
    altPhone: /^[6-9]\d{9}$/,
    repMobile: /^[6-9]\d{9}$/,
    pin: /^\d{6}$/,
    pan: /^[A-Z]{5}\d{4}[A-Z]$/,
    website: /^(https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+([/?#][^\s]*)?$/i,
    linkedin: /^https:\/\/(www\.)?linkedin\.com\/.+/i,
  };

  if (rules[key] && v && !rules[key].test(v)) {
    return `Please enter a valid ${
      key === "pin"
        ? "6-digit PIN code"
        : key === "pan"
        ? "PAN number (e.g. ABCDE1234F)"
        : key === "repMobile"
        ? "10-digit mobile number"
        : key === "altPhone"
        ? "10-digit alternate phone number"
        : key === "phone"
        ? "10-digit contact number"
        : key === "repEmail"
        ? "representative email"
        : key === "website"
        ? "agency website URL"
        : key
    }.`;
  }

  if (key === "establishmentYear" && v) {
    const year = Number(v);
    if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) {
      return "Please enter a valid establishment year.";
    }
  }

  return "";
};

export default function AgencyRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initial);
  const [files, setFiles] = useState({ incorporation: null, gst: null });
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const next = async () => {
    setNotice("");

    for (const field of fields[step]) {
      const value = data[field.key];

      if (field.required && !String(value || "").trim()) {
        toast.error(`${field.label} is required.`);
        return;
      }

      const error = validateField(field.key, value);
      if (error) {
        toast.error(error);
        return;
      }
    }

    if (step === 3) {
      if (!files.incorporation) {
        toast.error("Please upload your Certificate of Incorporation / Registration Proof.");
        return;
      }

      if (data.password.length < 6) {
        toast.error("Password must be at least 6 characters.");
        return;
      }

      if (data.password !== data.confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }

      if (!data.declaration) {
        toast.error("Please agree to the authorization declaration.");
        return;
      }

      setSubmitting(true);

      const mappedType =
        data.agencyType === "Staffing Agency"
          ? "STAFFING_AGENCY"
          : data.agencyType === "Job Consultancy"
          ? "PLACEMENT_CONSULTANCY"
          : "RECRUITMENT_AGENCY";

      const requestBody = {
        agencyName: data.agencyName.trim(),
        agencyType: mappedType,
        businessRegistrationNumber: data.regNumber.trim(),
        gstNumber: data.gstDoc ? "GST_DOC_ATTACHED" : "N/A",
        panNumber: data.pan.trim().toUpperCase(),
        officialEmail: data.email.trim().toLowerCase(),
        password: data.password,
        contactNumber: data.phone.trim(),
        alternateContactNumber: data.altPhone?.trim() || null,
        website: data.website?.trim() || null,
        representative: {
          fullName: data.repName.trim(),
          designation: data.designation.trim(),
          officialEmail: data.repEmail.trim().toLowerCase(),
          mobileNumber: data.repMobile.trim(),
          representativeId: data.repId?.trim() || null,
        },
        officeAddress: {
          country: data.country.trim() || "India",
          state: data.state.trim(),
          city: data.city.trim(),
          district: data.city.trim(),
          officeAddress: [data.address1, data.address2].filter(Boolean).join(", ").trim(),
          pinCode: data.pin.trim(),
        },
      };

      try {
        const headers = {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        };

        const res = await fetch("/api/agencies/register", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(requestBody),
        });

        const resData = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errMessage = resData.message || resData.error || "Agency registration failed.";
          toast.error(errMessage);
          setNotice(errMessage);
          setNoticeType("error");
          setSubmitting(false);
          return;
        }

        playTone();
        setIsSuccess(true);
        toast.success("Agency registered successfully!");
      } catch (err) {
        const msg = err?.message || "Network error submitting registration.";
        toast.error(msg);
        setNotice(msg);
        setNoticeType("error");
      } finally {
        setSubmitting(false);
      }

      return;
    }

    setStep((current) => current + 1);
  };

  const back = () => {
    setNotice("");
    setStep((s) => Math.max(0, s - 1));
  };

  if (isSuccess) {
    return (
      <main className="login-page recruiter-login-page agency-registration-page">
        <section className="login-form-panel agency-registration-panel" style={{ margin: "auto", maxWidth: "620px", padding: "2rem" }}>
          <div className="login-card agency-registration-card" style={{ textAlign: "center", padding: "3rem 2.5rem" }}>
            <div style={{ width: "68px", height: "68px", borderRadius: "50%", background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", fontSize: "2.2rem" }}>
              ✓
            </div>
            <h2 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.75rem" }}>
              Registration Submitted!
            </h2>
            <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: "2rem", fontSize: "0.95rem" }}>
              Thank you for registering <strong>{data.agencyName}</strong> with EUODOO HIRE. Your application has been submitted for verification by the platform administrator. You will receive an approval confirmation, after which you can log in to your Agency Dashboard.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Link to="/agency-login" className="login-submit agency-continue-btn" style={{ textDecoration: "none", padding: "0.75rem 2rem", width: "auto" }}>
                Go to Agency Login →
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page recruiter-login-page agency-registration-page">
      {/* Home button */}
      <button
        type="button"
        className="admin-home-button"
        aria-label="Go to home page"
        onClick={() => navigate("/")}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9" />
          <path d="M9 21v-7h6v7" />
        </svg>
      </button>

      {/* Left branding panel */}
      <section className="login-brand-panel">
        <a
          href="/"
          className="login-brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <span className="login-brand-mark" />
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

          <span className="login-kicker">AGENCY PARTNERSHIP</span>
          <h1>Grow your recruitment business.</h1>
          <p>
            Register your agency with Euodoo Hire to connect with recruiters, manage candidate profiles, and submit qualified candidates.
          </p>
        </div>

        <div className="login-brand-footer">
          <span className="login-footer-dot" />
          Your agency. More opportunities.
        </div>

        <div className="login-orb login-orb-one" />
        <div className="login-orb login-orb-two" />
      </section>

      {/* Right registration panel */}
      <section className="login-form-panel agency-registration-panel">
        <form
          className="login-card agency-registration-card"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
          noValidate
        >
          <a
            href="/"
            className="login-mobile-brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            <span className="login-brand-mark" />
            EUODOO HIRE
          </a>

          <div className="login-card-eyebrow">AGENCY REGISTRATION</div>

          <h2>Create your agency account</h2>
          <p className="login-subtitle">
            Provide your agency details to get started. Required fields are marked with <span className="asterisk">*</span>.
          </p>

          {/* Stepper */}
          <nav className="agency-stepper" aria-label="Registration progress">
            <ol className="stepper-list">
              {steps.map((label, i) => (
                <li
                  key={label}
                  className={`step-item ${i === step ? "active" : ""} ${
                    i < step ? "completed" : ""
                  }`}
                >
                  <span className="step-indicator">
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className="step-label">{label}</span>
                </li>
              ))}
            </ol>
          </nav>

          {/* Section heading */}
          <div className="agency-section-heading">
            <h3>{steps[step]}</h3>
            <span>Step {step + 1} of 4</span>
          </div>

          <div className="agency-registration-fields">
            {fields[step].map((f) => (
              <div className="agency-registration-field" key={f.key}>
                <label className="login-label" htmlFor={f.key}>
                  {f.label}
                  {f.required && <span className="asterisk"> *</span>}
                </label>

                {f.type === "select" ? (
                  <select
                    className="agency-registration-input"
                    id={f.key}
                    value={data[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                  >
                    <option value="">Select {f.label.toLowerCase()}</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="agency-registration-input"
                    id={f.key}
                    type={f.type || "text"}
                    value={data[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                    required={f.required}
                  />
                )}
              </div>
            ))}

            {step === 3 && (
              <>
                {/* Certificate of Incorporation */}
                <div className="agency-registration-field">
                  <label className="login-label" htmlFor="incorporation">
                    Certificate of Incorporation / Registration Proof
                    <span className="asterisk"> *</span>
                  </label>
                  <input
                    id="incorporation"
                    type="file"
                    className="agency-registration-input"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) =>
                      setFiles((prev) => ({
                        ...prev,
                        incorporation: e.target.files?.[0] || null,
                      }))
                    }
                  />
                  {files.incorporation && (
                    <small style={{ color: "#0d9488", marginTop: "4px", display: "block", fontSize: "12px" }}>
                      Selected: {files.incorporation.name}
                    </small>
                  )}
                </div>

                {/* GST Certificate */}
                <div className="agency-registration-field">
                  <label className="login-label" htmlFor="gstDoc">
                    GST Certificate (Optional)
                  </label>
                  <input
                    id="gstDoc"
                    type="file"
                    className="agency-registration-input"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) =>
                      setFiles((prev) => ({
                        ...prev,
                        gstDoc: e.target.files?.[0] || null,
                      }))
                    }
                  />
                  {files.gstDoc && (
                    <small style={{ color: "#0d9488", marginTop: "4px", display: "block", fontSize: "12px" }}>
                      Selected: {files.gstDoc.name}
                    </small>
                  )}
                </div>

                {/* Declaration */}
                <div className="agency-registration-field full-width">
                  <label className="remember-label">
                    <input
                      type="checkbox"
                      checked={data.declaration}
                      onChange={(e) => update("declaration", e.target.checked)}
                    />
                    <span>
                      I hereby declare that all submitted agency details and documents are authentic and valid. I agree to the Terms of Service and Partner Agency Agreement on Euodoo Hire.
                      <span className="asterisk"> *</span>
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          {notice && (
            <div className={`form-alert ${noticeType}`} role="status" aria-live="polite">
              {notice}
            </div>
          )}

          <div className="agency-registration-actions">
            {step > 0 && (
              <button type="button" className="agency-back-btn" onClick={back}>
                Back
              </button>
            )}

            <button
              className="login-submit agency-continue-btn"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Submitting..."
                : step === 3
                ? "Submit Registration"
                : "Continue"}
              <span aria-hidden="true"> →</span>
            </button>
          </div>

          <p className="agency-switch-link">
            Already registered? <Link to="/agency-login">Sign in</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
