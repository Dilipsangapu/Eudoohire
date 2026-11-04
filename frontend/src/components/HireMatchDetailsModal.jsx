import { useEffect, useState } from "react";
import { hireMatchApi } from "../services/api";

/**
 * Hire Match details modal shared by the candidate dashboards.
 *
 * Opened when a user clicks a Hire Match notification. All data comes from
 * `GET /api/hire-matches/{id}` (real MongoDB records). Handles loading,
 * empty/invalid reference, and error (403/404) states explicitly.
 */

const fmtINR = (n) =>
  n === null || n === undefined || n === ""
    ? "—"
    : "₹" + Number(n).toLocaleString("en-IN");

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
};

const statusBadge = (status, released) => {
  const map = {
    APPROVED: { bg: "#DCFCE7", color: "#15803D", label: "✔ Approved by Client Admin" },
    PENDING: { bg: "#FEF9C3", color: "#A16207", label: "⏳ Pending admin review" },
    REJECTED: { bg: "#FEE2E2", color: "#B91C1C", label: "✕ Rejected" },
  };
  const meta = map[status] || { bg: "#E0F2FE", color: "#0369A1", label: status || "—" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: "999px",
        background: meta.bg,
        color: meta.color,
        fontSize: "12px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
      {released ? " · Contact released" : ""}
    </span>
  );
};

const Chip = ({ children }) => (
  <span
    style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: "6px",
      background: "#F0FDFA",
      border: "1px solid #99F6E4",
      color: "#0F766E",
      fontSize: "12px",
      fontWeight: 600,
      margin: "2px 4px 2px 0",
    }}
  >
    {children}
  </span>
);

const Field = ({ label, value, strong }) => (
  <div>
    <small style={{ color: "#64748B", fontSize: "11px", display: "block", marginBottom: "2px" }}>
      {label}
    </small>
    <b style={{ color: "#0F172A", fontSize: "13px", wordBreak: "break-word" }}>{value || "—"}</b>
  </div>
);

