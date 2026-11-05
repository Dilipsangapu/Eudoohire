import { useEffect, useState } from "react";
import "./Paid_Dashboard.css";
import initPaidDashboard from "./PaidDashboardLogic";
import CandidateSubscriptionPage from "./CandidateSubscriptionPage";

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

// Keep the existing HTML-based dashboard markup separate from the React lifecycle.
const dashboardMarkup = `
<!-- Mobile Backdrop -->
    <div id="mobile-backdrop" class="mobile-backdrop" aria-hidden="true"></div>

    <!-- Floating Tooltip for Collapsed Sidebar (Exact Unpaid Dashboard Design) -->
    <div
      id="sidebar-floating-tooltip"
      class="sidebar-floating-tooltip"
      role="tooltip"
      style="display: none;"
    ></div>

    <!-- Main Application Container -->
    <div class="app-layout">
      <!-- ==================== FIXED LEFT SIDEBAR ==================== -->
      <aside id="sidebar" class="sidebar" aria-label="Main Navigation">
        <!-- Sidebar Header / Logo -->
        <div class="sidebar-header">
          <a
            href="/"
            class="sidebar-brand-link"
            id="sidebar-brand-link"
            title="Go to Home"
            aria-label="Go to Home Page"
            style="display: inline-flex; flex-direction: row; align-items: center; gap: 10px; text-decoration: none; color: #ffffff; cursor: pointer; flex-wrap: nowrap;"
          >
            <div class="logo-box" aria-hidden="true" style="flex-shrink: 0;">
              <svg
                class="logo-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div class="logo-text sidebar-brand-text" style="display: inline-flex; flex-direction: row; align-items: center; gap: 6px; flex-shrink: 0;">
              <span class="brand-title" style="text-decoration: none; color: #ffffff; white-space: nowrap;">HR Module</span>
              <!-- Crown icon - indicates Paid/Premium dashboard -->
              <svg
                class="paid-crown-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="#FFD700"
                stroke="#D4A800"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-label="Premium"
                title="Premium Plan"
              >
                <path d="M2 19h20M3 9l4 4 5-8 5 8 4-4-2 10H5L3 9z"/>
              </svg>
            </div>
          </a>
          <!-- Sidebar Collapse/Expand Arrow Button (Desktop) -->
          <button
            id="sidebar-collapse-btn"
            class="paid-sidebar-collapse-btn"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <svg id="sidebar-collapse-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <!-- Mobile Sidebar Close Button -->
          <button
            id="sidebar-close-btn"
            class="sidebar-close-btn"
            aria-label="Close sidebar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Navigation Section -->
        <div class="sidebar-menu-wrapper">
          <span class="sidebar-section-label">MENU</span>
          <nav class="sidebar-nav" id="sidebar-nav">
            <button
              class="nav-item active"
              data-nav="dashboard"
              id="nav-dashboard"
              data-tooltip="Dashboard"
            >
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span class="nav-label">Dashboard</span>
            </button>

            <button
              class="nav-item"
              data-nav="resume-templates"
              id="nav-templates"
              data-tooltip="Resume Templates"
            >
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                ></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span class="nav-label">Resume Templates</span>
            </button>

            <button class="nav-item" data-nav="ats-form" id="nav-ats" data-tooltip="ATS Form">
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 11l3 3L22 4"></path>
                <path
                  d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                ></path>
              </svg>
              <span class="nav-label">ATS Form</span>
            </button>

            <button class="nav-item" data-nav="portfolio" id="nav-portfolio" data-tooltip="Portfolio">
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span class="nav-label">Portfolio</span>
            </button>

            <button class="nav-item" data-nav="my-documents" id="nav-documents" data-tooltip="My Documents">
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                ></path>
              </svg>
              <span class="nav-label">My Documents</span>
            </button>

            <button class="nav-item" data-nav="job-matches" id="nav-jobs" data-tooltip="Job Matches">
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polygon
                  points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
                ></polygon>
              </svg>
              <span class="nav-label">Job Matches</span>
            </button>

            <button
              class="nav-item"
              data-nav="shortlisted"
              id="nav-shortlisted"
              data-tooltip="Shortlisted"
            >
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span class="nav-label">Shortlisted</span>
            </button>

            <button class="nav-item" data-nav="profile-views" id="nav-views" data-tooltip="Profile Views">
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span class="nav-label">Profile Views</span>
            </button>

            <button class="nav-item" data-nav="settings" id="nav-settings" data-tooltip="Settings">
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                ></path>
              </svg>
              <span class="nav-label">Settings</span>
            </button>

            <!-- Interested Jobs Nav Item in Left Sidebar after Settings -->
            <button class="nav-item" data-nav="interested-jobs" id="nav-interested-jobs" data-tooltip="Interested Jobs">
              <svg
                class="nav-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span class="nav-label">Interested Jobs</span>
            </button>
          </nav>
        </div>

        <!-- Profile Strength Card at Bottom of Sidebar -->
        <div class="sidebar-footer">
          <!-- Collapsed: circular strength badge (visible only when sidebar is collapsed, exact match to unpaid dashboard) -->
          <div
            class="profile-collapsed-badge"
            id="sidebar-profile-collapsed-badge"
            data-tooltip="Profile: 72% complete"
          >
            72%
          </div>
          <!-- Expanded: full strength card -->
          <div class="profile-strength-card" id="profile-strength-card">
            <div class="strength-card-header">
              <span class="strength-label">Profile Strength</span>
              <span class="strength-percentage" id="strength-percentage-text"
                >72%</span
              >
            </div>
            <div
              class="strength-progress-track"
              role="progressbar"
              aria-valuenow="72"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="strength-progress-fill"
                id="strength-progress-fill"
                style="width: 0%"
              ></div>
            </div>
            <p class="strength-hint" id="sidebar-strength-hint" style="cursor: pointer;" title="Click to add certifications in Settings">
              72% complete — add certifications to reach 100%
            </p>
          </div>
        </div>
      </aside>

      <!-- ==================== MAIN CONTENT AREA ==================== -->
      <div class="main-wrapper">
        <!-- Top Header -->
        <header class="top-header" id="top-header">
          <div class="header-left">
            <!-- Mobile Hamburger Toggle -->
            <button
              id="mobile-menu-toggle"
              class="mobile-menu-toggle"
              aria-label="Open sidebar menu"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <!-- Search Bar -->
            <div class="search-bar-wrapper">
              <svg
                class="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="global-search"
                class="search-input"
                placeholder="Search templates, resumes, portfolios..."
                autocomplete="off"
                aria-label="Search templates, resumes, portfolios"
              />
              <button
                id="search-clear-btn"
                class="search-clear-btn hidden"
                aria-label="Clear search input"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <div class="header-right">
            <!-- Notification Bell with Dropdown -->
            <div class="dropdown-wrapper">
              <button
                id="notification-btn"
                class="icon-button notification-trigger"
                aria-haspopup="true"
                aria-expanded="false"
                aria-label="Notifications"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span
                  class="notification-indicator"
                  id="notification-indicator"
                  aria-label="3 unread notifications"
                >3</span>
              </button>

              <!-- Notification Popover -->
              <div
                id="notification-dropdown"
                class="dropdown-panel notification-popover hidden"
                role="region"
                aria-label="Notifications panel"
              >
                <div class="popover-header">
                  <div class="popover-header-title">
                    <span class="title-text">Notifications</span>
                    <span class="badge-count" id="notif-count-badge"
                      >3 New</span
                    >
                  </div>
                  <button class="text-action-btn" id="mark-all-read-btn">
                    Mark all read
                  </button>
                </div>
                <ul class="notification-list" id="notification-list">
                </ul>
                <div class="popover-footer">
                  <button class="view-all-notifs-btn" id="view-all-notifs-btn">
                    View Notification History
                  </button>
                </div>
              </div>
            </div>

            <!-- User Profile Avatar & Dropdown -->
            <div class="dropdown-wrapper">
              <button
                id="profile-btn"
                class="profile-trigger-btn"
                aria-haspopup="true"
                aria-expanded="false"
                aria-label="User profile menu"
              >
                <div class="avatar-circle">
                  <span>C</span>
                </div>
                <div class="user-meta">
                  <span class="user-name">Candidate</span>
                  <span class="user-role">Software Developer</span>
                </div>
                <svg
                  class="chevron-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <!-- User Menu Popover -->
              <div
                id="profile-dropdown"
                class="dropdown-panel profile-popover hidden"
                role="region"
                aria-label="User account menu"
              >
                <div class="profile-card-header">
                  <div class="avatar-circle large">
                    <span>C</span>
                  </div>
                  <div class="profile-header-text">
                    <div class="profile-name-row">
                    <div class="profile-full-name">Candidate</div>
                    <span class="crown-badge-name" aria-label="Premium account">
                      <svg viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" width="17" height="12">
                        <path d="M1 12 L1 13.5 L19 13.5 L19 12 Z" fill="#F5C842" />
                        <path d="M0.5 4.5 L5 10 L10 1 L15 10 L19.5 4.5 L19 12 L1 12 Z" fill="#F5C842" stroke="#D4A520" stroke-width="0.7" stroke-linejoin="round" />
                        <circle cx="0.8" cy="4.5" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
                        <circle cx="10" cy="1" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
                        <circle cx="19.2" cy="4.5" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
                      </svg>
                    </span>
                  </div>
                    <div class="profile-email"></div>
                    <span class="profile-plan-pill">PREMIUM DEVELOPER ★</span>
                  </div>
                </div>
                <div class="profile-menu-links">
                  <button
                    class="profile-menu-item"
                    data-action="settings"
                    id="menu-btn-settings"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="3"></circle>
                      <path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                      ></path>
                    </svg>
                    <span>Account Settings</span>
                  </button>

                  <button
                    class="profile-menu-item"
                    data-action="plan"
                    id="menu-btn-plan"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      ></polygon>
                    </svg>
                    <span>Plan &amp; Upgrade</span>
                  </button>

                  <button
                    class="profile-menu-item"
                    data-action="shortlisted"
                    id="menu-btn-shortlist"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>Recruiter Shortlists (4)</span>
                  </button>

                  <button
                    class="profile-menu-item"
                    data-action="views"
                    id="menu-btn-views"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      ></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>Who Viewed Profile (48)</span>
                  </button>
                </div>
                <div class="profile-popover-divider"></div>
                <button class="profile-sign-out-btn" id="sign-out-btn">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Dashboard Inner Content -->
        <main class="dashboard-content" id="dashboard-content">
          <!-- ==================== 1. WELCOME SECTION ==================== -->
          <section
            class="welcome-section fade-in-up"
            aria-labelledby="welcome-heading"
          >
            <div class="welcome-text-group">
              <h1 id="welcome-heading" class="welcome-heading">
                ${getTimeBasedGreeting()}, Candidate
                <span class="welcome-crown" aria-label="Premium account">
                  <svg viewBox="0 0 20 14" width="25" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 12 L1 13.5 L19 13.5 L19 12 Z" fill="#F5C842" />
                    <path d="M0.5 4.5 L5 10 L10 1 L15 10 L19.5 4.5 L19 12 L1 12 Z" fill="#F5C842" stroke="#D4A520" stroke-width="0.7" stroke-linejoin="round" />
                    <circle cx="0.8" cy="4.5" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
                    <circle cx="10" cy="1" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
                    <circle cx="19.2" cy="4.5" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
                  </svg>
                </span>
              </h1>
              <p class="welcome-subtitle">
                What would you like to build today? Pick a tool below to get
                started.
              </p>
            </div>

            <!-- Resume Count History Component (Upper-Right Header) -->
            <div class="resume-count-history-card" id="resume-count-history-card">
              <div class="rch-header">
                <div class="rch-title-wrap">
                  <div class="rch-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                  </div>
                  <span class="rch-title">Resume History</span>
                </div>
                <button type="button" class="rch-history-btn" id="rch-view-history-btn" title="View detailed resume count and history">
                  <span>View History</span>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
              <div class="rch-stats-row">
                <div class="rch-stat-col">
                  <span class="rch-stat-label">Total</span>
                  <span class="rch-stat-num" id="rch-total-count">0</span>
                </div>
                <div class="rch-stat-divider" aria-hidden="true"></div>
                <div class="rch-stat-col">
                  <span class="rch-stat-label">Created</span>
                  <span class="rch-stat-num" id="rch-created-count">0</span>
                </div>
                <div class="rch-stat-divider" aria-hidden="true"></div>
                <div class="rch-stat-col">
                  <span class="rch-stat-label">Uploaded</span>
                  <span class="rch-stat-num" id="rch-uploaded-count">0</span>
                </div>
              </div>
              <div class="rch-footer">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span class="rch-updated-text">Last Updated: <strong id="rch-last-updated">None</strong></span>
              </div>
            </div>
          </section>

          <!-- ==================== PREMIUM PLAN BANNER ==================== -->
          <div
            class="premium-plan-banner"
            id="premium-plan-banner"
            role="banner"
            aria-label="Premium plan status"
          >
            <div class="premium-banner-left">
              <div class="premium-banner-icon" aria-hidden="true"></div>
              <div class="premium-banner-text">
                <div class="premium-banner-title">
                  You're on <strong>Premium Pro</strong> — Your profile is
                  ranked first to recruiters!
                </div>
                <div class="premium-banner-subtitle">
                  Unlimited ATS resumes &bull; Priority recruiter placement
                  &bull; Direct InMail &bull; Portfolio hosting &bull; Profile
                  view alerts
                </div>
              </div>
            </div>
            <div class="premium-banner-right">
              <div class="premium-feature-chips">
                <span class="premium-chip">✦ Unlimited Resumes</span>
                <span class="premium-chip">✦ ATS Optimizer</span>
                <span class="premium-chip">✦ Top Recruiter Rank</span>
                <span class="premium-chip">✦ InMail Unlocked</span>
              </div>
              <div class="premium-banner-renew">
                One-time registration fee — no renewals
              </div>
            </div>
          </div>

          <!-- ==================== 2. QUICK ACTION CARDS ==================== -->
          <section
            class="quick-actions-section"
            aria-label="Quick action builder tools"
          >
            <div class="quick-actions-grid">
              <!-- Quick Action Card 1: Resume Templates -->
              <article
                class="action-card fade-in-up delay-1"
                id="card-resume-templates"
              >
                <div class="action-preview-box">
                  <!-- Document Illustration for Resume Templates -->
                  <div class="doc-mockup resume-doc-mockup" aria-hidden="true">
                    <div class="doc-header-strip teal-strip"></div>
                    <div class="doc-body-content">
                      <div class="mockup-row top-row">
                        <div class="mockup-avatar-dot"></div>
                        <div class="mockup-col">
                          <div class="mockup-line w-75 bold-line"></div>
                          <div class="mockup-line w-45 sub-line"></div>
                        </div>
                      </div>
                      <div class="mockup-divider"></div>
                      <div class="mockup-row columns-2">
                        <div class="mockup-col-left">
                          <div class="mockup-line w-90"></div>
                          <div class="mockup-line w-80"></div>
                          <div class="mockup-line w-60"></div>
                        </div>
                        <div class="mockup-col-right">
                          <div class="mockup-pill-tag"></div>
                          <div class="mockup-line w-70"></div>
                          <div class="mockup-line w-50"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="action-card-details">
                  <h2 class="action-card-title">Resume Templates</h2>
                  <p class="action-card-desc">
                    Choose from 40+ designer-made layouts and build your resume
                    in minutes.
                  </p>
                  <button
                    class="action-card-btn"
                    data-action="browse-templates"
                    id="btn-browse-templates"
                  >
                    <span>Browse Templates</span>
                    <span class="btn-arrow">&rarr;</span>
                  </button>
                </div>
              </article>

              <!-- Quick Action Card 2: ATS Form -->
              <article
                class="action-card fade-in-up delay-2"
                id="card-ats-form"
              >
                <div class="action-preview-box">
                  <!-- Document Illustration for ATS Form -->
                  <div class="doc-mockup ats-doc-mockup" aria-hidden="true">
                    <div class="ats-scan-beam" aria-hidden="true"></div>
                    <div class="ats-mockup-header">
                      <div class="ats-mockup-badge">
                        <span class="ats-badge-dot"></span>
                        <span class="ats-badge-text">ATS MATCH 98%</span>
                      </div>
                    </div>
                    <div class="doc-body-content compact">
                      <div class="ats-form-item">
                        <div class="ats-check-box checked">
                          <svg
                            viewBox="0 0 12 12"
                            width="9"
                            height="9"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="2 6 5 9 10 3"></polyline>
                          </svg>
                        </div>
                        <div class="mockup-line w-85 accent-teal-line"></div>
                      </div>
                      <div class="ats-form-item">
                        <div class="ats-check-box checked">
                          <svg
                            viewBox="0 0 12 12"
                            width="9"
                            height="9"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="2 6 5 9 10 3"></polyline>
                          </svg>
                        </div>
                        <div class="mockup-line w-70"></div>
                      </div>
                      <div class="ats-form-item">
                        <div class="ats-check-box"></div>
                        <div class="mockup-line w-90"></div>
                      </div>
                      <div class="ats-form-item">
                        <div class="ats-check-box"></div>
                        <div class="mockup-line w-60"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="action-card-details">
                  <h2 class="action-card-title">ATS Form</h2>
                  <p class="action-card-desc">
                    Fill a guided form and get an ATS-optimized resume with a
                    live score.
                  </p>
                  <button
                    class="action-card-btn"
                    data-action="build-ats-form"
                    id="btn-build-ats-form"
                  >
                    <span>Build ATS Form</span>
                    <span class="btn-arrow">&rarr;</span>
                  </button>
                </div>
              </article>

              <!-- Quick Action Card 3: Portfolio -->
              <article
                class="action-card fade-in-up delay-3"
                id="card-portfolio"
              >
                <div class="action-preview-box">
                  <!-- Portfolio Webpage Preview Illustration -->
                  <div class="doc-mockup portfolio-mockup" aria-hidden="true">
                    <div class="browser-bar">
                      <div class="traffic-dot red"></div>
                      <div class="traffic-dot yellow"></div>
                      <div class="traffic-dot green"></div>
                      <div class="browser-url-pill"></div>
                    </div>
                    <div class="portfolio-screen">
                      <div class="portfolio-hero">
                        <div class="portfolio-avatar"></div>
                        <div class="mockup-line w-60 hero-line"></div>
                      </div>
                      <div class="portfolio-cards-row">
                        <div class="portfolio-mini-card"></div>
                        <div class="portfolio-mini-card"></div>
                        <div class="portfolio-mini-card accent"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="action-card-details">
                  <h2 class="action-card-title">Portfolio</h2>
                  <p class="action-card-desc">
                    Turn your work into a shareable portfolio site with one
                    click.
                  </p>
                  <button
                    class="action-card-btn"
                    data-action="create-portfolio"
                    id="btn-create-portfolio"
                  >
                    <span>Create Portfolio</span>
                    <span class="btn-arrow">&rarr;</span>
                  </button>
                </div>
              </article>
            </div>
          </section>

          <!-- ==================== 3. DASHBOARD STATISTICS ==================== -->
          <section class="stats-section" aria-label="Dashboard Metrics">
            <div class="stats-grid">
              <!-- Stat 1: Resumes Created -->
              <div class="stat-card fade-in-up delay-2">
                <div class="stat-card-header">
                  <span class="stat-label">Resumes Created</span>
                  <div class="stat-icon-wrapper">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      ></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                </div>
                <div class="stat-value counter-value" id="stat-resumes-created" data-count="0">0</div>
                <div class="stat-meta">
                  <span class="trend-indicator neutral">
                    Active saved versions
                  </span>
                </div>
              </div>

              <!-- Stat 2: Average ATS Score -->
              <div class="stat-card fade-in-up delay-3">
                <div class="stat-card-header">
                  <span class="stat-label">Average ATS Score</span>
                  <div class="stat-icon-wrapper">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div
                  class="stat-value counter-value"
                  id="statAvgAtsScore"
                  data-count="0"
                  data-suffix="%"
                >
                  0%
                </div>
                <div class="stat-meta">
                  <span class="trend-indicator neutral" id="avgAtsTrend">
                    Live scan average
                  </span>
                </div>
              </div>

              <!-- Stat 3: Portfolio Views -->
              <div class="stat-card fade-in-up delay-4">
                <div class="stat-card-header">
                  <span class="stat-label">Portfolio Views</span>
                  <div class="stat-icon-wrapper">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      ></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </div>
                </div>
                <div
                  class="stat-value counter-value"
                  id="stat-portfolio-views"
                  data-count="0"
                  data-format="comma"
                >
                  0
                </div>
                <div class="stat-meta">
                  <span class="trend-indicator neutral">
                    Recruiter profile visits
                  </span>
                </div>
              </div>

              <!-- Stat 4: Applications Sent -->
              <div class="stat-card fade-in-up delay-5">
                <div class="stat-card-header">
                  <span class="stat-label">Applications Sent</span>
                  <div class="stat-icon-wrapper">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </div>
                </div>
                <div class="stat-value counter-value" id="stat-applications-sent" data-count="0">0</div>
                <div class="stat-meta">
                  <span class="status-pill-info">
                    <span class="pulse-indicator"></span>
                    <span id="stat-in-review-count">Live applications</span>
                  </span>
                </div>
              </div>
            </div>
          </section>
          <!-- ==================== 4. RESUME TEMPLATES SECTION ==================== -->
          <section
            class="templates-section fade-in-up delay-4"
            id="section-templates"
            aria-labelledby="templates-heading"
          >
            <div class="section-header-bar">
              <div class="section-header-titles">
                <h2 id="templates-heading" class="section-title">
                  Resume Templates
                </h2>
                <p class="section-subtitle">
                  Pick a layout, then customize it with your details.
                </p>
              </div>

              <!-- Category Filter Chips -->
              <div
                class="filter-chips-group"
                role="tablist"
                aria-label="Filter templates by category"
              >
                <button
                  class="filter-chip active"
                  data-filter="all"
                  role="tab"
                  aria-selected="true"
                >
                  All
                </button>
                <button
                  class="filter-chip"
                  data-filter="modern"
                  role="tab"
                  aria-selected="false"
                >
                  Modern
                </button>
                <button
                  class="filter-chip"
                  data-filter="minimal"
                  role="tab"
                  aria-selected="false"
                >
                  Minimal
                </button>
                <button
                  class="filter-chip"
                  data-filter="creative"
                  role="tab"
                  aria-selected="false"
                >
                  Creative
                </button>
                <button
                  class="filter-chip"
                  data-filter="ats-friendly"
                  role="tab"
                  aria-selected="false"
                >
                  ATS-friendly
                </button>
              </div>
            </div>

            <!-- Templates Grid (4 Cards) -->
            <div class="templates-grid" id="templates-grid">
              <!-- Template 1: Aurora (Modern, ATS-friendly) -->
              <article
                class="template-card"
                data-name="Aurora"
                data-categories="modern ats-friendly"
                data-tags="popular modern ats-friendly"
              >
                <div class="template-preview-area">
                  <span class="template-badge popular-badge">Popular</span>

                  <!-- Distinct Layout 1: Aurora (Modern with Teal Accent Lines) -->
                  <div class="mini-resume aurora-layout" aria-hidden="true">
                    <div class="aurora-header">
                      <div class="aurora-teal-bar"></div>
                      <div class="aurora-title-line"></div>
                      <div class="aurora-subtitle-line"></div>
                    </div>
                    <div class="aurora-body">
                      <div class="aurora-left-col">
                        <div class="aurora-section-tag"></div>
                        <div class="aurora-line-long"></div>
                        <div class="aurora-line-med"></div>
                        <div class="aurora-line-short"></div>
                        <div class="aurora-section-tag mt-6"></div>
                        <div class="aurora-line-long"></div>
                        <div class="aurora-line-med"></div>
                      </div>
                      <div class="aurora-right-col">
                        <div class="aurora-chip"></div>
                        <div class="aurora-chip"></div>
                        <div class="aurora-line-short"></div>
                        <div class="aurora-pill-accent"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="template-card-footer">
                  <div class="template-info">
                    <h3 class="template-name">Aurora</h3>
                    <span class="template-meta-desc"
                      >Modern &bull; ATS-friendly</span
                    >
                  </div>
                  <button
                    class="btn-use-template"
                    data-template-name="Aurora"
                    aria-label="Use Aurora template"
                  >
                    Use
                  </button>
                </div>
              </article>

              <!-- Template 2: Slate (Minimal, Free) -->
              <article
                class="template-card"
                data-name="Slate"
                data-categories="minimal"
                data-tags="minimal free"
              >
                <div class="template-preview-area">
                  <!-- Distinct Layout 2: Slate (Minimal Monochrome Layout) -->
                  <div class="mini-resume slate-layout" aria-hidden="true">
                    <div class="slate-header">
                      <div class="slate-bold-name"></div>
                      <div class="slate-role-line"></div>
                      <div class="slate-hr"></div>
                    </div>
                    <div class="slate-body">
                      <div class="slate-heading-label"></div>
                      <div class="slate-text-block">
                        <div class="slate-line-100"></div>
                        <div class="slate-line-90"></div>
                        <div class="slate-line-75"></div>
                      </div>
                      <div class="slate-heading-label mt-5"></div>
                      <div class="slate-text-block">
                        <div class="slate-line-100"></div>
                        <div class="slate-line-80"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="template-card-footer">
                  <div class="template-info">
                    <h3 class="template-name">Slate</h3>
                    <span class="template-meta-desc">Minimal &bull; Free</span>
                  </div>
                  <button
                    class="btn-use-template"
                    data-template-name="Slate"
                    aria-label="Use Slate template"
                  >
                    Use
                  </button>
                </div>
              </article>

              <!-- Template 3: Indigo Side (Creative, Pro) -->
              <article
                class="template-card"
                data-name="Indigo Side"
                data-categories="creative"
                data-tags="creative pro new"
              >
                <div class="template-preview-area">
                  <span class="template-badge new-badge">New</span>

                  <!-- Distinct Layout 3: Indigo Side (Teal Vertical Sidebar with Profile Circle) -->
                  <div class="mini-resume indigo-layout" aria-hidden="true">
                    <div class="indigo-sidebar">
                      <div class="indigo-avatar-circle"></div>
                      <div class="indigo-side-line"></div>
                      <div class="indigo-side-line short"></div>
                      <div class="indigo-side-divider"></div>
                      <div class="indigo-side-dot-group">
                        <div class="indigo-dot"></div>
                        <div class="indigo-dot"></div>
                        <div class="indigo-dot"></div>
                      </div>
                    </div>
                    <div class="indigo-main-content">
                      <div class="indigo-top-title"></div>
                      <div class="indigo-top-sub"></div>
                      <div class="indigo-body-lines">
                        <div class="indigo-main-line full"></div>
                        <div class="indigo-main-line med"></div>
                        <div class="indigo-main-line short"></div>
                        <div class="indigo-block mt-4">
                          <div class="indigo-main-line full"></div>
                          <div class="indigo-main-line med"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="template-card-footer">
                  <div class="template-info">
                    <h3 class="template-name">Indigo Side</h3>
                    <span class="template-meta-desc">Creative &bull; Pro</span>
                  </div>
                  <button
                    class="btn-use-template"
                    data-template-name="Indigo Side"
                    aria-label="Use Indigo Side template"
                  >
                    Use
                  </button>
                </div>
              </article>

              <!-- Template 4: Classic (Traditional, ATS-friendly) -->
              <article
                class="template-card"
                data-name="Classic"
                data-categories="ats-friendly"
                data-tags="traditional ats-friendly"
              >
                <div class="template-preview-area">
                  <!-- Distinct Layout 4: Classic (Traditional Single-Column Resume) -->
                  <div class="mini-resume classic-layout" aria-hidden="true">
                    <div class="classic-header">
                      <div class="classic-center-name"></div>
                      <div class="classic-center-contact"></div>
                      <div class="classic-divider-line"></div>
                    </div>
                    <div class="classic-body">
                      <div class="classic-sec-title"></div>
                      <div class="classic-bullet-row">
                        <div class="classic-bullet-point"></div>
                        <div class="classic-line-text full"></div>
                      </div>
                      <div class="classic-bullet-row">
                        <div class="classic-bullet-point"></div>
                        <div class="classic-line-text med"></div>
                      </div>
                      <div class="classic-sec-title mt-4"></div>
                      <div class="classic-bullet-row">
                        <div class="classic-bullet-point"></div>
                        <div class="classic-line-text full"></div>
                      </div>
                      <div class="classic-bullet-row">
                        <div class="classic-bullet-point"></div>
                        <div class="classic-line-text short"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="template-card-footer">
                  <div class="template-info">
                    <h3 class="template-name">Classic</h3>
                    <span class="template-meta-desc"
                      >Traditional &bull; ATS-friendly</span
                    >
                  </div>
                  <button
                    class="btn-use-template"
                    data-template-name="Classic"
                    aria-label="Use Classic template"
                  >
                    Use
                  </button>
                </div>
              </article>
            </div>

            

            <!-- Empty State for Templates Filtering -->
            <div id="templates-empty-state" class="empty-state-box hidden">
              <svg
                viewBox="0 0 24 24"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
              <p class="empty-title">No templates found</p>
              <p class="empty-desc">
                Try clearing your search term or selecting a different category
                filter chip.
              </p>
              <button class="reset-filter-btn" id="reset-templates-filter-btn">
                Reset All Filters
              </button>
            </div>
          </section>
          <!-- ==================== A. RESUME MANAGEMENT HUB ==================== -->
          <section
            class="resume-hub-section fade-in-up delay-3"
            id="section-resume"
            aria-labelledby="resume-hub-heading"
          >
            <div class="section-header-bar">
              <div class="section-header-titles">
                <div class="header-badge-row">
                  <h2 id="resume-hub-heading" class="section-title">
                    Resume Management
                  </h2>
                  <span class="active-pulse-badge">
                    <span class="pulse-indicator"></span> Active Primary Resume
                  </span>
                </div>
              </div>
              <div class="header-actions-group">
                <button
                  class="btn-secondary-outline"
                  id="btn-preview-resume"
                  type="button"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    ></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>Preview Resume</span>
                </button>
              </div>
            </div>

            <div class="resume-hub-grid">
              <!-- Active Resume Showcase Card -->
              <div class="resume-active-card">
                <!-- Card Main Body -->
                <div class="resume-card-body">
                  <!-- Left: File Identity & Meta -->
                  <div class="resume-file-identity">
                    <div class="resume-file-icon-box">
                      <svg
                        viewBox="0 0 24 24"
                        width="26"
                        height="26"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                        ></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div class="resume-file-meta">
                      <div class="file-title-row">
                        <h3 class="resume-filename" id="active-resume-name">
                          Active_Resume.pdf
                        </h3>
                        <span
                          class="status-pill-success"
                          id="active-resume-status"
                        >
                          <span class="status-pulse-dot"></span>
                          Active &amp; Ready
                        </span>
                      </div>
                      <p class="resume-file-subtext" id="active-resume-details">
                        PDF Document &bull; 248 KB &bull; Last updated
                        <span id="active-resume-updated">Today, 10:30 AM</span>
                      </p>
                      <p class="resume-primary-note">
                        <svg
                          viewBox="0 0 16 16"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="13 4 6 11 3 8"></polyline>
                        </svg>
                        Default resume for 1-Click job applications &amp;
                        recruiter search
                      </p>
                    </div>
                  </div>

                  <!-- Right: ATS Performance Score & Quality Card -->
                  <div class="resume-ats-overview">
                    <div class="ats-score-badge-circle">
                      <span class="ats-circle-value" id="active-ats-score"
                        >--</span
                      >
                      <span class="ats-circle-label">ATS Score</span>
                    </div>
                    <div class="ats-breakdown-bars">
                      <div class="breakdown-item">
                        <div class="breakdown-label-row">
                          <span>Keyword Optimization</span>
                          <strong id="ats-keyword-val">92%</strong>
                        </div>
                        <div class="breakdown-track">
                          <div
                            class="breakdown-fill"
                            id="ats-keyword-bar"
                            style="width: 92%"
                          ></div>
                        </div>
                      </div>
                      <div class="breakdown-item">
                        <div class="breakdown-label-row">
                          <span>Formatting &amp; Structure</span>
                          <strong id="ats-format-val">98%</strong>
                        </div>
                        <div class="breakdown-track">
                          <div
                            class="breakdown-fill accent-green"
                            id="ats-format-bar"
                            style="width: 98%"
                          ></div>
                        </div>
                      </div>
                      <div class="breakdown-item">
                        <div class="breakdown-label-row">
                          <span>Contact &amp; Portfolio Links</span>
                          <strong id="ats-contact-val">100%</strong>
                        </div>
                        <div class="breakdown-track">
                          <div
                            class="breakdown-fill accent-teal"
                            id="ats-contact-bar"
                            style="width: 100%"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Card Bottom Footer Strip: Actions Toolbar -->
                <div class="resume-card-footer">
                  <div class="resume-footer-status">
                    <span class="sync-indicator-dot"></span>
                    <span
                      >Synced with ATS parser &amp; verified for applicant
                      tracking systems</span
                    >
                  </div>
                  <div class="resume-actions-toolbar">
                    <button
                      class="resume-action-btn primary"
                      id="btn-upload-resume"
                      type="button"
                      title="Upload a new resume file"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                        ></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span>Upload Resume</span>
                    </button>

                    <button
                      class="resume-action-btn secondary"
                      id="btn-replace-resume"
                      type="button"
                      title="Replace current active resume with a newer version"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path
                          d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                        ></path>
                      </svg>
                      <span>Replace Resume</span>
                    </button>

                    <button
                      class="resume-action-btn secondary"
                      id="btn-download-resume-card"
                      type="button"
                      title="Download active resume PDF"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                        ></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <!-- Hidden Real File Input -->
                <input
                  type="file"
                  id="resume-file-input"
                  accept=".pdf,.docx,.doc"
                  class="hidden"
                  style="display: none"
                />
              </div>
            </div>

            <!-- Resume Version History Table (styled like Recent Documents from Image 1) -->
            <div
              class="card-container docs-card-container resume-version-history-card"
            >
              <div class="docs-header">
                <div class="docs-title-group">
                  <h3 class="docs-heading">Resume Version History</h3>
                  <span class="docs-count-pill" id="version-count-pill"
                    >3 items</span
                  >
                </div>
                <span class="docs-sync-text">
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path
                      d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                    ></path>
                  </svg>
                  Cloud Synced
                </span>
              </div>

              <!-- Responsive Table Container matching Image 1 -->
              <div class="table-responsive-wrapper">
                <table class="documents-table" id="resume-version-table">
                  <thead>
                    <tr>
                      <th scope="col" class="th-name">NAME</th>
                      <th scope="col" class="th-type">TYPE</th>
                      <th scope="col" class="th-score">ATS SCORE</th>
                      <th scope="col" class="th-edited">LAST EDITED</th>
                      <th scope="col" class="th-action text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody id="resume-version-tbody">
                    <!-- Populated dynamically via script.js -->
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- ==================== B. JOB OPENINGS & SMART MATCHES ==================== -->
          <section
            class="jobs-section fade-in-up delay-4"
            id="section-jobs"
            aria-labelledby="jobs-heading"
          >
            <div class="section-header-bar">
              <div class="section-header-titles">
                <div class="header-badge-row">
                  <h2 id="jobs-heading" class="section-title">
                    Job Openings &amp; Smart Matches
                  </h2>
                  <span class="status-pill-info" id="jobs-total-count-badge"
                    >8 Open Roles</span
                  >
                </div>
              </div>
              <div class="jobs-header-stats">
                <button
                  class="btn-filter-interested"
                  id="btn-filter-interested-toggle"
                  type="button"
                  title="Show only jobs you marked as interested"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polygon
                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    ></polygon>
                  </svg>
                  <span
                    >Interested (<span id="interested-count-num">0</span>)</span
                  >
                </button>
              </div>
            </div>

            <!-- Filter & Sort Control Bar -->
            <div class="jobs-filter-panel">
              <div class="jobs-filter-grid">
                <!-- 1. Search by Title -->
                <div class="filter-group filter-search-group">
                  <label for="job-title-search" class="filter-label"
                    >Job Title / Role</label
                  >
                  <div class="filter-input-wrap">
                    <svg
                      class="filter-icon"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      type="text"
                      id="job-title-search"
                      class="filter-input"
                      placeholder="e.g. Frontend, Architect, Cloud..."
                    />
                  </div>
                </div>

                <!-- 2. Filter by Tech Stack -->
                <div class="filter-group">
                  <label for="job-tech-filter" class="filter-label"
                    >Tech Stack</label
                  >
                  <select id="job-tech-filter" class="filter-select">
                    <option value="all">All Tech Stacks</option>
                    <option value="react">React</option>
                    <option value="typescript">TypeScript</option>
                    <option value="node">Node.js</option>
                    <option value="python">Python</option>
                    <option value="next.js">Next.js</option>
                    <option value="vue">Vue.js</option>
                    <option value="aws">AWS / Cloud</option>
                    <option value="go">Go</option>
                    <option value="tailwind">Tailwind CSS</option>
                    <option value="figma">Figma / UI-UX</option>
                  </select>
                </div>

                <!-- 3. Filter by Location -->
                <div class="filter-group">
                  <label for="job-location-filter" class="filter-label"
                    >Location</label
                  >
                  <select id="job-location-filter" class="filter-select">
                    <option value="all">All Locations</option>
                    <option value="san francisco">San Francisco, USA</option>
                    <option value="bangalore">Bangalore, India</option>
                    <option value="new york">New York, USA</option>
                    <option value="london">London, UK</option>
                    <option value="berlin">Berlin, Germany</option>
                    <option value="remote">Remote Worldwide</option>
                  </select>
                </div>

                <!-- 4. Filter by Work Mode -->
                <div class="filter-group">
                  <label for="job-workmode-filter" class="filter-label"
                    >Work Mode</label
                  >
                  <select id="job-workmode-filter" class="filter-select">
                    <option value="all">All Work Modes</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="on-site">On-site</option>
                  </select>
                </div>

                <!-- 5. Sort By Option -->
                <div class="filter-group filter-sort-group">
                  <label for="job-sort-select" class="filter-label"
                    >Sort By</label
                  >
                  <select
                    id="job-sort-select"
                    class="filter-select sort-select"
                  >
                    <option value="match-desc">Highest Match %</option>
                    <option value="title-asc">Job Title (A &rarr; Z)</option>
                    <option value="title-desc">Job Title (Z &rarr; A)</option>
                    <option value="recent">Most Recent</option>
                    <option value="salary-desc">Highest Salary</option>
                  </select>
                </div>
              </div>

              <!-- Recommended Job Titles Chips (Single Horizontal Line) -->
              <div class="recommended-titles-wrap" id="recommended-titles-wrap">
                <span class="recommended-titles-label">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  Recommended:
                </span>
                <div class="recommended-chips-list" id="recommended-chips-list">
                  <button type="button" class="role-chip" data-title="Frontend">Frontend Architect</button>
                  <button type="button" class="role-chip" data-title="Full Stack">Full Stack</button>
                  <button type="button" class="role-chip" data-title="UI/UX">UI/UX Designer</button>
                  <button type="button" class="role-chip" data-title="DevOps">Cloud &amp; DevOps</button>
                  <button type="button" class="role-chip" data-title="AI Applications">AI Engineer</button>
                  <button type="button" class="role-chip" data-title="Backend">Backend Developer</button>
                </div>
              </div>

              <!-- Active Filters Bar -->
              <div class="active-filter-tags-row">
                <div class="active-tags-list" id="job-active-tags-list">
                  <!-- Generated via script.js -->
                </div>
                <button
                  class="btn-clear-job-filters hidden"
                  id="btn-clear-job-filters"
                  type="button"
                >
                  Reset All Job Filters
                </button>
              </div>
            </div>

            <!-- Job Cards Carousel Container -->
            <div class="jobs-carousel-wrapper" id="jobs-carousel-wrapper">
              <div class="jobs-carousel-viewport-wrapper">
                <button
                  class="jobs-carousel-arrow-btn prev-arrow"
                  id="jobs-carousel-prev-arrow"
                  type="button"
                  aria-label="Previous jobs slide"
                  title="Previous slide"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>

                <div class="jobs-carousel-viewport" id="jobs-carousel-viewport">
                  <div class="jobs-cards-grid jobs-carousel-track" id="jobs-cards-grid">
                    <!-- Dynamically populated via script.js -->
                  </div>
                </div>

                <button
                  class="jobs-carousel-arrow-btn next-arrow"
                  id="jobs-carousel-next-arrow"
                  type="button"
                  aria-label="Next jobs slide"
                  title="Next slide"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Jobs Empty State -->
            <div id="jobs-empty-state" class="empty-state-box hidden">
              <svg
                viewBox="0 0 24 24"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p class="empty-title">No matching job openings found</p>
              <p class="empty-desc">
                Try adjusting your search keywords, tech stack, location, or
                work mode filter.
              </p>
              <button
                class="reset-filter-btn"
                id="btn-empty-reset-jobs"
                type="button"
              >
                Reset All Filters
              </button>
            </div>
          </section>

          <!-- ==================== C. PORTFOLIO STUDIO ==================== -->

          

          <!-- ==================== D. RECRUITER SHORTLISTS ==================== -->
          <section
            class="shortlisted-section fade-in-up delay-4"
            id="section-shortlisted-jobs"
            aria-labelledby="shortlisted-heading"
          >
            <div class="section-header-bar">
              <div class="section-header-titles">
                <div class="header-badge-row">
                  <h2 id="shortlisted-heading" class="section-title">
                    Recruiter Shortlists &amp; Interviews
                  </h2>
                  <span class="active-pulse-badge" id="shortlist-count-badge">
                    <span class="pulse-indicator"></span> Loading shortlists…
                  </span>
                </div>
                <p class="section-subtitle">
                  Opportunities where recruiters reviewed your profile and moved
                  your application forward in the hiring pipeline.
                </p>
              </div>

              <!-- Stage Filter Chips -->
              <div
                class="filter-chips-group"
                role="tablist"
                aria-label="Filter shortlisted stages"
                id="shortlist-filter-chips"
              >
                <button
                  class="filter-chip active"
                  data-stage="all"
                  role="tab"
                  aria-selected="true"
                >
                  All
                </button>
                <button
                  class="filter-chip"
                  data-stage="SHORTLISTED"
                  role="tab"
                  aria-selected="false"
                >
                  Shortlisted
                </button>
                <button
                  class="filter-chip"
                  data-stage="HIRE_REQUESTED"
                  role="tab"
                  aria-selected="false"
                >
                  Hire Requested
                </button>
                <button
                  class="filter-chip"
                  data-stage="hired"
                  role="tab"
                  aria-selected="false"
                >
                  Released / Hired
                </button>
              </div>
            </div>

            <!-- Shortlisted Cards Grid Container -->
            <div class="shortlisted-cards-grid" id="shortlisted-cards-grid">
              <!-- Dynamically rendered via script.js -->
            </div>
          </section>

          <!-- ==================== E. RECRUITER PROFILE VIEWS ==================== -->
          <section
            class="profile-views-section fade-in-up delay-4"
            id="section-profile-views"
            aria-labelledby="views-heading"
          >
            <div class="section-header-bar">
              <div class="section-header-titles">
                <div class="header-badge-row">
                  <h2 id="views-heading" class="section-title">
                    Who Viewed Your Profile
                  </h2>
                  <span class="status-pill-info" id="views-impressions-badge">
                    <span class="pulse-indicator"></span> Loading impressions…
                  </span>
                </div>
                <p class="section-subtitle">
                  Real-time record of tech recruiters and companies that
                  inspected your ATS resume, GitHub repos, and portfolio
                  showcase.
                </p>
              </div>

              <!-- Quick Search Input for views -->
              <div class="views-search-box">
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  id="views-search-input"
                  class="views-search-input"
                  placeholder="Filter by recruiter or company name..."
                />
              </div>
            </div>

            <!-- Views KPI Metric Strip -->
            <div class="views-kpi-bar">
              <div class="views-kpi-item">
                <span class="kpi-num counter-value" id="kpi-impressions" data-count="0">0</span>
                <span class="kpi-label">Recruiter Impressions</span>
              </div>
              <div class="views-kpi-divider"></div>
              <div class="views-kpi-item">
                <span class="kpi-num counter-value" id="kpi-companies" data-count="0">0</span>
                <span class="kpi-label">Companies That Engaged You</span>
              </div>
              <div class="views-kpi-divider"></div>
              <div class="views-kpi-item">
                <span class="kpi-num counter-value" id="kpi-resume-downloads" data-count="0">0</span>
                <span class="kpi-label">Resume PDFs Downloaded</span>
              </div>
              <div class="views-kpi-divider"></div>
              <div class="views-kpi-item">
                <span class="kpi-num counter-value" id="kpi-interview-pipeline" data-count="0">0</span>
                <span class="kpi-label">Added to Interview Pipeline</span>
              </div>
            </div>

            <!-- Profile Views Card Container -->
            <div
              class="card-container docs-card-container views-card-container"
            >
              <div class="docs-header">
                <div class="docs-title-group">
                  <h3 class="docs-heading">Recruiter Activity Log</h3>
                  <span class="docs-count-pill" id="views-count-pill"
                    >Loading…</span
                  >
                </div>
                <span class="docs-sync-text">
                  <span class="status-dot" style="background: #10b981"></span>
                  Live Activity Tracking
                </span>
              </div>

              <div class="table-responsive-wrapper">
                <table class="documents-table" id="views-table">
                  <thead>
                    <tr>
                      <th scope="col">RECRUITER &amp; COMPANY</th>
                      <th scope="col">ACTION TAKEN</th>
                      <th scope="col">DISCOVERY SOURCE</th>
                      <th scope="col">TIMESTAMP</th>
                      <th scope="col" class="text-right">ENGAGE</th>
                    </tr>
                  </thead>
                  <tbody id="profile-views-tbody">
                    <!-- Populated dynamically via script.js -->
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
        

        <!-- ==================== DASHBOARD FOOTER ==================== -->
        <footer class="app-footer" aria-label="Site footer">
          <div class="app-footer-inner">
            <div class="footer-copy-text">
              <span class="footer-brand-title">HR Module</span>
              <span class="footer-nav-sep" aria-hidden="true">&bull;</span>
              <span class="footer-copy">&copy; 2026 HR Module Inc. All rights reserved.</span>
            </div>

            <nav class="footer-nav-links" aria-label="Legal links">
              <a href="#" class="footer-nav-link">Privacy Policy</a>
              <span class="footer-nav-sep" aria-hidden="true">&bull;</span>
              <a href="#" class="footer-nav-link">Terms of Service</a>
              <span class="footer-nav-sep" aria-hidden="true">&bull;</span>
              <a href="#" class="footer-nav-link">Cookie Settings</a>
            </nav>

            <div class="footer-social-icons" aria-label="Social links">
              <a href="#" class="footer-social-btn" aria-label="LinkedIn" title="LinkedIn">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
              </a>
              <a href="#" class="footer-social-btn" aria-label="GitHub" title="GitHub">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/>
                </svg>
              </a>
              <a href="#" class="footer-social-btn" aria-label="X (Twitter)" title="X (Twitter)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
    





    <!-- ==================== RESUME HISTORY MODAL ==================== -->
    <div
      id="modal-resume-history"
      class="app-modal-backdrop hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-history-title"
    >
      <div class="app-modal-dialog app-modal-dialog-wide">
        <div class="app-modal-header">
          <div class="modal-header-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span id="resume-history-title">Resume History</span>
          </div>
          <button type="button" class="app-modal-close" id="close-resume-history-modal" aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="app-modal-body">
          <table class="rch-history-table">
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
          <div class="rch-empty-state hidden" id="resume-history-empty">
            <div class="rch-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </div>
            <h4>No Resumes Found</h4>
            <p>You have not uploaded or created any resumes yet.</p>
          </div>
        </div>
        <div class="app-modal-footer">
          <button type="button" class="rch-modal-close-btn" id="btn-close-history-modal">Close</button>
        </div>
      </div>
    </div>
    <!-- ==================== 1. RESUME PREVIEW MODAL ==================== -->
    <div
      id="modal-resume-preview"
      class="app-modal-backdrop hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-preview-title"
    >
      <div class="app-modal-dialog modal-dialog-resume-preview">
        <div class="app-modal-header">
          <div class="modal-header-title">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-teal"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              ></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <div>
              <h3 id="resume-preview-title">Resume Preview</h3>
              <p
                id="resume-preview-subtitle"
                style="font-size: 0.78rem; color: var(--text-muted); margin: 0"
              >
                Loading document…
              </p>
            </div>
          </div>
          <button
            class="modal-close-btn"
            id="close-preview-modal"
            type="button"
            aria-label="Close resume preview"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="app-modal-body resume-preview-body">
          <div id="resume-preview-loading" class="resume-preview-state-box hidden">
            <div class="preview-spinner"></div>
            <p>Loading resume document…</p>
          </div>
          <div id="resume-preview-error" class="resume-preview-state-box hidden">
            <div class="preview-error-icon">
              <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <p id="resume-preview-error-text" class="preview-error-message">This resume could not be loaded.</p>
          </div>
          <div id="resume-preview-unsupported" class="resume-preview-state-box hidden">
            <div class="preview-doc-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <h4 style="margin: 12px 0 6px; font-size: 1.1rem; color: #f8fafc; font-weight: 600;">Word (.docx) Document</h4>
            <p style="margin: 0 0 16px; font-size: 0.88rem; color: #cbd5e1; max-width: 360px;">DOCX files cannot be previewed directly in the browser. Download the file to view its full contents.</p>
            <button type="button" class="btn-primary-teal" id="btn-unsupported-download" style="display: inline-flex; align-items: center; gap: 8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download Document</span>
            </button>
          </div>
          <iframe id="resume-preview-frame" class="resume-preview-iframe hidden" title="Resume Document Preview"></iframe>
        </div>

        <div class="app-modal-footer">
          <button
            class="btn-secondary-outline"
            id="btn-modal-print-resume"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path
                d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
              ></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Print</span>
          </button>
          <button
            class="btn-primary-teal"
            id="btn-modal-download-resume"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 2. JOB DETAILS & QUICK APPLY MODAL ==================== -->
    <div
      id="modal-job-details"
      class="app-modal-backdrop hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-modal-title"
    >
      <div class="app-modal-dialog">
        <div class="app-modal-header">
          <div class="modal-header-title">
            <div
              id="job-modal-logo"
              class="company-avatar-box"
              style="
                background: linear-gradient(135deg, #0f9488 0%, #0b756b 100%);
              "
            >
              A
            </div>
            <div>
              <h3 id="job-modal-title">Senior Frontend Architect</h3>
              <p
                id="job-modal-company"
                style="font-size: 0.8rem; color: var(--text-muted); margin: 0"
              >
                ApexCloud Tech &bull; San Francisco, USA
              </p>
            </div>
          </div>
          <button
            class="modal-close-btn"
            id="close-job-modal"
            type="button"
            aria-label="Close job details"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="app-modal-body" id="modal-job-body">
          <!-- Populated dynamically via script.js -->
        </div>

        <div class="app-modal-footer">
          <button
            class="btn-job-interest"
            id="modal-job-interest-btn"
            type="button"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            ></polygon>
            <span id="modal-interest-label">Interested</span>
          </button>
          <button
            class="btn-primary-teal"
            id="modal-job-apply-btn"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span>Quick Apply with Primary Resume</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 3. ATS FORM BUILDER MODAL ==================== -->
    <div
      id="modal-ats-builder"
      class="app-modal-backdrop hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ats-builder-title"
    >
      <div class="app-modal-dialog">
        <div class="app-modal-header">
          <div class="modal-header-title">
            <div class="icon-cube-teal">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 11l3 3L22 4"></path>
                <path
                  d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                ></path>
              </svg>
            </div>
            <div>
              <h3 id="ats-builder-title">ATS Resume Form Builder</h3>
              <p
                style="font-size: 0.78rem; color: var(--text-muted); margin: 0"
              >
                Targeted Role Optimization Wizard
              </p>
            </div>
          </div>
          <button
            class="modal-close-btn"
            id="close-ats-modal"
            type="button"
            aria-label="Close ATS builder"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="app-modal-body ats-simple-body">
          <!-- Entitlement / Allowance Display -->
          <div class="ats-quota-banner" id="ats-quota-banner">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span id="ats-remaining">Checking remaining ATS checks…</span>
          </div>

          <!-- Profile Resume Shortcut -->
          <div class="ats-stored-resume-row" id="ats-stored-resume-row" style="display: none;">
            <label class="ats-checkbox-label">
              <input type="checkbox" id="ats-use-stored-resume" />
              <span>Use active profile resume: <strong id="ats-stored-resume-name">resume.pdf</strong></span>
            </label>
          </div>

          <!-- Resume File Upload Section -->
          <div class="ats-upload-section" id="ats-upload-section">
            <label class="form-label" for="ats-resume-upload">Upload Resume (PDF, DOCX up to 5 MB)</label>
            <div class="ats-upload-area">
              <p>Upload your resume in PDF or DOCX format (maximum 5 MB).</p>
              <input type="file" id="ats-resume-upload" accept=".pdf,.docx,.txt" aria-label="Choose resume file" />
              <label for="ats-resume-upload" class="ats-upload-button">Browse Files</label>
              <p class="ats-file-name" id="ats-file-name">No file selected</p>
            </div>
          </div>

          <!-- Target Job Selection -->
          <div class="ats-target-section">
            <div class="form-group ats-form-group">
              <label class="form-label" for="ats-target-job">Target Job Position</label>
              <select id="ats-target-job" class="form-control ats-select">
                <option value="">-- Select a target job opening --</option>
              </select>
              <p class="ats-field-hint">Choose a published job from the platform to match against its actual requirements.</p>
            </div>

            <!-- Custom Job Description Fallback -->
            <div class="form-group ats-form-group">
              <label class="form-label" for="ats-job-description">
                Or Paste Job Description <span class="ats-optional">(at least 40 characters)</span>
              </label>
              <textarea
                id="ats-job-description"
                class="form-control ats-textarea"
                rows="4"
                placeholder="Paste the job requirements, responsibilities, or tech stack here..."
              ></textarea>
            </div>
          </div>

          <button id="ats-analyze-btn" class="btn-primary-teal ats-analyze-btn" type="button" disabled>
            Analyze Resume
          </button>
          <div id="ats-analysis-status" class="ats-analysis-status hidden" role="status" aria-live="polite"></div>

          <!-- Real ATS Evaluation Results -->
          <section id="ats-results" class="ats-results hidden" aria-live="polite">
            <div class="ats-score-panel">
              <div class="ats-score-circle">
                <span id="ats-result-score">--</span>
                <small>out of 100</small>
              </div>
              <div>
                <h4>ATS Compatibility Score</h4>
                <p id="ats-score-summary">Your analysis summary will appear here.</p>
              </div>
            </div>

            <div class="ats-skills-panel">
              <h4>Skills &amp; Keywords Analysis</h4>
              <ul id="ats-skill-list" class="ats-skill-list"></ul>
            </div>

            <div class="ats-improvements">
              <h4>Suggested Improvements</h4>
              <ul id="ats-improvement-list"></ul>
            </div>
          </section>

          <!-- Saved Evaluation History -->
          <div class="ats-history-section" id="ats-history">
            <h4 class="ats-history-title">Saved ATS Evaluation History</h4>
            <ul id="ats-history-list" class="ats-history-list">
              <li>No saved ATS checks yet.</li>
            </ul>
          </div>
        </div>

        <div class="app-modal-footer">
          <button
            class="btn-secondary-outline"
            id="btn-close-ats-bottom"
            type="button"
          >
            Close
          </button>

        </div>
      </div>
    </div>

    <!-- ==================== 4. PORTFOLIO BUILDER MODAL (MATCHING IMAGE 3) ==================== -->
    <div
      id="modal-portfolio-builder"
      class="app-modal-backdrop hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-builder-modal-title"
    >
      <div class="app-modal-dialog modal-dialog-portfolio">
        <!-- Modal Header (matches Image 3) -->
        <div class="app-modal-header">
          <div class="modal-header-title">
            <div class="icon-cube-teal">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <div>
              <h3 id="portfolio-builder-modal-title">
                Portfolio Builder &amp; Project Showcase
              </h3>
              <p
                style="font-size: 0.78rem; color: var(--text-muted); margin: 0"
              >
                Customize your live portfolio, add project links, and developer
                channels
              </p>
            </div>
          </div>
          <button
            class="modal-close-btn"
            id="close-portfolio-modal"
            type="button"
            aria-label="Close portfolio builder"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Modal Body (matches Image 3 inset card aesthetic) -->
        <div class="app-modal-body modal-scrollable-body">
          <div class="modal-sections-stack">
            <!-- Inset Box 1: Portfolio Identity & Domain -->
            <div class="modal-inset-card">
              <h4 class="modal-inset-title">
                Portfolio Identity &amp; Custom Domain
              </h4>
              <p class="modal-inset-desc">
                Set your public portfolio title, personal brand slug, and
                introductory headline.
              </p>
              <div class="form-grid-2">
                <div class="form-field">
                  <label class="form-label" for="builder-portfolio-title"
                    >Headline / Title</label
                  >
                  <input
                    type="text"
                    id="builder-portfolio-title"
                    class="form-input"
                    value="Software Developer"
                  />
                </div>
                <div class="form-field">
                  <label class="form-label" for="builder-portfolio-slug"
                    >Custom Domain Link</label
                  >
                  <div class="input-with-prefix">
                    <span class="input-prefix">https://</span>
                    <input
                      type="text"
                      id="builder-portfolio-slug"
                      class="form-input with-prefix"
                      value="portfolio"
                    />
                    <button
                      type="button"
                      class="btn-input-copy"
                      id="btn-builder-copy-slug"
                      title="Copy URL"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        ></rect>
                        <path
                          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div class="form-field" style="margin-top: 0.75rem">
                <label class="form-label" for="builder-portfolio-bio"
                  >Short Elevator Pitch / Bio</label
                >
                <textarea
                  id="builder-portfolio-bio"
                  class="form-input form-textarea"
                  rows="2"
                >
Senior Software Developer with 4+ years building high-throughput web apps, scalable micro-frontends, and real-time dashboard interfaces.</textarea
                >
              </div>
            </div>

            <!-- Inset Box 2: Add Project Links (The Core Request) -->
            <div class="modal-inset-card">
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  margin-bottom: 0.35rem;
                "
              >
                <h4 class="modal-inset-title">
                  Add Project Links &amp; Showcases
                </h4>
                <span class="badge-count" id="modal-project-count-badge"
                  >3 Projects</span
                >
              </div>
              <p class="modal-inset-desc">
                Add live demo URLs, GitHub repositories, and tech stacks so
                recruiters can inspect your real work.
              </p>

              <!-- Quick Add Project Inputs -->
              <div class="quick-add-project-box">
                <div class="form-grid-2">
                  <div class="form-field">
                    <label class="form-label" for="modal-new-proj-title">
                      Project Name <span class="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="modal-new-proj-title"
                      class="form-input"
                      placeholder="e.g. CloudPulse — Realtime Metrics Dashboard"
                    />
                  </div>
                  <div class="form-field">
                    <label class="form-label" for="modal-new-proj-cat"
                      >Category</label
                    >
                    <select
                      id="modal-new-proj-cat"
                      class="form-input form-select"
                    >
                      <option value="Web Application">Web Application</option>
                      <option value="Full Stack System">
                        Full Stack System
                      </option>
                      <option value="AI / ML Product">AI / ML Product</option>
                      <option value="Mobile App">Mobile App</option>
                      <option value="Open Source Tool">Open Source Tool</option>
                      <option value="UI/UX Concept">UI/UX Concept</option>
                    </select>
                  </div>
                </div>

                <div class="form-grid-2">
                  <div class="form-field">
                    <label class="form-label" for="modal-new-proj-demo"
                      >Live Demo Link</label
                    >
                    <div class="input-with-prefix">
                      <span class="input-prefix">https://</span>
                      <input
                        type="text"
                        id="modal-new-proj-demo"
                        class="form-input with-prefix"
                        placeholder="cloudpulse.vercel.app"
                      />
                    </div>
                  </div>
                  <div class="form-field">
                    <label class="form-label" for="modal-new-proj-github"
                      >GitHub Repository</label
                    >
                    <div class="input-with-prefix">
                      <span class="input-prefix">github.com/</span>
                      <input
                        type="text"
                        id="modal-new-proj-github"
                        class="form-input with-prefix"
                        placeholder="username/project"
                      />
                    </div>
                  </div>
                </div>

                <div class="form-field">
                  <label class="form-label" for="modal-new-proj-stack">
                    Tech Stack (comma separated) <span class="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="modal-new-proj-stack"
                    class="form-input"
                    placeholder="e.g. React, Next.js, TypeScript, Tailwind CSS, WebSockets"
                  />
                </div>

                <div class="form-field">
                  <label class="form-label" for="modal-new-proj-desc"
                    >Project Description</label
                  >
                  <textarea
                    id="modal-new-proj-desc"
                    class="form-input form-textarea"
                    rows="2"
                    placeholder="Briefly describe what this project does and key engineering highlights..."
                  ></textarea>
                </div>

                <div
                  style="
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 0.5rem;
                  "
                >
                  <button
                    type="button"
                    class="btn-primary-teal"
                    id="btn-modal-add-project-item"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Add Project Link</span>
                  </button>
                </div>
              </div>

              <!-- List of currently added projects in modal -->
              <div class="modal-project-links-list" id="modal-projects-list">
                <!-- Rendered dynamically via script.js -->
              </div>
            </div>

            <!-- Inset Box 3: Social & Developer Channels -->
            <div class="modal-inset-card">
              <h4 class="modal-inset-title">
                Social Profiles &amp; Developer Channels
              </h4>
              <p class="modal-inset-desc">
                Connect your public developer channels for recruiters to verify
                code contributions and endorsements.
              </p>

              <div class="form-grid-2">
                <div class="form-field">
                  <label class="form-label" for="builder-social-github"
                    >GitHub Profile</label
                  >
                  <div class="input-with-prefix">
                    <span class="input-prefix">github.com/</span>
                    <input
                      type="text"
                      id="builder-social-github"
                      class="form-input with-prefix"
                      value=""
                    />
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label" for="builder-social-linkedin"
                    >LinkedIn Profile</label
                  >
                  <div class="input-with-prefix">
                    <span class="input-prefix">linkedin.com/in/</span>
                    <input
                      type="text"
                      id="builder-social-linkedin"
                      class="form-input with-prefix"
                      value=""
                    />
                  </div>
                </div>
              </div>

              <div class="form-grid-2" style="margin-top: 0.75rem">
                <div class="form-field">
                  <label class="form-label" for="builder-social-twitter"
                    >Twitter / X Profile</label
                  >
                  <div class="input-with-prefix">
                    <span class="input-prefix">x.com/</span>
                    <input
                      type="text"
                      id="builder-social-twitter"
                      class="form-input with-prefix"
                      value=""
                    />
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label" for="builder-social-blog"
                    >Personal Blog / Substack / Dev.to</label
                  >
                  <div class="input-with-prefix">
                    <span class="input-prefix">https://</span>
                    <input
                      type="text"
                      id="builder-social-blog"
                      class="form-input with-prefix"
                      value=""
                    />
                  </div>
                </div>
              </div>

              <div class="form-grid-2" style="margin-top: 0.75rem">
                <div class="form-field">
                  <label class="form-label" for="builder-social-email"
                    >Work Inquiries Email</label
                  >
                  <input
                    type="email"
                    id="builder-social-email"
                    class="form-input"
                    value=""
                  />
                </div>
                <div class="form-field">
                  <label class="form-label" for="builder-hiring-status"
                    >Career Availability Status</label
                  >
                  <select
                    id="builder-hiring-status"
                    class="form-input form-select"
                  >
                    <option value="actively-looking">
                      Actively Looking &bull; Ready to Interview
                    </option>
                    <option value="open-to-offers">
                      Open to High-Impact Offers
                    </option>
                    <option value="freelance-contract">
                      Available for Contract / Consulting
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Inset Box 4: Display Preferences & Resume Integration -->
            <div class="modal-inset-card">
              <h4 class="modal-inset-title">
                Display Preferences &amp; Integration
              </h4>
              <p class="modal-inset-desc">
                Control what visitors see on your live showcase.
              </p>
              <div
                style="
                  display: flex;
                  flex-direction: column;
                  gap: 0.65rem;
                  margin-top: 0.5rem;
                "
              >
                <label class="checkbox-option-row">
                  <input
                    type="checkbox"
                    id="builder-pref-show-resume"
                    checked
                  />
                  <span
                    >Show one-click &ldquo;Download Active Resume (PDF)&rdquo;
                    button on live portfolio</span
                  >
                </label>
                <label class="checkbox-option-row">
                  <input type="checkbox" id="builder-pref-show-stats" checked />
                  <span
                    >Display live visitor analytics counter (1,284 views this
                    week)</span
                  >
                </label>
                <label class="checkbox-option-row">
                  <input
                    type="checkbox"
                    id="builder-pref-open-source"
                    checked
                  />
                  <span
                    >Feature GitHub Star counts &amp; repository metrics
                    automatically</span
                  >
                </label>
              </div>
            </div>

            <!-- Inset Box 5: Live Status Banner (styled identically to Image 3) -->
            <div class="portfolio-live-status-banner">
              <div style="display: flex; align-items: center; gap: 0.85rem">
                <div class="status-circle-badge">100%</div>
                <div>
                  <div
                    style="font-weight: 700; color: #065f46; font-size: 0.92rem"
                  >
                    Portfolio Status: Published &amp; Live
                  </div>
                  <div style="font-size: 0.78rem; color: #047857">
                    All <span id="status-proj-count">3</span> projects, 4
                    developer channels &amp; active ATS resume synced to
                    <strong
                      style="text-decoration: underline"
                      id="status-live-url"
                      >portfolio.live</strong
                    >
                  </div>
                </div>
              </div>
              <span class="status-pill-success">LIVE &amp; SYNCED</span>
            </div>
          </div>
        </div>

        <!-- Modal Footer (matches Image 3) -->
        <div class="app-modal-footer">
          <button
            class="btn-secondary-outline"
            id="btn-close-portfolio-bottom"
            type="button"
          >
            Close
          </button>
          <button
            class="btn-primary-teal"
            id="btn-save-publish-portfolio"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Save &amp; Publish Portfolio</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== 5. ACCOUNT SETTINGS & MEMBERSHIP MODAL ==================== -->
    <div
      id="modal-account-settings"
      class="app-modal-backdrop hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-modal-title"
    >
      <div class="app-modal-dialog modal-dialog-settings">
        <!-- Modal Header -->
        <div class="app-modal-header">
          <div class="modal-header-title">
            <div class="icon-cube-teal">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                ></path>
              </svg>
            </div>
            <div>
              <h3 id="account-settings-modal-title">
                Account Settings &amp; Preferences
              </h3>
              <p
                style="font-size: 0.78rem; color: var(--text-muted); margin: 0"
              >
                Edit personal details, manage Basic vs Premium membership, and
                account security
              </p>
            </div>
          </div>
          <button
            class="modal-close-btn"
            id="close-settings-modal"
            type="button"
            aria-label="Close account settings"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Settings Tab Navigation -->
        <div class="settings-tabs-header">
          <button
            class="settings-tab-btn active"
            id="btn-tab-personal"
            data-tab="personal"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Personal Information</span>
          </button>
          <button
            class="settings-tab-btn"
            id="btn-tab-plan"
            data-tab="plan"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              ></polygon>
            </svg>
            <span>Plan &amp; Subscription</span>
          </button>
          <button
            class="settings-tab-btn danger"
            id="btn-tab-danger"
            data-tab="danger"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              ></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Danger Zone</span>
          </button>
        </div>

        <!-- Modal Body with Scrollable Tab Contents -->
        <div class="app-modal-body modal-scrollable-body">
          <!-- TAB 1: Personal Information -->
          <div class="settings-tab-pane active" id="pane-personal">
            <div class="modal-inset-card">
              <div class="avatar-edit-row">
                <div
                  class="avatar-circle large"
                  id="settings-avatar-display"
                  style="width: 58px; height: 58px; font-size: 1.4rem"
                >
                  <span>A</span>
                </div>
                <div>
                  <h4
                    style="
                      font-size: 0.95rem;
                      font-weight: 700;
                      color: var(--text-main);
                      margin-bottom: 0.2rem;
                    "
                  >
                    Profile Avatar &amp; Public Identity
                  </h4>
                  <p
                    style="
                      font-size: 0.78rem;
                      color: var(--text-muted);
                      margin-bottom: 0.5rem;
                    "
                  >
                    Displayed to recruiters across applications and candidate
                    searches.
                  </p>
                  <div style="display: flex; gap: 0.5rem">
                    <button
                      type="button"
                      class="btn-version-pill-action"
                      id="btn-change-avatar"
                    >
                      Change Initials / Avatar
                    </button>
                    <button
                      type="button"
                      class="btn-secondary-outline"
                      id="btn-reset-avatar"
                      style="padding: 4px 10px; font-size: 0.74rem"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-inset-card" style="margin-top: 1rem">
              <h4 class="modal-inset-title">Candidate Personal Details</h4>
              <p class="modal-inset-desc">
                Update your contact info, role headline, and professional
                background.
              </p>
              <div class="form-grid-2">
                <div class="form-field">
                  <label class="form-label" for="settings-input-name"
                    >Full Name <span class="required">*</span></label
                  >
                  <input
                    type="text"
                    id="settings-input-name"
                    class="form-input"
                    value="Candidate"
                    required
                  />
                </div>
                <div class="form-field">
                  <label class="form-label" for="settings-input-headline"
                    >Professional Headline / Role
                    <span class="required">*</span></label
                  >
                  <input
                    type="text"
                    id="settings-input-headline"
                    class="form-input"
                    value="Software Developer"
                    required
                  />
                </div>
              </div>
              <div class="form-grid-2" style="margin-top: 0.75rem">
                <div class="form-field">
                  <label class="form-label" for="settings-input-email"
                    >Email Address <span class="required">*</span></label
                  >
                  <input
                    type="email"
                    id="settings-input-email"
                    class="form-input"
                    value=""
                    required
                  />
                </div>
                <div class="form-field">
                  <label class="form-label" for="settings-input-phone"
                    >Phone Number</label
                  >
                  <input
                    type="tel"
                    id="settings-input-phone"
                    class="form-input"
                    value=""
                  />
                </div>
              </div>
              <div class="form-grid-2" style="margin-top: 0.75rem">
                <div class="form-field">
                  <label class="form-label" for="settings-input-location"
                    >Location</label
                  >
                  <input
                    type="text"
                    id="settings-input-location"
                    class="form-input"
                    value="Bengaluru, India"
                  />
                </div>
                <div class="form-field">
                  <label class="form-label" for="settings-input-portfolio-url"
                    >Personal Portfolio URL</label
                  >
                  <input
                    type="text"
                    id="settings-input-portfolio-url"
                    class="form-input"
                    value=""
                  />
                </div>
              </div>
              <div class="form-field" style="margin-top: 0.75rem">
                <label class="form-label" for="settings-input-skills"
                  >Primary Technical Skills (comma separated)</label
                >
                <input
                  type="text"
                  id="settings-input-skills"
                  class="form-input"
                  value="React, TypeScript, Next.js, Node.js, PostgreSQL, Tailwind CSS, GraphQL"
                />
              </div>
              <div class="form-field" style="margin-top: 0.75rem">
                <label class="form-label" for="settings-input-bio"
                  >About / Elevator Pitch</label
                >
                <textarea
                  id="settings-input-bio"
                  class="form-input form-textarea"
                  rows="2"
                >
Senior Software Developer with 4+ years of expertise architecting high-performance web applications, scalable component systems, and real-time dashboard interfaces.</textarea
                >
              </div>
              <div
                style="
                  display: flex;
                  justify-content: flex-end;
                  margin-top: 1rem;
                "
              >
                <button
                  type="button"
                  class="btn-primary-teal"
                  id="btn-save-personal-info"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Save Personal Information</span>
                </button>
              </div>
            </div>

            <!-- Certifications & Professional Licenses Card -->
            <div class="modal-inset-card" id="certifications-settings-card" style="margin-top: 1rem">
              <div class="cert-section-header">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <h4 class="modal-inset-title" style="margin: 0">Certifications &amp; Licenses</h4>
                    <span class="cert-header-badge" id="cert-header-badge">72% &rarr; 100% Boost</span>
                  </div>
                  <p class="modal-inset-desc" style="margin-top: 0.25rem; margin-bottom: 0">
                    Upload certificate documents or badges to achieve 100% profile completeness and enhance recruiter discovery.
                  </p>
                </div>
              </div>

              <!-- Profile Strength Status Callout inside Card -->
              <div class="cert-boost-callout" id="cert-boost-callout">
                <div class="cert-boost-callout-icon" id="cert-boost-callout-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <div class="cert-boost-callout-text">
                  <div class="cert-boost-callout-title" id="cert-boost-callout-title">
                    Add certifications to reach 100% profile strength
                  </div>
                  <div class="cert-boost-callout-desc" id="cert-boost-callout-desc">
                    Your profile is currently at <strong>72%</strong>. Adding verified certifications completes your profile to <strong>100%</strong> and boosts recruiter ranking.
                  </div>
                </div>
              </div>

              <!-- Upload Dropzone Area -->
              <div class="cert-uploader-box">
                <input type="file" id="cert-file-input" accept=".pdf,.png,.jpg,.jpeg" style="display: none;" />
                <div class="cert-dropzone" id="cert-dropzone" role="button" tabindex="0">
                  <div class="cert-dropzone-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <div class="cert-dropzone-info">
                    <div class="cert-dropzone-title"><strong>Click to upload certificate document</strong> or drag and drop</div>
                    <div class="cert-dropzone-subtitle">PDF, PNG, JPG (up to 10MB) &bull; Verified credentials supported</div>
                  </div>
                  <button type="button" class="btn-cert-browse" id="btn-cert-browse">Browse File</button>
                </div>

                <!-- File Attached Preview Box -->
                <div class="cert-attached-box hidden" id="cert-attached-box">
                  <div class="cert-attached-details">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0a6960" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <div>
                      <span class="cert-attached-name" id="cert-attached-name">document.pdf</span>
                      <span class="cert-attached-size" id="cert-attached-size">(1.2 MB)</span>
                    </div>
                    <span class="cert-attached-status">File Attached</span>
                  </div>
                  <button type="button" class="btn-cert-remove-file" id="btn-cert-remove-file" aria-label="Remove attached file">&times;</button>
                </div>

                <!-- Input Fields for the Certificate -->
                <div class="cert-inputs-wrapper" style="margin-top: 1rem">
                  <div class="form-grid-2">
                    <div class="form-field">
                      <label class="form-label" for="cert-input-name">Certificate Name / Title <span class="required">*</span></label>
                      <input type="text" id="cert-input-name" class="form-input" placeholder="e.g. AWS Certified Solutions Architect" />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for="cert-input-issuer">Issuing Organization <span class="required">*</span></label>
                      <input type="text" id="cert-input-issuer" class="form-input" placeholder="e.g. Amazon Web Services, Google, Meta" />
                    </div>
                  </div>

                  <div class="form-grid-3" style="margin-top: 0.75rem">
                    <div class="form-field">
                      <label class="form-label" for="cert-input-issue-date">Issue Date</label>
                      <input type="text" id="cert-input-issue-date" class="form-input" placeholder="e.g. May 2024" />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for="cert-input-expiry-date">Expiration Date</label>
                      <input type="text" id="cert-input-expiry-date" class="form-input" placeholder="e.g. May 2027 or Never" />
                    </div>
                    <div class="form-field">
                      <label class="form-label" for="cert-input-id">Credential ID / Number</label>
                      <input type="text" id="cert-input-id" class="form-input" placeholder="e.g. AWS-PSA-78291" />
                    </div>
                  </div>

                  <div class="form-field" style="margin-top: 0.75rem">
                    <label class="form-label" for="cert-input-url">Credential Verification URL</label>
                    <input type="url" id="cert-input-url" class="form-input" placeholder="https://www.credly.com/badges/... or verification URL" />
                  </div>

                  <!-- Quick Suggested Preset Pills -->
                  <div class="cert-preset-row">
                    <span class="cert-preset-label">Quick presets:</span>
                    <button type="button" class="btn-cert-preset" data-name="AWS Certified Solutions Architect" data-issuer="Amazon Web Services (AWS)" data-issue="Jan 2024" data-expiry="Jan 2027" data-id="AWS-SA-94021" data-url="https://aws.amazon.com/verification">+ AWS Solutions Architect</button>
                    <button type="button" class="btn-cert-preset" data-name="Meta Certified Front-End Developer" data-issuer="Meta / Coursera" data-issue="Mar 2024" data-expiry="No Expiration" data-id="META-FE-55104" data-url="https://coursera.org/verify/meta">+ Meta Front-End</button>
                    <button type="button" class="btn-cert-preset" data-name="Google Cloud Associate Cloud Engineer" data-issuer="Google Cloud" data-issue="Jun 2024" data-expiry="Jun 2026" data-id="GCP-ACE-81204" data-url="https://cloud.google.com/certification">+ Google Cloud</button>
                  </div>

                  <!-- Form Action Buttons -->
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; flex-wrap: wrap; gap: 0.5rem">
                    <button type="button" class="btn-secondary-outline" id="btn-cert-clear-fields" style="font-size: 0.8rem; padding: 0.45rem 0.9rem">Clear Form</button>
                    <button type="button" class="btn-primary-teal" id="btn-cert-add-submit">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span>Add Certification &amp; Reach 100%</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- List of Uploaded / Added Certifications -->
              <div class="cert-list-section" style="margin-top: 1.25rem">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem">
                  <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.04em">
                    Added Certifications (<span id="cert-count-badge">0</span>)
                  </span>
                  <span id="cert-count-status" style="font-size: 0.75rem; color: var(--text-muted)">Add 1+ to reach 100%</span>
                </div>
                <div class="certifications-items-list" id="certifications-items-list">
                  <!-- Dynamically populated or empty state -->
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: Plan & Subscription (Basic vs Premium) -->
          <div class="settings-tab-pane hidden" id="pane-plan">
            <!-- Current Status Banner -->
            <div class="membership-current-card" id="membership-current-card">
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  flex-wrap: wrap;
                  gap: 0.75rem;
                "
              >
                <div style="display: flex; align-items: center; gap: 0.75rem">
                  <div
                    class="status-circle-badge"
                    id="plan-status-icon-badge"
                    style="
                      background: linear-gradient(
                        135deg,
                        #0d9488 0%,
                        #0f766e 100%
                      );
                    "
                  >
                    ★
                  </div>
                  <div>
                    <div
                      style="display: flex; align-items: center; gap: 0.5rem"
                    >
                      <h4
                        style="
                          font-size: 1rem;
                          font-weight: 800;
                          color: var(--text-main);
                          margin: 0;
                        "
                        id="current-plan-name"
                      >
                        Premium Pro Plan
                      </h4>
                      <span class="status-pill-success" id="current-plan-badge"
                        >ACTIVE SUBSCRIBER</span
                      >
                    </div>
                    <div id="sub-expiry-info" style="margin-top:6px;font-size:0.78rem;"></div>
                    <p
                      style="
                        font-size: 0.78rem;
                        color: var(--text-muted);
                        margin: 0.2rem 0 0 0;
                      "
                      id="current-plan-desc"
                    >
                      Loading your subscription&hellip;
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn-version-pill-action"
                  id="btn-quick-toggle-plan"
                >
                  Upgrade to Premium — ₹499
                </button>
              </div>
            </div>

            <!-- Plan Card (Single ₹499 Premium Career Pro) -->
            <div class="plans-comparison-grid" style="margin-top: 1.25rem; max-width: 540px; margin-left: auto; margin-right: auto;">
              <!-- Premium Plan Card -->
              <div class="plan-card featured current" id="plan-card-premium" style="width: 100%;">
                <div class="featured-ribbon">PREMIUM PLAN</div>
                <div class="plan-card-top">
                  <div class="plan-title-row">
                    <h4 class="plan-title">Premium Career Pro</h4>
                    <span class="plan-tag pro">One-time payment</span>
                  </div>
                  <div class="plan-pricing">
                    <span class="plan-currency">₹</span>
                    <span class="plan-amount" id="premium-price-display">499</span>
                    <span class="plan-period">/ one-time</span>
                  </div>
                  <p class="plan-desc">
                    Full candidate platform access with top recruiter visibility, gold crown profile badge, and portfolio publishing.
                  </p>
                </div>
                <ul class="plan-perks-list">
                  <li>
                    <span class="check-icon">&check;</span> <strong>Gold crown badge</strong> on your candidate profile
                  </li>
                  <li>
                    <span class="check-icon">&check;</span> <strong>Priority placement</strong> at the top of recruiter talent searches
                  </li>
                  <li>
                    <span class="check-icon">&check;</span> Full candidate dashboard with recruiter discovery
                  </li>
                  <li>
                    <span class="check-icon">&check;</span> Unlimited resume uploads &amp; ATS score checks
                  </li>
                  <li>
                    <span class="check-icon">&check;</span> Direct 1-click job applications
                  </li>
                  <li>
                    <span class="check-icon">&check;</span> Live portfolio web publishing on custom URL
                  </li>
                  <li>
                    <span class="check-icon">&check;</span> Full access to all 40+ professional resume templates
                  </li>
                </ul>
                <button
                  type="button"
                  class="btn-plan-action primary"
                  id="btn-select-premium-plan"
                >
                  Active Premium Subscription
                </button>
              </div>
            </div>


            <!-- Billing & Invoice History -->
            <section class="billing-invoice-section" aria-labelledby="billing-invoice-title">
              <div class="billing-invoice-heading">
                <div>
                  <span class="billing-eyebrow">BILLING HISTORY</span>
                  <h4 id="billing-invoice-title">Billing &amp; Invoices</h4>
                  <p>View your latest subscription payment and download a copy of your invoice.</p>
                </div>
                <span class="invoice-paid-badge"><span class="invoice-status-dot"></span> Paid</span>
              </div>

              <div class="invoice-summary-card">
                <div class="invoice-summary-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="8" y1="13" x2="16" y2="13"></line>
                    <line x1="8" y1="17" x2="14" y2="17"></line>
                  </svg>
                </div>
                <div class="invoice-summary-main">
                  <strong id="invoice-plan-name">Loading invoice&hellip;</strong>
                  <span>Invoice <span id="invoice-number">—</span></span>
                  <span>Payment date: <span id="invoice-date">—</span></span>
                </div>
                <div class="invoice-total-block">
                  <span>Total paid</span>
                  <strong id="invoice-total">—</strong>
                  <small>INR</small>
                </div>
                <button type="button" class="btn-download-invoice" id="btn-download-invoice">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download Invoice
                </button>
              </div>

              <div class="invoice-detail-grid">
                <div class="invoice-detail-item"><span>Billing period</span><strong id="invoice-detail-period">—</strong></div>
                <div class="invoice-detail-item"><span>Payer</span><strong id="invoice-detail-payer">—</strong></div>
                <div class="invoice-detail-item"><span>Subtotal</span><strong id="invoice-detail-subtotal">—</strong></div>
                <div class="invoice-detail-item"><span>Tax</span><strong id="invoice-detail-tax">Included</strong></div>
              </div>
              <p class="invoice-demo-note" id="invoice-demo-note">Your latest verified payment invoice is shown here once a payment completes.</p>
            </section>

          </div>

          <!-- TAB 3: Danger Zone (Delete Account) -->
          <div class="settings-tab-pane hidden" id="pane-danger">
            <div class="danger-zone-card">
              <div class="danger-zone-header">
                <div class="danger-icon-circle">
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    ></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <div>
                  <h4
                    style="
                      font-size: 1rem;
                      font-weight: 800;
                      color: #991b1b;
                      margin: 0 0 0.2rem 0;
                    "
                  >
                    Permanently Delete Account
                  </h4>
                  <p
                    style="
                      font-size: 0.8rem;
                      color: #7f1d1d;
                      margin: 0;
                      line-height: 1.5;
                    "
                  >
                    Once your account is deleted, all stored ATS resumes,
                    recruiter shortlists, interview notes, and published
                    portfolio showcases will be permanently wiped.
                  </p>
                </div>
              </div>

              <div
                style="
                  margin-top: 1.25rem;
                  padding-top: 1rem;
                  border-top: 1px solid #fecaca;
                "
              >
                <label
                  class="form-label"
                  for="input-delete-confirm"
                  style="color: #991b1b; font-weight: 700"
                >
                  To verify deletion, please type
                  <code
                    style="
                      background: #fee2e2;
                      padding: 2px 6px;
                      border-radius: 4px;
                      color: #dc2626;
                    "
                    >DELETE</code
                  >
                  in the field below:
                </label>
                <input
                  type="text"
                  id="input-delete-confirm"
                  class="form-input"
                  placeholder="Type DELETE to confirm"
                  style="
                    border-color: #f87171;
                    margin-top: 0.4rem;
                    max-width: 320px;
                  "
                />

                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 1rem;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                  "
                >
                  <span style="font-size: 0.78rem; color: var(--text-muted)"
                    >This action is irrevocable in production
                    environments.</span
                  >
                  <button
                    type="button"
                    class="btn-danger-delete"
                    id="btn-confirm-delete-account"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                      ></path>
                    </svg>
                    <span>Permanently Delete Account</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="app-modal-footer">
          <button
            class="btn-secondary-outline"
            id="btn-close-settings-bottom"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Dedicated Interested Jobs Card Dialog (Opens on clicking "Interested Jobs" in Left Sidebar) -->
    <div
      id="modal-interested-jobs"
      class="app-modal-backdrop hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interested-jobs-modal-title"
    >
      <div class="app-modal-dialog modal-dialog-interested-jobs">
        <div class="app-modal-header">
          <div class="modal-header-title">
            <div class="modal-title-icon-box accent-teal-box">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div>
              <div class="interested-modal-header-row">
                <h3 id="interested-jobs-modal-title">Interested Jobs</h3>
                <span class="active-pulse-badge">
                  <span class="pulse-indicator"></span>
                  <span id="modal-interested-count">1</span> Saved Opportunity
                </span>
              </div>
              <p class="modal-subtitle">
                Opportunities you marked as interested. Recruiters are notified for prioritized candidate review.
              </p>
            </div>
          </div>
          <button
            class="modal-close-btn"
            id="close-interested-jobs-modal"
            aria-label="Close modal"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="app-modal-body modal-scrollable-body" id="modal-interested-jobs-body">
          <!-- Populated dynamically with the Interested Jobs cards & expandable details (Image 2) -->
          <div class="interested-jobs-modal-list" id="modal-interested-jobs-list">
          </div>

          <!-- Empty state when no interested jobs -->
          <div id="modal-interested-empty-state" class="empty-state-box hidden">
            <div class="empty-icon-circle">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <p class="empty-title">No Interested Jobs Yet</p>
            <p class="empty-desc">
              Browse Job Matches in your dashboard and click the &ldquo;Interested&rdquo; button to save opportunities here.
            </p>
          </div>
        </div>

        <div class="app-modal-footer">
          <button type="button" class="btn-modal-cancel" id="btn-close-interested-modal">
            Close
          </button>
          <button type="button" class="btn-secondary-outline" id="btn-modal-browse-matches">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            <span>Explore All Matches</span>
          </button>
        </div>
      </div>
    </div>
    
<!-- Notification History Modal -->
<div
  id="notification-history-modal"
  class="notification-history-overlay hidden"
  role="presentation"
>
  <section
    class="notification-history-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="notification-history-title"
  >
    <div class="notification-history-header">
      <div>
        <h2 id="notification-history-title">
          Notification History
        </h2>
        <p>View all your recent notifications in one place.</p>
      </div>

      <button
        type="button"
        id="close-notification-history"
        class="notification-history-close"
        aria-label="Close notification history"
      >
        &times;
      </button>
    </div>

    <div class="notification-history-summary">
      <span class="notification-history-count" id="history-total-count">
        0 notifications
      </span>
      <span class="notification-history-subtitle">
        Your recent activity
      </span>
    </div>

    <ul
      id="notification-history-list"
      class="notification-history-list"
      aria-label="Notification history"
    ></ul>

    <div
      id="notification-history-empty"
      class="notification-history-empty hidden"
    >
      <div class="notification-history-empty-icon">
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M10 21h4"></path>
        </svg>
      </div>
      <h3>No notifications yet</h3>
      <p>Your notification history will appear here.</p>
    </div>

    <div class="notification-history-footer">
      <button
        type="button"
        id="close-notification-history-footer"
        class="notification-history-done-btn"
      >
        Done
      </button>
    </div>
  </section>
</div>

`;

export default function Paid_Dashboard() {
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    // Expose opener for vanilla JS (PaidDashboardLogic "Plan & Upgrade" click)
    window.__openCandidateSubscription = () => setShowSubscriptionModal(true);

    try {
      const cleanup = initPaidDashboard();
      return () => {
        delete window.__openCandidateSubscription;
        if (typeof cleanup === "function") cleanup();
      };
    } catch (err) {
      console.error("Error initializing Paid Dashboard logic:", err);
    }
  }, []);

  return (
    <>
      {showSubscriptionModal && (
        <CandidateSubscriptionPage
          onClose={() => setShowSubscriptionModal(false)}
          onSuccess={() => {
            setShowSubscriptionModal(false);
            setTimeout(() => window.location.reload(), 1200);
          }}
        />
      )}
      <div
        className="paid-dashboard-root"
        dangerouslySetInnerHTML={{ __html: dashboardMarkup }}
      />
    </>
  );
}
