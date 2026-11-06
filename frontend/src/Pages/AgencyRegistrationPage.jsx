import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Country, State, City } from "country-state-city";
import { toast } from "../components/Toast";
import { agencyApi } from "../services/api";
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
  phoneCode: "+91",
  altPhone: "",
  altPhoneCode: "+91",
  repName: "",
  designation: "Owner / Founder",
  repEmail: "",
  repMobile: "",
  repMobileCode: "+91",
  repAltMobile: "",
  repAltMobileCode: "+91",
  linkedin: "",
  address1: "",
  address2: "",
  // Names are what we send to the backend; codes only drive the dropdowns
  country: "India",
  countryCode: "IN",
  state: "",
  stateCode: "",
  city: "",
  district: "",
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
    options: ["Recruitment Agency", "Job Consultancy", "Staffing Agency", "Others"],
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
    { key: "repAltMobile", label: "Alternate Mobile Number", type: "tel" },
    { key: "linkedin", label: "LinkedIn Profile URL", type: "url" },
  ],
  [
    { key: "address1", label: "Office Address Line 1", required: true },
    { key: "address2", label: "Office Address Line 2" },
    { key: "country", label: "Country", geo: true, required: true },
    { key: "state", label: "State / Union Territory", geo: true, required: true },
    { key: "city", label: "City", geo: true, required: true },
    { key: "district", label: "District", required: true }, // manual entry separate from city
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

const passwordChecks = [
  { label: "At least 6 characters", test: (p) => p.length >= 6 },
  { label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0-9)", test: (p) => /\d/.test(p) },
  { label: "One symbol (e.g. @ # $ % !)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

const countryOptions = Country.getAllCountries().map((c) => ({ value: c.isoCode, label: c.name }));

/* ---------- Phone number helpers ---------- */
const countryCodes = [
  { iso: "IN", code: "+91" },
  { iso: "US", code: "+1" },
  { iso: "GB", code: "+44" },
  { iso: "AE", code: "+971" },
  { iso: "AU", code: "+61" },
  { iso: "SG", code: "+65" },
  { iso: "SA", code: "+966" },
  { iso: "QA", code: "+974" },
  { iso: "DE", code: "+49" },
  { iso: "NP", code: "+977" },
  { iso: "BD", code: "+880" },
  { iso: "LK", code: "+94" },
  { iso: "PK", code: "+92" },
];

// phone field -> its country code field
const phoneCodeKey = {
  phone: "phoneCode",
  altPhone: "altPhoneCode",
  repMobile: "repMobileCode",
  repAltMobile: "repAltMobileCode",
};

const phoneLabels = {
  phone: "contact number",
  altPhone: "alternate contact number",
  repMobile: "direct mobile number",
  repAltMobile: "alternate mobile number",
};

// digits only, max 10; also handles pasted "+91 98765 43210"
const cleanPhone = (raw, code) => {
  const digits = raw.replace(/\D/g, "");
  const stripped =
    code === "+91" && digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
  return stripped.slice(0, 10);
};

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

const validateField = (key, value, all) => {
  const v = String(value || "").trim();

  // Phone numbers: +91 must start with 6-9, other countries just need 10 digits
  if (phoneCodeKey[key] && v) {
    const india = all?.[phoneCodeKey[key]] === "+91";
    const ok = india ? /^[6-9]\d{9}$/.test(v) : /^\d{10}$/.test(v);
    if (!ok) {
      return india
        ? `Enter a valid 10-digit ${phoneLabels[key]} starting with 6, 7, 8 or 9.`
        : `Enter a valid 10-digit ${phoneLabels[key]}.`;
    }
  }

  const rules = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    repEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    pin: /^\d{6}$/,
    pan: /^[A-Z]{5}\d{4}[A-Z]$/,
    website: /^(https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+([/?#][^\s]*)?$/i,
    linkedin: /^https:\/\/(www\.)?linkedin\.com\/.+/i,
  };

  const testValue = key === "pan" ? v.toUpperCase() : v;

  if (rules[key] && v && !rules[key].test(testValue)) {
    return `Please enter a valid ${
      key === "pin"
        ? "6-digit PIN code"
        : key === "pan"
        ? "PAN number (e.g. ABCDE1234F)"
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

const EyeIcon = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <path d="M1 1l22 22" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function AgencyRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initial);
  const [files, setFiles] = useState({ incorporation: null, gstDoc: null });
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPw, setShowPw] = useState({ password: false, confirmPassword: false });
const togglePw = (key) => setShowPw((s) => ({ ...s, [key]: !s[key] }));

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  /* ---------- Country / State / City dropdown data ---------- */
  const stateOptions = useMemo(
    () =>
      data.countryCode
        ? State.getStatesOfCountry(data.countryCode).map((s) => ({ value: s.isoCode, label: s.name }))
        : [],
    [data.countryCode]
  );

  const cityOptions = useMemo(() => {
    if (!data.countryCode || !data.stateCode) return [];
    const names = City.getCitiesOfState(data.countryCode, data.stateCode).map((c) => c.name);
    return [...new Set(names)].sort().map((n) => ({ value: n, label: n }));
  }, [data.countryCode, data.stateCode]);

  const handleCountry = (code) => {
    const name = countryOptions.find((c) => c.value === code)?.label || "";
    setData((d) => ({ ...d, countryCode: code, country: name, stateCode: "", state: "", city: "" }));
  };

  const handleState = (code) => {
    const name = stateOptions.find((s) => s.value === code)?.label || "";
    setData((d) => ({ ...d, stateCode: code, state: name, city: "" }));
  };

  // Some countries have no state/city data; fall back to a text box so nobody gets blocked
  const countryHasNoStates = !!data.countryCode && stateOptions.length === 0;
  const stateHasNoCities = !!data.stateCode && cityOptions.length === 0;

  const getGeoConfig = (key) => {
    if (key === "country") {
      return { options: countryOptions, value: data.countryCode, onChange: handleCountry, disabled: false, textFallback: false };
    }
    if (key === "state") {
      return {
        options: stateOptions,
        value: data.stateCode,
        onChange: handleState,
        disabled: !data.countryCode,
        textFallback: countryHasNoStates,
      };
    }
    return {
      options: cityOptions,
      value: data.city,
      onChange: (v) => update("city", v),
      disabled: !data.stateCode && !countryHasNoStates,
      textFallback: countryHasNoStates || stateHasNoCities,
    };
  };

  /* ---------- Password ---------- */
  const passwordResults = passwordChecks.map((c) => ({ ...c, ok: c.test(data.password) }));
  const passwordValid = passwordResults.every((c) => c.ok);

  const next = async () => {
    setNotice("");

    for (const field of fields[step]) {
      const value = data[field.key];

      if (field.required && !String(value || "").trim()) {
        toast.error(`${field.label} is required.`);
        return;
      }

      const error = validateField(field.key, value, data);
      if (error) {
        toast.error(error);
        return;
      }
    }

    if (
      step === 0 &&
      data.altPhone?.trim() &&
      data.altPhone.trim() === data.phone.trim() &&
      data.altPhoneCode === data.phoneCode
    ) {
      toast.error("Alternate contact number must be different from the contact number.");
      return;
    }

    if (
      step === 1 &&
      data.repAltMobile?.trim() &&
      data.repAltMobile.trim() === data.repMobile.trim() &&
      data.repAltMobileCode === data.repMobileCode
    ) {
      toast.error("Alternate mobile number must be different from the direct mobile number.");
      return;
    }

    if (step === 3) {
      if (!files.incorporation) {
        toast.error("Please upload your Certificate of Incorporation / Registration Proof.");
        return;
      }

      // Check file types and sizes (max 10MB)
      const allowedExts = ["pdf", "png", "jpg", "jpeg"];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (files.incorporation.size > maxSize) {
        toast.error("Incorporation certificate must be smaller than 10 MB.");
        return;
      }
      const incExt = files.incorporation.name.split(".").pop().toLowerCase();
      if (!allowedExts.includes(incExt)) {
        toast.error("Incorporation certificate must be a PDF, PNG, or JPG file.");
        return;
      }

      if (files.gstDoc) {
        if (files.gstDoc.size > maxSize) {
          toast.error("GST certificate must be smaller than 10 MB.");
          return;
        }
        const gstExt = files.gstDoc.name.split(".").pop().toLowerCase();
        if (!allowedExts.includes(gstExt)) {
          toast.error("GST certificate must be a PDF, PNG, or JPG file.");
          return;
        }
      }

      if (!passwordValid) {
        const missing = passwordResults.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
        toast.error(`Password needs: ${missing.join(", ")}.`);
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

      const typeMap = {
        "Staffing Agency": "STAFFING_AGENCY",
        "Job Consultancy": "PLACEMENT_CONSULTANCY",
        "Recruitment Agency": "RECRUITMENT_AGENCY",
        "Others": "OTHER",
      };
      const mappedType = typeMap[data.agencyType] || "RECRUITMENT_AGENCY";

      const requestBody = {
        agencyName: data.agencyName.trim(),
        agencyType: mappedType,
        businessRegistrationNumber: data.regNumber.trim(),
        establishmentYear: data.establishmentYear ? parseInt(data.establishmentYear, 10) : null,
        officeModel: data.officeModel || "Physical Office",
        gstNumber: files.gstDoc ? "GST_DOC_ATTACHED" : null,
        panNumber: data.pan.trim().toUpperCase(),
        officialEmail: data.email.trim().toLowerCase(),
        password: data.password,
        contactNumber: data.phone.trim(),
        contactCountryCode: data.phoneCode,
        alternateContactNumber: data.altPhone?.trim() || null,
        alternateContactCountryCode: data.altPhone?.trim() ? data.altPhoneCode : null,
        website: data.website?.trim() || null,
        linkedin: data.linkedin?.trim() || null,
        representative: {
          fullName: data.repName.trim(),
          designation: data.designation.trim(),
          officialEmail: data.repEmail.trim().toLowerCase(),
          mobileNumber: data.repMobile.trim(),
          mobileCountryCode: data.repMobileCode,
          alternateMobileNumber: data.repAltMobile?.trim() || null,
          alternateMobileCountryCode: data.repAltMobile?.trim() ? data.repAltMobileCode : null,
          representativeId: data.repId?.trim() || null,
          linkedin: data.linkedin?.trim() || null,
        },
        officeAddress: {
          country: data.country.trim() || "India",
          state: data.state.trim(),
          city: data.city.trim(),
          district: data.district.trim(),
          officeAddress: [data.address1, data.address2].filter(Boolean).join(", ").trim(),
          pinCode: data.pin.trim(),
        },
      };

      try {
        await agencyApi.register(requestBody, files);
        playTone();
        setIsSuccess(true);
        toast.success("Agency registered successfully!");
      } catch (err) {
        const msg = err?.message || "Agency registration failed.";
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
            {fields[step].map((f) => {
              /* Country / State / City dropdowns */
              if (f.geo) {
                const geo = getGeoConfig(f.key);

                return (
                  <div className="agency-registration-field" key={f.key}>
                    <label className="login-label" htmlFor={f.key}>
                      {f.label}
                      {f.required && <span className="asterisk"> *</span>}
                    </label>

                    {geo.textFallback && f.key !== "country" ? (
                      <input
                        className="agency-registration-input"
                        id={f.key}
                        type="text"
                        value={data[f.key]}
                        onChange={(e) => update(f.key, e.target.value)}
                        placeholder={`Enter ${f.label.toLowerCase()}`}
                      />
                    ) : (
                      <select
                        className="agency-registration-input"
                        id={f.key}
                        value={geo.value}
                        disabled={geo.disabled}
                        onChange={(e) => geo.onChange(e.target.value)}
                      >
                        <option value="">Select {f.label.toLowerCase()}</option>
                        {geo.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              }

              /* Regular fields */
              return (
                <div className="agency-registration-field" key={f.key}>
                  <label className="login-label" htmlFor={f.key}>
                    {f.label}
                    {f.required && <span className="asterisk"> *</span>}
                  </label>

                  {phoneCodeKey[f.key] ? (
                    /* Phone: country code + 10-digit number */
                    <div className="phone-input-group">
                      <select
                        className="agency-registration-input phone-code"
                        aria-label={`${f.label} country code`}
                        value={data[phoneCodeKey[f.key]]}
                        onChange={(e) => {
                          const code = e.target.value;
                          setData((d) => ({
                            ...d,
                            [phoneCodeKey[f.key]]: code,
                            [f.key]: cleanPhone(d[f.key], code),
                          }));
                        }}
                      >
                        {countryCodes.map((c) => (
                          <option key={c.iso} value={c.code}>
                            {c.iso} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        className="agency-registration-input"
                        id={f.key}
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        autoComplete="tel-national"
                        value={data[f.key]}
                        onChange={(e) =>
                          update(f.key, cleanPhone(e.target.value, data[phoneCodeKey[f.key]]))
                        }
                        placeholder="Enter 10-digit number"
                        required={f.required}
                      />
                    </div>
                  ) : f.type === "select" ? (
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
                                    ) : f.type === "password" ? (
                    <div className="password-input-wrap">
                      <input
                        className="agency-registration-input"
                        id={f.key}
                        type={showPw[f.key] ? "text" : "password"}
                        value={data[f.key]}
                        onChange={(e) => update(f.key, e.target.value)}
                        placeholder={`Enter ${f.label.toLowerCase()}`}
                        required={f.required}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => togglePw(f.key)}
                        aria-label={showPw[f.key] ? "Hide password" : "Show password"}
                      >
                        <EyeIcon off={showPw[f.key]} />
                      </button>
                    </div>
                                   ) : (
                    <input
                      className="agency-registration-input"
                      id={f.key}
                      type={f.type || "text"}
                      value={data[f.key]}
                      onChange={(e) =>
                        update(
                          f.key,
                          f.key === "pin"
                            ? e.target.value.replace(/\D/g, "").slice(0, 6)
                            : e.target.value
                        )
                      }
                      placeholder={`Enter ${f.label.toLowerCase()}`}
                      required={f.required}
                      maxLength={f.key === "pin" ? 6 : undefined}
                      inputMode={f.key === "pin" ? "numeric" : undefined}
                    />
                  )}
                </div>
              );
            })}

            {step === 3 && (
              <>
                {/* Password requirements checklist */}
                <div className="agency-registration-field full-width">
                  <ul
                    aria-live="polite"
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: "0.75rem 1rem",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: "4px 16px",
                      fontSize: "13px",
                    }}
                  >
                    <li style={{ gridColumn: "1 / -1", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>
                      Your password must have:
                    </li>
                    {passwordResults.map((c) => (
                      <li
                        key={c.label}
                        style={{ color: c.ok ? "#059669" : data.password ? "#dc2626" : "#64748b" }}
                      >
                        <span aria-hidden="true">{c.ok ? "✓" : "○"}</span> {c.label}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Certificate of Incorporation */}
                <div className="agency-registration-field">
                  <label className="login-label" htmlFor="incorporation">
                    Incorporation Certificate / Registration Proof
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
                      Selected: {files.incorporation.name} ({(files.incorporation.size / 1024).toFixed(1)} KB)
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
                      Selected: {files.gstDoc.name} ({(files.gstDoc.size / 1024).toFixed(1)} KB)
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
                ? "Submit"
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