export default function HireMatchDetailsModal({ open, hireId, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) return;

    // Missing / invalid reference in the notification record
    if (!hireId) {
      setStatus("error");
      setErrorMsg("This notification does not contain valid hire match details.");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setErrorMsg("");
    setData(null);

    hireMatchApi
      .getDetails(hireId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err && err.status === 403) {
          setErrorMsg("You are not authorized to view these hire match details.");
        } else if (err && err.status === 404) {
          setErrorMsg("These hire match details are no longer available.");
        } else {
          setErrorMsg(
            (err && err.message) ||
              "Unable to load the hire match details. Please try again later."
          );
        }
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open, hireId]);

  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.65)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "grid",
    placeItems: "center",
    padding: "16px",
  };

  const boxStyle = {
    background: "#FFFFFF",
    borderRadius: "16px",
    boxShadow: "0 24px 60px rgba(0,0,0,.25)",
    width: "min(680px, 100%)",
    maxHeight: "88vh",
    overflowY: "auto",
    padding: "22px 24px",
    fontFamily: "inherit",
    textAlign: "left",
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={boxStyle} role="dialog" aria-modal="true" aria-label="Hire Match Details">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            borderBottom: "1px solid #E2E8F0",
            paddingBottom: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🤝</span> Hire Match Details
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748B" }}>
              {data && data.job && data.job.title
                ? `${data.job.title}${data.companyName ? " · " + data.companyName : ""}`
                : "Approved hiring details"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "#F1F5F9",
              color: "#334155",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "14px",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Loading state ─────────────────────────── */}
        {status === "loading" && (
          <div style={{ textAlign: "center", padding: "42px 10px", color: "#64748B", fontSize: "13px" }}>
            <div style={{ fontSize: "26px", marginBottom: "8px" }}>⌛</div>
            Loading hire match details…
          </div>
        )}

        {/* ── Error / empty state ───────────────────── */}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: "42px 10px", color: "#B91C1C", fontSize: "13px" }}>
            <div style={{ fontSize: "26px", marginBottom: "8px" }}>⚠️</div>
            {errorMsg}
          </div>
        )}

        {/* ── Ready state: real data ─────────────────── */}
        {status === "ready" && data && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", margin: "14px 0" }}>
              {statusBadge(data.approvalStatus, data.candidateReleased)}
              <span style={{ fontSize: "12px", color: "#64748B" }}>
                Approved: {fmtDate(data.approvedAt)}
              </span>
            </div>

            {/* Job details */}
            {data.job && (
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "14px",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: "14px", color: "#0F766E" }}>
                  💼 {data.job.title}
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <Field label="Company" value={data.companyName} />
                  <Field label="Location / Work mode" value={[data.job.location, data.job.workMode].filter(Boolean).join(" · ")} />
                  <Field label="Experience range" value={
                    data.job.minExperienceYears !== undefined && data.job.minExperienceYears !== null
                      ? `${data.job.minExperienceYears}–${data.job.maxExperienceYears} yrs`
                      : "—"
                  } />
                </div>
                {data.job.description && (
                  <p style={{ margin: "10px 0 0", fontSize: "12.5px", color: "#334155", lineHeight: 1.5 }}>
                    {data.job.description}
                  </p>
                )}
                {Array.isArray(data.job.techStack) && data.job.techStack.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    {data.job.techStack.map((t, i) => (
                      <Chip key={i}>{t}</Chip>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Candidate profile (full details on recruiter/admin view) */}
            {data.viewerRole !== "CANDIDATE" && data.candidate && (
              <div style={{ marginBottom: "14px" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "14px", color: "#0F172A" }}>
                  👤 Candidate
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <Field label="Full name" value={data.candidate.name} />
                  <Field label="Headline" value={data.candidate.headline || data.candidate.currentDesignation} />
                  <Field label="Experience" value={data.candidate.totalExperienceYears != null ? `${data.candidate.totalExperienceYears} years` : "—"} />
                  <Field label="Location" value={data.candidate.location} />
                  <Field label="Email" value={data.candidate.email} />
                  <Field label="Phone" value={data.candidate.phone} />
                </div>
                {Array.isArray(data.candidate.skills) && data.candidate.skills.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    {data.candidate.skills.map((s, i) => (
                      <Chip key={i}>{s}</Chip>
                    ))}
                  </div>
                )}
                {Array.isArray(data.candidate.experiences) && data.candidate.experiences.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    {data.candidate.experiences.map((exp, i) => (
                      <div
                        key={i}
                        style={{
                          borderLeft: "3px solid #99F6E4",
                          paddingLeft: "10px",
                          margin: "8px 0",
                          fontSize: "12.5px",
                        }}
                      >
                        <b style={{ color: "#0F172A" }}>{exp.designation || "—"}</b>{" "}
                        <span style={{ color: "#64748B" }}>@ {exp.company || "—"}</span>
                        {exp.description && (
                          <p style={{ margin: "3px 0 0", color: "#475569", lineHeight: 1.4 }}>{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {data.candidate.resumeDownloadUrl && (
                  <a
                    href={data.candidate.resumeDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: "10px",
                      padding: "7px 14px",
                      borderRadius: "8px",
                      background: "#0F766E",
                      color: "#fff",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    📄 Download Resume{data.candidate.resumeFileName ? ` · ${data.candidate.resumeFileName}` : ""}
                  </a>
                )}
              </div>
            )}

            {/* Hiring details */}
            <div
              style={{
                background: "#F0FDFA",
                border: "1px solid #CCFBF1",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "14px",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: "14px", color: "#0F766E" }}>📋 Hiring details</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "10px",
                }}
              >
                <Field label="Agreed salary (p.a.)" value={fmtINR(data.agreedAnnualSalaryInr)} />
                <Field label="Hiring fee" value={
                  data.calculatedHiringFeeInr
                    ? `${fmtINR(data.calculatedHiringFeeInr)}${
                        data.hiringFeePercentage != null ? ` (${data.hiringFeePercentage}%)` : ""
                      }`
                    : "—"
                } />
                <Field label="Payment status" value={data.paymentStatus} />
                <Field label="Request raised" value={fmtDate(data.createdAtDisplay)} />
                <Field label="Recruiter" value={data.recruiter && data.recruiter.name} />
                {data.viewerRole === "CANDIDATE" && (
                  <Field
                    label="Recruiter contact"
                    value={
                      data.recruiter && data.recruiter.email && data.recruiter.email !== "Locked until candidate release"
                        ? data.recruiter.email
                        : "Unlocked after candidate release"
                    }
                  />
                )}
              </div>
            </div>

            {/* Next steps */}
            {Array.isArray(data.nextSteps) && data.nextSteps.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <h3 style={{ margin: "0 0 6px", fontSize: "14px", color: "#0F172A" }}>🎯 Next steps</h3>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12.5px", color: "#334155", lineHeight: 1.7 }}>
                  {data.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#fff",
              color: "#334155",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
