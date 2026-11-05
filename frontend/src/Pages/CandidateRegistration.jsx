import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";
import { toast } from "../components/Toast";
import "./CandidateRegistration.css";

const initialForm = {
  fullName: "",
  gender: "Male",
  mobile: "",
  email: "",
  password: "",
  city: "",
  state: "",
  qualification: "",
  college: "",
  passoutYear: "",
  percentage: "",
  cgpa: "",
  experienceType: "Fresher",
  currentEmployee: "No",
  designation: "",
  totalExperience: "",
  currentExperience: "",
  jobTitle: "",
  jobPreferences: [],
  skills: [],
  agreed: false,
};

const DRAFT_KEY = "euodoo-registration-draft";

const jobTypes = ["Full-time", "Part-time", "Remote", "Hybrid", "Contract"];

const skillSuggestions = [
  "React", "JavaScript", "Node.js", "TypeScript", "HTML", "CSS", "React Native",
  "MySQL", "REST API", "Python", "Java", "Git", "Communication", "Recruitment",
];

const certificationSuggestions = [
  "AWS Certified", "PMP", "Scrum Master", "Azure Fundamentals", "Google Analytics", "CCNA",
];

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const qualificationOptions = [
  "10th / SSC",
  "12th / HSC",
  "Diploma",
  "Bachelor's degree",
  "Master's degree",
  "PhD",
  "Other",
];

// Fields that get marked as "touched" when a step fails validation
const stepFields = {
  0: ["fullName", "mobile", "email", "password", "city", "state"],
  1: ["qualification", "college", "passoutYear", "percentage", "cgpa"],
  2: ["designation", "totalExperience", "currentExperience"],
  4: ["jobTitle", "jobPreferences", "skills", "resume", "agreed"],
};

const lettersAndNameChars = (value) => value.replace(/[^\p{L}\s.'-]/gu, "");
const organizationChars = (value) => value.replace(/[^\p{L}\p{N}\s&.,'()/-]/gu, "");
const decimalChars = (value, maxDecimals = 2) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, maxDecimals);
};

// Current year down to 1950 (inclusive)
const yearOptions = Array.from(
  { length: new Date().getFullYear() - 1950 + 1 },
  (_, i) => String(new Date().getFullYear() - i)
);

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  const paths = {
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    education: (
      <>
        <path d="m2 9 10-5 10 5-10 5L2 9Z" />
        <path d="M6 11v5c4 3 8 3 12 0v-5M22 9v6" />
      </>
    ),
    work: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
      </>
    ),
    documents: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-4 4 4-4 4 4" />
        <path d="M4 16v4h16v-4" />
      </>
    ),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg {...common}>{paths[name] || paths.profile}</svg>;
}

function Field({ label, required, children, className = "" }) {
  return (
    <div className={`cr-field ${className}`}>
      <label>
        {label}
        {required && <span className="cr-required"> *</span>}
      </label>
      {children}
    </div>
  );
}

