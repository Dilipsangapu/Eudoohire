import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { publicApi, candidateApi } from "../services/api";
import { toast } from "../components/Toast";
import "./FeaturedJobs.css";

const SAVED_JOBS_KEY = "hrm_unpaid_saved_jobs";

function BookmarkIcon({ saved }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="fj-bookmark-svg"
      fill={saved ? "currentColor" : "none"}
    >
      <path
        d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4V4.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatSalary(minSalary, maxSalary) {
  if (minSalary != null && maxSalary != null) {
    const minLpa = (Number(minSalary) / 100000).toFixed(0);
    const maxLpa = (Number(maxSalary) / 100000).toFixed(0);
    return `₹${minLpa}–${maxLpa} LPA`;
  }
  if (minSalary != null) {
    return `From ₹${(Number(minSalary) / 100000).toFixed(0)} LPA`;
  }
  if (maxSalary != null) {
    return `Up to ₹${(Number(maxSalary) / 100000).toFixed(0)} LPA`;
  }
  return null;
}

function formatExperience(minExp, maxExp) {
  if (minExp != null && maxExp != null) {
    return minExp === maxExp ? `${minExp} years` : `${minExp}–${maxExp} years`;
  }
  if (minExp != null) {
    return `${minExp}+ years`;
  }
  if (maxExp != null) {
    return `Up to ${maxExp} years`;
  }
  return null;
}

function formatPostedDate(createdAt) {
  if (!createdAt) return null;
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const postedDaysAgo = Math.max(0, Math.round((Date.now() - time) / dayMs));
  if (postedDaysAgo === 0) return "Posted today";
  if (postedDaysAgo === 1) return "Posted 1 day ago";
  return `Posted ${postedDaysAgo} days ago`;
}

export default function FeaturedJobs({ jobs: initialJobs = null }) {
  const navigate = useNavigate();
  const [liveJobs, setLiveJobs] = useState(initialJobs);
  const [loading, setLoading] = useState(!initialJobs || initialJobs.length === 0);
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const raw = localStorage.getItem(SAVED_JOBS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [jobQuery, setJobQuery] = useState("");
  const [jobsError, setJobsError] = useState(false);
  const [applying, setApplying] = useState(false);

  // Sync when initialJobs prop changes
  useEffect(() => {
    if (initialJobs && initialJobs.length > 0) {
      setLiveJobs(initialJobs);
      setLoading(false);
      setJobsError(false);
      return;
    }

    let isSubscribed = true;
    setLoading(true);
    setJobsError(false);

    publicApi.getJobs(0, 10)
      .then((res) => {
        if (!isSubscribed) return;
        const jobList = Array.isArray(res?.content)
          ? res.content
          : Array.isArray(res)
          ? res
          : [];

        if (jobList.length > 0) {
          const mapped = jobList.map((j, idx) => ({
            id: j.id,
            title: j.title || "Untitled Role",
            company: j.company || null,
            location: j.location || null,
            type: j.workMode === "WFH" ? "Remote" : j.workMode === "HYBRID" ? "Hybrid" : "Full-time",
            salary: formatSalary(j.minSalaryInr, j.maxSalaryInr),
            posted: formatPostedDate(j.createdAt),
            category: Array.isArray(j.techStack) && j.techStack.length ? j.techStack[0] : null,
            icon: ["↗", "♧", "✿", "＄", "◎", "▥"][idx % 6],
            tone: ["blue", "cyan", "purple", "green", "orange", "lime"][idx % 6],
            description: j.description || "No description provided.",
            experience: formatExperience(j.minExperienceYears, j.maxExperienceYears),
          }));
          setLiveJobs(mapped);
        } else {
          setLiveJobs([]);
        }
      })
      .catch(() => {
        if (!isSubscribed) return;
        setLiveJobs([]);
        setJobsError(true);
      })
      .finally(() => {
        if (isSubscribed) {
          setLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [initialJobs]);

  const jobs = useMemo(() => (liveJobs && liveJobs.length > 0 ? liveJobs : []), [liveJobs]);
  const [selectedId, setSelectedId] = useState(() => jobs[0]?.id ?? null);

  useEffect(() => {
    if (jobs && jobs.length > 0 && !selectedId) {
      setSelectedId(jobs[0].id);
    }
  }, [jobs, selectedId]);

  const filteredJobs = useMemo(() => {
    const term = jobQuery.trim().toLowerCase();
    if (!term) return jobs;
    return jobs.filter((job) =>
      [job.title, job.company, job.location, job.type, job.category, job.experience]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [jobs, jobQuery]);

  const selectedJob = useMemo(
    () => filteredJobs.find((job) => job.id === selectedId) ?? filteredJobs[0] ?? null,
    [filteredJobs, selectedId]
  );

  const toggleSaved = (jobId) => {
    setSavedJobs((current) => {
      const next = current.includes(jobId)
        ? current.filter((id) => id !== jobId)
        : [...current, jobId];
      try {
        localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const handleApply = async (event, targetJob = selectedJob) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent?.stopImmediatePropagation?.();
    }

    if (!targetJob?.id || typeof targetJob.id !== "string") {
      navigate("/login");
      return;
    }

    try {
      setApplying(true);
      await candidateApi.applyToJob(targetJob.id);
      if (toast?.success) {
        toast.success(`Interest registered successfully for ${targetJob.title}!`);
      } else {
        window.alert(`Interest registered successfully for ${targetJob.title}!`);
      }
    } catch (err) {
      const status = err?.status || err?.statusCode || err?.response?.status;
      if (status === 401 || status === 403) {
        if (toast?.info) {
          toast.info("Please sign in to register interest for this role.");
        }
        navigate("/login");
      } else {
        const msg = err?.message || "Please sign in to register interest for this role.";
        if (toast?.error) {
          toast.error(msg);
        } else {
          window.alert(msg);
        }
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="fj-section" id="featured-jobs" aria-labelledby="fj-heading">
      <div className="fj-container">
        <div className="fj-section-heading">
          <div>
            <span className="fj-eyebrow">EUODOO HIRE · CAREER OPPORTUNITIES</span>
            <h2 id="fj-heading">Featured Jobs</h2>
            <p>
              Explore handpicked opportunities and select a role to see more
              details.
            </p>
          </div>
          <span className="fj-total">
            {loading ? "Loading..." : `${jobs.length} opportunities`}
          </span>
        </div>

        <label className="fj-job-search" aria-label="Search featured jobs">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={jobQuery}
            onChange={(event) => setJobQuery(event.target.value)}
            placeholder="Search roles, companies, location..."
            aria-label="Search roles, companies, or location"
          />
          {jobQuery && (
            <button
              type="button"
              className="fj-search-clear"
              onClick={() => setJobQuery("")}
              aria-label="Clear job search"
            >
              ×
            </button>
          )}
        </label>

        {loading ? (
          <div className="fj-empty">
            <h3>Loading opportunities...</h3>
            <p>Fetching active jobs from our verified employers.</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="fj-empty">
            {jobsError ? (
              <>
                <h3>Could not load jobs</h3>
                <p>Live job openings could not be reached right now. Please try again later.</p>
              </>
            ) : (
              <>
                <h3>No jobs available</h3>
                <p>Please check back later for new opportunities.</p>
              </>
            )}
          </div>
        ) : (
          <div className="fj-explorer">
            <aside className="fj-list-panel" aria-label="Featured job list">
              <div className="fj-list-heading">
                <h3>Explore roles</h3>
                <span>{filteredJobs.length} of {jobs.length} jobs</span>
              </div>

              <div className="fj-job-list">
                {filteredJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const isSaved = savedJobs.includes(job.id);

                  return (
                    <button
                      type="button"
                      key={job.id}
                      className={`fj-job-option ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(job.id)}
                      aria-pressed={isSelected}
                    >
                      <span className={`fj-company-icon fj-tone-${job.tone || "blue"}`}>
                        {job.icon || job.company?.charAt(0) || "J"}
                      </span>

                      <span className="fj-option-copy">
                        <span className="fj-option-title">{job.title}</span>
                        <span className="fj-option-company">{job.company || "—"}</span>
                        <span className="fj-option-location">{job.location || "—"}</span>
                        <span className="fj-option-bottom">
                          <span className="fj-type-pill">{job.type}</span>
                          <strong>{job.salary || "—"}</strong>
                        </span>
                      </span>

                      <span
                        className={`fj-option-bookmark ${isSaved ? "is-saved" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSaved(job.id);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={isSaved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleSaved(job.id);
                          }
                        }}
                      >
                        <BookmarkIcon saved={isSaved} />
                      </span>
                    </button>
                  );
                })}
                {filteredJobs.length === 0 && (
                  <div className="fj-search-empty">
                    <strong>No matching roles</strong>
                    <span>Try another job title, company, or location.</span>
                  </div>
                )}
              </div>
            </aside>

            <div className="fj-detail-panel" aria-live="polite">
              {selectedJob ? (
                <article key={selectedJob.id} className="fj-detail-content">
                  <div className="fj-detail-top">
                    <div className="fj-detail-company">
                      <span
                        className={`fj-company-icon fj-detail-icon fj-tone-${selectedJob.tone || "blue"}`}
                      >
                        {selectedJob.icon || selectedJob.company?.charAt(0) || "J"}
                      </span>
                      <div>
                        <span className="fj-detail-eyebrow">FEATURED OPPORTUNITY</span>
                        <h3>{selectedJob.title}</h3>
                        <p>
                          {selectedJob.company || "—"}{" "}
                          <span aria-hidden="true">·</span>{" "}
                          {selectedJob.location || "—"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`fj-save-button ${savedJobs.includes(selectedJob.id) ? "is-saved" : ""}`}
                      onClick={() => toggleSaved(selectedJob.id)}
                      aria-label={
                        savedJobs.includes(selectedJob.id)
                          ? "Remove from saved jobs"
                          : "Save job"
                      }
                      title={savedJobs.includes(selectedJob.id) ? "Unsave job" : "Save job"}
                    >
                      <BookmarkIcon saved={savedJobs.includes(selectedJob.id)} />
                    </button>
                  </div>

                  <div className="fj-detail-body">
                    <div className="fj-detail-tags">
                      <span className="fj-type-pill">{selectedJob.type}</span>
                      {selectedJob.category && (
                        <span className="fj-category-pill">{selectedJob.category}</span>
                      )}
                    </div>

                    {selectedJob.salary ? (
                      <div className="fj-salary">
                        {selectedJob.salary}
                        <span> / per annum</span>
                      </div>
                    ) : null}

                    <h4>About this role</h4>
                    <p className="fj-description">{selectedJob.description}</p>

                    <div className="fj-facts">
                      <div>
                        <span>Company</span>
                        <strong>{selectedJob.company || "—"}</strong>
                      </div>
                      <div>
                        <span>Experience</span>
                        <strong>{selectedJob.experience || "As per role"}</strong>
                      </div>
                      <div>
                        <span>Posted</span>
                        <strong>{selectedJob.posted || "—"}</strong>
                      </div>
                    </div>

                    <div className="fj-detail-footer">
                      <span className="fj-posted-label">
                        {selectedJob.posted ? `Listed ${selectedJob.posted.replace(/^Posted /i, "")}` : "—"}
                      </span>
                      <div className="fj-actions">
                        <button
                          type="button"
                          className="fj-button fj-button-outline"
                          onClick={() => toggleSaved(selectedJob.id)}
                        >
                          {savedJobs.includes(selectedJob.id) ? "Saved ✓" : "Save job"}
                        </button>
                        <button
                          type="button"
                          className="fj-button fj-button-primary"
                          onClick={handleApply}
                          disabled={applying}
                        >
                          {applying ? "Applying..." : "Apply Now"} <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="fj-empty fj-detail-empty">
                  <h3>No role selected</h3>
                  <p>Search for another role or clear your search to browse all opportunities.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
