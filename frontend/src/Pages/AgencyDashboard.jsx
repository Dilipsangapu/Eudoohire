import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { agencyApi, notificationApi } from "../services/api";
import "./AgencyDashboard.css";

const navItems = [
  ["dashboard", "Dashboard", "▦"],
  ["profile", "Agency Profile", "♙"],
  ["clients", "Client Companies", "▣"],
  ["jobs", "Manage Jobs", "▤"],
  ["candidates", "Candidate Database", "♧"],
  ["shortlist", "Candidate Shortlisting", "✓"],
  ["submissions", "Candidate Submissions", "⇧"],
  ["interviews", "Interview Tracking", "▦"],
  ["placements", "Placement Tracking", "◇"],
  ["reports", "Reports & Analytics", "▥"],
  ["notifications", "Notification History", "♧"],
  ["settings", "Settings", "⚙"],
];

const titleMap = Object.fromEntries(navItems.map(([id, label]) => [id, label]));

const Icon = ({ children }) => (
  <span className="agency-icon" aria-hidden="true">
    {children}
  </span>
);

const Status = ({ value }) => {
  const normalized = String(value || "UNKNOWN")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return <span className={`agency-status ${normalized}`}>{formatStatusLabel(value)}</span>;
};

function formatStatusLabel(val) {
  if (!val) return "Unknown";
  return String(val)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : h < 21 ? "Good Evening" : "Good Night";
  }, []);
}

function playTone() {
  try {
    const soundEnabled = localStorage.getItem("agency_sound_enabled") !== "false";
    if (!soundEnabled) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 740;
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // Audio tone failed silently
  }
}

function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <div className="agency-section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="agency-text-btn" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="agency-empty">
      <span>⌕</span>
      <b>{title}</b>
      <p>{description}</p>
    </div>
  );
}

function parseDayMonth(dateStr) {
  if (!dateStr) return { day: "—", month: "—" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      const parts = dateStr.split(/[-/]/);
      return { day: parts[2] || parts[0] || "—", month: parts[1] || "—" };
    }
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("default", { month: "short" }).toUpperCase();
    return { day, month };
  } catch {
    return { day: "—", month: "—" };
  }
}

