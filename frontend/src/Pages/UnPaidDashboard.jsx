import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initUnpaidDashboard } from "./UnPaidDashboardLogic";
import { authApi } from "../services/api";
import { toast } from "../components/Toast";
import CandidateSubscriptionPage from "./CandidateSubscriptionPage";
import "./UnPaidDashboard.css";

function getTimeBasedGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  } else if (hour >= 17 && hour < 21) {
    return "Good Evening";
  } else {
    return "Good Night";
  }
}

export default function UnPaidDashboard() {
  const navigate = useNavigate();

  const [greeting, setGreeting] = useState(() => getTimeBasedGreeting());
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getTimeBasedGreeting());
    };
    updateGreeting();
    const intervalId = setInterval(updateGreeting, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const [openMenu, setOpenMenu] = useState(null); // "notif" | "profile" | null
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(
    () => localStorage.getItem("hrm_unpaid_read_notifications") !== "true",
  );

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("hrm_unpaid_sidebar_collapsed") === "true";
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [tooltip, setTooltip] = useState({
    visible: false,
    text: "",
    top: 0,
    left: 0,
  });

  const hideTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  const showTooltip = (e, text) => {
    if (!isSidebarCollapsed || window.innerWidth <= 768) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  };

  const handleToggleSidebar = () => {
    hideTooltip();
    if (window.innerWidth <= 768) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem("hrm_unpaid_sidebar_collapsed", String(next));
        return next;
      });
    }
  };

  const handleCloseMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  useEffect(() => {
    const handleScrollOrResize = () => hideTooltip();
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, []);

  const handleNavClick = () => {
    if (window.innerWidth <= 768) {
      setIsMobileSidebarOpen(false);
    }
  };

  useEffect(() => {
    const handleSyncMobile = (e) => {
      if (e.detail && typeof e.detail.open === "boolean") {
        setIsMobileSidebarOpen(e.detail.open);
      }
    };
    window.addEventListener("hrm-sync-mobile-sidebar", handleSyncMobile);
    return () => {
      window.removeEventListener("hrm-sync-mobile-sidebar", handleSyncMobile);
    };
  }, []);

  useEffect(() => {
    const sidebarEl = document.getElementById("sidebar");
    const overlayEl = document.getElementById("sidebarOverlay");
    if (isMobileSidebarOpen) {
      sidebarEl?.classList.add("mobile-open");
      overlayEl?.classList.add("active");
      overlayEl?.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    } else {
      sidebarEl?.classList.remove("mobile-open");
      overlayEl?.classList.remove("active");
      overlayEl?.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    const sidebarEl = document.getElementById("sidebar");
    const appEl = document.querySelector(".hrm-unpaid");
    if (isSidebarCollapsed) {
      sidebarEl?.classList.add("collapsed");
      appEl?.classList.add("sidebar-collapsed");
    } else {
      sidebarEl?.classList.remove("collapsed");
      appEl?.classList.remove("sidebar-collapsed");
    }
  }, [isSidebarCollapsed]);

  const handleMarkAllRead = (e) => {
    e.stopPropagation(); // same as paid logic

    localStorage.setItem("hrm_unpaid_read_notifications", "true");
    setHasUnreadNotifications(false);

    // Same as paid: remove "unread" from every item
    document
      .querySelectorAll(".hrm-unpaid .notif-item.unread")
      .forEach((item) => item.classList.remove("unread"));

    // Same as paid: hide the red dot directly
    const badge = document.getElementById("notificationBadge");
    if (badge) badge.style.display = "none";
  };
  useEffect(() => {
    const closeOutside = (e) => {
      if (!e.target.closest(".dropdown-wrapper")) setOpenMenu(null);
    };
    const closeOnEsc = (e) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setIsMobileSidebarOpen(false);
      }
    };
    document.addEventListener("click", closeOutside);
    document.addEventListener("keydown", closeOnEsc);
    return () => {
      document.removeEventListener("click", closeOutside);
      document.removeEventListener("keydown", closeOnEsc);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.add("hrmu-root");
    const cleanup = initUnpaidDashboard();

    return () => {
      if (typeof cleanup === "function") cleanup();
      document.documentElement.classList.remove("hrmu-root");
    };
  }, []);

  return (
    <div className={`hrm-unpaid ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <CandidateSubscriptionPage
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={() => {
            setShowSubscriptionModal(false);
            // Reload page so AuthContext picks up plan change and redirects to paid dashboard
            setTimeout(() => window.location.reload(), 1200);
          }}
        />
      )}
      {/* Floating Tooltip for Collapsed Sidebar */}
      {isSidebarCollapsed && tooltip.visible && (
        <div
          className="sidebar-floating-tooltip"
          role="tooltip"
          style={{
            position: "fixed",
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`,
            transform: "translateY(-50%)",
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Mobile Navigation Overlay */}
      <div
        className={`sidebar-overlay ${isMobileSidebarOpen ? "active" : ""}`}
        id="sidebarOverlay"
        aria-hidden={!isMobileSidebarOpen}
        onClick={handleCloseMobileSidebar}
      ></div>

      <div className="app-layout">
        {/* ==================== A. LEFT SIDEBAR ==================== */}
        <aside
          className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""} ${isMobileSidebarOpen ? "mobile-open" : ""}`}
          id="sidebar"
          aria-label="Main Navigation"
        >
          {/* The ONLY Arrow Toggle Button for collapsing and expanding unpaid dashboard sidebar */}
          <button
            type="button"
            className="sidebar-collapse-btn"
            id="sidebarCollapseBtn"
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={handleToggleSidebar}
          >
            <i className={isSidebarCollapsed ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-left"}></i>
          </button>

          <div className="sidebar-brand">
            <a
              href="/"
              className="sidebar-brand-link"
              id="unpaid-sidebar-brand-link"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
              aria-label="HR Module Home"
              title="HR Module Home"
            >
              <div className="brand-logo">
                <i className="fa-regular fa-folder-closed"></i>
              </div>
              <div className="brand-info">
                <span className="brand-title">HR Module</span>
              </div>
            </a>
            <span className="badge-free-plan-tag">FREE</span>

            {/* Mobile Sidebar Close Button */}
            <button
              type="button"
              className="mobile-close-btn"
              id="sidebarCloseBtn"
              aria-label="Close navigation"
              onClick={handleCloseMobileSidebar}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="sidebar-menu-wrapper">
            <span className="sidebar-label">MENU</span>
            <nav className="sidebar-nav">
              <a
                href="#dashboard"
                className="nav-item active"
                id="nav-dashboard"
                data-tooltip="Dashboard"
                onMouseEnter={(e) => showTooltip(e, "Dashboard")}
                onMouseLeave={hideTooltip}
                onClick={handleNavClick}
              >
                <i className="fa-solid fa-border-all"></i>
                <span>Dashboard</span>
              </a>
              <a
                href="#resume-templates"
                className="nav-item"
                id="nav-resume-templates"
                data-tooltip="Resume Templates"
                onMouseEnter={(e) => showTooltip(e, "Resume Templates")}
                onMouseLeave={hideTooltip}
                onClick={handleNavClick}
              >
                <i className="fa-regular fa-file-lines"></i>
                <span>Resume Templates</span>
              </a>
              <a
                href="#ats-checker"
                className="nav-item"
                id="nav-ats-checker"
                data-tooltip="ATS Form"
                onMouseEnter={(e) => showTooltip(e, "ATS Form")}
                onMouseLeave={hideTooltip}
                onClick={handleNavClick}
              >
                <i className="fa-regular fa-square-check"></i>
                <span>ATS Form</span>
                <span className="nav-badge-pill" id="navAtsPill">
                  2 Left
                </span>
              </a>
              <a
                href="#portfolio-builder"
                className="nav-item"
                id="nav-portfolio-builder"
                data-locked="true"
                data-feature="Portfolio Website Builder &amp; Publisher"
                data-desc="Build and publish a live personal portfolio site with your own domain, auto-SSL, and global CDN exclusive to Premium Career Pro candidates."
                data-tooltip="Portfolio"
                onMouseEnter={(e) => showTooltip(e, "Portfolio")}
                onMouseLeave={hideTooltip}
                onClick={handleNavClick}
              >
                <i className="fa-solid fa-desktop"></i>
                <span>Portfolio</span>
                <i className="fa-solid fa-lock nav-lock"></i>
              </a>
              <a
                href="#my-documents"
                className="nav-item"
                id="nav-my-documents"
                data-locked="true"
                data-feature="Cloud Document History &amp; Multi-File Storage"
                data-desc="Unlock unlimited cloud document storage, version rollback history, and multi-file resume sync with Premium Career Pro."
                data-tooltip="My Documents"
                onMouseEnter={(e) => showTooltip(e, "My Documents")}
                onMouseLeave={hideTooltip}
                onClick={handleNavClick}
              >
                <i className="fa-regular fa-folder"></i>
                <span>My Documents</span>
                <i className="fa-solid fa-lock nav-lock"></i>
              </a>
              <a
                href="#job-matches"
                className="nav-item"
                id="nav-job-matches"
                data-tooltip="Job Matches"
                onMouseEnter={(e) => showTooltip(e, "Job Matches")}
                onMouseLeave={hideTooltip}
                onClick={handleNavClick}
              >
                <i className="fa-regular fa-compass"></i>
                <span>Job Matches</span>
              </a>
              <a
                href="#settings"
                className="nav-item"
                id="nav-settings"
                data-tooltip="Settings"
                onMouseEnter={(e) => showTooltip(e, "Settings")}
                onMouseLeave={hideTooltip}
                onClick={handleNavClick}
              >
                <i className="fa-solid fa-gear"></i>
                <span>Settings</span>
              </a>
            </nav>
          </div>

          {/* B. Sidebar Bottom Profile Card */}
          <div className="sidebar-profile-card">
            {/* Collapsed mini profile badge */}
            <div
              className="profile-collapsed-badge"
              onMouseEnter={(e) => showTooltip(e, "Profile: 72% complete")}
              onMouseLeave={hideTooltip}
            >
              72%
            </div>

            <div className="profile-card-header">
              <div className="profile-card-title">
                <span>Profile Strength</span>
                <span className="profile-percent" id="sidebarProfilePercent">
                  72%
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  id="sidebarProgressBar"
                  style={{ width: "72%" }}
                ></div>
              </div>
              <p className="profile-card-hint" id="sidebarProfileHint">
                72% complete — add certifications to reach 100%
              </p>
            </div>

            <div className="sidebar-upgrade-link-wrap">
              <button
                className="btn-sidebar-upgrade"
                id="sidebarUpgradeBtn"
                onClick={() => setShowSubscriptionModal(true)}
                onMouseEnter={(e) => showTooltip(e, "Upgrade to Pro")}
                onMouseLeave={hideTooltip}
              >
                <i className="fa-solid fa-crown text-gold"></i> Upgrade to Pro
              </button>
            </div>
          </div>
        </aside>

        {/* ==================== MAIN CONTENT WRAPPER ==================== */}
        <div className="main-wrapper">
          {/* ==================== C. TOP NAVIGATION BAR (EXACT REFERENCE DESIGN) ==================== */}
          <header className="topbar">
            <div className="topbar-left">
              <div className="search-box">
                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                <input
                  type="text"
                  id="globalSearchInput"
                  placeholder="Search templates, resumes, portfolios..."
                  aria-label="Search templates, resumes, portfolios"
                  autoComplete="off"
                />
                <button
                  className="search-clear-btn"
                  id="searchClearBtn"
                  aria-label="Clear search"
                  style={{ display: "none" }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            <div className="topbar-right">
              {/* Notifications */}
              <div className="dropdown-wrapper">
                <button
                  type="button"
                  className="btn-icon topbar-action-btn"
                  aria-label="Notifications"
                  aria-expanded={openMenu === "notif"}
                  onClick={() =>
                    setOpenMenu(openMenu === "notif" ? null : "notif")
                  }
                >
                  <i className="fa-regular fa-bell"></i>

                  {hasUnreadNotifications && (
                    <span
                      className="badge-dot"
                      id="notificationBadge"
                      style={{
                        display: hasUnreadNotifications ? "block" : "none",
                      }}
                    ></span>
                  )}
                </button>
                <div
                  className={`dropdown-menu notification-dropdown${openMenu === "notif" ? " active" : ""}`}
                >
                  <div className="dropdown-header">
                    <div>
                      <h4 className="dropdown-title">Notifications</h4>
                      <span className="dropdown-subtitle" id="unreadNotifCount">
                        {hasUnreadNotifications
                          ? "3 unread updates"
                          : "0 unread updates"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn-text-action"
                      id="markAllReadBtn"
                      onClick={handleMarkAllRead}
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="notification-list" id="notificationList">
                  </div>
                  <div className="dropdown-footer">
                    <button
                      className="btn-text-action w-full text-center"
                      id="notifUpgradeCTA"
                      onClick={() => setOpenMenu(null)}
                    >
                      <i className="fa-solid fa-gem"></i> Upgrade to receive
                      instant job alerts
                    </button>
                  </div>
                </div>
              </div>

              {/* Profile */}
              <div className="dropdown-wrapper">
                <button
                  className="profile-toggle-btn"
                  aria-label="User profile menu"
                  aria-expanded={openMenu === "profile"}
                  onClick={() =>
                    setOpenMenu(openMenu === "profile" ? null : "profile")
                  }
                >
                  <div className="avatar avatar-sm">C</div>
                  <div className="profile-meta">
                    <span className="profile-name" id="topbarCandidateName">
                      Candidate
                    </span>
                    <span className="profile-role" id="topbarCandidateRole">
                      Software Developer
                    </span>
                  </div>
                  <i className="fa-solid fa-chevron-down profile-arrow"></i>
                </button>

                <div
                  className={`dropdown-menu profile-dropdown${openMenu === "profile" ? " active" : ""}`}
                >
                  <div className="profile-dropdown-header">
                    <div className="avatar avatar-md">C</div>
                    <div>
                      <h4
                        className="profile-name-lg"
                        id="dropdownCandidateName"
                      >
                        Candidate
                      </h4>
                      <p
                        className="profile-email-sm"
                        id="dropdownCandidateEmail"
                      >
                        
                      </p>
                      <span className="badge badge-teal-subtle mt-1">
                        Free Plan
                      </span>
                    </div>
                  </div>

                  <div className="profile-menu-links">
                    <a
                      href="#settings"
                      className="dropdown-item"
                      id="menuMyProfile"
                      onClick={() => setOpenMenu(null)}
                    >
                      <i className="fa-regular fa-user"></i>
                      <span>My Profile</span>
                    </a>
                    <a
                      href="#settings"
                      className="dropdown-item"
                      id="menuAccountSettings"
                      onClick={() => setOpenMenu(null)}
                    >
                      <i className="fa-solid fa-sliders"></i>
                      <span>Account Settings</span>
                    </a>
                  </div>

                  <div className="dropdown-item-info">
                    <div className="info-row">
                      <span>Plan Status</span>
                      <span className="badge badge-teal-subtle">Free Tier</span>
                    </div>
                    <div className="info-row text-xs text-muted">
                      <span>ATS Checks:</span>
                      <strong id="dropdownAtsCount">2 / 2 Left</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="dropdown-item-gold"
                    id="menuUpgradePremium"
                    onClick={() => { setOpenMenu(null); setShowSubscriptionModal(true); }}
                  >
                    <i className="fa-solid fa-crown"></i>
                    <span>Upgrade to Premium</span>
                  </button>

                  <div className="profile-dropdown-footer">
                    <button
                      type="button"
                      className="dropdown-item-signout"
                      id="menuSignOut"
                      onClick={async () => {
                        setOpenMenu(null);
                        // Invalidate the backend session (same contract as the
                        // paid dashboard), then confirm on the login page.
                        try {
                          await authApi.logout();
                        } catch (_) {}
                        toast.success("You have been logged out successfully.");
                        navigate("/login");
                      }}
                    >
                      <i className="fa-solid fa-arrow-right-from-bracket"></i>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Search Results Banner (When searching) */}
          <div
            className="search-feedback-banner"
            id="searchFeedbackBanner"
            style={{ display: "none" }}
          >
            <div className="search-feedback-content">
              <i className="fa-solid fa-filter"></i>
              <span>
                Filtering results for:
                <strong id="activeSearchQuery">""</strong>
              </span>
            </div>
            <button
              className="btn btn-secondary-light btn-xs"
              id="resetSearchBannerBtn"
            >
              Clear Search
            </button>
          </div>

          {/* Empty Search Results State */}
          <div
            className="empty-search-state"
            id="emptySearchState"
            style={{ display: "none" }}
          >
            <div className="empty-icon-circle">
              <i className="fa-solid fa-magnifying-glass"></i>
            </div>
            <h3>No matching results found</h3>
            <p>
              We couldn't find any templates, documents, or jobs matching "
              <span id="emptySearchTerm"></span>". Try another keyword.
            </p>
            <button
              className="btn btn-primary btn-sm mt-3"
              id="clearSearchEmptyBtn"
            >
              <i className="fa-solid fa-rotate-left"></i> Reset Filter
            </button>
          </div>

          {/* MAIN SCROLLABLE DASHBOARD CONTENT */}
          <main className="dashboard-content" id="dashboardMainArea">
            {/* ==================== D. WELCOME HEADER (MATCHING SCREENSHOT 1) ==================== */}
            <section className="welcome-section" id="dashboard">
              <div className="welcome-header">
                <div>
                  <h1 className="welcome-heading">
                    {greeting}, <span id="welcomeUserName">Candidate</span>
                  </h1>
                  <p className="welcome-subheading">
                    What would you like to build today? Pick a tool below to get
                    started.
                  </p>
                </div>

                {/* Resume Count History Component */}
                <div className="resume-count-history-card" id="resume-count-history-card">
                  <div className="rch-header">
                    <div className="rch-title-wrap">
                      <div className="rch-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                      </div>
                      <span className="rch-title">Resume History</span>
                    </div>
                    <button type="button" className="rch-history-btn" id="rch-view-history-btn" title="View detailed resume count and history">
                      <span>View History</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </div>
                  <div className="rch-stats-row">
                    <div className="rch-stat-col">
                      <span className="rch-stat-label">Total</span>
                      <span className="rch-stat-num" id="rch-total-count">0</span>
                    </div>
                    <div className="rch-stat-divider" aria-hidden="true"></div>
                    <div className="rch-stat-col">
                      <span className="rch-stat-label">Created</span>
                      <span className="rch-stat-num" id="rch-created-count">0</span>
                    </div>
                    <div className="rch-stat-divider" aria-hidden="true"></div>
                    <div className="rch-stat-col">
                      <span className="rch-stat-label">Uploaded</span>
                      <span className="rch-stat-num" id="rch-uploaded-count">0</span>
                    </div>
                  </div>
                  <div className="rch-footer">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span className="rch-updated-text">Last Updated: <strong id="rch-last-updated">None</strong></span>
                  </div>
                </div>
              </div>

              {/* Subtle Freemium Notice Card */}
              <div className="unpaid-notice-bar">
                <div className="notice-bar-content">
                  <span>
                    You are currently on the
                    <strong> Free Candidate Tier</strong>. You have 3 free
                    templates and 2 ATS checks remaining.
                  </span>
                </div>

                <button className="btn-banner-upgrade" id="bannerUpgradeBtn" onClick={() => setShowSubscriptionModal(true)}>
                  Explore Premium Plans{" "}
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </section>
            {/* ==================== E. MAIN FEATURE CARDS (EXACT SCREENSHOT 1) ==================== */}
            <section
              className="features-grid-section"
              aria-label="Key Features"
            >
              <div className="features-grid">
                {/* Feature Card 1: Resume Templates */}
                <div className="feature-card" id="card-feature-templates">
                  <div className="feature-card-preview">
                    {/* Exact Screenshot 1 Mini Resume Illustration */}
                    <div className="ref-mini-resume">
                      <div className="ref-resume-top">
                        <div className="ref-resume-circle"></div>
                        <div className="ref-resume-header-bar"></div>
                      </div>
                      <div className="ref-resume-divider"></div>
                      <div className="ref-resume-cols">
                        <div className="ref-col-left">
                          <div className="ref-grey-line w-80"></div>
                          <div className="ref-grey-line w-60"></div>
                          <div className="ref-grey-line w-90"></div>
                        </div>
                        <div className="ref-col-right">
                          <div className="ref-teal-line w-90"></div>
                          <div className="ref-teal-line w-70"></div>
                          <div className="ref-grey-line w-100"></div>
                          <div className="ref-grey-line w-80"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="feature-card-content">
                    <div className="feature-card-header-row">
                      <h3 className="feature-card-title">Resume Templates</h3>
                    </div>
                    <p className="feature-card-desc">
                      Choose from 40+ designer-made layouts and build your
                      resume in minutes.
                    </p>
                    <div className="feature-card-footer">
                      <button
                        className="btn btn-primary w-full btn-card-action"
                        id="browseTemplatesBtn"
                      >
                        Browse Templates{" "}
                        <i className="fa-solid fa-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feature Card 2: ATS Form / ATS Checker */}
                <div className="feature-card" id="card-feature-ats">
                  <div className="feature-card-preview">
                    {/* Exact Screenshot 1 Mini ATS Sheet Illustration */}
                    <div className="ref-mini-ats">
                      <div className="ref-ats-badge">
                        <span className="ref-ats-dot"></span> ATS MATCH 88%
                      </div>
                      <div className="ref-ats-items">
                        <div className="ref-ats-row">
                          <div className="ref-ats-check">
                            <i className="fa-solid fa-check"></i>
                          </div>
                          <div className="ref-ats-bar primary"></div>
                        </div>
                        <div className="ref-ats-row">
                          <div className="ref-ats-check">
                            <i className="fa-solid fa-check"></i>
                          </div>
                          <div className="ref-ats-bar"></div>
                        </div>
                        <div className="ref-ats-row">
                          <div className="ref-ats-check-empty"></div>
                          <div className="ref-ats-bar light"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="feature-card-content">
                    <div className="feature-card-header-row">
                      <h3 className="feature-card-title">ATS Resume Checker</h3>
                      <span
                        className="badge-quota-pill"
                        id="atsChecksRemainingPill"
                      >
                        <i className="fa-solid fa-bolt"></i>{" "}
                        <span id="atsChecksRemainingCount">2</span> Free Checks
                        Left
                      </span>
                    </div>
                    <p className="feature-card-desc">
                      Upload your resume to receive an instant ATS compatibility
                      score with improvement tips. File is never saved to your
                      profile.
                    </p>
                    <div className="feature-card-footer">
                      <button
                        className="btn btn-primary w-full btn-card-action"
                        id="openAtsModalBtn"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i>{" "}
                        Check ATS Compatibility
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feature Card 3: Portfolio (LOCKED - Premium Only) */}
                <div
                  className="feature-card feature-card-locked"
                  id="card-feature-portfolio"
                  data-locked="true"
                  data-feature="Portfolio Website Builder &amp; Publisher"
                  data-desc="Build and publish a live personal portfolio site with your own domain, auto-SSL, and global CDN exclusive to Premium Career Pro candidates."
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="feature-card-preview"
                    style={{ position: "relative" }}
                  >
                    <div
                      className="ref-mini-browser"
                      style={{ opacity: "0.45", filter: "blur(1px)" }}
                    >
                      <div className="ref-browser-dots">
                        <span className="dot red"></span>
                        <span className="dot yellow"></span>
                        <span className="dot green"></span>
                      </div>
                      <div className="ref-browser-hero">
                        <div className="ref-browser-avatar"></div>
                        <div className="ref-browser-bar"></div>
                      </div>
                      <div className="ref-browser-cards">
                        <div className="ref-b-card"></div>
                        <div className="ref-b-card"></div>
                        <div className="ref-b-card"></div>
                      </div>
                    </div>
                    <div className="feature-card-lock-overlay">
                      <div className="fcard-lock-circle">
                        <i className="fa-solid fa-lock"></i>
                      </div>
                      <span className="fcard-lock-label">Premium Only</span>
                    </div>
                  </div>
                  <div className="feature-card-content">
                    <div className="feature-card-header-row">
                      <h3 className="feature-card-title">Portfolio</h3>
                      <span className="badge-lock-pill">
                        <i className="fa-solid fa-crown"></i> Pro
                      </span>
                    </div>
                    <p className="feature-card-desc">
                      Publish a shareable personal portfolio site with one
                      click. Requires Premium plan.
                    </p>
                    <div className="feature-card-footer">
                      <button
                        className="btn btn-locked-feature w-full btn-card-action"
                        id="previewPortfolioBtn"
                        data-locked="true"
                        data-feature="Portfolio Website Builder &amp; Publisher"
                        data-desc="Build and publish a live personal portfolio site with your own domain, auto-SSL, and global CDN exclusive to Premium Career Pro candidates."
                      >
                        <i className="fa-solid fa-lock"></i> Unlock Portfolio
                        (Pro)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ==================== F. DASHBOARD STATISTICS (EXACT SCREENSHOT 1) ==================== */}

            {/* ==================== 5. RESUME TEMPLATES SECTION (EXACT SCREENSHOT 2) ==================== */}
            <section className="section-container" id="resume-templates">
              <div className="section-header-wrap">
                <div>
                  <h2 className="section-title">Resume Templates</h2>
                  <p className="section-subtitle">
                    Pick a layout, then customize it with your details.
                  </p>
                </div>

                {/* Exact Filter Pills from Screenshot 2 */}
                <div
                  className="filter-pills-row"
                  role="tablist"
                  aria-label="Resume Template Categories"
                >
                  <button
                    className="filter-pill active"
                    data-category="all"
                    role="tab"
                    aria-selected="true"
                  >
                    All
                  </button>
                  <button
                    className="filter-pill"
                    data-category="modern"
                    role="tab"
                    aria-selected="false"
                  >
                    Modern
                  </button>
                  <button
                    className="filter-pill"
                    data-category="minimal"
                    role="tab"
                    aria-selected="false"
                  >
                    Minimal
                  </button>
                  <button
                    className="filter-pill"
                    data-category="creative"
                    role="tab"
                    aria-selected="false"
                  >
                    Creative
                  </button>
                  <button
                    className="filter-pill"
                    data-category="ats-friendly"
                    role="tab"
                    aria-selected="false"
                  >
                    ATS-friendly
                  </button>
                </div>
              </div>

              {/* Resume Templates Horizontal Carousel */}
              <div className="templates-carousel-wrapper" id="templates-carousel-wrapper">
                <div className="templates-carousel-viewport-wrapper">
                  <button
                    className="carousel-arrow-btn prev-arrow"
                    id="templates-carousel-prev"
                    type="button"
                    aria-label="Previous template slide"
                    title="Previous templates"
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>

                  <div className="templates-carousel-viewport" id="templates-carousel-viewport">
                    <div className="template-grid templates-carousel-track" id="templateGrid">
                {/* 1. Aurora (Modern • ATS-friendly - Popular - Free) */}
                <div
                  className="template-card"
                  data-category="modern"
                  data-plan="free"
                  data-id="aurora"
                  data-name="Aurora"
                >
                  <div className="template-preview-frame">
                    <span className="template-ribbon ribbon-popular">
                      Popular
                    </span>
                    {/* Exact Screenshot 2 Aurora Preview */}
                    <div className="ref-template-doc doc-aurora">
                      <div className="doc-header-teal-bar"></div>
                      <div className="doc-sub-bar"></div>
                      <div className="doc-body-split">
                        <div className="doc-split-left">
                          <div className="doc-line-teal"></div>
                          <div className="doc-line-grey"></div>
                          <div className="doc-line-grey short"></div>
                        </div>
                        <div className="doc-split-right">
                          <div className="doc-line-grey"></div>
                          <div className="doc-line-grey"></div>
                          <div className="doc-line-grey short"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="template-card-footer">
                    <div className="template-meta">
                      <h4 className="template-name">Aurora</h4>
                      <span className="template-cat-sub">
                        Modern • ATS-friendly
                      </span>
                    </div>
                    <button
                      className="btn-use-tpl btn-use-template"
                      data-template="Aurora"
                      data-category="Modern"
                    >
                      Use
                    </button>
                  </div>
                </div>

                {/* 2. Slate (Minimal • Free - Free) */}
                <div
                  className="template-card"
                  data-category="minimal"
                  data-plan="free"
                  data-id="slate"
                  data-name="Slate"
                >
                  <div className="template-preview-frame">
                    {/* Exact Screenshot 2 Slate Preview */}
                    <div className="ref-template-doc doc-slate">
                      <div className="doc-black-header-bar"></div>
                      <div className="doc-black-sub-bar"></div>
                      <div className="doc-line-grey"></div>
                      <div className="doc-line-grey short"></div>
                      <div className="doc-black-mid-bar"></div>
                      <div className="doc-line-grey"></div>
                      <div className="doc-line-grey short"></div>
                    </div>
                  </div>
                  <div className="template-card-footer">
                    <div className="template-meta">
                      <h4 className="template-name">Slate</h4>
                      <span className="template-cat-sub">Minimal • Free</span>
                    </div>
                    <button
                      className="btn-use-tpl btn-use-template"
                      data-template="Slate"
                      data-category="Minimal"
                    >
                      Use
                    </button>
                  </div>
                </div>

                {/* 3. Indigo Side (Creative • Pro - New - Premium) */}
                <div
                  className="template-card card-locked"
                  data-category="creative"
                  data-plan="premium"
                  data-id="indigo-side"
                  data-name="Indigo Side"
                >
                  <div className="template-preview-frame locked-frame">
                    <span className="template-ribbon ribbon-new">New</span>
                    {/* Exact Screenshot 2 Indigo Side Preview */}
                    <div className="ref-template-doc doc-indigo">
                      <div className="doc-indigo-side-strip">
                        <div className="doc-avatar-dot"></div>
                        <div className="doc-white-dot"></div>
                        <div className="doc-white-dot"></div>
                        <div className="doc-white-dot"></div>
                      </div>
                      <div className="doc-indigo-content">
                        <div className="doc-dark-bar"></div>
                        <div className="doc-blue-bar"></div>
                        <div className="doc-line-grey"></div>
                        <div className="doc-line-grey short"></div>
                      </div>
                    </div>
                    {/* Locked Overlay */}
                    <div className="locked-preview-overlay">
                      <div className="lock-circle">
                        <i className="fa-solid fa-lock"></i>
                      </div>
                      <span className="locked-overlay-text">Pro Template</span>
                    </div>
                  </div>
                  <div className="template-card-footer">
                    <div className="template-meta">
                      <h4 className="template-name">Indigo Side</h4>
                      <span className="template-cat-sub">Creative • Pro</span>
                    </div>
                    <button
                      className="btn-use-tpl btn-locked-tpl"
                      data-locked="true"
                      data-feature="Indigo Side Resume Template"
                      data-desc="Unlock Indigo Side and our full library of 40+ professional creative layouts with SVG & PDF exports."
                    >
                      <i className="fa-solid fa-lock text-gold"></i> Unlock
                    </button>
                  </div>
                </div>

                {/* 4. Classic (Traditional • ATS-friendly - Free) */}
                <div
                  className="template-card"
                  data-category="ats-friendly"
                  data-plan="free"
                  data-id="classic"
                  data-name="Classic"
                >
                  <div className="template-preview-frame">
                    {/* Exact Screenshot 2 Classic Preview */}
                    <div className="ref-template-doc doc-classic">
                      <div className="doc-black-header-bar centered"></div>
                      <div className="doc-line-grey centered short"></div>
                      <div className="doc-black-mid-bar"></div>
                      <div className="doc-bullet-row">
                        <span className="b-dot"></span>
                        <div className="doc-line-grey"></div>
                      </div>
                      <div className="doc-bullet-row">
                        <span className="b-dot"></span>
                        <div className="doc-line-grey"></div>
                      </div>
                      <div className="doc-black-mid-bar"></div>
                      <div className="doc-line-grey short"></div>
                    </div>
                  </div>
                  <div className="template-card-footer">
                    <div className="template-meta">
                      <h4 className="template-name">Classic</h4>
                      <span className="template-cat-sub">
                        Traditional • ATS-friendly
                      </span>
                    </div>
                    <button
                      className="btn-use-tpl btn-use-template"
                      data-template="Classic"
                      data-category="ATS-Friendly"
                    >
                      Use
                    </button>
                  </div>
                </div>

                {/* 5. Executive Pro (Modern • Pro - Premium) */}
                <div
                  className="template-card card-locked"
                  data-category="modern"
                  data-plan="premium"
                  data-id="executive-pro"
                  data-name="Executive Pro"
                >
                  <div className="template-preview-frame locked-frame">
                    <div className="ref-template-doc doc-executive">
                      <div className="doc-black-header-bar centered"></div>
                      <div className="doc-line-grey centered short"></div>
                      <div className="doc-grid-metrics">
                        <div className="doc-m-box"></div>
                        <div className="doc-m-box"></div>
                      </div>
                      <div className="doc-line-grey"></div>
                    </div>
                    <div className="locked-preview-overlay">
                      <div className="lock-circle">
                        <i className="fa-solid fa-lock"></i>
                      </div>
                      <span className="locked-overlay-text">Pro Template</span>
                    </div>
                  </div>
                  <div className="template-card-footer">
                    <div className="template-meta">
                      <h4 className="template-name">Executive Pro</h4>
                      <span className="template-cat-sub">
                        Modern • Leadership
                      </span>
                    </div>
                    <button
                      className="btn-use-tpl btn-locked-tpl"
                      data-locked="true"
                      data-feature="Executive Pro Resume Template"
                      data-desc="Craft executive CVs with quantified leadership metrics and corporate formatting."
                    >
                      <i className="fa-solid fa-lock text-gold"></i> Unlock
                    </button>
                  </div>
                </div>

                {/* 6. Elegant Plus (Minimal • Pro - Premium) */}
                <div
                  className="template-card card-locked"
                  data-category="minimal"
                  data-plan="premium"
                  data-id="elegant-plus"
                  data-name="Elegant Plus"
                >
                  <div className="template-preview-frame locked-frame">
                    <div className="ref-template-doc doc-elegant">
                      <div className="doc-line-grey centered short"></div>
                      <div className="doc-black-header-bar centered"></div>
                      <div className="doc-line-grey"></div>
                      <div className="doc-line-grey short"></div>
                    </div>
                    <div className="locked-preview-overlay">
                      <div className="lock-circle">
                        <i className="fa-solid fa-lock"></i>
                      </div>
                      <span className="locked-overlay-text">Pro Template</span>
                    </div>
                  </div>
                  <div className="template-card-footer">
                    <div className="template-meta">
                      <h4 className="template-name">Elegant Plus</h4>
                      <span className="template-cat-sub">
                        Minimal • Editorial
                      </span>
                    </div>
                    <button
                      className="btn-use-tpl btn-locked-tpl"
                      data-locked="true"
                      data-feature="Elegant Plus Resume Template"
                      data-desc="Unlock Elegant Plus and premium editorial CV templates for international applications."
                    >
                      <i className="fa-solid fa-lock text-gold"></i> Unlock
                    </button>
                  </div>
                </div>
              </div>
            </div>

                  <button
                    className="carousel-arrow-btn next-arrow"
                    id="templates-carousel-next"
                    type="button"
                    aria-label="Next template slide"
                    title="Next templates"
                  >
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>

                <div className="templates-carousel-controls" id="templates-carousel-controls">
                  <div className="templates-carousel-dots" id="templates-carousel-dots"></div>
                  <span className="templates-carousel-counter" id="templates-carousel-counter">
                    Showing 1–3 of 6 templates
                  </span>
                </div>
              </div>
            </section>

            {/* ==================== 6. RECENT DOCUMENTS SECTION (EXACT SCREENSHOT 2) ==================== */}
            <section className="section-container" id="my-documents">
              <div className="section-header-wrap">
                <div className="d-flex align-center gap-2">
                  <h2 className="section-title">Recent Documents</h2>
                  <span className="badge-count-pill badge-count-locked">
                    <i className="fa-solid fa-lock"></i> 3 items
                  </span>
                  <span className="badge-lock-pill">
                    <i className="fa-solid fa-crown"></i> Pro Only
                  </span>
                </div>
                <div>
                  <button
                    className="btn-cloud-sync"
                    id="viewAllDocsBtn"
                    data-locked="true"
                    data-feature="Cloud Synchronization & Unlimited Storage"
                    data-desc="Unlock unlimited cloud document storage, version history rollback, and automatic synchronization with Premium Career Pro."
                  >
                    <i className="fa-solid fa-lock text-amber"></i> Cloud Synced
                    (Locked)
                  </button>
                </div>
              </div>

              {/* Document Table (LOCKED FOR UNPAID CANDIDATES - BLURRED WITH LOCK OVERLAY) */}
              <div
                className="table-card table-card-locked"
                id="documentsTableCard"
                data-locked="true"
                data-feature="Cloud Document History &amp; Multi-File Storage"
                data-desc="Unlock unlimited cloud document storage, version rollback history, and multi-file resume sync with Premium Career Pro."
              >
                <div
                  className="table-responsive table-blurred"
                  aria-hidden="true"
                >
                  <table className="documents-table" id="documentsTable">
                    <thead>
                      <tr>
                        <th>NAME</th>
                        <th>TYPE</th>
                        <th>ATS SCORE</th>
                        <th>LAST EDITED</th>
                        <th className="text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody id="documentsTableBody">
                    </tbody>
                  </table>
                </div>

                {/* Locked Overlay (Unpaid Candidate Plan) */}
                <div className="table-lock-overlay" id="documentsLockOverlay">
                  <div className="table-lock-circle">
                    <i className="fa-solid fa-lock"></i>
                  </div>
                  <h3 className="table-lock-title">
                    <span>Cloud Document History Locked</span>
                    <span className="badge-lock-pill">
                      <i className="fa-solid fa-crown"></i> Pro Only
                    </span>
                  </h3>
                  <p className="table-lock-desc">
                    Free candidate accounts are limited to editing your single
                    active draft. Cloud document versioning, rollback history,
                    and multi-file management require
                    <strong>Premium Career Pro</strong>.
                  </p>
                  <div className="table-lock-actions">
                    <button
                      className="btn btn-unlock-table"
                      id="unlockDocsTableBtn"
                      type="button"
                      data-locked="true"
                      data-feature="Cloud Document History &amp; Multi-File Storage"
                      data-desc="Unlock unlimited cloud document storage, version rollback history, and multi-file resume sync with Premium Career Pro."
                    >
                      <i className="fa-solid fa-crown"></i> Unlock Document
                      History
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ==================== 7. RECOMMENDED JOB MATCHES SECTION ==================== */}
            <section className="section-container" id="job-matches">
              <div className="section-header-wrap">
                <div>
                  <h2 className="section-title">Recommended Job Matches</h2>
                  <p className="section-subtitle">
                    Explore smart career matches based on your candidate
                    profile. 1 free preview is unlocked.
                  </p>
                </div>
                <div>
                  <span className="badge badge-teal-subtle">
                    <i className="fa-solid fa-eye"></i> 1 Free Preview
                  </span>
                </div>
              </div>

              {/* Job Matches Chips Row */}
              <div className="jobs-grid jobs-chips-wrap" id="jobsGrid">
              </div>
            </section>

            {/* ==================== 8. INTERVIEW PREPARATION SECTION (MATCHING USER IMAGE 1) ==================== */}

            {/* ==================== 9. FREE PLAN USAGE & LIMITS SECTION (MATCHING USER IMAGE 2) ==================== */}
            <section
              className="section-container"
              id="usage-limits"
              aria-label="Usage Limits"
            >
              <div className="usage-limits-header">
                <div className="usage-title-wrap">
                  <div className="usage-shield-icon">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div>
                    <h3 className="usage-title">
                      Your Free Plan Usage & Limits
                    </h3>
                    <p className="usage-subtitle">
                      Track your free quota across tools. Quotas persist
                      automatically across sessions.
                    </p>
                  </div>
                </div>
                <div className="usage-plan-badge">
                  <span className="badge-free-plan-pill">Free Plan</span>
                </div>
              </div>

              <div className="usage-metrics-grid">
                {/* Metric 1: Resume Templates */}
                <div className="usage-metric-item">
                  <div className="usage-metric-meta">
                    <span className="metric-name">
                      <i className="fa-regular fa-file-lines"></i> Resume
                      Templates
                    </span>
                    <span className="metric-quota" id="usageTemplateCount">
                      3 of 3 Available
                    </span>
                  </div>
                  <div className="metric-progress-track">
                    <div
                      className="metric-progress-bar fill-teal"
                      style={{ width: "100%" }}
                    ></div>
                  </div>
                  <span className="metric-hint">
                    3 Free templates unlocked (Aurora, Slate, Classic)
                  </span>
                </div>

                {/* Metric 2: ATS Checks */}
                <div className="usage-metric-item">
                  <div className="usage-metric-meta">
                    <span className="metric-name">
                      <i className="fa-solid fa-percent"></i> ATS Checks
                    </span>
                    <span className="metric-quota" id="usageAtsCount">
                      2 Remaining
                    </span>
                  </div>
                  <div className="metric-progress-track">
                    <div
                      className="metric-progress-bar fill-teal"
                      id="usageAtsBar"
                      style={{ width: "100%" }}
                    ></div>
                  </div>
                  <span className="metric-hint" id="usageAtsHint">
                    2 checks remaining in current free cycle
                  </span>
                </div>

                {/* Metric 3: Portfolio Publishing */}
                <div className="usage-metric-item">
                  <div className="usage-metric-meta">
                    <span className="metric-name">
                      <i className="fa-solid fa-globe"></i> Portfolio Publishing
                    </span>
                    <span className="metric-quota text-gold font-semibold">
                      <i className="fa-solid fa-lock"></i> Premium Only
                    </span>
                  </div>
                  <div className="metric-progress-track">
                    <div
                      className="metric-progress-bar fill-locked"
                      style={{ width: "0%" }}
                    ></div>
                  </div>
                  <span className="metric-hint">
                    Draft mode only • Custom domains locked
                  </span>
                </div>

                {/* Metric 4: Advanced Job Matching */}
                <div className="usage-metric-item">
                  <div className="usage-metric-meta">
                    <span className="metric-name">
                      <i className="fa-solid fa-magnifying-glass"></i> Advanced
                      Job Matching
                    </span>
                    <span className="metric-quota text-gold font-semibold">
                      <i className="fa-solid fa-lock"></i> Premium Only
                    </span>
                  </div>
                  <div className="metric-progress-track">
                    <div
                      className="metric-progress-bar fill-locked"
                      style={{ width: "0%" }}
                    ></div>
                  </div>
                  <span className="metric-hint">
                    1 preview job active • Unlimited requires Premium
                  </span>
                </div>

                {/* Metric 5: Document Storage */}
                <div className="usage-metric-item">
                  <div className="usage-metric-meta">
                    <span className="metric-name">
                      <i className="fa-solid fa-cloud"></i> Document Storage
                    </span>
                    <span className="metric-quota" id="usageDocCount">
                      1 / 3 Free Slots
                    </span>
                  </div>
                  <div className="metric-progress-track">
                    <div
                      className="metric-progress-bar fill-teal"
                      style={{ width: "33%" }}
                    ></div>
                  </div>
                  <span className="metric-hint">
                    Basic local storage • Cloud sync locked
                  </span>
                </div>

                {/* Metric 6: CTA Upgrade Card */}
                <div className="usage-metric-item cta-metric-item">
                  <div className="cta-metric-content">
                    <h4 className="cta-metric-title">
                      <i className="fa-solid fa-crown text-gold"></i> Need
                      Unlimited Access?
                    </h4>
                    <p className="cta-metric-desc">
                      Get unlimited ATS checks, full document history, all
                      templates & direct recruiter outreach.
                    </p>
                  </div>
                  <button
                    className="btn-amber-upgrade w-full"
                    id="usageUpgradeBtn"
                  >
                    <i className="fa-solid fa-arrow-up-right-dots"></i> Upgrade
                    Plan
                  </button>
                </div>
              </div>
            </section>
          </main>

          {/* ==================== DASHBOARD FOOTER ==================== */}
          <footer className="app-footer" aria-label="Site footer">
            <div className="app-footer-inner">
              <div className="footer-copy-text">
                <span className="footer-brand-title">HR Module</span>
                <span className="footer-nav-sep" aria-hidden="true">&bull;</span>
                <span className="footer-copy">&copy; 2026 HR Module Inc. All rights reserved.</span>
              </div>

              <nav className="footer-nav-links" aria-label="Legal links">
                <a href="#" className="footer-nav-link">Privacy Policy</a>
                <span className="footer-nav-sep" aria-hidden="true">&bull;</span>
                <a href="#" className="footer-nav-link">Terms of Service</a>
                <span className="footer-nav-sep" aria-hidden="true">&bull;</span>
                <a href="#" className="footer-nav-link">Cookie Settings</a>
              </nav>

              <div className="footer-social-icons" aria-label="Social links">
                <a href="#" className="footer-social-btn" aria-label="LinkedIn" title="LinkedIn">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect x="2" y="9" width="4" height="12"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                </a>
                <a href="#" className="footer-social-btn" aria-label="GitHub" title="GitHub">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/>
                  </svg>
                </a>
                <a href="#" className="footer-social-btn" aria-label="X (Twitter)" title="X (Twitter)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS SECTION */}
      {/* ========================================================================= */}

      {/* ==================== RESUME HISTORY MODAL ==================== */}
      <div
        id="modal-resume-history"
        className="app-modal-backdrop hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-history-title"
      >
        <div className="app-modal-dialog app-modal-dialog-wide">
          <div className="app-modal-header">
            <div className="modal-header-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span id="resume-history-title">Resume History</span>
            </div>
            <button type="button" className="app-modal-close" id="close-resume-history-modal" aria-label="Close">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div className="app-modal-body">
            <table className="rch-history-table">
              <thead>
                <tr>
                  <th>Resume</th>
                  <th>Source</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="resume-history-tbody"></tbody>
            </table>
            <div className="rch-empty-state hidden" id="resume-history-empty">
              <h4>No Resumes Found</h4>
              <p>You have not uploaded or created any resumes yet.</p>
            </div>
          </div>
          <div className="app-modal-footer">
            <button type="button" className="rch-modal-close-btn" id="btn-close-history-modal">Close</button>
          </div>
        </div>
      </div>
      {/* ==================== REUSABLE PREMIUM UPGRADE MODAL ==================== */}
      <div
        className="modal-backdrop"
        id="upgradeModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgradeModalTitle"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-upgrade">
          <button
            className="modal-close-btn"
            id="upgradeModalCloseBtn"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="upgrade-modal-header">
            <div className="upgrade-modal-icon-wrap">
              <i className="fa-solid fa-crown modal-crown-icon"></i>
            </div>
            <span className="badge badge-gold-large">
              <i className="fa-solid fa-gem"></i> PREMIUM FEATURE
            </span>
            <h3 className="modal-title" id="upgradeModalTitle">
              Unlock Premium Features
            </h3>
            <p className="modal-subtitle" id="upgradeModalFeatureNote">
              You've tried to access a premium feature. Upgrade your candidate
              account to unlock full professional tools.
            </p>
          </div>

          <div
            className="upgrade-modal-feature-box"
            id="upgradeFeatureHighlight"
          >
            <div className="highlight-icon">
              <i className="fa-solid fa-lock text-gold"></i>
            </div>
            <div>
              <span className="highlight-title" id="upgradeTargetFeature">
                Advanced Feature
              </span>
              <p className="highlight-desc" id="upgradeTargetDesc">
                This feature is reserved for HR Module Premium candidates.
              </p>
            </div>
          </div>

          <div className="upgrade-benefits-section">
            <h4 className="benefits-title">What you get with Premium:</h4>
            <div className="benefits-grid">
              <div className="benefit-item">
                <i className="fa-solid fa-circle-check text-gold"></i>
                <span>Unlimited resume creation & drafts</span>
              </div>
              <div className="benefit-item">
                <i className="fa-solid fa-circle-check text-gold"></i>
                <span>All 40+ designer templates</span>
              </div>
              <div className="benefit-item">
                <i className="fa-solid fa-circle-check text-gold"></i>
                <span>Advanced ATS keyword scoring & audit</span>
              </div>
              <div className="benefit-item">
                <i className="fa-solid fa-circle-check text-gold"></i>
                <span>Live portfolio web hosting on custom domains</span>
              </div>
              <div className="benefit-item">
                <i className="fa-solid fa-circle-check text-gold"></i>
                <span>Direct recruiter contact & priority review</span>
              </div>
              <div className="benefit-item">
                <i className="fa-solid fa-circle-check text-gold"></i>
                <span>Full document history & version diffs</span>
              </div>
            </div>
          </div>

          <div className="modal-actions-dual">
            <button
              className="btn btn-primary btn-lg w-full"
              id="upgradeModalExploreBtn"
            >
              <i className="fa-solid fa-crown"></i> Explore Premium Plans
            </button>
            <button
              className="btn btn-secondary-light btn-lg w-full"
              id="upgradeModalDismissBtn"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>

      {/* ==================== PRICING COMPARISON MODAL ==================== */}
      <div
        className="modal-backdrop"
        id="pricingModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricingModalTitle"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-pricing">
          <button
            className="modal-close-btn"
            id="pricingModalCloseBtn"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="pricing-modal-header text-center" style={{ marginBottom: "1.5rem" }}>
            <span className="badge badge-teal-subtle" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <i className="fa-solid fa-crown"></i> Candidate Upgrade
            </span>
            <h3 className="modal-title" id="pricingModalTitle" style={{ fontSize: "1.6rem", fontWeight: 800, margin: "6px 0" }}>
              Upgrade to Premium Career Pro
            </h3>
            <p className="modal-subtitle" style={{ color: "#64748b", fontSize: "0.92rem", margin: 0 }}>
              One-time payment of ₹499 unlocks gold badge, top recruiter priority, ATS checks, and portfolio hosting.
            </p>
          </div>

          <div className="pricing-cards-grid">
            {/* Premium Career Pro Plan Card */}
            <div className="pricing-card card-premium-plan featured" style={{ border: "2px solid var(--primary-teal, #0f9488)" }}>
              <div className="popular-ribbon">
                <i className="fa-solid fa-crown"></i> ALL-IN-ONE
              </div>
              <div className="pricing-card-top">
                <span className="plan-tag tag-teal">
                  <i className="fa-solid fa-crown"></i> PRO CANDIDATE
                </span>
                <h4 className="plan-name">Premium Career Pro</h4>
                <p className="plan-pitch">
                  Complete candidate toolkit with top recruiter visibility while you job hunt.
                </p>
                <div className="plan-price-wrap">
                  <span className="plan-price">₹499</span>
                  <span className="plan-cycle">/ one-time payment</span>
                </div>
              </div>
              <ul className="plan-features-list">
                <li>
                  <i className="fa-solid fa-circle-check text-teal"></i>
                  <span><strong>Gold crown badge</strong> on your candidate profile</span>
                </li>
                <li>
                  <i className="fa-solid fa-circle-check text-teal"></i>
                  <span><strong>Priority placement</strong> at top of recruiter searches</span>
                </li>
                <li>
                  <i className="fa-solid fa-circle-check text-teal"></i>
                  <span>Full paid candidate dashboard &amp; recruiter discovery</span>
                </li>
                <li>
                  <i className="fa-solid fa-circle-check text-teal"></i>
                  <span>Unlimited resume uploads &amp; ATS score checks</span>
                </li>
                <li>
                  <i className="fa-solid fa-circle-check text-teal"></i>
                  <span>1-Click direct job applications to top companies</span>
                </li>
                <li>
                  <i className="fa-solid fa-circle-check text-teal"></i>
                  <span>Live personal portfolio website on custom URL</span>
                </li>
                <li>
                  <i className="fa-solid fa-circle-check text-teal"></i>
                  <span>All 40+ professional designer resume templates</span>
                </li>
              </ul>
              <div className="pricing-card-footer">
                <button
                  className="btn btn-primary w-full"
                  id="pricingDemoUpgradeBtn"
                  type="button"
                >
                  <i className="fa-solid fa-crown"></i> Upgrade to Premium Career Pro — ₹499
                </button>
              </div>
            </div>
          </div>

          {/* ==================== PREMIUM CHECKOUT SECTION ==================== */}
          <section
            className="payment-checkout"
            id="paymentCheckout"
            aria-labelledby="paymentCheckoutTitle"
            style={{ display: "none" }}
          >
            <div className="payment-checkout-heading">
              <button
                type="button"
                className="payment-back-btn"
                id="paymentBackBtn"
              >
                <i className="fa-solid fa-arrow-left"></i> Back to plans
              </button>
              <span className="badge badge-teal-subtle">
                <i className="fa-solid fa-shield-halved"></i> Secure checkout
              </span>
              <h3 id="paymentCheckoutTitle">Complete your plan upgrade</h3>
              <p>Review your order and choose a payment method to continue.</p>
            </div>

            <div className="payment-checkout-grid">
              <form className="payment-form" id="paymentForm">
                <h4>
                  <i className="fa-regular fa-user"></i> Billing details
                </h4>
                <div className="payment-field">
                  <label htmlFor="paymentFullName">Full name</label>
                  <input
                    id="paymentFullName"
                    name="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="payment-field">
                  <label htmlFor="paymentEmail">Email address</label>
                  <input
                    id="paymentEmail"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <h4 className="payment-method-heading">
                  <i className="fa-regular fa-credit-card"></i> Payment method
                </h4>
                <div className="payment-field">
                  <label htmlFor="paymentMethod">Choose a method</label>
                  <select
                    id="paymentMethod"
                    name="paymentMethod"
                    required
                    defaultValue="upi"
                  >
                    <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="netbanking">Net Banking</option>
                  </select>
                </div>

                <div id="upiPaymentFields" className="payment-method-fields">
                  <label htmlFor="paymentUpiId">UPI ID</label>
                  <input
                    id="paymentUpiId"
                    name="upiId"
                    type="text"
                    placeholder="name@bank"
                  />
                </div>

                <div
                  id="cardPaymentFields"
                  className="payment-method-fields"
                  style={{ display: "none" }}
                >
                  <div className="payment-field">
                    <label htmlFor="paymentCardNumber">Card number</label>
                    <input
                      id="paymentCardNumber"
                      name="cardNumber"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="1234 5678 9012 3456"
                    />
                  </div>
                  <div className="payment-two-columns">
                    <div className="payment-field">
                      <label htmlFor="paymentCardExpiry">Expiry</label>
                      <input
                        id="paymentCardExpiry"
                        name="cardExpiry"
                        autoComplete="cc-exp"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div className="payment-field">
                      <label htmlFor="paymentCardCvv">CVV</label>
                      <input
                        id="paymentCardCvv"
                        name="cardCvv"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="123"
                      />
                    </div>
                  </div>
                  <p className="payment-security-note">
                    For a real payment, card details must be collected and
                    tokenized by your payment gateway—not stored by this app.
                  </p>
                </div>

                <div
                  id="bankPaymentFields"
                  className="payment-method-fields"
                  style={{ display: "none" }}
                >
                  <label htmlFor="paymentBank">Select bank</label>
                  <select id="paymentBank" name="bank">
                    <option value="">Choose your bank</option>
                    <option value="sbi">State Bank of India</option>
                    <option value="hdfc">HDFC Bank</option>
                    <option value="icici">ICICI Bank</option>
                    <option value="axis">Axis Bank</option>
                    <option value="other">Other bank</option>
                  </select>
                </div>

                <button
                  className="btn btn-primary w-full payment-pay-btn"
                  id="paymentPayBtn"
                  type="submit"
                >
                  <i className="fa-solid fa-lock"></i> Pay securely with Razorpay
                </button>
              </form>

              <aside
                className="payment-order-summary"
                aria-label="Order summary"
              >
                <h4>Order summary</h4>
                <div className="payment-product">
                  <span className="payment-product-icon">
                    <i className="fa-solid fa-crown"></i>
                  </span>
                  <div>
                    <strong id="checkoutSummaryPlanTitle">Premium Career Pro</strong>
                    <span id="checkoutSummaryPlanDesc">
                      Candidate plan · one-time registration fee
                    </span>
                  </div>
                </div>
                <div className="payment-summary-row">
                  <span>Plan price</span>
                  <strong id="checkoutSummaryPlanPrice">₹499.00</strong>
                </div>
                <div className="payment-summary-row">
                  <span>Tax</span>
                  <strong>Included</strong>
                </div>
                <div className="payment-summary-total">
                  <span>Total due today</span>
                  <strong id="checkoutSummaryTotal">₹499</strong>
                </div>
                <div className="payment-benefit-note">
                  <i className="fa-solid fa-circle-check"></i>
                  Portfolio publishing, unlimited ATS checks, and premium
                  templates.
                </div>
              </aside>
            </div>

            <div
              id="paymentSuccessMessage"
              className="payment-success-message"
              role="status"
              style={{ display: "none" }}
            >
              <span className="payment-success-icon">
                <i className="fa-solid fa-check"></i>
              </span>
              <h3>Payment successful</h3>
              <p>Your subscription is active and your invoice is ready.</p>
              <button
                type="button"
                className="btn btn-primary"
                id="paymentDoneBtn"
              >
                Done
              </button>
            </div>
          </section>

                  </div>
      </div>

      {/* ==================== ATS CHECKER MODAL ==================== */}
      <div
        className="modal-backdrop"
        id="atsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atsModalTitle"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-ats">
          <button
            className="modal-close-btn"
            id="atsModalCloseBtn"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="ats-modal-header">
            <div className="ats-header-icon">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <h3 className="modal-title" id="atsModalTitle">
                ATS Resume Checker
              </h3>
              <p className="modal-subtitle">
                Upload your resume to calculate an instant ATS compatibility
                score and get actionable improvement tips. Files are processed
                in-memory only and are never saved to your profile.
              </p>
            </div>
          </div>

          {/* Free checks remaining banner */}
          <div className="ats-quota-banner" id="atsQuotaBanner">
            <i className="fa-solid fa-bolt text-teal"></i>
            <span>
              Free Plan Quota:
              <strong id="atsModalChecksRemaining">2</strong> checks remaining.
            </span>
          </div>

          {/* Checker Body */}
          <div className="ats-checker-body" id="atsInputSection">
            {/* Input Method Tabs */}
            <div className="ats-input-tabs">
              <button
                className="ats-tab-btn active"
                id="atsTabUpload"
                data-tab="upload"
                type="button"
              >
                <i className="fa-solid fa-file-arrow-up"></i> Upload Resume
              </button>
              <button
                className="ats-tab-btn"
                id="atsTabPaste"
                data-tab="paste"
                type="button"
              >
                <i className="fa-solid fa-clipboard"></i> Paste Text
              </button>
            </div>

            {/* Upload Tab Panel */}
            <div id="atsUploadPanel" className="ats-tab-panel">
              <div className="ats-upload-dropzone" id="atsDropzone">
                <input
                  type="file"
                  id="atsFileInput"
                  accept=".txt,.pdf,.doc,.docx"
                  style={{ display: "none" }}
                />
                <div className="ats-dropzone-icon">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <div className="ats-dropzone-content">
                  <p className="ats-dropzone-title">
                    Drop your resume file here
                  </p>
                  <p className="ats-dropzone-sub">
                    Supports PDF, DOCX, TXT &bull; Max 5 MB &bull;
                    <strong>File is not saved</strong>
                  </p>
                  <button
                    className="btn btn-secondary-light btn-sm"
                    id="atsBrowseFileBtn"
                    type="button"
                  >
                    <i className="fa-solid fa-folder-open"></i> Browse File
                  </button>
                </div>
              </div>
              {/* File selected state */}
              <div
                className="ats-file-selected"
                id="atsFileSelectedRow"
                style={{ display: "none" }}
              >
                <div className="ats-file-info">
                  <div className="ats-file-icon">
                    <i className="fa-solid fa-file-lines"></i>
                  </div>
                  <div>
                    <p className="ats-file-name" id="atsFileName">
                      resume.pdf
                    </p>
                    <p className="ats-file-meta" id="atsFileMeta">
                      Ready to analyze &mdash; not saved to profile
                    </p>
                  </div>
                </div>
                <button
                  className="btn-icon ats-remove-file"
                  id="atsRemoveFileBtn"
                  aria-label="Remove file"
                  type="button"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="ats-no-save-notice">
                <i className="fa-solid fa-shield-halved text-teal"></i>
                Your file is analyzed in memory only and
                <strong>never uploaded or saved</strong> to any server or
                profile.
              </div>
            </div>

            {/* Paste Tab Panel */}
            <div
              id="atsPastePanel"
              className="ats-tab-panel"
              style={{ display: "none" }}
            >
              <div className="form-group">
                <label htmlFor="atsResumeText" className="form-label">
                  Resume Content{" "}
                  <span className="text-muted">(plain text)</span>:
                </label>
                <textarea
                  id="atsResumeText"
                  className="form-control text-area-ats"
                  rows="9"
                  placeholder="Paste your resume text here..."
                ></textarea>
              </div>
              <button
                className="btn btn-link-subtle"
                id="atsFillSampleBtn"
                type="button"
              >
                <i className="fa-solid fa-wand-sparkles"></i> Fill with sample
                resume
              </button>
            </div>

            {/* Target Job / Job Description Section */}
            <div className="ats-target-job-section" style={{ marginTop: "1rem" }}>
              <div className="form-group">
                <label htmlFor="atsTargetJob" className="form-label">
                  Target Job Position:
                </label>
                <select id="atsTargetJob" className="form-control">
                  <option value="">-- Select a target job opening --</option>
                </select>
                <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                  Select an active job opening from the platform, or paste a custom job description below.
                </p>
              </div>

              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label htmlFor="atsJobDescription" className="form-label">
                  Or Paste Job Description <span className="text-muted">(min 40 characters)</span>:
                </label>
                <textarea
                  id="atsJobDescription"
                  className="form-control"
                  rows="4"
                  placeholder="Paste the target job description or requirements here..."
                ></textarea>
              </div>
            </div>

            <div className="ats-modal-actions">
              <button
                className="btn btn-secondary-light"
                id="atsClearBtn"
                type="button"
              >
                <i className="fa-solid fa-rotate"></i> Clear
              </button>
              <button
                className="btn btn-primary"
                id="atsRunCheckBtn"
                type="button"
              >
                <i className="fa-solid fa-magnifying-glass-chart"></i> Analyze
                Resume
              </button>
            </div>
          </div>

          {/* ATS Result Area */}
          <div
            className="ats-results-area"
            id="atsResultsArea"
            style={{ display: "none" }}
          >
            <div className="ats-score-display-card">
              <div className="score-circle-wrapper">
                <div className="score-circular-metric" id="scoreMetricValue">
                  88%
                </div>
                <span className="score-status-text" id="scoreStatusText">
                  Strong Match
                </span>
              </div>
              <div className="score-details-summary">
                <h4 className="score-card-title">Analysis Summary</h4>
                <p className="score-card-desc" id="scoreAnalysisDesc">
                  Your resume exhibits strong keyword density and standard
                  section headers. Recommended for front-end positions.
                </p>
                <div
                  className="detected-pills-row"
                  id="detectedSkillsList"
                ></div>
              </div>
            </div>

            <div className="ats-breakdown-card">
              <h4 className="breakdown-title">
                <i className="fa-solid fa-list-check"></i> Section Breakdown
              </h4>
              <div className="breakdown-items-grid" id="breakdownGrid"></div>
            </div>

            <div className="ats-suggestions-card">
              <h4 className="suggestions-title">
                <i className="fa-solid fa-lightbulb text-warning"></i>{" "}
                Optimization Suggestions
              </h4>
              <ul className="suggestions-list" id="suggestionsList"></ul>
            </div>

            <div className="ats-results-footer">
              <button
                className="btn btn-secondary-light btn-sm"
                id="atsRecheckBtn"
              >
                <i className="fa-solid fa-rotate-left"></i> Test Another Text
              </button>
              <button
                className="btn btn-primary btn-sm"
                id="atsLockedDeepAuditBtn"
                data-locked="true"
                data-feature="Detailed ATS Diagnostic Report"
                data-desc="Unlock line-by-line ATS simulation against Taleo, Greenhouse, and Workday parsers."
              >
                <i className="fa-solid fa-crown text-gold"></i> Download Full
                Report (Pro)
              </button>
            </div>
          </div>

          {/* Saved ATS Checks History */}
          <div className="ats-history-section" id="atsHistorySection" style={{ marginTop: "1.25rem", padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <h5 className="form-label" style={{ fontWeight: 700, marginBottom: "8px" }}>Saved ATS Checks History</h5>
            <ul id="atsHistoryList" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
              <li className="text-muted" style={{ fontSize: "0.82rem" }}>No saved ATS checks yet.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ==================== RESUME EDITOR MODAL ==================== */}
      <div
        className="modal-backdrop"
        id="resumeEditorModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resumeEditorTitle"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-editor">
          <button
            className="modal-close-btn"
            id="resumeEditorCloseBtn"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="editor-modal-header">
            <div className="editor-title-wrap">
              <div className="editor-header-icon">
                <i className="fa-solid fa-pen-nib"></i>
              </div>
              <div>
                <h3 className="modal-title" id="resumeEditorTitle">
                  Resume Editor —
                  <span id="currentEditingTemplateName">Aurora</span>
                </h3>
                <p className="modal-subtitle">
                  Customize your free resume draft. Changes update live in the
                  preview pane.
                </p>
              </div>
            </div>
            <div className="editor-header-actions">
              <button
                className="btn btn-secondary-light btn-sm"
                id="editorDownloadBtn"
              >
                <i className="fa-solid fa-download"></i> Download Resume
              </button>
              <button
                className="btn btn-primary btn-sm"
                id="editorSaveDraftBtn"
              >
                <i className="fa-solid fa-floppy-disk"></i> Save Draft
              </button>
            </div>
          </div>

          {/* Dual Split Layout: Form & Live Preview */}
          <div className="editor-split-container">
            {/* Left: Form inputs */}
            <div className="editor-form-col">
              <h4 className="editor-subhead">
                <i className="fa-solid fa-user-pen"></i> Candidate Information
              </h4>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="edFullName" className="form-label">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="edFullName"
                    className="form-control"
                    defaultValue=""
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edJobTitle" className="form-label">
                    Professional Title
                  </label>
                  <input
                    type="text"
                    id="edJobTitle"
                    className="form-control"
                    value="Software Developer"
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label htmlFor="edEmail" className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    id="edEmail"
                    className="form-control"
                    defaultValue=""
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edPhone" className="form-label">
                    Phone
                  </label>
                  <input
                    type="text"
                    id="edPhone"
                    className="form-control"
                    value="+91 98765 43210"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edLocation" className="form-label">
                    Location
                  </label>
                  <input
                    type="text"
                    id="edLocation"
                    className="form-control"
                    value="Bengaluru, India"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edSummary" className="form-label">
                  Professional Summary
                </label>
                <textarea id="edSummary" className="form-control" rows="3">
                  Innovative Software Developer with 2+ years of experience in
                  developing responsive web interfaces, modern JavaScript SPAs,
                  and robust front-end architectures.
                </textarea>
              </div>

              <div className="form-group">
                <label htmlFor="edSkills" className="form-label">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  id="edSkills"
                  className="form-control"
                  value="JavaScript (ES6+), HTML5, CSS3, React, TypeScript, Git, REST APIs, Webpack"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edExperience" className="form-label">
                  Work Experience
                </label>
                <textarea id="edExperience" className="form-control" rows="4">
                  Junior Front-End Developer — TechNova Solutions (2024 -
                  Present) - Engineered responsive UI components for candidate
                  dashboard modules. - Boosted web performance by 34% with
                  modern CSS and bundling optimizations.
                </textarea>
              </div>

              <div className="form-group">
                <label htmlFor="edEducation" className="form-label">
                  Education
                </label>
                <input
                  type="text"
                  id="edEducation"
                  className="form-control"
                  value="B.Tech in Computer Science — National Institute of Technology (2023)"
                />
              </div>
            </div>

            {/* Right: Live Preview Pane */}
            <div className="editor-preview-col">
              <div className="preview-toolbar">
                <span className="preview-label">
                  <i className="fa-solid fa-eye"></i> Live Preview
                </span>
                <span
                  className="badge badge-teal-subtle"
                  id="previewTemplatePill"
                >
                  Aurora Layout
                </span>
              </div>

              <div className="preview-paper-sheet" id="liveResumeSheet">
                <div className="paper-header">
                  <h2 className="paper-name" id="prevName">
                    Candidate
                  </h2>
                  <div className="paper-title" id="prevTitle">
                    Software Developer
                  </div>
                  <div className="paper-contact" id="prevContact">
                    <span>
                      <i className="fa-solid fa-envelope"></i>
                      <span id="prevEmail"></span>
                    </span>
                    <span>
                      <i className="fa-solid fa-phone"></i>
                      <span id="prevPhone">+91 98765 43210</span>
                    </span>
                    <span>
                      <i className="fa-solid fa-location-dot"></i>
                      <span id="prevLocation">Bengaluru, India</span>
                    </span>
                  </div>
                </div>

                <div className="paper-section">
                  <h3 className="paper-sec-head">Professional Summary</h3>
                  <p className="paper-text" id="prevSummary">
                    Innovative Software Developer with 2+ years of experience in
                    developing responsive web interfaces.
                  </p>
                </div>

                <div className="paper-section">
                  <h3 className="paper-sec-head">Technical Skills</h3>
                  <div className="paper-skills-wrap" id="prevSkillsWrap"></div>
                </div>

                <div className="paper-section">
                  <h3 className="paper-sec-head">Work Experience</h3>
                  <div className="paper-preformatted" id="prevExperience"></div>
                </div>

                <div className="paper-section">
                  <h3 className="paper-sec-head">Education</h3>
                  <p className="paper-text" id="prevEducation">
                    B.Tech in Computer Science — NIT (2023)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SETTINGS & PROFILE MODAL (3-Tab Redesign) ==================== */}
      <div
        className="modal-backdrop"
        id="settingsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settingsModalTitle"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-settings">
          <button
            className="modal-close-btn"
            id="settingsModalCloseBtn"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          {/* Settings Header */}
          <div className="settings-modal-header">
            <div className="settings-header-icon">
              <i className="fa-solid fa-gear"></i>
            </div>
            <div>
              <h3 className="modal-title" id="settingsModalTitle">
                Account Settings
              </h3>
              <p className="modal-subtitle">
                Manage your profile, plan, and account preferences.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="settings-tab-nav" role="tablist">
            <button
              className="settings-tab-btn active"
              id="stab-info"
              role="tab"
              aria-selected="true"
              data-stab="info"
            >
              <i className="fa-solid fa-user-pen"></i> Edit Personal Information
            </button>
            <button
              className="settings-tab-btn"
              id="stab-upgrade"
              role="tab"
              aria-selected="false"
              data-stab="upgrade"
            >
              <i className="fa-solid fa-crown"></i> Upgrade Plan
            </button>
            <button
              className="settings-tab-btn"
              id="stab-danger"
              role="tab"
              aria-selected="false"
              data-stab="danger"
            >
              <i className="fa-solid fa-trash-can"></i> Delete Account
            </button>
          </div>

          {/* Tab Panel 1: Edit Personal Information */}
          <div
            className="settings-tab-panel"
            id="stab-panel-info"
            role="tabpanel"
          >
            <form id="profileSettingsForm">
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="setFullName" className="form-label">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="setFullName"
                    className="form-control"
                    defaultValue=""
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="setTitle" className="form-label">
                    Professional Title
                  </label>
                  <input
                    type="text"
                    id="setTitle"
                    className="form-control"
                    value="Software Developer"
                    required
                  />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="setEmail" className="form-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="setEmail"
                    className="form-control"
                    defaultValue=""
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="setLocation" className="form-label">
                    Location
                  </label>
                  <input
                    type="text"
                    id="setLocation"
                    className="form-control"
                    value="Bengaluru, India"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="setSkills" className="form-label">
                  Skills <span className="text-muted">(comma separated)</span>
                </label>
                <input
                  type="text"
                  id="setSkills"
                  className="form-control"
                  value="HTML5, CSS3, JavaScript, React, TypeScript, Git"
                />
              </div>
              <div className="form-group">
                <label htmlFor="setBio" className="form-label">
                  Professional Summary
                </label>
                <textarea id="setBio" className="form-control" rows="3">
                  Front-End Developer passionate about building accessible,
                  performant, and delightful web applications.
                </textarea>
              </div>
              <div className="settings-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary-light"
                  id="settingsCancelBtn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  id="settingsSaveBtn"
                >
                  <i className="fa-solid fa-floppy-disk"></i> Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Tab Panel 2: Upgrade Plan */}
          <div
            className="settings-tab-panel"
            id="stab-panel-upgrade"
            role="tabpanel"
            style={{ display: "none" }}
          >
            <div className="settings-upgrade-panel">
              <div className="sup-current-plan">
                <div className="sup-plan-icon">
                  <i className="fa-solid fa-user"></i>
                </div>
                <div>
                  <p className="sup-plan-label">Current Plan</p>
                  <h4 className="sup-plan-name">Free Candidate Tier</h4>
                  <p className="text-sm text-secondary">
                    3 templates &bull; 2 ATS checks &bull; No portfolio
                    publishing
                  </p>
                </div>
              </div>
              <div className="sup-divider">
                <span>Upgrade to unlock everything</span>
              </div>
              <div className="sup-premium-card">
                <div className="sup-premium-header">
                  <div className="sup-premium-icon">
                    <i className="fa-solid fa-crown"></i>
                  </div>
                  <div>
                    <h4 className="sup-premium-name">Premium Career Pro</h4>
                    <p className="text-sm text-secondary">
                      Everything you need to land your next role
                    </p>
                  </div>
                  <div className="sup-premium-price">
                    &lrm;&#8377;499<span>/mo</span>
                  </div>
                </div>
                <ul className="sup-features-list">
                  <li>
                    <i className="fa-solid fa-circle-check text-teal"></i> All
                    40+ designer resume templates
                  </li>
                  <li>
                    <i className="fa-solid fa-circle-check text-teal"></i>{" "}
                    Unlimited ATS checks with full reports
                  </li>
                  <li>
                    <i className="fa-solid fa-circle-check text-teal"></i> Live
                    portfolio website publishing
                  </li>
                  <li>
                    <i className="fa-solid fa-circle-check text-teal"></i>{" "}
                    Vector PDF &amp; Word export
                  </li>
                  <li>
                    <i className="fa-solid fa-circle-check text-teal"></i>{" "}
                    Advanced job matching &amp; direct apply
                  </li>
                  <li>
                    <i className="fa-solid fa-circle-check text-teal"></i> Cloud
                    document history &amp; version sync
                  </li>
                </ul>
                <button
                  className="btn btn-primary w-full"
                  id="settingsUpgradeBtn"
                >
                  <i className="fa-solid fa-crown"></i> Explore Premium Plans
                </button>
              </div>
            </div>
          </div>

          {/* Tab Panel 3: Danger Zone / Delete Account */}
          <div
            className="settings-tab-panel"
            id="stab-panel-danger"
            role="tabpanel"
            style={{ display: "none" }}
          >
            <div className="settings-danger-panel">
              <div className="danger-warning-box">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <div>
                  <h4 className="danger-title">Delete Account</h4>
                  <p className="danger-subtitle">
                    Actions here are permanent and irreversible. Please proceed
                    with caution.
                  </p>
                </div>
              </div>
              <div className="danger-action-card">
                <div className="danger-action-info">
                  <h5 className="danger-action-title">
                    <i className="fa-solid fa-trash-can"></i> Delete My Account
                  </h5>
                  <p className="danger-action-desc">
                    Permanently delete your candidate profile, all saved
                    resumes, and application history. This action
                    <strong>cannot be undone</strong>.
                  </p>
                </div>
                <button
                  className="btn btn-danger-outline"
                  id="deleteAccountBtn"
                  type="button"
                >
                  Delete Account
                </button>
              </div>
              {/* Confirmation step (hidden by default) */}
              <div
                className="danger-confirm-step"
                id="deleteConfirmStep"
                style={{ display: "none" }}
              >
                <p className="danger-confirm-msg">
                  Type <strong>DELETE</strong> below to confirm:
                </p>
                <div className="danger-confirm-row">
                  <input
                    type="text"
                    id="deleteConfirmInput"
                    className="form-control"
                    placeholder="Type DELETE to confirm"
                  />
                  <button
                    className="btn btn-danger"
                    id="confirmDeleteAccountBtn"
                    type="button"
                    disabled
                  >
                    Confirm Delete
                  </button>
                </div>
                <button
                  className="btn btn-secondary-light btn-sm"
                  id="cancelDeleteBtn"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== PORTFOLIO PREVIEW MODAL ==================== */}
      <div
        className="modal-backdrop"
        id="portfolioModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolioModalTitle"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-portfolio-preview">
          <button
            className="modal-close-btn"
            id="portfolioModalCloseBtn"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="portfolio-modal-header">
            <div className="portfolio-header-icon">
              <i className="fa-solid fa-desktop"></i>
            </div>
            <div>
              <h3 className="modal-title" id="portfolioModalTitle">
                Portfolio Website Preview
              </h3>
              <p className="modal-subtitle">
                Preview your generated developer portfolio website. Live
                publishing requires Pro.
              </p>
            </div>
          </div>

          <div className="portfolio-sim-browser">
            <div className="browser-address-bar">
              <div className="browser-controls">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="browser-url-input">
                <i className="fa-solid fa-lock text-muted"></i>
                <span>https://candidate.hrmodule.dev</span>
              </div>
              <span className="badge badge-warning-subtle text-xs">
                UNPUBLISHED DRAFT
              </span>
            </div>

            <div className="browser-webpage-content">
              <div className="mock-pf-hero">
                <div className="mock-pf-avatar">C</div>
                <h2 className="mock-pf-name" id="pfPreviewName">
                  Candidate
                </h2>
                <p className="mock-pf-tagline" id="pfPreviewTitle">
                  Software Developer & UI Specialist
                </p>
                <p className="mock-pf-bio">
                  Passionate about crafting fast, accessible, and elegant web
                  interfaces with modern JavaScript and design systems.
                </p>
                <div className="mock-pf-links">
                  <span className="pf-link-pill">
                    <i className="fa-brands fa-github"></i> GitHub
                  </span>
                  <span className="pf-link-pill">
                    <i className="fa-brands fa-linkedin"></i> LinkedIn
                  </span>
                  <span className="pf-link-pill">
                    <i className="fa-solid fa-envelope"></i> Contact
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="portfolio-modal-footer">
            <div className="text-sm text-secondary">
              <i className="fa-solid fa-info-circle text-teal"></i> This draft
              is saved locally.
            </div>
            <button
              className="btn btn-primary"
              id="publishPortfolioBtn"
              data-locked="true"
              data-feature="Live Portfolio Web Publishing"
              data-desc="Publish your portfolio on custom domains with automated SSL and global CDN."
            >
              <i className="fa-solid fa-lock"></i> Publish Portfolio (Pro)
            </button>
          </div>
        </div>
      </div>

      {/* ==================== JOB PREVIEW MODAL (FREE JOB 1) ==================== */}
      <div
        className="modal-backdrop"
        id="jobPreviewModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jobModalTitle"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-job-preview">
          <button
            className="modal-close-btn"
            id="jobModalCloseBtn"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="job-preview-header">
            <div className="company-logo lg logo-technova">
              <i className="fa-solid fa-code"></i>
            </div>
            <div>
              <div className="d-flex align-center gap-2">
                <h3 className="modal-title" id="jobModalTitle">
                  Junior Front-End Developer
                </h3>
                <span className="badge badge-teal-subtle">Free Preview</span>
              </div>
              <p className="modal-subtitle">
                TechNova Solutions • Remote / India • Full-time
              </p>
            </div>
          </div>

          <div className="job-preview-body">
            <div className="job-match-callout">
              <div className="match-score-big">88%</div>
              <div>
                <strong>Great Match for Your Profile</strong>
                <p className="text-xs text-muted">
                  Your resume contains 5 of 6 required primary skills (HTML,
                  CSS, JavaScript, React, Git).
                </p>
              </div>
            </div>

            <div className="job-desc-section">
              <h4>About the Role</h4>
              <p>
                TechNova Solutions is seeking an enthusiastic Junior Front-End
                Developer to join our core product team.
              </p>
            </div>
          </div>

          <div className="job-preview-footer">
            <button className="btn btn-secondary-light" id="jobSaveToggleBtn">
              <i className="fa-regular fa-bookmark"></i>
              <span id="jobSaveBtnText">Save Job</span>
            </button>
            <button
              className="btn btn-primary"
              id="jobApplyDirectBtn"
              data-locked="true"
              data-feature="Direct Recruiter Fast-Track Application"
              data-desc="Skip applicant queues and submit your tailored resume directly to the TechNova hiring manager."
            >
              <i className="fa-solid fa-crown"></i> 1-Click Apply (Pro)
            </button>
          </div>
        </div>
      </div>

      {/* ==================== TOAST NOTIFICATION CONTAINER ==================== */}
      <div
        className="toast-container"
        id="toastContainer"
        aria-live="polite"
        aria-atomic="true"
      ></div>
    </div>
  );
}