function ChoiceGroup({ value, options, onChange, multi = false }) {
  return (
    <div className="cr-choice-group">
      {options.map((option) => {
        const selected = multi ? value.includes(option) : value === option;
        return (
          <button
            key={option}
            type="button"
            className={`cr-choice${selected ? " is-active" : ""}`}
            aria-pressed={selected}
            onClick={() => {
              if (!multi) onChange(option);
              else onChange(selected ? value.filter((item) => item !== option) : [...value, option]);
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function UploadBox({ title, hint, accept, file, onFile, multiple = false }) {
  const [dragging, setDragging] = useState(false);

  const allowedExt = accept.split(",").map((t) => t.trim().toLowerCase());

  const handleFiles = (list) => {
    const files = Array.from(list || []);
    const valid = files.filter((item) => {
      const name = item.name.toLowerCase();
      const okType = allowedExt.some((ext) => name.endsWith(ext));
      return okType && item.size <= 5 * 1024 * 1024;
    });
    if (valid.length !== files.length) {
      window.alert("Please choose supported files up to 5 MB each.");
    }
    if (!valid.length) return;
    onFile(multiple ? valid : valid[0]);
  };

  const files = multiple ? file || [] : file ? [file] : [];
  const hasFile = files.length > 0;

  return (
    <div className="cr-upload-field">
      <label className="cr-upload-label">{title}</label>

      {hasFile ? (
        <div className="cr-upload-box has-file cr-upload-done">
          <span className="cr-upload-icon"><Icon name="check" size={20} /></span>
          <strong>{files.map((f) => f.name).join(", ")}</strong>
          <span>Uploaded successfully</span>
          <button
            className="cr-remove-file"
            type="button"
            onClick={() => onFile(multiple ? [] : null)}
          >
            Remove {multiple ? "files" : "file"}
          </button>
        </div>
      ) : (
        <label
          className={`cr-upload-box${dragging ? " is-dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="cr-upload-icon"><Icon name="upload" size={20} /></span>
          <strong>{title === "Attach resume" ? "Upload your resume" : title}</strong>
          <span><em>Click to upload</em> or drag &amp; drop</span>
          <small>{hint} &bull; max 5 MB each</small>
        </label>
      )}
    </div>
  );
}

const tagChars = (value) => value.replace(/[^\p{L}\p{N}\s+#.&/()-]/gu, "");

/* Chip field: type + Enter / comma / Add button, OR click a suggestion. Both add to the same list. */
function TagInput({ label, required, placeholder, values, suggestions, onAdd, onRemove, onTouch, error }) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const typed = text.trim();
  const has = (list, v) => list.some((x) => x.toLowerCase() === v.toLowerCase());

  const commit = (raw) => {
    const v = raw.trim();
    if (!v) return;
    onAdd(v);
    setText("");
  };

  const matches = suggestions
    .filter((x) => !has(values, x))
    .filter((x) => x.toLowerCase().includes(typed.toLowerCase()));
  const canAddTyped = typed && !has(values, typed) && !matches.some((x) => x.toLowerCase() === typed.toLowerCase());

  return (
    <div
      className="cr-field cr-span-2"
      onBlur={(e) => {
        // Leaving the whole field: keep any typed text instead of losing it
        if (!e.currentTarget.contains(e.relatedTarget)) {
          commit(text);
          if (onTouch) onTouch();
        }
      }}
    >
      <label>
        {label}
        {required && <span className="cr-required"> *</span>}
      </label>

      <div className="cr-tag-entry">
        <div
          className={`cr-tag-box${error ? " is-invalid" : ""}`}
          onClick={() => inputRef.current && inputRef.current.focus()}
        >
          {values.map((v) => (
            <span className="cr-chip" key={v}>
              {v}
              <button
                type="button"
                className="cr-chip-remove"
                aria-label={`Remove ${v}`}
                onClick={() => onRemove(v)}
              >
                &times;
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            className="cr-tag-input"
            value={text}
            onChange={(e) => setText(tagChars(e.target.value).slice(0, 40))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit(text);
              } else if (e.key === "Backspace" && !text && values.length) {
                onRemove(values[values.length - 1]);
              }
            }}
            placeholder={values.length ? "Add another..." : placeholder}
          />
        </div>
        <button type="button" className="cr-tag-add" onClick={() => commit(text)} disabled={!typed}>
          Add
        </button>
      </div>
      <InlineError>{error}</InlineError>

      {(matches.length > 0 || canAddTyped) && (
        <div className="cr-suggestions">
          {matches.length > 0 && <span className="cr-suggestions-label">Suggestions:</span>}
          {matches.map((x) => (
            <button
              type="button"
              key={x}
              className="cr-suggestion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(x)}
            >
              + {x}
            </button>
          ))}
          {canAddTyped && (
            <button
              type="button"
              className="cr-suggestion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(typed)}
            >
              + Add "{typed}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const validationRules = {
  fullName: {
    validate: (value) => /^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(value.trim()),
    message: "Enter a valid name using letters, spaces, apostrophes or hyphens.",
  },
  mobile: {
    validate: (value) => /^[6-9]\d{9}$/.test(value),
    message: "Enter a valid 10-digit Indian mobile number.",
  },
  email: {
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()),
    message: "Enter a valid email address.",
  },
  password: {
    validate: (value) => Boolean(value && value.length >= 8),
    message: "Password must be at least 8 characters.",
  },
  city: {
    validate: (value) => /^[\p{L}][\p{L}\s.'-]{1,59}$/u.test(value.trim()),
    message: "Enter a valid city name.",
  },
  state: {
    validate: (value) => indianStates.includes(value),
    message: "Select a valid state or union territory.",
  },
  qualification: {
    validate: (value) => Boolean(value),
    message: "Select your qualification.",
  },
  college: {
    validate: (value) =>
      value.trim().length >= 2 && /^[\p{L}\p{N}\s&.,'()/-]+$/u.test(value.trim()),
    message: "Enter a valid college name.",
  },
  passoutYear: {
    validate: (value) => Number(value) > 0 && Number(value) <= new Date().getFullYear(),
    message: "Select a valid pass-out year (not in the future).",
  },
  designation: {
    validate: (value) =>
      value.trim().length >= 2 && /^[\p{L}\p{N}\s&.,'()/-]+$/u.test(value.trim()),
    message: "Enter a valid designation.",
  },
  totalExperience: {
    validate: (value) => Number(value) > 0 && Number(value) <= 60,
    message: "Enter experience greater than 0 and up to 60 years.",
  },
  jobTitle: {
    validate: (value) =>
      value.trim().length >= 2 && /^[\p{L}\p{N}\s&.,'()/-]+$/u.test(value.trim()),
    message: "Enter a valid job title.",
  },
  percentage: {
    validate: (value) =>
      value === "" ||
      (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) >= 0 && Number(value) <= 100),
    message: "Percentage must be between 0 and 100.",
  },
  cgpa: {
    validate: (value) =>
      value === "" ||
      (/^\d{1,2}(\.\d{1,2})?$/.test(value) && Number(value) >= 0 && Number(value) <= 10),
    message: "CGPA must be between 0 and 10.",
  },
};

function getFieldError(name, value) {
  const rule = validationRules[name];
  if (!rule) return "";
  if (!String(value ?? "").trim()) {
    return ["percentage", "cgpa"].includes(name) ? "" : "This field is required.";
  }
  return rule.validate(String(value)) ? "" : rule.message;
}

function InlineError({ children }) {
  if (!children) return null;
  return <span className="cr-field-error" role="alert">{children}</span>;
}

export default function CandidateRegistration() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [certifications, setCertifications] = useState([]);
  const [experienceLetter, setExperienceLetter] = useState(null);
  const [salarySlips, setSalarySlips] = useState([]);
  const [resume, setResume] = useState(null);
  const [status, setStatus] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [touched, setTouched] = useState({});
  const [statusType, setStatusType] = useState("error"); // "error" (amber/red) or "success" (green)

  useEffect(() => {
    // Short initial loading state gives the registration layout a polished skeleton transition.
    const loadingId = window.setTimeout(() => setIsLoading(false), 500);
    return () => window.clearTimeout(loadingId);
  }, []);

  // Restore a previously saved draft (files cannot be restored)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const { certifications: savedCerts, savedAt, agreed, ...saved } = JSON.parse(raw);
      setForm((prev) => ({ ...prev, ...saved }));
      if (Array.isArray(savedCerts)) setCertifications(savedCerts);
      setStatusType("success");
      setStatus("Your saved draft was restored. You can now continue editing.");
    } catch {
      /* ignore unreadable drafts */
    }
  }, []);

  // Typing does NOT mark a field as touched; errors appear on blur / Next / Submit.
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("");
  };

  const markTouched = (key) => setTouched((prev) => ({ ...prev, [key]: true }));

  const touchStep = (step) =>
    setTouched((prev) => ({
      ...prev,
      ...Object.fromEntries((stepFields[step] || []).map((k) => [k, true])),
    }));

  const showError = (key, value = form[key]) => {
    if (!touched[key]) return "";
    return getFieldError(key, value ?? "");
  };

  // Select helper: update value and mark touched in one go
  const updateSelect = (key, value) => {
    update(key, value);
    markTouched(key);
  };

  const currentExpError =
    touched.currentExperience &&
    form.currentExperience !== "" &&
    Number(form.currentExperience) > Number(form.totalExperience || 0)
      ? "Cannot be more than total experience."
      : "";

  const jobPreferenceError =
    touched.jobPreferences && form.jobPreferences.length === 0
      ? "Choose at least one job preference."
      : "";
  const skillsError =
    touched.skills && form.skills.length === 0 ? "Add at least one skill." : "";
  const resumeError = touched.resume && !resume ? "Please attach your resume." : "";
  const agreedError =
    touched.agreed && !form.agreed ? "You must agree to the Terms & Privacy Policy." : "";

  /* ---------- Skills ---------- */
  const addSkillValue = (value) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.some((x) => x.toLowerCase() === value.toLowerCase())
        ? prev.skills
        : [...prev.skills, value],
    }));
    markTouched("skills");
    setStatus("");
  };

  const removeSkill = (skill) => {
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((x) => x !== skill) }));
    markTouched("skills");
  };

  /* ---------- Certifications ---------- */
  const addCertificationValue = (value) => {
    setCertifications((prev) =>
      prev.some((c) => c.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value]
    );
    setStatus("");
  };

  const removeCertification = (cert) =>
    setCertifications((prev) => prev.filter((c) => c !== cert));

  /* ---------- Job preference ---------- */
  const toggleJobPreference = (type) => {
    setForm((prev) => ({
      ...prev,
      jobPreferences: prev.jobPreferences.includes(type)
        ? prev.jobPreferences.filter((t) => t !== type)
        : [...prev.jobPreferences, type],
    }));
    markTouched("jobPreferences");
    setStatus("");
  };

  const saveDraft = () => {
    const draft = { ...form, certifications, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setStatusType("success");
      setStatus("Draft saved on this device.");
    } catch {
      setStatusType("error");
      setStatus("Could not save the draft in this browser.");
    }
  };

  /* ---------- Step validation ---------- */
  const validateStep = (step) => {
    setStatus("");
    const name = form.fullName.trim();
    const city = form.city.trim();
    const state = form.state.trim();
    const college = form.college.trim();
    const jobTitle = form.jobTitle.trim();
    const percentage = form.percentage === "" ? null : Number(form.percentage);
    const cgpa = form.cgpa === "" ? null : Number(form.cgpa);
    const totalExperience = form.totalExperience === "" ? null : Number(form.totalExperience);
    const currentExperience = form.currentExperience === "" ? null : Number(form.currentExperience);
    const fail = (message) => {
      setStatusType("error");
      setStatus(message);
      touchStep(step); // show inline errors on every field of this step
      return false;
    };

    if (step === 0) {
      if (!name || !form.mobile.trim() || !form.email.trim() || !form.password || !city || !state) {
        return fail("Please fill in all required personal details.");
      }
      if (!/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(name)) return fail("Enter a valid full name.");
      if (!/^[6-9]\d{9}$/.test(form.mobile)) return fail("Enter a valid 10-digit Indian mobile number.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return fail("Enter a valid email address.");
      if (form.password.length < 8) return fail("Password must be at least 8 characters.");
      if (city.length < 2 || city.length > 60 || !/^[\p{L}][\p{L}\s.'-]{1,59}$/u.test(city)) {
        return fail("Enter a valid city name using 2–60 characters.");
      }
      if (!indianStates.includes(state)) return fail("Please select a valid state or union territory.");
    }

    if (step === 1) {
      if (!form.qualification || !college || !form.passoutYear) {
        return fail("Please fill in all required education details.");
      }
      if (college.length < 2) return fail("Enter a valid college or university name.");
      if (Number(form.passoutYear) > new Date().getFullYear()) return fail("Select a valid pass-out year that is not in the future.");
      if (percentage !== null && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) return fail("Percentage must be between 0 and 100.");
      if (cgpa !== null && (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10)) return fail("CGPA must be between 0 and 10.");
    }

    if (step === 2 && form.experienceType === "Experienced") {
      if (!form.designation.trim() || !form.totalExperience) {
        return fail("Please fill in your designation and total experience.");
      }
      if (form.designation.trim().length < 2) return fail("Enter your current or most recent designation.");
      if (totalExperience === null || !Number.isFinite(totalExperience) || totalExperience <= 0 || totalExperience > 60) return fail("Enter total experience greater than 0 and no more than 60 years.");
      if (currentExperience !== null && (!Number.isFinite(currentExperience) || currentExperience < 0 || currentExperience > totalExperience)) return fail("Current-company experience must be between 0 and your total experience.");
    }

    if (step === 4) {
      if (jobTitle.length < 2) return fail("Enter the job title you are looking for.");
      if (!form.jobPreferences.length) return fail("Choose at least one job preference.");
      if (!form.skills.length) return fail("Add at least one skill.");
      if (!resume) return fail("Please attach your resume before submitting.");
      if (!form.agreed) return fail("Please confirm the information and agree to the Terms & Privacy Policy.");
    }

    return true;
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(step + 1, 4));
    setStatus("");
    // "instant" on purpose: html has `scroll-behavior: smooth`, so the default
    // ("auto") resolves to a smooth animation that can fail or be cancelled by
    // user input, leaving the page stuck at the previous step's scroll offset.
    // Instant scrolling is deterministic and always lands at the top of the
    // newly shown step.
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const goPrevious = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
    setStatus("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setStatus("");
    setSubmitted(false);

    // Re-validate every step so nothing is skipped before submitting.
    for (let step = 0; step <= 4; step += 1) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    setIsSubmitting(true);
    setStatusType("info");
    setStatus("Submitting your profile to Euodoo Hire...");

    try {
      const payload = {
        name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.mobile.trim(),
        location: [form.city.trim(), form.state.trim()].filter(Boolean).join(", "),
        qualification: form.qualification,
        college: form.college.trim(),
        passoutYear: form.passoutYear,
        designation: form.designation ? form.designation.trim() : "",
        totalExperienceYears: form.totalExperience ? Math.round(Number(form.totalExperience)) : 0,
        jobTitle: form.jobTitle.trim(),
        skills: form.skills,
        certifications,
      };

      const result = await authApi.registerCandidate(payload);
      setSubmitted(true);
      setStatusType("success");
      setStatus(
        result?.message ||
        "Registration successful! Your account has been created and is pending admin approval."
      );
      toast.success("Registration submitted successfully! Your account is pending admin approval.");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (_) {}
    } catch (err) {
      setSubmitted(false);
      setStatusType("error");
      setStatus(err.message || "Registration failed. Please check your details and try again.");
      toast.error(err.message || "Registration failed. Please check your details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { title: "Personal details", subtitle: "Basic information", icon: "profile" },
    { title: "Education background", subtitle: "Academic details", icon: "education" },
    { title: "Work experience", subtitle: "Professional background", icon: "work" },
    { title: "Documents", subtitle: "Supporting files", icon: "documents" },
    { title: "Job preference", subtitle: "Your next role", icon: "target" },
  ];

  // Moving forward validates every step in between, so none can be skipped.
  const goToStep = (index) => {
    for (let s = currentStep; s < index; s += 1) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        return;
      }
    }
    setCurrentStep(index);
    setStatus("");
  };

  if (isLoading) {
    return (
      <main className="candidate-registration cr-loading-shell" aria-busy="true" aria-label="Loading candidate registration">
        <aside className="cr-sidebar cr-skeleton-sidebar">
          <div className="cr-skeleton cr-skeleton-brand" />
          <div className="cr-skeleton cr-skeleton-kicker" />
          <div className="cr-skeleton cr-skeleton-title" />
          <div className="cr-skeleton cr-skeleton-copy" />
          <div className="cr-skeleton-steps">
            {steps.map((step) => (
              <div className="cr-skeleton-step" key={step.title}>
                <span className="cr-skeleton cr-skeleton-step-number" />
                <span className="cr-skeleton-step-copy">
                  <span className="cr-skeleton cr-skeleton-step-title" />
                  <span className="cr-skeleton cr-skeleton-step-subtitle" />
                </span>
              </div>
            ))}
          </div>
          <div className="cr-skeleton cr-skeleton-help" />
        </aside>
        <section className="cr-main cr-skeleton-main">
          <div className="cr-skeleton cr-skeleton-eyebrow" />
          <div className="cr-skeleton cr-skeleton-heading" />
          <div className="cr-skeleton cr-skeleton-description" />
          <div className="cr-skeleton cr-skeleton-progress" />
          <div className="cr-skeleton-card">
            <div className="cr-skeleton cr-skeleton-section-title" />
            <div className="cr-skeleton cr-skeleton-section-copy" />
            <div className="cr-skeleton-fields">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="cr-skeleton-field" key={index}>
                  <span className="cr-skeleton cr-skeleton-label" />
                  <span className="cr-skeleton cr-skeleton-input" />
                </div>
              ))}
            </div>
            <div className="cr-skeleton cr-skeleton-action" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="candidate-registration">
      <aside className="cr-sidebar">
        <div className="cr-registration-topbar">
          <a
            className="cr-brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
          >
            <span className="cr-brand-mark"><span /></span>
            <strong>EUODOO HIRE</strong>
          </a>

          <button
            className="cr-exit-button"
            type="button"
            onClick={() => navigate("/")}
            aria-label="Exit registration and return home"
          >
            Exit <span>&times;</span>
          </button>
        </div>

        <nav className="cr-step-list" aria-label="Registration steps">
          {steps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              className={`cr-step-link ${index === currentStep ? "is-current" : index < currentStep ? "is-completed" : ""}`}
              onClick={() => goToStep(index)}
              aria-current={index === currentStep ? "step" : undefined}
            >
              <span className={`cr-step-number ${index === currentStep ? "current" : index < currentStep ? "completed" : ""}`}>
                {index < currentStep ? "✓" : index + 1}
              </span>
              <span className="cr-step-copy">
                <strong>{step.title}</strong>
              </span>
            </button>
          ))}
        </nav>

        <div className="cr-sidebar-orb cr-sidebar-orb-one" /><div className="cr-sidebar-orb cr-sidebar-orb-two" />
      </aside>

      <section className="cr-main">
        <header className="cr-page-header">
          <div>
            <span className="cr-eyebrow">CANDIDATE REGISTRATION</span>
            <h2>Create your profile</h2>
            <p className="cr-page-description">
              Tell us about yourself so we can match you with the right opportunities.
              Fields marked <span className="cr-required">*</span> are required.
            </p>
          </div>
        </header>

        <div className="cr-progress-meta">
          <span>Profile completion</span>
          <strong>{Math.round(((currentStep + 1) / steps.length) * 100)}%</strong>
        </div>

        <div className="cr-progress-track">
          <span style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
        </div>

        <form className="cr-form" onSubmit={submitForm} noValidate>
          {status && (
            <div
              className={`cr-status${statusType === "success" ? " success" : ""}`}
              role="alert"
              aria-live="assertive"
            >
              {status}
            </div>
          )}

          {/* ---------- Step 1: Personal details ---------- */}
          {currentStep === 0 && (
            <section className="cr-section-card cr-slide" id="cr-step-1">
              <div className="cr-section-heading">
                <span className="cr-section-number">1</span>
                <div>
                  <h3>Personal details</h3>
                  <p>Basic information so employers can reach you</p>
                </div>
              </div>
              <div className="cr-form-grid two">
                <Field label="Full name" required>
                  <input
                    value={form.fullName}
                    onChange={(e) => update("fullName", lettersAndNameChars(e.target.value))}
                    onBlur={() => markTouched("fullName")}
                    placeholder="e.g. Kiran Sharma"
                    autoComplete="name"
                    required
                    aria-invalid={Boolean(showError("fullName"))}
                  />
                  <InlineError>{showError("fullName")}</InlineError>
                </Field>

                <Field label="Gender" required>
                  <ChoiceGroup
                    value={form.gender}
                    options={["Male", "Female", "Other"]}
                    onChange={(v) => update("gender", v)}
                  />
                </Field>

                <Field label="Mobile number" required>
                  <div className="cr-phone-input">
                    <span>+91</span>
                    <input
                      value={form.mobile}
                      onChange={(e) => update("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      onBlur={() => markTouched("mobile")}
                      placeholder="98765 43210"
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      title="Enter a 10-digit mobile number"
                      required
                      aria-invalid={Boolean(showError("mobile"))}
                    />
                  </div>
                  <InlineError>{showError("mobile")}</InlineError>
                </Field>

                <Field label="Email ID" required>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() => markTouched("email")}
                    placeholder="you@email.com"
                    required
                    autoComplete="email"
                    aria-invalid={Boolean(showError("email"))}
                  />
                  <InlineError>{showError("email")}</InlineError>
                </Field>

                <Field label="Password" required>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    onBlur={() => markTouched("password")}
                    placeholder="Minimum 8 characters"
                    required
                    autoComplete="new-password"
                    aria-invalid={Boolean(showError("password"))}
                  />
                  <InlineError>{showError("password")}</InlineError>
                </Field>

                <Field label="City" required>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => update("city", lettersAndNameChars(e.target.value).slice(0, 60))}
                    onBlur={() => markTouched("city")}
                    placeholder="Enter your city"
                    autoComplete="address-level2"
                    minLength={2}
                    maxLength={60}
                    required
                    aria-invalid={Boolean(showError("city"))}
                  />
                  <InlineError>{showError("city")}</InlineError>
                </Field>

                <Field label="State / Union Territory" required className="cr-span-2">
                  <select
                    value={form.state}
                    onChange={(e) => updateSelect("state", e.target.value)}
                    onBlur={() => markTouched("state")}
                    autoComplete="address-level1"
                    required
                    aria-invalid={Boolean(showError("state"))}
                  >
                    <option value="">Select your state</option>
                    {indianStates.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <InlineError>{showError("state")}</InlineError>
                </Field>
              </div>
            </section>
          )}

          {/* ---------- Step 2: Education ---------- */}
          {currentStep === 1 && (
            <section className="cr-section-card cr-slide" id="cr-step-2">
              <div className="cr-section-heading">
                <span className="cr-section-number">2</span>
                <div>
                  <h3>Education background</h3>
                  <p>Your highest qualification and academic performance</p>
                </div>
              </div>
              <div className="cr-form-grid two">
                <Field label="Education background" required>
                  <select
                    value={form.qualification}
                    onChange={(e) => updateSelect("qualification", e.target.value)}
                    onBlur={() => markTouched("qualification")}
                    required
                    aria-invalid={Boolean(showError("qualification"))}
                  >
                    <option value="">Select qualification</option>
                    {qualificationOptions.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                  <InlineError>{showError("qualification")}</InlineError>
                </Field>

                <Field label="College name" required>
                  <input
                    value={form.college}
                    onChange={(e) => update("college", organizationChars(e.target.value))}
                    onBlur={() => markTouched("college")}
                    placeholder="Enter college / university name"
                    required
                    aria-invalid={Boolean(showError("college"))}
                  />
                  <InlineError>{showError("college")}</InlineError>
                </Field>

                <Field label="Pass-out year" required>
                  <select
                    value={form.passoutYear}
                    onChange={(e) => updateSelect("passoutYear", e.target.value)}
                    onBlur={() => markTouched("passoutYear")}
                    required
                    aria-invalid={Boolean(showError("passoutYear"))}
                  >
                    <option value="">Select year</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <InlineError>{showError("passoutYear")}</InlineError>
                </Field>

                <Field label="Percentage">
                  <div className="cr-suffix-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.percentage}
                      onChange={(e) => update("percentage", decimalChars(e.target.value))}
                      onBlur={() => markTouched("percentage")}
                      placeholder="e.g. 78.5"
                      aria-invalid={Boolean(showError("percentage"))}
                    />
                  </div>
                  <InlineError>{showError("percentage")}</InlineError>
                </Field>

                <Field label="CGPA">
                  <div className="cr-suffix-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.cgpa}
                      onChange={(e) => update("cgpa", decimalChars(e.target.value))}
                      onBlur={() => markTouched("cgpa")}
                      placeholder="e.g. 8.4"
                      aria-invalid={Boolean(showError("cgpa"))}
                    />
                    <span>/ 10</span>
                  </div>
                  <InlineError>{showError("cgpa")}</InlineError>
                </Field>
              </div>
            </section>
          )}

          {/* ---------- Step 3: Work experience ---------- */}
          {currentStep === 2 && (
            <section className="cr-section-card cr-slide" id="cr-step-3">
              <div className="cr-section-heading">
                <span className="cr-section-number">3</span>
                <div>
                  <h3>Work experience</h3>
                  <p>Tell us about your professional background</p>
                </div>
              </div>
              <div className="cr-form-grid two">
                <Field label="Work experience" required>
                  <ChoiceGroup
                    value={form.experienceType}
                    options={["Fresher", "Experienced"]}
                    onChange={(v) => {
                      update("experienceType", v);
                      if (v === "Fresher") {
                        update("currentEmployee", "No");
                        update("designation", "");
                        update("totalExperience", "");
                        update("currentExperience", "");
                        setTouched((prev) => ({
                          ...prev,
                          designation: false,
                          totalExperience: false,
                          currentExperience: false,
                        }));
                      }
                    }}
                  />
                </Field>

                <Field label="Current employee?" required>
                  <ChoiceGroup
                    value={form.currentEmployee}
                    options={["Yes", "No"]}
                    onChange={(v) => update("currentEmployee", v)}
                  />
                </Field>

                {form.experienceType === "Experienced" && (
                  <>
                    <TagInput
                      label="Certification"
                      placeholder="Type a certification and press Enter or click Add, or pick below"
                      values={certifications}
                      suggestions={certificationSuggestions}
                      onAdd={addCertificationValue}
                      onRemove={removeCertification}
                    />

                    <Field label="Designation" required>
                      <input
                        value={form.designation}
                        onChange={(e) => update("designation", organizationChars(e.target.value))}
                        onBlur={() => markTouched("designation")}
                        placeholder="e.g. Recruiter"
                        required
                        aria-invalid={Boolean(showError("designation"))}
                      />
                      <InlineError>{showError("designation")}</InlineError>
                    </Field>

                    <Field label="Total years of experience" required>
                      <div className="cr-suffix-input">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="0.5"
                          value={form.totalExperience}
                          onChange={(e) => update("totalExperience", e.target.value)}
                          onBlur={() => markTouched("totalExperience")}
                          placeholder="e.g. 3.5"
                          required
                          aria-invalid={Boolean(showError("totalExperience"))}
                        />
                        <span>years</span>
                      </div>
                      <InlineError>{showError("totalExperience")}</InlineError>
                    </Field>

                    <Field label="Current experience">
                      <div className="cr-suffix-input">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="0.5"
                          value={form.currentExperience}
                          onChange={(e) => update("currentExperience", e.target.value)}
                          onBlur={() => markTouched("currentExperience")}
                          placeholder="Time in current company"
                          aria-invalid={Boolean(currentExpError)}
                        />
                        <span>years</span>
                      </div>
                      <InlineError>{currentExpError}</InlineError>
                    </Field>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ---------- Step 4: Documents ---------- */}
          {currentStep === 3 && (
            <section className="cr-section-card cr-slide" id="cr-step-4">
              <div className="cr-section-heading">
                <span className="cr-section-number">4</span>
                <div>
                  <h3>Experience documents</h3>
                  <p>Upload supporting documents (PDF, DOC or DOCX up to 5 MB each)</p>
                </div>
              </div>
              <div className="cr-form-grid two">
                <UploadBox
                  title="Experience letter"
                  hint="PDF, DOC, DOCX"
                  accept=".pdf,.doc,.docx"
                  file={experienceLetter}
                  onFile={setExperienceLetter}
                />
                <UploadBox
                  title="Salary slips (last 3 months)"
                  hint="PDF, DOC, DOCX"
                  accept=".pdf,.doc,.docx"
                  file={salarySlips}
                  onFile={setSalarySlips}
                  multiple
                />
              </div>
            </section>
          )}

          {/* ---------- Step 5: Job preference ---------- */}
          {currentStep === 4 && (
            <section className="cr-section-card cr-slide" id="cr-step-5">
              <div className="cr-section-heading">
                <span className="cr-section-number">5</span>
                <div>
                  <h3>Job preference</h3>
                  <p>What kind of role are you looking for?</p>
                </div>
              </div>
              <div className="cr-form-grid two">
                <Field label="Job title" required>
                  <input
                    value={form.jobTitle}
                    onChange={(e) => update("jobTitle", organizationChars(e.target.value))}
                    onBlur={() => markTouched("jobTitle")}
                    placeholder="e.g. Recruiter, Frontend Developer"
                    required
                    aria-invalid={Boolean(showError("jobTitle"))}
                  />
                  <InlineError>{showError("jobTitle")}</InlineError>
                </Field>

                <Field label="Job preference" required>
                  <div className="cr-checkbox-group">
                    {jobTypes.map((type) => {
                      const checked = form.jobPreferences.includes(type);
                      return (
                        <label key={type} className={`cr-checkbox${checked ? " is-checked" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleJobPreference(type)}
                          />
                          <span>{type}</span>
                        </label>
                      );
                    })}
                  </div>
                  <small className="cr-field-hint">Select all job types that match your preferences.</small>
                  <InlineError>{jobPreferenceError}</InlineError>
                </Field>

                <TagInput
                  label="Skills"
                  required
                  placeholder="Type a skill and press Enter or click Add, or pick below"
                  values={form.skills}
                  suggestions={skillSuggestions}
                  onAdd={addSkillValue}
                  onRemove={removeSkill}
                  onTouch={() => markTouched("skills")}
                  error={skillsError}
                />

                <div className="cr-span-2">
                  <UploadBox
                    title="Attach resume"
                    hint="PDF, DOC, DOCX"
                    accept=".pdf,.doc,.docx"
                    file={resume}
                    onFile={(f) => {
                      setResume(f);
                      markTouched("resume");
                    }}
                  />
                  <InlineError>{resumeError}</InlineError>
                </div>
              </div>
            </section>
          )}

          <div className="cr-carousel-controls" aria-label="Registration step navigation">
            <button
              type="button"
              className="cr-button cr-button-secondary"
              onClick={goPrevious}
              disabled={currentStep === 0}
            >
              <span aria-hidden="true">&larr;</span> Previous
            </button>
            <div className="cr-carousel-indicators" aria-label={`Step ${currentStep + 1} of 5`}>
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={`cr-carousel-dot${index === currentStep ? " is-active" : ""}`}
                  onClick={() => goToStep(index)}
                  aria-label={`Go to step ${index + 1}: ${step.title}`}
                  aria-current={index === currentStep ? "step" : undefined}
                />
              ))}
              <span>Step {currentStep + 1} of {steps.length}</span>
            </div>
            {currentStep < steps.length - 1 ? (
              <button type="button" className="cr-button cr-button-primary" onClick={goNext}>
                Next <Icon name="arrow" size={17} />
              </button>
            ) : (
              <button
                type="submit"
                className="cr-button cr-button-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit registration"} <Icon name="arrow" size={17} />
              </button>
            )}
          </div>

          <div className="cr-form-footer">
            {currentStep === 4 && (
              <>
                <label className="cr-agreement">
                  <input
                    type="checkbox"
                    checked={form.agreed}
                    onChange={(e) => {
                      update("agreed", e.target.checked);
                      markTouched("agreed");
                    }}
                  />
                  <span>
                    I confirm that the information provided is accurate and agree to the{" "}
                    <a href="/terms" onClick={(e) => e.preventDefault()}>Terms</a> &amp;{" "}
                    <a href="/privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                  </span>
                </label>
                <InlineError>{agreedError}</InlineError>
              </>
            )}

            {submitted && (
              <div className="cr-success-card">
                <span><Icon name="check" /></span>
                <div>
                  <strong>Registration submitted successfully!</strong>
                  <p>{status}</p>
                  <button
                    type="button"
                    className="cr-button cr-button-primary"
                    style={{ marginTop: "12px", width: "auto", display: "inline-flex" }}
                    onClick={() => navigate("/login")}
                  >
                    Go to Sign in &rarr;
                  </button>
                </div>
              </div>
            )}

            <div className="cr-actions">
              <button type="button" className="cr-button cr-button-secondary" onClick={saveDraft}>
                Save as draft
              </button>
            </div>
          </div>
        </form>

        <footer className="cr-footer">
          <span>&copy; {new Date().getFullYear()} Euodoo Hire</span>
          <span>Built for your next opportunity</span>
        </footer>
      </section>

      <div className="cr-help-floating">
        <span className="cr-help-icon">
          <Icon name="documents" size={18} />
        </span>
        <div className="cr-help-floating-copy">
          <strong>Need help?</strong>
          <span>Questions about registration?</span>
        </div>
        <a href="mailto:support@euodoohire.com">
          Contact support
          <Icon name="arrow" size={15} />
        </a>
      </div>
    </main>
  );
}