export default function AgencyDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Popovers
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Modals
  const [jobModal, setJobModal] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [candidateModal, setCandidateModal] = useState(false);
  const [interviewModal, setInterviewModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [placementModal, setPlacementModal] = useState(false);
  const [timelineModal, setTimelineModal] = useState(false);
  const [activeTimeline, setActiveTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Backend state
  const [summary, setSummary] = useState(null);
  const [placementStats, setPlacementStats] = useState(null);
  const [profile, setProfile] = useState({
    agencyName: "",
    officialEmail: "",
    contactNumber: "",
    alternateContactNumber: "",
    website: "",
    agencyType: "RECRUITMENT_AGENCY",
    businessRegistrationNumber: "",
    gstNumber: "",
    panNumber: "",
    representative: { fullName: "", designation: "", officialEmail: "", mobileNumber: "" },
    officeAddress: { officeAddress: "", city: "", state: "", country: "India", pinCode: "" },
  });
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [shortlists, setShortlists] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Forms
  const [jobForm, setJobForm] = useState({
    title: "",
    clientCompanyId: "",
    employmentType: "FULL_TIME",
    workMode: "WFO",
    location: "",
    description: "",
    responsibilities: "",
    minExperienceYears: 1,
    maxExperienceYears: 5,
    minSalaryInr: 500000,
    maxSalaryInr: 1200000,
  });

  const [clientForm, setClientForm] = useState({
    companyName: "",
    industry: "",
    contactPerson: "",
    officialEmail: "",
    contactNumber: "",
    website: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pinCode: "",
  });

  const [interviewForm, setInterviewForm] = useState({
    submissionId: "",
    roundNumber: 1,
    interviewDate: "",
    interviewTime: "",
    meetingLink: "",
    interviewerName: "",
    notes: "",
  });

  const [selectedInterview, setSelectedInterview] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({
    status: "PASSED",
    feedback: "",
    rating: 5,
  });

  const [placementForm, setPlacementForm] = useState({
    submissionId: "",
    candidateId: "",
    jobId: "",
    designation: "",
    offeredSalaryInr: 1000000,
    joiningDate: "",
  });

  const greeting = useGreeting();

  const notify = useCallback((message) => {
    setToast(message);
    playTone();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Load all dashboard & agency data from Spring Boot backend
  useEffect(() => {
    let isMounted = true;

    async function loadAllAgencyData() {
      setLoading(true);
      try {
        const [
          summaryData,
          statsData,
          profileData,
          clientsData,
          jobsData,
          candidatesData,
          shortlistsData,
          submissionsData,
          interviewsData,
          placementsData,
          notifsData,
        ] = await Promise.allSettled([
          agencyApi.getDashboardSummary(),
          agencyApi.getPlacementStatistics(),
          agencyApi.getProfile(),
          agencyApi.getClients({ size: 100 }),
          agencyApi.getJobs({ size: 100 }),
          agencyApi.getCandidates({ size: 100 }),
          agencyApi.getShortlists({ size: 100 }),
          agencyApi.getSubmissions({ size: 100 }),
          agencyApi.getInterviews({ size: 100 }),
          agencyApi.getPlacements({ size: 100 }),
          notificationApi.getNotifications(false, 0, 50),
        ]);

        if (!isMounted) return;

        if (summaryData.status === "fulfilled" && summaryData.value) {
          setSummary(summaryData.value);
        }
        if (statsData.status === "fulfilled" && statsData.value) {
          setPlacementStats(statsData.value);
        }
        if (profileData.status === "fulfilled" && profileData.value) {
          setProfile((prev) => ({
            ...prev,
            ...profileData.value,
            representative: profileData.value.representative || prev.representative,
            officeAddress: profileData.value.officeAddress || prev.officeAddress,
          }));
        }
        if (clientsData.status === "fulfilled" && clientsData.value) {
          setClients(clientsData.value.content || clientsData.value || []);
        }
        if (jobsData.status === "fulfilled" && jobsData.value) {
          setJobs(jobsData.value.content || jobsData.value || []);
        }
        if (candidatesData.status === "fulfilled" && candidatesData.value) {
          setCandidates(candidatesData.value.content || candidatesData.value || []);
        }
        if (shortlistsData.status === "fulfilled" && shortlistsData.value) {
          setShortlists(shortlistsData.value.content || shortlistsData.value || []);
        }
        if (submissionsData.status === "fulfilled" && submissionsData.value) {
          setSubmissions(submissionsData.value.content || submissionsData.value || []);
        }
        if (interviewsData.status === "fulfilled" && interviewsData.value) {
          setInterviews(interviewsData.value.content || interviewsData.value || []);
        }
        if (placementsData.status === "fulfilled" && placementsData.value) {
          setPlacements(placementsData.value.content || placementsData.value || []);
        }
        if (notifsData.status === "fulfilled" && notifsData.value) {
          const list = notifsData.value.content || notifsData.value || [];
          setNotifications(list);
          const unread = list.filter((n) => !n.read && !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch (err) {
        notify("Some agency records could not be loaded: " + (err.message || "Network error"));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAllAgencyData();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, notify]);

  const refreshData = () => setRefreshKey((k) => k + 1);

  const setSection = (id) => {
    setActive(id);
    setMobileOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
    setSearch("");
  };

  const handleSignOut = async () => {
    setProfileOpen(false);
    try {
      await logout();
      navigate("/login");
    } catch {
      navigate("/login");
    }
  };

  // Filtered queries based on active search bar
  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      `${j.title || ""} ${j.clientCompanyName || ""} ${j.employmentType || ""} ${j.workMode || ""} ${j.status || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [jobs, search]);

  const filteredSubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) =>
      `${s.candidateName || ""} ${s.jobTitle || ""} ${s.clientCompanyName || ""} ${s.adminReviewStatus || ""} ${s.recruiterSubmissionStatus || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [submissions, search]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.companyName || ""} ${c.industry || ""} ${c.contactPerson || ""} ${c.status || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [clients, search]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      `${c.name || ""} ${c.currentRole || ""} ${Array.isArray(c.skills) ? c.skills.join(" ") : ""} ${c.location || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [candidates, search]);

  const filteredShortlists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shortlists;
    return shortlists.filter((s) =>
      `${s.candidateName || ""} ${s.jobTitle || ""} ${s.shortlistStatus || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [shortlists, search]);

  const filteredInterviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return interviews;
    return interviews.filter((i) =>
      `${i.candidateName || ""} ${i.jobTitle || ""} ${i.interviewStatus || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [interviews, search]);

  const filteredPlacements = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return placements;
    return placements.filter((p) =>
      `${p.candidateName || ""} ${p.jobTitle || ""} ${p.designation || ""} ${p.placementStatus || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [placements, search]);

  // Client actions
  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!clientForm.companyName.trim()) {
      notify("Please enter the client company name.");
      return;
    }
    try {
      await agencyApi.addClient(clientForm);
      notify("Client company registered successfully.");
      setClientModal(false);
      setClientForm({
        companyName: "",
        industry: "",
        contactPerson: "",
        officialEmail: "",
        contactNumber: "",
        website: "",
        address: "",
        city: "",
        state: "",
        country: "India",
        pinCode: "",
      });
      refreshData();
    } catch (err) {
      notify("Failed to add client company: " + err.message);
    }
  };

  const handleToggleClientStatus = async (client) => {
    const nextStatus = client.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await agencyApi.updateClientStatus(client.id, nextStatus);
      notify(`Client marked as ${nextStatus.toLowerCase()}.`);
      refreshData();
    } catch (err) {
      notify("Failed to update client status: " + err.message);
    }
  };

  // Job actions
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!jobForm.title.trim()) {
      notify("Please enter a job title.");
      return;
    }
    if (!jobForm.clientCompanyId) {
      notify("Please select a registered client company for this job.");
      return;
    }
    try {
      await agencyApi.createJob(jobForm);
      notify("Job requirement posted successfully.");
      setJobModal(false);
      setJobForm({
        title: "",
        clientCompanyId: "",
        employmentType: "FULL_TIME",
        workMode: "WFO",
        location: "",
        description: "",
        responsibilities: "",
        minExperienceYears: 1,
        maxExperienceYears: 5,
        minSalaryInr: 500000,
        maxSalaryInr: 1200000,
      });
      refreshData();
      setSection("jobs");
    } catch (err) {
      notify("Failed to create job: " + err.message);
    }
  };

  const handleToggleJobStatus = async (job) => {
    const nextStatus = job.status === "ACTIVE" ? "CLOSED" : "ACTIVE";
    try {
      await agencyApi.updateJobStatus(job.id, nextStatus);
      notify(`Job status changed to ${nextStatus}.`);
      refreshData();
    } catch (err) {
      notify("Failed to update job status: " + err.message);
    }
  };

  // Candidate actions
  const handleAssociateCandidate = async (candidateId) => {
    try {
      await agencyApi.associateCandidate(candidateId);
      notify("Candidate associated with your agency. Consent granted.");
      refreshData();
    } catch (err) {
      notify("Association failed: " + err.message);
    }
  };

  const handleQuickShortlist = async (candidateId) => {
    if (!jobs.length) {
      notify("Please create at least one active job opening first.");
      setSection("jobs");
      return;
    }
    const defaultJob = jobs[0];
    try {
      await agencyApi.shortlistCandidate({
        candidateId,
        jobId: defaultJob.id,
        notes: `Shortlisted for ${defaultJob.title}`,
      });
      notify(`Candidate shortlisted for ${defaultJob.title}.`);
      refreshData();
      setSection("shortlist");
    } catch (err) {
      notify("Shortlisting failed: " + err.message);
    }
  };

  const handleRemoveShortlist = async (shortlistId) => {
    if (!window.confirm("Remove this candidate from the job shortlist?")) return;
    try {
      await agencyApi.removeShortlist(shortlistId);
      notify("Candidate removed from shortlist.");
      refreshData();
    } catch (err) {
      notify("Could not remove from shortlist: " + err.message);
    }
  };

  // Submissions actions
  const handleCreateSubmission = async (candidateId, jobId, clientCompanyId) => {
    try {
      await agencyApi.createSubmission({
        candidateId,
        jobId,
        clientCompanyId,
      });
      notify("Candidate submission draft created.");
      refreshData();
      setSection("submissions");
    } catch (err) {
      notify("Submission draft failed: " + err.message);
    }
  };

  const handleSubmitToAdmin = async (submissionId) => {
    try {
      await agencyApi.submitToAdmin(submissionId);
      notify("Candidate submitted for Admin Review.");
      refreshData();
    } catch (err) {
      notify("Submit to admin failed: " + err.message);
    }
  };

  const handleSendToRecruiter = async (submissionId, recruiterUserId) => {
    try {
      await agencyApi.sendToRecruiter(submissionId, recruiterUserId || null);
      notify("Candidate forwarded to hiring recruiter.");
      refreshData();
    } catch (err) {
      notify("Forwarding failed: " + err.message);
    }
  };

  const handleViewTimeline = async (submissionId) => {
    setTimelineLoading(true);
    setTimelineModal(true);
    try {
      const history = await agencyApi.getSubmissionTimeline(submissionId);
      setActiveTimeline(history || []);
    } catch (err) {
      notify("Could not load timeline: " + err.message);
      setActiveTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  // Interview actions
  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    if (!interviewForm.submissionId) {
      notify("Please select an approved submission.");
      return;
    }
    if (!interviewForm.interviewDate) {
      notify("Please choose an interview date.");
      return;
    }
    try {
      await agencyApi.scheduleInterview({
        submissionId: interviewForm.submissionId,
        roundNumber: parseInt(interviewForm.roundNumber, 10) || 1,
        interviewDate: interviewForm.interviewDate,
        interviewTime: interviewForm.interviewTime || "10:00 AM",
        meetingLink: interviewForm.meetingLink || "",
        interviewerName: interviewForm.interviewerName || "Interview Panel",
        notes: interviewForm.notes || "",
      });
      notify("Interview scheduled successfully.");
      setInterviewModal(false);
      setInterviewForm({
        submissionId: "",
        roundNumber: 1,
        interviewDate: "",
        interviewTime: "",
        meetingLink: "",
        interviewerName: "",
        notes: "",
      });
      refreshData();
    } catch (err) {
      notify("Failed to schedule interview: " + err.message);
    }
  };

  const handleRecordFeedback = async (e) => {
    e.preventDefault();
    if (!selectedInterview) return;
    try {
      await agencyApi.recordInterviewFeedback(selectedInterview.id, feedbackForm);
      notify("Interview outcome & feedback recorded.");
      setFeedbackModal(false);
      setSelectedInterview(null);
      refreshData();
    } catch (err) {
      notify("Failed to record feedback: " + err.message);
    }
  };

  // Placement actions
  const handleRecordPlacement = async (e) => {
    e.preventDefault();
    if (!placementForm.submissionId) {
      notify("Please select a selected candidate submission.");
      return;
    }
    try {
      await agencyApi.createPlacement({
        submissionId: placementForm.submissionId,
        candidateId: placementForm.candidateId,
        jobId: placementForm.jobId,
        designation: placementForm.designation,
        offeredSalaryInr: Number(placementForm.offeredSalaryInr) || 800000,
        joiningDate: placementForm.joiningDate || new Date().toISOString().slice(0, 10),
      });
      notify("Offer & placement recorded.");
      setPlacementModal(false);
      refreshData();
    } catch (err) {
      notify("Placement record failed: " + err.message);
    }
  };

  const handleConfirmPlacement = async (placementId) => {
    const remarks = window.prompt("Enter confirmation remarks / joining note:", "Candidate accepted offer and joined client company.");
    if (remarks === null) return;
    try {
      await agencyApi.confirmPlacement(placementId, remarks);
      notify("Placement successfully confirmed!");
      refreshData();
    } catch (err) {
      notify("Confirmation failed: " + err.message);
    }
  };

  // Profile actions
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await agencyApi.updateProfile({
        agencyName: profile.agencyName,
        agencyType: profile.agencyType,
        contactNumber: profile.contactNumber,
        alternateContactNumber: profile.alternateContactNumber,
        website: profile.website,
        representative: profile.representative,
        officeAddress: profile.officeAddress,
      });
      notify("Agency profile details saved successfully.");
      refreshData();
    } catch (err) {
      notify("Failed to save profile: " + err.message);
    }
  };

  // Notification actions
  const handleMarkAllNotifsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
      setUnreadCount(0);
      notify("All notifications marked as read.");
    } catch (err) {
      notify("Could not mark all as read: " + err.message);
    }
  };

  const handleMarkSingleNotif = async (notifId) => {
    try {
      await notificationApi.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Mark locally on non-critical error
    }
  };

  const pageTitle = titleMap[active] || "Dashboard";
  const agencyDisplayName = profile.agencyName || user?.name || "Consulting Agency";

  // Dashboard Overview Section
  const renderDashboard = () => (
    <>
      <section className="agency-welcome">
        <div>
          <h1>
            {greeting}, {agencyDisplayName}
          </h1>
          <p>Here’s your recruitment overview. Let’s find and place top talent for your clients.</p>
        </div>
        <button className="agency-primary" onClick={() => setJobModal(true)}>
          ＋ Create New Job
        </button>
      </section>

      {/* Metrics Row */}
      <section className="agency-metrics">
        {[
          {
            label: "Total Jobs",
            value: summary?.totalJobs ?? jobs.length,
            change: `${summary?.openJobs ?? jobs.filter((j) => j.status === "ACTIVE").length} active`,
            icon: "▤",
            tone: "teal",
          },
          {
            label: "Total Candidates",
            value: summary?.totalCandidates ?? candidates.length,
            change: `${summary?.shortlistedCandidates ?? shortlists.length} shortlisted`,
            icon: "♧",
            tone: "blue",
          },
          {
            label: "Interviews",
            value: summary?.upcomingInterviews ?? interviews.length,
            change: `${interviews.filter((i) => i.interviewStatus === "SCHEDULED").length} scheduled`,
            icon: "▦",
            tone: "purple",
          },
          {
            label: "Successful Placements",
            value: summary?.successfulPlacements ?? placements.filter((p) => p.placementStatus === "PLACEMENT_CONFIRMED").length,
            change: `${placements.length} total offers`,
            icon: "◇",
            tone: "green",
          },
        ].map((m) => (
          <article className="agency-metric-card" key={m.label}>
            <div className="agency-metric-top">
              <span>{m.label}</span>
              <span className={`agency-metric-icon ${m.tone}`}>{m.icon}</span>
            </div>
            <strong>{m.value}</strong>
            <small>{m.change}</small>
          </article>
        ))}
      </section>

      {/* Quick Action Navigation */}
      <section className="agency-quick-grid">
        {[
          ["clients", "Client Companies", "Manage partner employers & hiring companies", "▣"],
          ["candidates", "Candidate Database", "Discover, associate & verify candidates", "♧"],
          ["submissions", "Candidate Submissions", "Review admin approvals & recruiter actions", "⇧"],
        ].map(([id, label, desc, icon]) => (
          <button className="agency-quick-card" key={id} onClick={() => setSection(id)}>
            <span className="agency-quick-icon">{icon}</span>
            <div>
              <b>{label}</b>
              <small>{desc}</small>
            </div>
            <span className="agency-arrow">→</span>
          </button>
        ))}
      </section>

      {/* Active Jobs Table Card */}
      <section className="agency-section-card">
        <SectionHeader
          title="Active Job Requirements"
          subtitle="Recent positions registered for partner companies"
          action="View all jobs →"
          onAction={() => setSection("jobs")}
        />
        {renderJobsTable(filteredJobs.slice(0, 4))}
      </section>

      {/* Recent Submissions Table Card */}
      <section className="agency-section-card">
        <SectionHeader
          title="Recent Candidate Submissions"
          subtitle="Follow candidates through admin review and recruiter evaluations"
          action="View all submissions →"
          onAction={() => setSection("submissions")}
        />
        {renderSubmissionsTable(filteredSubs.slice(0, 4))}
      </section>

      {/* Upcoming Interviews & Placement Preview */}
      <section className="agency-bottom-grid">
        <article className="agency-section-card agency-mini-card">
          <h2>Upcoming Interviews</h2>
          <p>Scheduled candidate assessments</p>
          {interviews.length ? (
            interviews.slice(0, 3).map((iv) => {
              const { day, month } = parseDayMonth(iv.interviewDate);
              return (
                <div className="agency-interview" key={iv.id}>
                  <span className="agency-date">
                    <b>{day}</b>
                    <small>{month}</small>
                  </span>
                  <div>
                    <b>{iv.candidateName || "Candidate"}</b>
                    <small>{iv.jobTitle || "Job Interview"}</small>
                  </div>
                  <span className="agency-time">{iv.interviewTime || "Scheduled"}</span>
                </div>
              );
            })
          ) : (
            <EmptyState title="No upcoming interviews" description="Scheduled rounds will appear here." />
          )}
          <button className="agency-text-btn" onClick={() => setSection("interviews")}>
            Manage interviews →
          </button>
        </article>

        <article className="agency-section-card agency-mini-card">
          <h2>Placement Overview</h2>
          <p>Your hiring success and joining velocity</p>
          <div className="agency-placement-number">
            <strong>
              {placementStats?.confirmedPlacements ??
                placements.filter((p) => p.placementStatus === "PLACEMENT_CONFIRMED").length}
            </strong>
            <span>placements confirmed</span>
          </div>
          <div className="agency-placement-bar">
            <i
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    15,
                    ((placementStats?.confirmedPlacements || placements.length) / Math.max(1, (jobs.length || 10))) * 100
                  )
                )}%`,
              }}
            />
          </div>
          <div className="agency-placement-foot">
            <span>
              Total Value: ₹
              {((placementStats?.totalConfirmedSalaryInr || 0) / 100000).toFixed(1)}L
            </span>
            <b>{placementStats?.confirmedPlacements || placements.length} Joined</b>
          </div>
          <button className="agency-text-btn" onClick={() => setSection("reports")}>
            View full analytics →
          </button>
        </article>
      </section>
    </>
  );

  // Table renderers
  function renderJobsTable(rows) {
    if (!rows.length) {
      return <EmptyState title="No jobs found" description="Create a new job opening or adjust search filters." />;
    }
    return (
      <div className="agency-table-wrap">
        <table className="agency-table">
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Client Company</th>
              <th>Employment Type</th>
              <th>Location</th>
              <th>Candidates</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id}>
                <td>
                  <b>{j.title}</b>
                </td>
                <td>{j.clientCompanyName || "Company Client"}</td>
                <td>{formatStatusLabel(j.employmentType || "FULL_TIME")}</td>
                <td>{j.location || j.city || "Remote / Onsite"}</td>
                <td>{j.candidateCount || j.submissionCount || 0}</td>
                <td>
                  <Status value={j.status} />
                </td>
                <td>
                  <button
                    className="agency-row-action"
                    onClick={() => handleToggleJobStatus(j)}
                    title="Toggle active / closed status"
                  >
                    {j.status === "ACTIVE" ? "Close" : "Re-open"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSubmissionsTable(rows) {
    if (!rows.length) {
      return <EmptyState title="No submissions found" description="Candidates submitted for review will appear here." />;
    }
    return (
      <div className="agency-table-wrap">
        <table className="agency-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Applied For</th>
              <th>Client Company</th>
              <th>Admin Review</th>
              <th>Recruiter Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const initials = (s.candidateName || "Candidate")
                .split(/\s+/)
                .map((x) => x[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <tr key={s.id}>
                  <td>
                    <div className="agency-candidate">
                      <span>{initials}</span>
                      <b>{s.candidateName}</b>
                    </div>
                  </td>
                  <td>{s.jobTitle}</td>
                  <td>{s.clientCompanyName || "—"}</td>
                  <td>
                    <Status value={s.adminReviewStatus} />
                  </td>
                  <td>
                    <Status value={s.recruiterSubmissionStatus || s.finalSelectionStatus || "Pending"} />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {s.adminReviewStatus === "DRAFT" && (
                        <button
                          className="agency-row-action"
                          style={{ color: "#0f9488", fontWeight: 600 }}
                          onClick={() => handleSubmitToAdmin(s.id)}
                        >
                          Submit to Admin ↗
                        </button>
                      )}
                      {s.adminReviewStatus === "RELEASED_TO_AGENCY" && (
                        <button
                          className="agency-row-action"
                          style={{ color: "#0284c7", fontWeight: 600 }}
                          onClick={() => handleSendToRecruiter(s.id, s.recruiterUserId)}
                        >
                          Forward to Recruiter ↗
                        </button>
                      )}
                      <button className="agency-row-action" onClick={() => handleViewTimeline(s.id)}>
                        Timeline
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Section Switcher
  function renderSection() {
    if (active === "dashboard") return renderDashboard();

    if (active === "jobs") {
      return (
        <>
          <SectionHeader
            title="Manage Jobs"
            subtitle="Register client requirements and track hiring positions"
            action="＋ Create New Job"
            onAction={() => setJobModal(true)}
          />
          <section className="agency-section-card">{renderJobsTable(filteredJobs)}</section>
        </>
      );
    }

    if (active === "submissions") {
      return (
        <>
          <SectionHeader
            title="Candidate Submissions"
            subtitle="Review candidates progressing through Platform Admin approval and Recruiter selection"
          />
          <section className="agency-section-card">{renderSubmissionsTable(filteredSubs)}</section>
        </>
      );
    }

    if (active === "clients") {
      return (
        <>
          <SectionHeader
            title="Client Companies"
            subtitle="Manage hiring partners and companies working with your agency"
            action="＋ Add Client Company"
            onAction={() => setClientModal(true)}
          />
          <section className="agency-section-card">
            {filteredClients.length ? (
              <div className="agency-table-wrap">
                <table className="agency-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Industry</th>
                      <th>Contact Person</th>
                      <th>Contact Email</th>
                      <th>Jobs</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <b>{c.companyName}</b>
                        </td>
                        <td>{c.industry || "General"}</td>
                        <td>{c.contactPerson || "—"}</td>
                        <td>{c.officialEmail || "—"}</td>
                        <td>{c.totalJobs || 0}</td>
                        <td>
                          <Status value={c.status} />
                        </td>
                        <td>
                          <button className="agency-row-action" onClick={() => handleToggleClientStatus(c)}>
                            {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No client companies registered"
                description="Add your first corporate client partner to start creating jobs."
              />
            )}
          </section>
        </>
      );
    }

    if (active === "candidates") {
      return (
        <>
          <SectionHeader
            title="Candidate Database"
            subtitle="Browse candidate profiles, associate them with your agency and collect consent"
            action="＋ Associate Candidate"
            onAction={() => setCandidateModal(true)}
          />
          <section className="agency-section-card">
            {filteredCandidates.length ? (
              <div className="agency-table-wrap">
                <table className="agency-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Role / Headline</th>
                      <th>Experience</th>
                      <th>Key Skills</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((c) => {
                      const initials = (c.name || "Candidate")
                        .split(/\s+/)
                        .map((x) => x[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      const isAssociated = c.associated || c.associationStatus === "ACTIVE";
                      return (
                        <tr key={c.candidateId || c.profileId || c.id || c.name}>
                          <td>
                            <div className="agency-candidate">
                              <span>{initials}</span>
                              <b>{c.name}</b>
                            </div>
                          </td>
                          <td>{c.currentRole || "Candidate"}</td>
                          <td>{c.totalExperienceYears ? `${c.totalExperienceYears} yrs` : "Fresher"}</td>
                          <td>{Array.isArray(c.skills) ? c.skills.slice(0, 3).join(", ") : "—"}</td>
                          <td>
                            <Status value={isAssociated ? "Associated" : "Available"} />
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {!isAssociated ? (
                                <button
                                  className="agency-row-action"
                                  style={{ color: "#0f9488", fontWeight: 600 }}
                                  onClick={() => handleAssociateCandidate(c.candidateId || c.userId || c.id)}
                                >
                                  Associate ＋
                                </button>
                              ) : (
                                <button
                                  className="agency-row-action"
                                  onClick={() => handleQuickShortlist(c.candidateId || c.userId || c.id)}
                                >
                                  Shortlist ✓
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No candidates found"
                description="Candidates registered on the portal will appear here for association."
              />
            )}
          </section>
        </>
      );
    }

    if (active === "shortlist") {
      return (
        <>
          <SectionHeader
            title="Candidate Shortlisting"
            subtitle="Candidates shortlisted for job requirements ready for submission"
          />
          <section className="agency-section-card">
            {filteredShortlists.length ? (
              <div className="agency-table-wrap">
                <table className="agency-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Target Job</th>
                      <th>Match Score</th>
                      <th>Notes</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShortlists.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <b>{s.candidateName}</b>
                        </td>
                        <td>{s.jobTitle}</td>
                        <td>{s.matchingPercentage ? `${s.matchingPercentage}%` : "Eligible"}</td>
                        <td>{s.shortlistingNotes || "—"}</td>
                        <td>
                          <Status value={s.shortlistStatus} />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              className="agency-row-action"
                              style={{ color: "#0f9488", fontWeight: 600 }}
                              onClick={() => {
                                const matchedJob = jobs.find((j) => j.id === s.jobId);
                                handleCreateSubmission(s.candidateId, s.jobId, matchedJob?.clientCompanyId || "");
                              }}
                            >
                              Submit to Admin ↗
                            </button>
                            <button
                              className="agency-row-action"
                              style={{ color: "#ef4444" }}
                              onClick={() => handleRemoveShortlist(s.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No candidates shortlisted yet"
                description="Browse candidate profiles and shortlist them for active jobs."
              />
            )}
          </section>
        </>
      );
    }

    if (active === "interviews") {
      return (
        <>
          <SectionHeader
            title="Interview Tracking"
            subtitle="Monitor scheduled rounds, record interviewer feedback and advance candidates"
            action="＋ Schedule Interview"
            onAction={() => setInterviewModal(true)}
          />
          <section className="agency-section-card">
            {filteredInterviews.length ? (
              filteredInterviews.map((iv) => {
                const { day, month } = parseDayMonth(iv.interviewDate);
                return (
                  <div className="agency-interview" key={iv.id}>
                    <span className="agency-date">
                      <b>{day}</b>
                      <small>{month}</small>
                    </span>
                    <div>
                      <b>{iv.candidateName}</b>
                      <small>
                        {iv.jobTitle} · Round {iv.roundNumber || 1}
                      </small>
                      {iv.meetingLink && (
                        <small style={{ color: "#0f9488" }}>
                          Link:{" "}
                          <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer">
                            {iv.meetingLink}
                          </a>
                        </small>
                      )}
                    </div>
                    <span className="agency-time">{iv.interviewTime || "Scheduled"}</span>
                    <Status value={iv.interviewStatus} />
                    <button
                      className="agency-row-action"
                      onClick={() => {
                        setSelectedInterview(iv);
                        setFeedbackModal(true);
                      }}
                    >
                      Feedback ✎
                    </button>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="No interviews scheduled"
                description="Schedule candidate interview rounds once submissions are approved."
              />
            )}
          </section>
        </>
      );
    }

    if (active === "placements") {
      return (
        <>
          <SectionHeader
            title="Placement Tracking"
            subtitle="Track offer releases, candidate joinings and fee records"
            action="＋ Record Placement"
            onAction={() => setPlacementModal(true)}
          />
          <section className="agency-section-card">
            {filteredPlacements.length ? (
              <div className="agency-table-wrap">
                <table className="agency-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Role</th>
                      <th>Client Company</th>
                      <th>Offered Salary</th>
                      <th>Joining Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlacements.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <b>{p.candidateName}</b>
                        </td>
                        <td>{p.designation || p.jobTitle}</td>
                        <td>{p.clientCompanyName || "Hiring Partner"}</td>
                        <td>₹{((p.offeredSalaryInr || 0) / 100000).toFixed(2)} LPA</td>
                        <td>{p.joiningDate || "Immediate"}</td>
                        <td>
                          <Status value={p.placementStatus} />
                        </td>
                        <td>
                          {p.placementStatus !== "PLACEMENT_CONFIRMED" ? (
                            <button
                              className="agency-row-action"
                              style={{ color: "#15803d", fontWeight: 600 }}
                              onClick={() => handleConfirmPlacement(p.id)}
                            >
                              Confirm Joining ✓
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#15803d" }}>Joined ✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No placements recorded"
                description="Offers accepted and confirmed hires will appear here."
              />
            )}
          </section>
        </>
      );
    }

    if (active === "reports") {
      const confirmed =
        placementStats?.confirmedPlacements ??
        placements.filter((p) => p.placementStatus === "PLACEMENT_CONFIRMED").length;
      return (
        <>
          <SectionHeader
            title="Reports & Analytics"
            subtitle="Hiring performance metrics, recruitment speed and placement value"
          />
          <section className="agency-metrics">
            {[
              { label: "Jobs Managed", value: summary?.totalJobs ?? jobs.length },
              { label: "Active Clients", value: summary?.activeClients ?? clients.length },
              { label: "Submissions Sent", value: summary?.candidatesSentToRecruiters ?? submissions.length },
              { label: "Interviews Held", value: summary?.completedInterviews ?? interviews.length },
              { label: "Confirmed Hires", value: confirmed },
              {
                label: "Total Placed CTC",
                value: `₹${(((placementStats?.totalConfirmedSalaryInr || 0) / 100000) || 0).toFixed(1)}L`,
              },
            ].map((x) => (
              <article className="agency-metric-card" key={x.label}>
                <span>{x.label}</span>
                <strong>{x.value}</strong>
              </article>
            ))}
          </section>
          <section className="agency-section-card">
            <h2>Monthly Placement Target</h2>
            <div className="agency-placement-number">
              <strong>{confirmed}</strong>
              <span>placements finalized this quarter</span>
            </div>
            <div className="agency-placement-bar">
              <i style={{ width: `${Math.min(100, Math.max(15, (confirmed / 10) * 100))}%` }} />
            </div>
          </section>
        </>
      );
    }

    if (active === "notifications") {
      return (
        <>
          <SectionHeader
            title="Notification History"
            subtitle="Review agency activity, candidate updates, submissions and interview alerts"
            action="Mark all as read"
            onAction={handleMarkAllNotifsRead}
          />
          <section className="agency-section-card agency-history-card">
            <div className="agency-history-toolbar">
              <span>{notifications.length} notifications</span>
              <span>{unreadCount} unread</span>
            </div>
            {notifications.length ? (
              notifications.map((n) => {
                const isUnread = !n.read && !n.isRead;
                return (
                  <article className={`agency-history-item ${isUnread ? "unread" : ""}`} key={n.id}>
                    <span className="agency-history-icon">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                      </svg>
                    </span>
                    <div className="agency-history-body">
                      <div className="agency-history-title">
                        <b>{n.title || n.subject || "Agency Update"}</b>
                        {isUnread && <span className="agency-unread-dot" />}
                      </div>
                      <p>{n.message || n.detail || n.content}</p>
                      <small>{n.createdAt ? new Date(n.createdAt).toLocaleString() : "Just now"}</small>
                    </div>
                    {isUnread && (
                      <button className="agency-row-action" onClick={() => handleMarkSingleNotif(n.id)}>
                        Mark read
                      </button>
                    )}
                  </article>
                );
              })
            ) : (
              <EmptyState title="You're all caught up" description="New notifications from EUODOO will appear here." />
            )}
          </section>
        </>
      );
    }

    if (active === "profile") {
      return (
        <>
          <SectionHeader
            title="Agency Profile"
            subtitle="Manage your agency information, verified documents and corporate contacts"
          />
          <form className="agency-section-card agency-profile-form" onSubmit={handleSaveProfile}>
            <div className="agency-profile-intro">
              <span className="agency-avatar agency-profile-avatar">
                {(profile.agencyName || user?.name || "A").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <b>{profile.agencyName || user?.name || "Agency Name"}</b>
                <small>Official Registration Status: {profile.registrationStatus || "SUBMITTED"}</small>
              </div>
            </div>

            <label>
              Agency Name *
              <input
                value={profile.agencyName || ""}
                onChange={(e) => setProfile((p) => ({ ...p, agencyName: e.target.value }))}
                required
              />
            </label>

            <label>
              Official Business Email
              <input value={profile.officialEmail || user?.email || ""} readOnly disabled />
            </label>

            <label>
              Contact Number
              <input
                value={profile.contactNumber || ""}
                onChange={(e) => setProfile((p) => ({ ...p, contactNumber: e.target.value }))}
              />
            </label>

            <label>
              Alternate Contact Number
              <input
                value={profile.alternateContactNumber || ""}
                onChange={(e) => setProfile((p) => ({ ...p, alternateContactNumber: e.target.value }))}
              />
            </label>

            <label>
              Website
              <input
                value={profile.website || ""}
                onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://youragency.com"
              />
            </label>

            <label>
              Agency Type
              <input value={profile.agencyType || "RECRUITMENT_AGENCY"} readOnly disabled />
            </label>

            <label>
              Business Registration (CIN)
              <input value={profile.businessRegistrationNumber || "—"} readOnly disabled />
            </label>

            <label>
              GST Number
              <input value={profile.gstNumber || "—"} readOnly disabled />
            </label>

            <label>
              Company PAN
              <input value={profile.panNumber || "—"} readOnly disabled />
            </label>

            <label>
              Representative Name
              <input
                value={profile.representative?.fullName || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    representative: { ...(p.representative || {}), fullName: e.target.value },
                  }))
                }
              />
            </label>

            <label className="agency-profile-wide">
              Office Address
              <textarea
                value={profile.officeAddress?.officeAddress || ""}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    officeAddress: { ...(p.officeAddress || {}), officeAddress: e.target.value },
                  }))
                }
                placeholder="Full street address..."
              />
            </label>

            <div className="agency-profile-wide agency-form-actions">
              <button className="agency-primary" type="submit">
                Save Profile Changes
              </button>
            </div>
          </form>
        </>
      );
    }

    // Settings
    return (
      <>
        <SectionHeader title="Settings" subtitle="Agency notification settings and application preferences" />
        <section className="agency-section-card agency-settings">
          <label>
            <input
              type="checkbox"
              defaultChecked={localStorage.getItem("agency_sound_enabled") !== "false"}
              onChange={(e) => {
                localStorage.setItem("agency_sound_enabled", e.target.checked ? "true" : "false");
                notify(e.target.checked ? "Audio notifications enabled." : "Audio notifications muted.");
              }}
            />
            Enable notification chime sounds
          </label>
          <label>
            <input
              type="checkbox"
              defaultChecked={localStorage.getItem("agency_email_notifs") !== "false"}
              onChange={(e) => {
                localStorage.setItem("agency_email_notifs", e.target.checked ? "true" : "false");
                notify("Email preferences updated.");
              }}
            />
            Receive email notifications for candidate review outcomes
          </label>
        </section>
      </>
    );
  }

  return (
    <div className={`agency-root ${collapsed ? "agency-collapsed" : ""}`}>
      {/* Sidebar */}
      <aside className={`agency-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="agency-brand">
          <span className="agency-logo">▣</span>
          <span className="agency-brand-name">EUODOO HIRE</span>
        </div>
        <button
          className="agency-collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? "›" : "‹"}
        </button>
        <div className="agency-menu-label">AGENCY PORTAL</div>
        <nav className="agency-nav">
          {navItems.map(([id, label, icon]) => (
            <button
              key={id}
              className={`agency-nav-item ${active === id ? "active" : ""}`}
              onClick={() => setSection(id)}
              title={label}
            >
              <Icon>{icon}</Icon>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <button className="agency-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
      )}

      {/* Main Container */}
      <main className="agency-main">
        {/* Topbar */}
        <header className="agency-topbar">
          <button className="agency-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="agency-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, candidates, client companies..."
            />
          </div>

          <div className="agency-top-actions">
            {/* Notification Bell */}
            <div className="agency-popover-wrap">
              <button
                className="agency-bell"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
                {unreadCount > 0 && <i>{unreadCount}</i>}
              </button>

              {notifOpen && (
                <div className="agency-dropdown agency-notif-dropdown">
                  <div className="agency-dropdown-head">
                    <b>Notifications</b>
                    <button onClick={handleMarkAllNotifsRead}>Mark all read</button>
                  </div>
                  {notifications.slice(0, 5).map((n) => (
                    <button
                      className={`agency-notification ${!n.read && !n.isRead ? "unread" : ""}`}
                      key={n.id}
                      onClick={() => {
                        handleMarkSingleNotif(n.id);
                        setSection("notifications");
                      }}
                    >
                      <b>{n.title || n.subject || "Alert"}</b>
                      <span>{n.message || n.detail || n.content}</span>
                      <small>{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}</small>
                    </button>
                  ))}
                  <button
                    className="agency-dropdown-footer"
                    onClick={() => {
                      setNotifOpen(false);
                      setSection("notifications");
                    }}
                  >
                    View notification history
                  </button>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="agency-popover-wrap">
              <button
                className="agency-user"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                aria-expanded={profileOpen}
              >
                <span className="agency-avatar">
                  {(agencyDisplayName || "A").slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <b>{agencyDisplayName}</b>
                  <small>{user?.role ? formatStatusLabel(user.role) : "Agency User"}</small>
                </span>
                <span className="agency-chevron">⌄</span>
              </button>

              {profileOpen && (
                <div className="agency-dropdown agency-profile-dropdown">
                  <div className="agency-profile-summary">
                    <span className="agency-avatar">
                      {(agencyDisplayName || "A").slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <b>{agencyDisplayName}</b>
                      <small>{user?.email}</small>
                    </div>
                  </div>
                  <button onClick={() => setSection("profile")}>Agency Profile</button>
                  <button onClick={() => setSection("settings")}>Settings</button>
                  <button className="agency-signout" onClick={handleSignOut}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="agency-content">
          {loading ? (
            <div className="agency-skeleton">
              <div className="sk-line wide" />
              <div className="sk-line medium" />
              <div className="sk-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div className="sk-card" key={i} />
                ))}
              </div>
              <div className="sk-card tall" />
            </div>
          ) : (
            <div className="agency-page-enter" key={active}>
              {active !== "dashboard" && (
                <div className="agency-page-heading">
                  <div>
                    <h1>{pageTitle}</h1>
                    <p>Manage your agency recruitment workflow.</p>
                  </div>
                  {active === "jobs" && (
                    <button className="agency-primary" onClick={() => setJobModal(true)}>
                      ＋ Create New Job
                    </button>
                  )}
                </div>
              )}
              {renderSection()}
            </div>
          )}
        </div>
      </main>

      {/* Modal: Create Job */}
      {jobModal && (
        <div
          className="agency-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setJobModal(false);
          }}
        >
          <form className="agency-modal" onSubmit={handleCreateJob}>
            <div className="agency-modal-head">
              <div>
                <h2>Create New Job</h2>
                <p>Add a client job requirement to your agency dashboard.</p>
              </div>
              <button type="button" onClick={() => setJobModal(false)} aria-label="Close">
                ×
              </button>
            </div>

            <label>
              Job Title *
              <input
                autoFocus
                value={jobForm.title}
                onChange={(e) => setJobForm((v) => ({ ...v, title: e.target.value }))}
                placeholder="e.g. Senior Java Backend Engineer"
                required
              />
            </label>

            <label>
              Client Company *
              <select
                value={jobForm.clientCompanyId}
                onChange={(e) => setJobForm((v) => ({ ...v, clientCompanyId: e.target.value }))}
                required
              >
                <option value="">Select a registered client company...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Employment Type
              <select
                value={jobForm.employmentType}
                onChange={(e) => setJobForm((v) => ({ ...v, employmentType: e.target.value }))}
              >
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </label>

            <label>
              Work Mode
              <select
                value={jobForm.workMode}
                onChange={(e) => setJobForm((v) => ({ ...v, workMode: e.target.value }))}
              >
                <option value="WFO">On-site (WFO)</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </label>

            <label>
              Location
              <input
                value={jobForm.location}
                onChange={(e) => setJobForm((v) => ({ ...v, location: e.target.value }))}
                placeholder="e.g. Mumbai, Maharashtra"
              />
            </label>

            <label>
              Job Description *
              <textarea
                value={jobForm.description}
                onChange={(e) => setJobForm((v) => ({ ...v, description: e.target.value }))}
                placeholder="Key role responsibilities, tech stack, and qualifications..."
                required
              />
            </label>

            <div className="agency-modal-actions">
              <button type="button" className="agency-secondary" onClick={() => setJobModal(false)}>
                Cancel
              </button>
              <button type="submit" className="agency-primary">
                Create Job
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Client */}
      {clientModal && (
        <div
          className="agency-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setClientModal(false);
          }}
        >
          <form className="agency-modal" onSubmit={handleCreateClient}>
            <div className="agency-modal-head">
              <div>
                <h2>Add Client Company</h2>
                <p>Register a corporate employer hiring through your agency.</p>
              </div>
              <button type="button" onClick={() => setClientModal(false)} aria-label="Close">
                ×
              </button>
            </div>

            <label>
              Company Name *
              <input
                autoFocus
                value={clientForm.companyName}
                onChange={(e) => setClientForm((v) => ({ ...v, companyName: e.target.value }))}
                required
              />
            </label>

            <label>
              Industry *
              <input
                value={clientForm.industry}
                onChange={(e) => setClientForm((v) => ({ ...v, industry: e.target.value }))}
                placeholder="e.g. Information Technology"
                required
              />
            </label>

            <label>
              Contact Person
              <input
                value={clientForm.contactPerson}
                onChange={(e) => setClientForm((v) => ({ ...v, contactPerson: e.target.value }))}
              />
            </label>

            <label>
              Contact Email
              <input
                type="email"
                value={clientForm.officialEmail}
                onChange={(e) => setClientForm((v) => ({ ...v, officialEmail: e.target.value }))}
              />
            </label>

            <label>
              Contact Phone
              <input
                value={clientForm.contactNumber}
                onChange={(e) => setClientForm((v) => ({ ...v, contactNumber: e.target.value }))}
              />
            </label>

            <label>
              Website
              <input
                value={clientForm.website}
                onChange={(e) => setClientForm((v) => ({ ...v, website: e.target.value }))}
                placeholder="https://company.com"
              />
            </label>

            <label>
              Address
              <textarea
                value={clientForm.address}
                onChange={(e) => setClientForm((v) => ({ ...v, address: e.target.value }))}
              />
            </label>

            <div className="agency-modal-actions">
              <button type="button" className="agency-secondary" onClick={() => setClientModal(false)}>
                Cancel
              </button>
              <button type="submit" className="agency-primary">
                Add Client
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Associate Candidate */}
      {candidateModal && (
        <div
          className="agency-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCandidateModal(false);
          }}
        >
          <div className="agency-modal">
            <div className="agency-modal-head">
              <div>
                <h2>Associate Candidate</h2>
                <p>Select a candidate from the available talent pool to represent.</p>
              </div>
              <button type="button" onClick={() => setCandidateModal(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {candidates.map((c) => (
                <div
                  key={c.candidateId || c.userId || c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <b>{c.name}</b>
                    <small style={{ display: "block", color: "#64748b" }}>
                      {c.currentRole || "Candidate"} · {c.email || ""}
                    </small>
                  </div>
                  <button
                    className="agency-primary"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                    onClick={() => {
                      handleAssociateCandidate(c.candidateId || c.userId || c.id);
                      setCandidateModal(false);
                    }}
                  >
                    Associate
                  </button>
                </div>
              ))}
            </div>

            <div className="agency-modal-actions">
              <button type="button" className="agency-secondary" onClick={() => setCandidateModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Schedule Interview */}
      {interviewModal && (
        <div
          className="agency-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInterviewModal(false);
          }}
        >
          <form className="agency-modal" onSubmit={handleScheduleInterview}>
            <div className="agency-modal-head">
              <div>
                <h2>Schedule Candidate Interview</h2>
                <p>Coordinate an interview round for an approved candidate submission.</p>
              </div>
              <button type="button" onClick={() => setInterviewModal(false)} aria-label="Close">
                ×
              </button>
            </div>

            <label>
              Select Submission *
              <select
                value={interviewForm.submissionId}
                onChange={(e) => setInterviewForm((v) => ({ ...v, submissionId: e.target.value }))}
                required
              >
                <option value="">Select a submission...</option>
                {submissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.candidateName} — {s.jobTitle} ({formatStatusLabel(s.adminReviewStatus)})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Round Number
              <input
                type="number"
                min="1"
                max="10"
                value={interviewForm.roundNumber}
                onChange={(e) => setInterviewForm((v) => ({ ...v, roundNumber: e.target.value }))}
              />
            </label>

            <label>
              Interview Date *
              <input
                type="date"
                value={interviewForm.interviewDate}
                onChange={(e) => setInterviewForm((v) => ({ ...v, interviewDate: e.target.value }))}
                required
              />
            </label>

            <label>
              Interview Time
              <input
                type="time"
                value={interviewForm.interviewTime}
                onChange={(e) => setInterviewForm((v) => ({ ...v, interviewTime: e.target.value }))}
              />
            </label>

            <label>
              Meeting Link (Google Meet / Zoom / Teams)
              <input
                value={interviewForm.meetingLink}
                onChange={(e) => setInterviewForm((v) => ({ ...v, meetingLink: e.target.value }))}
                placeholder="https://meet.google.com/..."
              />
            </label>

            <div className="agency-modal-actions">
              <button type="button" className="agency-secondary" onClick={() => setInterviewModal(false)}>
                Cancel
              </button>
              <button type="submit" className="agency-primary">
                Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Record Interview Feedback */}
      {feedbackModal && selectedInterview && (
        <div
          className="agency-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFeedbackModal(false);
          }}
        >
          <form className="agency-modal" onSubmit={handleRecordFeedback}>
            <div className="agency-modal-head">
              <div>
                <h2>Record Interview Feedback</h2>
                <p>
                  {selectedInterview.candidateName} — {selectedInterview.jobTitle}
                </p>
              </div>
              <button type="button" onClick={() => setFeedbackModal(false)} aria-label="Close">
                ×
              </button>
            </div>

            <label>
              Interview Outcome *
              <select
                value={feedbackForm.status}
                onChange={(e) => setFeedbackForm((v) => ({ ...v, status: e.target.value }))}
              >
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed / Rejected</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </label>

            <label>
              Rating (1 - 5)
              <input
                type="number"
                min="1"
                max="5"
                value={feedbackForm.rating}
                onChange={(e) => setFeedbackForm((v) => ({ ...v, rating: Number(e.target.value) }))}
              />
            </label>

            <label>
              Detailed Feedback & Evaluation Notes *
              <textarea
                value={feedbackForm.feedback}
                onChange={(e) => setFeedbackForm((v) => ({ ...v, feedback: e.target.value }))}
                placeholder="Candidate strengths, technical proficiency, cultural fit..."
                required
              />
            </label>

            <div className="agency-modal-actions">
              <button type="button" className="agency-secondary" onClick={() => setFeedbackModal(false)}>
                Cancel
              </button>
              <button type="submit" className="agency-primary">
                Save Feedback
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Record Placement */}
      {placementModal && (
        <div
          className="agency-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPlacementModal(false);
          }}
        >
          <form className="agency-modal" onSubmit={handleRecordPlacement}>
            <div className="agency-modal-head">
              <div>
                <h2>Record Placement Offer</h2>
                <p>Register an official job offer released for a candidate.</p>
              </div>
              <button type="button" onClick={() => setPlacementModal(false)} aria-label="Close">
                ×
              </button>
            </div>

            <label>
              Select Candidate Submission *
              <select
                value={placementForm.submissionId}
                onChange={(e) => {
                  const subId = e.target.value;
                  const matched = submissions.find((s) => s.id === subId);
                  setPlacementForm((v) => ({
                    ...v,
                    submissionId: subId,
                    candidateId: matched?.candidateId || "",
                    jobId: matched?.jobId || "",
                    designation: matched?.jobTitle || "",
                  }));
                }}
                required
              >
                <option value="">Select candidate submission...</option>
                {submissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.candidateName} — {s.jobTitle}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Offered Role / Designation *
              <input
                value={placementForm.designation}
                onChange={(e) => setPlacementForm((v) => ({ ...v, designation: e.target.value }))}
                required
              />
            </label>

            <label>
              Offered Annual Salary (INR) *
              <input
                type="number"
                value={placementForm.offeredSalaryInr}
                onChange={(e) => setPlacementForm((v) => ({ ...v, offeredSalaryInr: e.target.value }))}
                required
              />
            </label>

            <label>
              Expected Joining Date
              <input
                type="date"
                value={placementForm.joiningDate}
                onChange={(e) => setPlacementForm((v) => ({ ...v, joiningDate: e.target.value }))}
              />
            </label>

            <div className="agency-modal-actions">
              <button type="button" className="agency-secondary" onClick={() => setPlacementModal(false)}>
                Cancel
              </button>
              <button type="submit" className="agency-primary">
                Record Offer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Submission Timeline History */}
      {timelineModal && (
        <div
          className="agency-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTimelineModal(false);
          }}
        >
          <div className="agency-modal">
            <div className="agency-modal-head">
              <div>
                <h2>Submission Timeline Tracking</h2>
                <p>Audit trail of review and selection milestones.</p>
              </div>
              <button type="button" onClick={() => setTimelineModal(false)} aria-label="Close">
                ×
              </button>
            </div>

            {timelineLoading ? (
              <p style={{ padding: "20px", color: "#64748b" }}>Loading timeline audit log...</p>
            ) : activeTimeline.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "10px 0" }}>
                {activeTimeline.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      borderLeft: "3px solid #0f9488",
                      paddingLeft: "12px",
                      position: "relative",
                    }}
                  >
                    <b>{formatStatusLabel(item.stage || item.status || "Milestone")}</b>
                    <p style={{ margin: "3px 0", fontSize: "12px", color: "#475569" }}>
                      {item.notes || item.remarks || "Stage completed"}
                    </p>
                    <small style={{ color: "#94a3b8" }}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No timeline milestones logged" description="Milestones will appear as reviews progress." />
            )}

            <div className="agency-modal-actions">
              <button type="button" className="agency-secondary" onClick={() => setTimelineModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="agency-toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
