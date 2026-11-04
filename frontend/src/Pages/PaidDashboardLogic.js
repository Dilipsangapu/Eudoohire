 
import {
  techIconPillHTML,
  techPillHTML,
} from "../components/TechnologyIcon.jsx";
import { csrfHeaders } from "../services/api.js";
import { toast } from "../components/Toast.jsx";

/**
 * fetch() wrapper for the dashboard's raw calls: always sends the session cookie
 * and attaches the CSRF token header on state-changing requests, matching the
 * contract api.js enforces for every POST/PUT/PATCH/DELETE sent to Spring Security.
 */
function withCsrf(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    Object.assign(headers, csrfHeaders());
  }
  return fetch(url, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
}

export default function initPaidDashboard() {
  // Keep the golden premium crown beside the welcome name whenever the
  // greeting is updated (for example, after saving account settings).
  function updateWelcomeHeading(greeting) {
    const welcomeHeading = document.getElementById("welcome-heading");
    if (!welcomeHeading) return;

    welcomeHeading.textContent = `${greeting} `;

    const crown = document.createElement("span");
    crown.className = "welcome-crown";
    crown.setAttribute("aria-label", "Premium account");
    crown.innerHTML = `
      <svg
        viewBox="0 0 20 14"
        width="25"
        height="18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M1 12 L1 13.5 L19 13.5 L19 12 Z" fill="#F5C842" />
        <path
          d="M0.5 4.5 L5 10 L10 1 L15 10 L19.5 4.5 L19 12 L1 12 Z"
          fill="#F5C842"
          stroke="#D4A520"
          stroke-width="0.7"
          stroke-linejoin="round"
        />
        <circle cx="0.8" cy="4.5" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
        <circle cx="10" cy="1" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
        <circle cx="19.2" cy="4.5" r="1.3" fill="#F5C842" stroke="#D4A520" stroke-width="0.5" />
      </svg>
    `;
    welcomeHeading.appendChild(crown);
  }

  // =========================================================================
  // 1. DOM ELEMENT REFERENCES
  // =========================================================================
  const globalSearchInput = document.getElementById("global-search");
  const searchClearBtn = document.getElementById("search-clear-btn");

  // Sidebar elements
  const sidebar = document.getElementById("sidebar");
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
  const mobileBackdrop = document.getElementById("mobile-backdrop");
  const sidebarNav = document.getElementById("sidebar-nav");
  const strengthActionBtn = document.getElementById("strength-action-btn");

  // Header dropdown elements
  const notificationBtn = document.getElementById("notification-btn");
  const notificationDropdown = document.getElementById("notification-dropdown");
  const notificationIndicator = document.getElementById(
    "notification-indicator",
  );
  const notifCountBadge = document.getElementById("notif-count-badge");
  const markAllReadBtn = document.getElementById("mark-all-read-btn");
  const viewAllNotifsBtn = document.getElementById("view-all-notifs-btn");

  const profileBtn = document.getElementById("profile-btn");
  const profileDropdown = document.getElementById("profile-dropdown");
  const signOutBtn = document.getElementById("sign-out-btn");

  // Quick Action Buttons
  const btnBrowseTemplates = document.getElementById("btn-browse-templates");
  const btnBuildAtsForm = document.getElementById("btn-build-ats-form");
  const btnCreatePortfolio = document.getElementById("btn-create-portfolio");

  // Templates Section elements
  const filterChips = document.querySelectorAll(".filter-chip");
  const templateCards = document.querySelectorAll(".template-card");
  const templatesEmptyState = document.getElementById("templates-empty-state");
  const resetTemplatesFilterBtn = document.getElementById(
    "reset-templates-filter-btn",
  );

  // Recent Documents Section elements
  const documentRows = document.querySelectorAll(".document-row");
  const docsEmptyState = document.getElementById("docs-empty-state");
  const docsCountPill = document.getElementById("docs-count-pill");

  // Current State
  let currentCategoryFilter = "all";
  let currentSearchQuery = "";

  // =========================================================================
  // 2. TOAST NOTIFICATION UTILITY (DISABLED)
  // =========================================================================
  function showToast() {
    // Toast popups disabled across website per user request
  }


  // =========================================================================
  // 3. DROPDOWNS HANDLING (Notifications & Profile)
  // =========================================================================
  function closeAllDropdowns() {
    if (notificationDropdown) {
      notificationDropdown.classList.add("hidden");
      notificationBtn.setAttribute("aria-expanded", "false");
    }
    if (profileDropdown) {
      profileDropdown.classList.add("hidden");
      profileBtn.setAttribute("aria-expanded", "false");
    }
  }

  // Toggle Notification Popover
  if (notificationBtn && notificationDropdown) {
    notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = notificationDropdown.classList.contains("hidden");
      closeAllDropdowns();
      if (isHidden) {
        notificationDropdown.classList.remove("hidden");
        notificationBtn.setAttribute("aria-expanded", "true");
      }
    });
  }

  // Toggle Profile Popover
  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = profileDropdown.classList.contains("hidden");
      closeAllDropdowns();
      if (isHidden) {
        profileDropdown.classList.remove("hidden");
        profileBtn.setAttribute("aria-expanded", "true");
      }
    });
  }

  // Load real notifications from backend
  async function loadCandidateNotifications() {
    const notificationList = document.getElementById("notification-list");
    if (!notificationList) return;

    try {
      const [listRes, countRes] = await Promise.all([
        fetch("/api/notifications?page=0&size=10", { credentials: "include" }),
        fetch("/api/notifications/unread-count", { credentials: "include" })
      ]);

      if (countRes.ok) {
        const count = await countRes.json();
        const unreadCount = Number(count) || 0;
        if (notificationIndicator) {
          notificationIndicator.style.display = unreadCount > 0 ? "block" : "none";
        }
        if (notifCountBadge) {
          notifCountBadge.textContent = `${unreadCount} New`;
          if (unreadCount > 0) {
            notifCountBadge.style.backgroundColor = "";
            notifCountBadge.style.color = "";
          } else {
            notifCountBadge.style.backgroundColor = "#F1F5F9";
            notifCountBadge.style.color = "#64748B";
          }
        }
      }

      if (listRes.ok) {
        const pageData = await listRes.json();
        const items = (pageData && pageData.content) ? pageData.content : [];
        notificationList.innerHTML = "";

        if (items.length === 0) {
          notificationList.innerHTML = `
            <li class="notification-item" style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); justify-content: center;">
              <span>No notifications yet</span>
            </li>
          `;
          return;
        }

        items.forEach((item) => {
          const li = document.createElement("li");
          li.className = `notification-item ${item.read ? "" : "unread"}`.trim();
          const timeStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recently";
          li.innerHTML = `
            <div class="notif-icon-circle teal-bg">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div class="notif-content">
              <p class="notif-title">${item.title || "Notification"}</p>
              <p class="notif-desc">${item.message || ""}</p>
              <span class="notif-time">${timeStr}</span>
            </div>
          `;
          notificationList.appendChild(li);
        });
      }
    } catch (err) {
      console.warn("Failed to load candidate notifications:", err);
    }
  }

  loadCandidateNotifications();

  // Mark all notifications as read
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await fetch("/api/notifications/read-all", {
          method: "POST",
          credentials: "include"
        });
      } catch (err) {
        /* proceed with local state update */
      }
      const unreadItems = notificationDropdown ? notificationDropdown.querySelectorAll(
        ".notification-item.unread",
      ) : [];
      unreadItems.forEach((item) => item.classList.remove("unread"));
      if (notificationIndicator) {
        notificationIndicator.style.display = "none";
      }
      if (notifCountBadge) {
        notifCountBadge.textContent = "0 New";
        notifCountBadge.style.backgroundColor = "#F1F5F9";
        notifCountBadge.style.color = "#64748B";
      }
    });
  }

  if (viewAllNotifsBtn) {
    viewAllNotifsBtn.addEventListener("click", () => {
      closeAllDropdowns();
    });
  }

  // Profile Menu Items click handlers
  const profileMenuItems = document.querySelectorAll(".profile-menu-item");
  profileMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.getAttribute("data-action");
      closeAllDropdowns();

      if (action === "settings" || action === "profile") {
        openAccountSettingsModal("personal");
      } else if (action === "plan") {
        // Open React subscription modal via global bridge
        if (typeof window.__openCandidateSubscription === "function") {
          window.__openCandidateSubscription();
        } else {
          openAccountSettingsModal("plan");
        }
      } else if (action === "shortlisted") {
        const section = document.getElementById("section-shortlisted-jobs");
        if (section)
          section.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "views") {
        const section = document.getElementById("section-profile-views");
        if (section)
          section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });


  // Sign Out â€” invalidate the Spring Security session, then redirect to login
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      closeAllDropdowns();
      // Queue the success toast for after the redirect (a full page reload
      // would otherwise discard it); ToastProvider shows it on the login page.
      try {
        sessionStorage.setItem(
          "euodoo-pending-toast",
          JSON.stringify({ type: "success", message: "You have been logged out successfully." }),
        );
      } catch (_) {}
      // Fire-and-forget: invalidate session on backend before navigating away
      fetch("/api/auth/logout", { method: "POST", credentials: "include" })
        .catch(() => {})
        .finally(() => {
          window.location.href = "/login";
        });
    });
  }


  // Dismiss dropdowns when clicking outside or pressing Escape
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown-wrapper")) {
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllDropdowns();
      closeMobileSidebar();
    }
  });

  // =========================================================================
  // 4. MOBILE SIDEBAR NAVIGATION
  // =========================================================================
  function openMobileSidebar() {
    if (sidebar && mobileBackdrop) {
      sidebar.classList.add("open");
      mobileBackdrop.classList.add("show");
      document.body.style.overflow = "hidden";
    }
  }

  function closeMobileSidebar() {
    if (sidebar && mobileBackdrop) {
      sidebar.classList.remove("open");
      mobileBackdrop.classList.remove("show");
      document.body.style.overflow = "";
    }
  }

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", openMobileSidebar);
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener("click", closeMobileSidebar);
  }

  if (mobileBackdrop) {
    mobileBackdrop.addEventListener("click", closeMobileSidebar);
  }

  // =========================================================================
  // 4b. DESKTOP SIDEBAR COLLAPSE / EXPAND TOGGLE & PERSISTENCE
  // =========================================================================
  const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");
  const appLayout = document.querySelector(".app-layout");
  const paidDashboardRoot =
    document.querySelector(".paid-dashboard-root") || document.body;
  const floatingTooltip = document.getElementById("sidebar-floating-tooltip");

  function setSidebarCollapsed(collapsed) {
    if (collapsed) {
      paidDashboardRoot.classList.add("paid-sidebar-collapsed");
      if (appLayout) appLayout.classList.add("paid-sidebar-collapsed");
      sidebar?.classList.add("collapsed");
      if (sidebarCollapseBtn) {
        sidebarCollapseBtn.setAttribute("aria-label", "Expand sidebar");
        sidebarCollapseBtn.setAttribute("title", "Expand sidebar");
      }
    } else {
      paidDashboardRoot.classList.remove("paid-sidebar-collapsed");
      if (appLayout) appLayout.classList.remove("paid-sidebar-collapsed");
      sidebar?.classList.remove("collapsed");
      if (sidebarCollapseBtn) {
        sidebarCollapseBtn.setAttribute("aria-label", "Collapse sidebar");
        sidebarCollapseBtn.setAttribute("title", "Collapse sidebar");
      }
      if (floatingTooltip) floatingTooltip.style.display = "none";
    }
    try {
      localStorage.setItem("hrm_paid_sidebar_collapsed", String(collapsed));
    } catch (e) {
      // ignore storage quota / permission errors
    }
  }

  // Restore collapsed state across refreshes
  try {
    if (localStorage.getItem("hrm_paid_sidebar_collapsed") === "true") {
      setSidebarCollapsed(true);
    }
  } catch (e) {}

  if (sidebarCollapseBtn) {
    sidebarCollapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCurrentlyCollapsed =
        paidDashboardRoot.classList.contains("paid-sidebar-collapsed") ||
        (appLayout && appLayout.classList.contains("paid-sidebar-collapsed"));
      setSidebarCollapsed(!isCurrentlyCollapsed);
    });
  }

  // Floating tooltip for nav items when sidebar is collapsed
  if (sidebarNav && floatingTooltip) {
    const navItems = sidebarNav.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
      item.addEventListener("mouseenter", () => {
        const isCollapsed =
          paidDashboardRoot.classList.contains("paid-sidebar-collapsed") ||
          (appLayout && appLayout.classList.contains("paid-sidebar-collapsed"));
        if (!isCollapsed || window.innerWidth <= 768) return;
        const text =
          item.getAttribute("data-tooltip") ||
          item.querySelector(".nav-label")?.textContent?.trim();
        if (!text) return;
        const rect = item.getBoundingClientRect();
        floatingTooltip.textContent = text;
        floatingTooltip.style.top = `${rect.top + rect.height / 2}px`;
        floatingTooltip.style.left = `${rect.right + 10}px`;
        floatingTooltip.style.display = "block";
      });
      item.addEventListener("mouseleave", () => {
        floatingTooltip.style.display = "none";
      });
    });
  }

  // Common destination for Resume Templates (served by Spring Boot Thymeleaf)
  const RESUME_TEMPLATES_DESTINATION = "/candidate/resume-templates/";

  function navigateToResumeTemplates(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    window.location.href = RESUME_TEMPLATES_DESTINATION;
  }

  // =========================================================================
  // 5. SIDEBAR NAVIGATION ACTIONS
  // =========================================================================
  if (sidebarNav) {
    const navItems = sidebarNav.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const navId = item.getAttribute("data-nav");
        const label = item.querySelector(".nav-label")?.textContent || navId;

        // Make this item active visually
        navItems.forEach((btn) => btn.classList.remove("active"));
        item.classList.add("active");

        // Close mobile drawer if open
        closeMobileSidebar();

        // Perform in-page context action
        if (navId === "dashboard") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (navId === "resume-templates") {
          // Served by Spring Boot (Thymeleaf) - use a normal browser navigation
          navigateToResumeTemplates();
        } else if (navId === "ats-form") {
          openAtsModal();
     } else if (navId === "portfolio") {
  openPortfolioBuilderModal();
} else if (navId === "my-documents") {
          const section = document.getElementById("section-resume");
          if (section)
            section.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (navId === "job-matches") {
          const section = document.getElementById("section-jobs");
          if (section)
            section.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (navId === "shortlisted") {
          const section = document.getElementById("section-shortlisted-jobs");
          if (section)
            section.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (navId === "profile-views") {
          const section = document.getElementById("section-profile-views");
          if (section)
            section.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (navId === "interested-jobs") {
          openInterestedJobsModal();
        } else if (navId === "settings") {
          openAccountSettingsModal("personal");
        }
      });
    });
  }

  // Profile strength button - opens the section that is actually incomplete
  if (strengthActionBtn) {
    strengthActionBtn.addEventListener("click", () => {
      const settingsNav = document.getElementById("nav-settings");
      if (settingsNav) {
        settingsNav.click();
        return;
      }
      const resumeSection = document.getElementById("section-resume");
      if (resumeSection) resumeSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // =========================================================================
  // 6. QUICK ACTION CARDS BUTTONS
  // =========================================================================
  if (btnBrowseTemplates) {
    btnBrowseTemplates.addEventListener("click", () => {
      const section =
        document.getElementById("section-templates") ||
        document.querySelector(".templates-section");
      if (section)
        section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (btnBuildAtsForm) {
    btnBuildAtsForm.addEventListener("click", () => {
      openAtsModal();
    });
  }

  if (btnCreatePortfolio) {
    btnCreatePortfolio.addEventListener("click", () => {
      openPortfolioBuilderModal();
    });
  }

  // =========================================================================
  // 7. FILTERING LOGIC (SEARCH + CATEGORY CHIPS)
  // =========================================================================
  /**
   * Applies both search query and category filters synchronously
   */
  function applyCombinedFilters() {
    const query = currentSearchQuery.trim().toLowerCase();

    // ----------------------------------------------------
    // A. Filter Resume Template Cards
    // ----------------------------------------------------
    let visibleTemplatesCount = 0;

    templateCards.forEach((card) => {
      const name = (card.getAttribute("data-name") || "").toLowerCase();
      const categories = (
        card.getAttribute("data-categories") || ""
      ).toLowerCase();
      const tags = (card.getAttribute("data-tags") || "").toLowerCase();

      // Check category match
      const matchesCategory =
        currentCategoryFilter === "all" ||
        categories.includes(currentCategoryFilter);

      // Check search query match
      const matchesSearch =
        query === "" ||
        name.includes(query) ||
        categories.includes(query) ||
        tags.includes(query);

      if (matchesCategory && matchesSearch) {
        card.style.display = "";
        visibleTemplatesCount++;
      } else {
        card.style.display = "none";
      }
    });

    if (templatesEmptyState) {
      if (visibleTemplatesCount === 0) {
        templatesEmptyState.classList.remove("hidden");
      } else {
        templatesEmptyState.classList.add("hidden");
      }
    }

    // ----------------------------------------------------
    // B. Filter Recent Documents Table Rows
    // ----------------------------------------------------
    let visibleDocsCount = 0;

    documentRows.forEach((row) => {
      const docName = (row.getAttribute("data-name") || "").toLowerCase();
      const docType = (row.getAttribute("data-type") || "").toLowerCase();

      const matchesSearch =
        query === "" || docName.includes(query) || docType.includes(query);

      if (matchesSearch) {
        row.style.display = "";
        visibleDocsCount++;
      } else {
        row.style.display = "none";
      }
    });

    if (docsEmptyState) {
      if (visibleDocsCount === 0) {
        docsEmptyState.classList.remove("hidden");
      } else {
        docsEmptyState.classList.add("hidden");
      }
    }

    if (docsCountPill) {
      docsCountPill.textContent = `${visibleDocsCount} item${visibleDocsCount === 1 ? "" : "s"}`;
    }
  }

  // Search Input Event Listener
  if (globalSearchInput) {
    globalSearchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value;

      // Toggle search clear button
      if (searchClearBtn) {
        if (currentSearchQuery.length > 0) {
          searchClearBtn.classList.remove("hidden");
        } else {
          searchClearBtn.classList.add("hidden");
        }
      }

      applyCombinedFilters();
    });
  }

  // Clear Search Button
  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      if (globalSearchInput) {
        globalSearchInput.value = "";
        currentSearchQuery = "";
        searchClearBtn.classList.add("hidden");
        globalSearchInput.focus();
        applyCombinedFilters();
      }
    });
  }

  // Filter Chips Click Listener
  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => {
        c.classList.remove("active");
        c.setAttribute("aria-selected", "false");
      });

      chip.classList.add("active");
      chip.setAttribute("aria-selected", "true");

      currentCategoryFilter = chip.getAttribute("data-filter") || "all";
      applyCombinedFilters();
    });
  });

  // Reset Filters Button in Empty State
  if (resetTemplatesFilterBtn) {
    resetTemplatesFilterBtn.addEventListener("click", () => {
      // Reset filter chips to "all"
      filterChips.forEach((c) => {
        if (c.getAttribute("data-filter") === "all") {
          c.classList.add("active");
          c.setAttribute("aria-selected", "true");
        } else {
          c.classList.remove("active");
          c.setAttribute("aria-selected", "false");
        }
      });
      currentCategoryFilter = "all";

      // Reset search bar
      if (globalSearchInput) {
        globalSearchInput.value = "";
        currentSearchQuery = "";
        if (searchClearBtn) searchClearBtn.classList.add("hidden");
      }

      applyCombinedFilters();
    });
  }

  // =========================================================================
  // 8. TEMPLATE CARD "USE" BUTTONS
  // =========================================================================
  // Navigates to the exact same Resume Templates page opened via the sidebar (/candidate/resume-templates/)
  const useTemplateButtons = document.querySelectorAll(".btn-use-template");
  useTemplateButtons.forEach((btn) => {
    btn.addEventListener("click", navigateToResumeTemplates);
  });

  // Event delegation on templates grid to handle dynamic category filtering (All, Modern, Minimal, ATS-friendly)
  // and ensure any template card Use button reliably executes navigation
  const templatesGrid = document.getElementById("templates-grid");
  if (templatesGrid) {
    templatesGrid.addEventListener("click", (e) => {
      const useBtn = e.target.closest(".btn-use-template");
      if (useBtn) {
        navigateToResumeTemplates(e);
      }
    });
  }

  // =========================================================================
  // 9. RECENT DOCUMENTS TABLE ACTIONS
  // =========================================================================
  const rowActionButtons = document.querySelectorAll(".btn-row-action");
  rowActionButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  // =========================================================================
  // 10. DYNAMIC NUMERICAL COUNTER ANIMATIONS
  // =========================================================================
  function animateCounters() {
    const counterElements = document.querySelectorAll(
      ".counter-value[data-count]",
    );
    counterElements.forEach((el) => {
      const target = parseInt(el.getAttribute("data-count"), 10);
      const suffix = el.getAttribute("data-suffix") || "";
      const isFormatted = el.getAttribute("data-format") === "comma";
      const duration = 1400;
      let startTimestamp = null;

      function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = Math.round(ease * target);
        const formatted = isFormatted ? current.toLocaleString() : current;
        el.textContent = `${formatted}${suffix}`;
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      }
      requestAnimationFrame(step);
    });
  }

  // =========================================================================
  // 11. PROFILE STRENGTH (real profile completeness from the backend)
  // =========================================================================
  /**
   * Animates the sidebar strength bar to a REAL percentage computed by the
   * backend from the candidate's actual profile fields (see
   * CandidateController#getProfile ? profileStrength). The hint names only
   * genuinely missing information.
   */
  function animateProfileStrength(target = 0, suggestions = []) {
    const fill = document.getElementById("strength-progress-fill");
    const percentText = document.getElementById("strength-percentage-text");
    if (!fill || !percentText) return;

    const track = fill.parentElement;
    if (track) track.setAttribute("aria-valuenow", String(target));

    const duration = 1300;
    let startTimestamp = null;

    function step(timestamp) {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(ease * target);

      fill.style.width = `${current}%`;
      percentText.textContent = `${current}%`;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    setTimeout(() => {
      requestAnimationFrame(step);
    }, 200);

    const hint = document.querySelector(".strength-hint");
    if (hint) {
      hint.textContent = target >= 100
        ? "100% complete - your profile has every recommended section."
        : suggestions.length
          ? `${target}% complete - ${suggestions[0]}`
          : `${target}% complete.`;
    }

    // Also update the collapsed sidebar circular badge
    const collapsedBadge = document.getElementById("sidebar-profile-collapsed-badge");
    if (collapsedBadge) {
      collapsedBadge.textContent = `${target}%`;
      collapsedBadge.setAttribute("data-tooltip", `Profile: ${target}% complete`);
    }
  }

  /** Loads the real profile strength and fills the sidebar card. */
  async function loadProfileStrength() {
    try {
      const res = await fetch("/api/candidate/profile", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof applyUserProfile === "function") {
        applyUserProfile(data);
      }
      const strength = data && data.profileStrength;
      if (strength && typeof strength.percentage === "number") {
        animateProfileStrength(strength.percentage, strength.suggestions || []);
        if (typeof updateCertCardFromStrength === "function") {
          updateCertCardFromStrength(strength);
        }
      }
    } catch (error) {
      /* leave the card at its neutral state if the profile is unavailable */
    }
  }

  // Initialize entry animations
  animateCounters();
  animateProfileStrength();
  loadProfileStrength();

  // =========================================================================
  // 12. RESUME MANAGEMENT HUB (UPLOAD, REPLACE, DOWNLOAD, VERSION HISTORY)
  // =========================================================================
  const activeResumeNameEl = document.getElementById("active-resume-name");
  const activeResumeStatusEl = document.getElementById("active-resume-status");
  const activeResumeDetailsEl = document.getElementById(
    "active-resume-details",
  );
  const activeAtsScoreEl = document.getElementById("active-ats-score");
  const atsKeywordValEl = document.getElementById("ats-keyword-val");
  const atsFormatValEl = document.getElementById("ats-format-val");
  const atsContactValEl = document.getElementById("ats-contact-val");
  const atsBreakdownBarsEl = document.getElementById("atsBreakdownBars");
  const atsOverviewHintEl = document.getElementById("atsOverviewHint");
  const statAvgAtsScoreEl = document.getElementById("statAvgAtsScore");
  const avgAtsTrendEl = document.getElementById("avgAtsTrend");

  /**
   * Renders the dashboard ATS overview (score circle + breakdown bars)
   * from a REAL saved ATS evaluation. Rows mirror the backend breakdown
   * categories; categories the job did not require show as N/A.
   */
  function renderAtsOverview(score, breakdown) {
    if (activeAtsScoreEl) activeAtsScoreEl.textContent = `${score}%`;
    if (!atsBreakdownBarsEl) return;
    const categories = [
      { label: "Required Skills", data: breakdown ? breakdown.requiredSkills : null },
      { label: "Preferred Skills", data: breakdown ? breakdown.preferredSkills : null },
      { label: "Experience", data: breakdown ? breakdown.experience : null },
      { label: "Education", data: breakdown ? breakdown.education : null },
      { label: "Certifications &amp; Projects", data: breakdown ? breakdown.certificationsProjects : null }
    ];
    const accents = ["", " accent-green", " accent-teal"];
    const rows = [];
    let accentIndex = 0;
    categories.forEach((cat) => {
      const d = cat.data;
      const applicable = d && d.applicable !== false && typeof d.score === "number";
      const value = applicable ? Math.max(0, Math.min(100, Math.round(d.score))) : null;
      rows.push(``
        + `<div class="breakdown-item">`
        + `<div class="breakdown-label-row"><span>${cat.label}</span>`
        + `<strong>${value === null ? "N/A" : value + "%"}</strong></div>`
        + `<div class="breakdown-track"><div class="breakdown-fill${accents[accentIndex]}"`
        + ` style="width:${value === null ? 0 : value}%"></div></div></div>`);
      accentIndex = (accentIndex + 1) % 3;
    });
    atsBreakdownBarsEl.innerHTML = rows.join("");
  }

  /**
   * Loads the candidate's REAL saved ATS checks (own candidate-self
   * evaluations only) into the dashboard overview.
   *
   * The circle/breakdown belong to the ACTIVE resume version: the newest
   * evaluation whose resumeId matches the active version. An evaluation of an
   * older or different version is never presented as the current resume's
   * score. The Average stat is the genuine mean across saved checks.
   * Viewing them never consumes a check.
   */
  async function refreshDashboardAtsPanel(preloaded) {
    try {
      const listRes = await fetch("/api/candidate/ats-evaluations?page=0&size=50", { credentials: "include" });
      if (!listRes.ok) return;
      const list = await listRes.json();
      const content = (list && Array.isArray(list.content)) ? list.content : [];

      if (statAvgAtsScoreEl) {
        if (content.length) {
          const avg = Math.round(
            content.reduce((sum, c) => sum + (typeof c.score === "number" ? c.score : 0), 0)
            / content.length);
          statAvgAtsScoreEl.textContent = `${avg}%`;
          statAvgAtsScoreEl.setAttribute("data-count", String(avg));
        } else {
          statAvgAtsScoreEl.textContent = "0%";
        }
      }
      // No honest month-over-month data exists for this stat â€” keep hidden.
      if (avgAtsTrendEl) avgAtsTrendEl.style.display = "none";

      const active = getActiveResume();
      // Evaluations recorded before resume versioning have no resumeId; the
      // active version's own attached score (from the resume list) is the
      // authoritative fallback for those.
      const forActive = active
        ? content.find((c) => c.resumeId === active.id)
        : null;
      const target = forActive || (active && active.ats ? active.ats : null);

      if (!target) {
        if (activeAtsScoreEl) activeAtsScoreEl.textContent = "â€“";
        if (atsOverviewHintEl) {
          atsOverviewHintEl.textContent = content.length
            ? "Your active resume has not been evaluated yet. Run an ATS check to see its live score breakdown here."
            : "Run an ATS check to see your live score breakdown here.";
        }
        return;
      }

      let detail = (preloaded && preloaded.id === target.id
        && typeof preloaded.score === "number") ? preloaded : null;
      if (!detail) {
        const detRes = await fetch(`/api/candidate/ats-evaluations/${target.id || target.evaluationId}`, { credentials: "include" });
        if (!detRes.ok) return;
        detail = await detRes.json();
      }
      if (detail && typeof detail.score === "number") {
        renderAtsOverview(detail.score, detail.breakdown);
      }
    } catch (error) {
      /* network failure: keep the last rendered values, retry on next open */
    }
  }
  const atsKeywordBarEl = document.getElementById("ats-keyword-bar");
  const atsFormatBarEl = document.getElementById("ats-format-bar");
  const atsContactBarEl = document.getElementById("ats-contact-bar");

  const btnPreviewResume = document.getElementById("btn-preview-resume");
  const btnDownloadResume = document.getElementById("btn-download-resume");
  const btnDownloadResumeCard = document.getElementById(
    "btn-download-resume-card",
  );
  const btnUploadResume = document.getElementById("btn-upload-resume");
  const btnReplaceResume = document.getElementById("btn-replace-resume");
  const resumeDropzone = document.getElementById("resume-dropzone");
  const btnDropzoneBrowse = document.getElementById("btn-dropzone-browse");
  const resumeFileInput = document.getElementById("resume-file-input");
  const uploadProgressWrapper = document.getElementById(
    "upload-progress-wrapper",
  );
  const uploadingFileNameEl = document.getElementById("uploading-file-name");
  const uploadPercentTextEl = document.getElementById("upload-percent-text");
  const uploadProgressBarEl = document.getElementById("upload-progress-bar");
  const dropzoneContent = document.getElementById("dropzone-content");
  const resumeVersionTbody = document.getElementById("resume-version-tbody");
  const versionCountPill = document.getElementById("version-count-pill");

  // =========================================================================
  // 12b. REAL RESUME DATA (versioned records from the backend)
  // =========================================================================
  // Every row keeps the backend resume id and is rendered from the record the
  // backend returned for that exact version. No filename, size, date or score
  // is ever fabricated on the client.
  let resumeVersions = [];
  let resumePreviewObjectUrl = null;
  let resumePreviewRequestId = 0;
  let currentPreviewResumeId = null;

  function formatBytes(bytes) {
    if (typeof bytes !== "number" || !isFinite(bytes) || bytes <= 0) return "â€”";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatResumeDate(iso) {
    if (!iso) return "â€”";
    const date = new Date(iso);
    if (isNaN(date)) return "â€”";
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) {
      return `Today, ${date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function resumeTypeLabel(mimeType, filename) {
    const name = (filename || "").toLowerCase();
    if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "PDF Document";
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx")
    ) {
      return "DOCX Document";
    }
    return "Document";
  }

  function isPdfResume(resume) {
    return resumeTypeLabel(resume.mimeType, resume.originalFilename) === "PDF Document";
  }

  function canRenderInFrame(resume) {
    if (!resume) return true;
    const mime = (resume.mimeType || "").toLowerCase();
    const name = (resume.originalFilename || "").toLowerCase();
    if (mime.includes("pdf") || name.endsWith(".pdf")) return true;
    if (mime.includes("html") || name.endsWith(".html") || mime.includes("text")) return true;
    return false;
  }

  function approvalLabel(status) {
    if (status === "APPROVED") return "Approved";
    if (status === "PENDING") return "Pending review";
    if (status === "REJECTED") return "Rejected";
    return "â€”";
  }

  function scoreBadgeClass(score) {
    if (score >= 80) return "score-high";
    if (score >= 60) return "score-mid";
    return "score-low";
  }

  function getActiveResume() {
    return resumeVersions.find((item) => item.active) || null;
  }

  /** Loads the authenticated candidate's real resume versions. */
  async function loadResumeData() {
    try {
      const res = await fetch("/api/candidate/resumes", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      resumeVersions = Array.isArray(data && data.content) ? data.content : [];
      renderResumeUI();
      // The ATS circle belongs to the active version, so refresh it once the
      // real resume records (and their attached evaluations) are known.
      refreshDashboardAtsPanel();
      await loadResumeStats();
    } catch (error) {
      /* keep the last rendered state; the page still works from server data */
    }
  }

  function renderResumeUI() {
    const active = getActiveResume();

    if (activeResumeNameEl) {
      activeResumeNameEl.textContent = active
        ? active.originalFilename
        : "No resume uploaded yet";
    }
    if (activeResumeDetailsEl) {
      if (active) {
        activeResumeDetailsEl.innerHTML =
          `${resumeTypeLabel(active.mimeType, active.originalFilename)} &bull; ` +
          `${formatBytes(active.fileSizeBytes)} &bull; Last updated ` +
          `<span id="active-resume-updated">${formatResumeDate(active.uploadedAt)}</span>`;
      } else {
        activeResumeDetailsEl.innerHTML =
          "Upload a PDF or DOCX resume to apply to jobs and be found by recruiters.";
      }
    }
    if (activeResumeStatusEl) {
      activeResumeStatusEl.innerHTML = active
        ? `<span class="status-pulse-dot"></span> Active &bull; ${escapeHtml(approvalLabel(active.approvalStatus))}`
        : `<span class="status-pulse-dot"></span> No active resume`;
      activeResumeStatusEl.classList.toggle("status-pill-muted", !active);
    }

    renderVersionHistory();

    // Keep the job-details "Quick Apply" label honest about the resume used.
    const quickApplyLabel = document.getElementById("quick-apply-resume-label");
    if (quickApplyLabel) {
      quickApplyLabel.textContent = active
        ? `Quick Apply with ${active.originalFilename}`
        : "Upload a resume to Quick Apply";
    }
  }

  function renderVersionHistory() {
    if (!resumeVersionTbody) return;
    resumeVersionTbody.innerHTML = "";

    if (versionCountPill) {
      versionCountPill.textContent = `${resumeVersions.length} item${resumeVersions.length === 1 ? "" : "s"}`;
    }

    if (!resumeVersions.length) {
      const row = document.createElement("tr");
      row.className = "document-row";
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.className = "resume-empty-row";
      cell.textContent = "No resume versions yet. Upload a resume to get started.";
      row.appendChild(cell);
      resumeVersionTbody.appendChild(row);
      return;
    }

    resumeVersions.forEach((item) => {
      const row = document.createElement("tr");
      row.className = "document-row";
      row.setAttribute("data-resume-id", item.id);

      const activeBadge = item.active
        ? '<span class="status-badge-inline-active" style="background:#ECFDF5; color:#059669; font-weight:700; padding:1px 6px; border-radius:4px; margin-left:6px; font-size:0.7rem;">Active</span>'
        : "";

      const atsCell = item.ats && typeof item.ats.score === "number"
        ? `<span class="badge-ats-score ${scoreBadgeClass(item.ats.score)}" title="${escapeHtml(item.ats.jobTitle ? `Evaluated against ${item.ats.jobTitle}` : "Pasted job description")}">
             <span class="score-indicator-dot"></span>
             ${escapeHtml(item.ats.score)}% ATS
           </span>
           <span class="resume-ats-context">${escapeHtml(item.ats.jobTitle || "Pasted job description")}</span>`
        : `<span class="badge-ats-score score-neutral"><span class="score-dash">Not evaluated</span></span>`;

      const setActiveButton = item.active
        ? '<span style="font-size: 0.75rem; font-weight: 700; color: #059669; padding: 4px 8px; margin-right: 4px;">&check; Current</span>'
        : `<button class="btn-version-pill-action btn-set-active" type="button"
             data-resume-id="${escapeHtml(item.id)}"
             ${item.approvalStatus === "APPROVED" ? 'title="Set as primary active resume"' : 'disabled title="Only approved resumes can be set as primary"'}
             >Set Active</button>`;

      row.innerHTML = `
        <td class="td-name">
          <div class="doc-name-cell">
            <div class="doc-type-icon-box resume-icon-bg">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div class="doc-text-meta">
              <span class="doc-filename">${escapeHtml(item.originalFilename || "Resume")}</span>
              <span class="doc-format">
                ${escapeHtml(item.versionLabel)} &bull; ${formatBytes(item.fileSizeBytes)} &bull; ${escapeHtml(approvalLabel(item.approvalStatus))}
                ${activeBadge}
              </span>
            </div>
          </div>
        </td>
        <td class="td-type">
          <span class="badge-type badge-resume">${resumeTypeLabel(item.mimeType, item.originalFilename)}</span>
        </td>
        <td class="td-score">${atsCell}</td>
        <td class="td-edited">
          <span class="edited-text">${formatResumeDate(item.updatedAt || item.uploadedAt || item.createdAt)}</span>
        </td>
        <td class="td-action text-right">
          <div class="action-buttons-cell">
            ${setActiveButton}
            <button class="btn-row-action btn-preview-version" data-resume-id="${item.id}" type="button" title="Preview this resume">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="btn-row-action btn-dl-version" data-resume-id="${item.id}" type="button" title="Download this resume">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button class="btn-row-action btn-delete-version" data-resume-id="${item.id}" type="button" title="Delete this resume" style="color: #EF4444;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </td>
      `;
      resumeVersionTbody.appendChild(row);
    });

    // Each handler reads the resume id from ITS OWN row and passes it on.
    resumeVersionTbody.querySelectorAll(".btn-set-active").forEach((btn) => {
      btn.addEventListener("click", () => {
        activateResumeVersion(btn.getAttribute("data-resume-id"));
      });
    });

    resumeVersionTbody.querySelectorAll(".btn-preview-version").forEach((btn) => {
      btn.addEventListener("click", () => {
        openResumePreview(btn.getAttribute("data-resume-id"));
      });
    });

    resumeVersionTbody.querySelectorAll(".btn-dl-version").forEach((btn) => {
      btn.addEventListener("click", () => {
        downloadResumeVersion(btn.getAttribute("data-resume-id"));
      });
    });

    resumeVersionTbody.querySelectorAll(".btn-delete-version").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteResumeVersion(btn.getAttribute("data-resume-id"));
      });
    });
  }

  /** Promotes a version server-side, then re-renders from the backend truth. */
  async function activateResumeVersion(resumeId) {
    if (!resumeId) return;
    try {
      const res = await withCsrf(`/api/candidate/resumes/${encodeURIComponent(resumeId)}/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setResumeNotice(error?.message || "This resume could not be set as primary.", true);
        toast.error(error?.message || "This resume could not be set as primary.");
        return;
      }
      setResumeNotice("Primary resume updated.", false);
      toast.success("Primary resume updated.");
      await loadResumeData();
      refreshDashboardAtsPanel();
    } catch (error) {
      setResumeNotice("This resume could not be set as primary.", true);
      toast.error("This resume could not be set as primary.");
    }
  }

  /**
   * Deletes one of the candidate's versions server-side (the backend removes
   * the stored file, the record and the active-resume mirror), then re-renders
   * the history and the summary counts from the server truth.
   */
  async function deleteResumeVersion(resumeId) {
    if (!resumeId) return;
    if (!window.confirm("Delete this resume permanently? This also removes its stored PDF file.")) return;
    try {
      const res = await withCsrf(`/api/candidate/resumes/${encodeURIComponent(resumeId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setResumeNotice(error?.message || "This resume could not be deleted.", true);
        toast.error(error?.message || "This resume could not be deleted.");
        return;
      }
      const payload = await res.json().catch(() => null);
      setResumeNotice(payload?.message || "Resume deleted successfully.", false);
      toast.success(payload?.message || "Resume deleted successfully.");
      await loadResumeData();
    } catch (error) {
      setResumeNotice("Network error deleting resume.", true);
      toast.error("Network error deleting resume.");
    }
  }

  function setResumeNotice(message, isError) {
    const el = document.getElementById("resume-action-notice");
    if (!el) return;
    if (!message) {
      el.textContent = "";
      el.classList.add("hidden");
      return;
    }
    el.textContent = message;
    el.style.color = isError ? "#dc2626" : "#059669";
    el.classList.remove("hidden");
  }

  // â”€â”€ Preview: loads the EXACT resume selected in the row â”€â”€

  function setPreviewState(state) {
    const loading = document.getElementById("resume-preview-loading");
    const error = document.getElementById("resume-preview-error");
    const unsupported = document.getElementById("resume-preview-unsupported");
    const frame = document.getElementById("resume-preview-frame");
    if (loading) loading.classList.toggle("hidden", state !== "loading");
    if (error) error.classList.toggle("hidden", state !== "error");
    if (unsupported) unsupported.classList.toggle("hidden", state !== "unsupported");
    if (frame) frame.classList.toggle("hidden", state !== "ready");
  }

  function releaseResumePreviewUrl() {
    if (resumePreviewObjectUrl) {
      URL.revokeObjectURL(resumePreviewObjectUrl);
      resumePreviewObjectUrl = null;
    }
  }

  async function openResumePreview(resumeId) {
    if (!resumeId) return;
    const resume = resumeVersions.find((item) => item.id === resumeId);
    const modal = document.getElementById("modal-resume-preview");
    const titleEl = document.getElementById("resume-preview-title");
    const subtitle = document.getElementById("resume-preview-subtitle");
    const frame = document.getElementById("resume-preview-frame");

    // Invalidate any in-flight request so a slow previous preview can never
    // overwrite the newly selected resume.
    const requestId = ++resumePreviewRequestId;
    currentPreviewResumeId = resumeId;

    if (titleEl) {
      titleEl.textContent = resume?.resumeTitle || resume?.originalFilename || "Resume Preview";
    }
    if (subtitle) {
      const parts = [];
      if (resume?.source) parts.push(resume.source === "CREATED" ? "Created" : "Uploaded");
      if (resume?.versionLabel || resume?.version) parts.push(resume.versionLabel || `v${resume.version}`);
      if (resume?.originalFilename) parts.push(resume.originalFilename);
      subtitle.textContent = parts.length > 0 ? parts.join(" â€¢ ") : "Resume Document";
    }
    if (modal) modal.classList.remove("hidden");

    // DOCX cannot render inline in the browser: be explicit instead of showing
    // a blank frame or the wrong file.
    if (resume && !canRenderInFrame(resume)) {
      releaseResumePreviewUrl();
      if (frame) frame.removeAttribute("src");
      setPreviewState("unsupported");
      return;
    }

    releaseResumePreviewUrl();
    if (frame) frame.removeAttribute("src");
    setPreviewState("loading");

    try {
      const res = await fetch(
        `/api/candidate/resumes/${encodeURIComponent(resumeId)}/file`,
        { credentials: "include" },
      );
      if (requestId !== resumePreviewRequestId) return; // a newer preview won

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        const errorText = document.getElementById("resume-preview-error-text");
        if (errorText) {
          errorText.textContent =
            error?.message || "This resume could not be loaded. It may have been removed.";
        }
        setPreviewState("error");
        return;
      }

      const blob = await res.blob();
      if (requestId !== resumePreviewRequestId) return;

      const mimeType = (resume && resume.mimeType) || res.headers.get("content-type") || "application/pdf";
      const typedBlob = blob.type ? blob : new Blob([blob], { type: mimeType });

      // A fresh object URL per selection; the previous one is revoked above.
      resumePreviewObjectUrl = URL.createObjectURL(typedBlob);
      if (frame) {
        frame.src = resumePreviewObjectUrl;
        setPreviewState("ready");
      }
    } catch (error) {
      if (requestId !== resumePreviewRequestId) return;
      setPreviewState("error");
    }
  }

  // â”€â”€ Download: the exact resume selected in the row â”€â”€

  async function downloadResumeVersion(resumeId) {
    if (!resumeId) return;
    const resume = resumeVersions.find((item) => item.id === resumeId);
    try {
      const res = await fetch(
        `/api/candidate/resumes/${encodeURIComponent(resumeId)}/file?download=true`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setResumeNotice(error?.message || "This resume could not be downloaded.", true);
        toast.error(error?.message || "This resume could not be downloaded.");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = resume?.originalFilename || "resume";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setResumeNotice("This resume could not be downloaded.", true);
      toast.error("This resume could not be downloaded.");
    }
  }

  function downloadActiveResume() {
    const active = getActiveResume();
    if (!active) {
      setResumeNotice("Upload a resume before downloading.", true);
      toast.warning("Upload a resume before downloading.");
      return;
    }
    downloadResumeVersion(active.id);
  }

  // File Upload â€” real progress from the actual request
  function handleResumeUpload(file, isReplace = false) {
    if (!file) return;

    if (dropzoneContent) dropzoneContent.classList.add("hidden");
    if (uploadProgressWrapper) uploadProgressWrapper.classList.remove("hidden");
    if (uploadingFileNameEl)
      uploadingFileNameEl.textContent = `Uploading ${file.name}...`;
    if (uploadPercentTextEl) uploadPercentTextEl.textContent = "0%";
    if (uploadProgressBarEl) uploadProgressBarEl.style.width = "0%";
    setResumeNotice(null, false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", isReplace ? "replace" : "upload");

    const finish = () => {
      if (uploadProgressWrapper) uploadProgressWrapper.classList.add("hidden");
      if (dropzoneContent) dropzoneContent.classList.remove("hidden");
    };

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/candidate/resumes");
    xhr.withCredentials = true;
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      if (uploadPercentTextEl) uploadPercentTextEl.textContent = `${percent}%`;
      if (uploadProgressBarEl) uploadProgressBarEl.style.width = `${percent}%`;
    });
    xhr.addEventListener("load", async () => {
      let payload = null;
      try {
        payload = JSON.parse(xhr.responseText || "null");
      } catch (error) {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        finish();
        setResumeNotice(payload?.message || "Resume uploaded successfully.", false);
        toast.success(payload?.message || "Resume uploaded successfully.");
        // Reload from the backend so the history shows the real new record.
        await loadResumeData();
        refreshDashboardAtsPanel();
      } else {
        finish();
        // Nothing was written on failure: the previous resume stays intact.
        setResumeNotice(
          payload?.message || "The resume could not be uploaded. Nothing was changed.",
          true,
        );
        toast.error(
          payload?.message || "The resume could not be uploaded. Nothing was changed.",
        );
      }
    });
    xhr.addEventListener("error", () => {
      finish();
      setResumeNotice("The resume could not be uploaded. Nothing was changed.", true);
      toast.error("The resume could not be uploaded. Nothing was changed.");
    });
    xhr.send(formData);
  }

  // Upload & Replace Listeners
  let isReplaceAction = false;

  if (btnUploadResume) {
    btnUploadResume.addEventListener("click", () => {
      isReplaceAction = false;
      if (resumeFileInput) resumeFileInput.click();
    });
  }

  if (btnReplaceResume) {
    btnReplaceResume.addEventListener("click", () => {
      isReplaceAction = true;
      if (resumeFileInput) resumeFileInput.click();
    });
  }

  if (btnDropzoneBrowse) {
    btnDropzoneBrowse.addEventListener("click", (e) => {
      e.stopPropagation();
      isReplaceAction = false;
      if (resumeFileInput) resumeFileInput.click();
    });
  }

  if (resumeFileInput) {
    resumeFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleResumeUpload(e.target.files[0], isReplaceAction);
        e.target.value = "";
      }
    });
  }

  // Dropzone drag events
  if (resumeDropzone) {
    resumeDropzone.addEventListener("click", () => {
      isReplaceAction = false;
      if (resumeFileInput) resumeFileInput.click();
    });

    ["dragenter", "dragover"].forEach((evt) => {
      resumeDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        resumeDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      resumeDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        resumeDropzone.classList.remove("dragover");
      });
    });

    resumeDropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleResumeUpload(e.dataTransfer.files[0], false);
      }
    });
  }

  // Download buttons - always the real active version
  if (btnDownloadResume) {
    btnDownloadResume.addEventListener("click", () => downloadActiveResume());
  }

  if (btnDownloadResumeCard) {
    btnDownloadResumeCard.addEventListener("click", () => downloadActiveResume());
  }

  // Preview button - opens the real active resume
  if (btnPreviewResume) {
    btnPreviewResume.addEventListener("click", () => {
      const active = getActiveResume();
      if (!active) {
        setResumeNotice("Upload a resume before previewing it.", true);
        toast.warning("Upload a resume before previewing it.");
        return;
      }
      openResumePreview(active.id);
    });
  }

  // Initial render of Resume UI from real backend records
  renderResumeUI();
  loadResumeData();
  // Real ATS overview + Average ATS Score from the candidate's saved checks
  refreshDashboardAtsPanel();

  // =========================================================================
  // 12c. RESUME COUNT HISTORY & MODAL (Real MongoDB Records)
  // =========================================================================
  let resumeStats = {
    totalResumes: 0,
    createdCount: 0,
    uploadedCount: 0,
    lastUpdated: null,
    lastUpdatedFormatted: "None",
  };

  async function loadResumeStats() {
    try {
      const res = await fetch("/api/candidate/resumes/stats", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        resumeStats = {
          totalResumes: typeof data.totalResumes === "number" ? data.totalResumes : 0,
          createdCount: typeof data.createdCount === "number" ? data.createdCount : 0,
          uploadedCount: typeof data.uploadedCount === "number" ? data.uploadedCount : 0,
          lastUpdated: data.lastUpdated || null,
          lastUpdatedFormatted:
            data.lastUpdatedFormatted ||
            (data.lastUpdated ? formatResumeDate(data.lastUpdated) : "None"),
        };
        renderResumeStatsUI();
      }
    } catch (e) {
      /* silently ignore network failures */
    }
  }

  function renderResumeStatsUI() {
    const elTotal = document.getElementById("rch-total-count");
    const elCreated = document.getElementById("rch-created-count");
    const elUploaded = document.getElementById("rch-uploaded-count");
    const elUpdated = document.getElementById("rch-last-updated");

    const statResCreated = document.getElementById("stat-resumes-created");
    if (statResCreated) {
      statResCreated.textContent = resumeStats.createdCount;
      statResCreated.setAttribute("data-count", String(resumeStats.createdCount));
    }
    if (elTotal) elTotal.textContent = resumeStats.totalResumes;
    if (elCreated) elCreated.textContent = resumeStats.createdCount;
    if (elUploaded) elUploaded.textContent = resumeStats.uploadedCount;
    if (elUpdated) {
      elUpdated.textContent = resumeStats.lastUpdatedFormatted || "None";
    }

    const mTotal = document.getElementById("modal-hist-total");
    const mCreated = document.getElementById("modal-hist-created");
    const mUploaded = document.getElementById("modal-hist-uploaded");
    const mUpdated = document.getElementById("modal-hist-last-updated");

    if (mTotal) mTotal.textContent = resumeStats.totalResumes;
    if (mCreated) mCreated.textContent = resumeStats.createdCount;
    if (mUploaded) mUploaded.textContent = resumeStats.uploadedCount;
    if (mUpdated) mUpdated.textContent = resumeStats.lastUpdatedFormatted || "None";
  }

  const btnViewResumeHistory = document.getElementById("rch-view-history-btn");
  const modalResumeHistory = document.getElementById("modal-resume-history");
  const closeResumeHistoryBtn = document.getElementById(
    "close-resume-history-modal",
  );
  const btnCloseHistoryModal = document.getElementById(
    "btn-close-history-modal",
  );
  const resumeHistoryTbody = document.getElementById("resume-history-tbody");
  const resumeHistoryEmpty = document.getElementById("resume-history-empty");

  function openResumeHistoryModal() {
    if (!modalResumeHistory) return;
    renderResumeHistoryModal();
    modalResumeHistory.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeResumeHistoryModal() {
    if (!modalResumeHistory) return;
    modalResumeHistory.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function renderResumeHistoryModal() {
    renderResumeStatsUI();
    if (!resumeHistoryTbody) return;
    resumeHistoryTbody.innerHTML = "";

    if (!resumeVersions || resumeVersions.length === 0) {
      if (resumeHistoryEmpty) resumeHistoryEmpty.classList.remove("hidden");
      return;
    }

    if (resumeHistoryEmpty) resumeHistoryEmpty.classList.add("hidden");

    resumeVersions.forEach((item) => {
      const tr = document.createElement("tr");
      const isCreated = (item.source || "").toUpperCase() === "CREATED";
      const sourceBadge = isCreated
        ? '<span class="badge-source-created">âœ¦ Created</span>'
        : '<span class="badge-source-uploaded">â¬† Uploaded</span>';

      const statusBadge = item.active
        ? '<span class="badge-status-active">â— Active Primary</span>'
        : '<span class="badge-status-inactive">â—‹ Stored</span>';

      const title = escapeHtml(
        item.resumeTitle || item.originalFilename || "Resume",
      );
      const createdDate = formatResumeDate(item.uploadedAt || item.createdAt);
      const updatedDate = formatResumeDate(
        item.updatedAt || item.uploadedAt || item.createdAt,
      );

      tr.innerHTML = `
        <td>
          <div class="resume-name-cell">
            <div class="resume-icon-box">${isCreated ? "ðŸ“" : "ðŸ“„"}</div>
            <div>
              <strong style="color: #0F172A; font-size: 0.88rem; display: block; margin-bottom: 2px;">${title}</strong>
              <div style="font-size: 0.75rem; color: #64748B;">${escapeHtml(item.versionLabel || ("v" + item.version))} &bull; ${formatBytes(item.fileSizeBytes || 0)}</div>
            </div>
          </div>
        </td>
        <td>${sourceBadge}</td>
        <td style="color: #475569; font-size: 0.82rem; white-space: nowrap;">${createdDate}</td>
        <td style="color: #475569; font-size: 0.82rem; white-space: nowrap;">${updatedDate}</td>
        <td style="white-space: nowrap;">${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <div class="rch-actions-cell">
            <button type="button" class="rch-btn-view btn-hist-preview" data-id="${escapeHtml(item.id)}" title="Preview resume">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>View</span>
            </button>
            <button type="button" class="rch-btn-download btn-hist-download" data-id="${escapeHtml(item.id)}" title="Download resume file">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download</span>
            </button>
          </div>
        </td>
      `;

      const btnPrev = tr.querySelector(".btn-hist-preview");
      if (btnPrev) {
        btnPrev.addEventListener("click", () => {
          closeResumeHistoryModal();
          openResumePreview(item.id);
        });
      }

      const btnDown = tr.querySelector(".btn-hist-download");
      if (btnDown) {
        btnDown.addEventListener("click", () => {
          downloadResumeVersion(item.id);
        });
      }

            resumeHistoryTbody.appendChild(tr);
    });
  }

  if (btnViewResumeHistory) {
    btnViewResumeHistory.addEventListener("click", () =>
      openResumeHistoryModal(),
    );
  }
  if (closeResumeHistoryBtn) {
    closeResumeHistoryBtn.addEventListener("click", () =>
      closeResumeHistoryModal(),
    );
  }
  if (btnCloseHistoryModal) {
    btnCloseHistoryModal.addEventListener("click", () =>
      closeResumeHistoryModal(),
    );
  }
  if (modalResumeHistory) {
    modalResumeHistory.addEventListener("click", (e) => {
      if (e.target === modalResumeHistory) closeResumeHistoryModal();
    });
  }

  loadResumeStats();


  // =========================================================================
  // 13. JOB OPENINGS & SMART MATCHES (FILTER, SORT & INTERESTED BUTTON)
  // =========================================================================
  const jobsCardsGrid = document.getElementById("jobs-cards-grid");
  const jobsEmptyState = document.getElementById("jobs-empty-state");
  const jobsTotalCountBadge = document.getElementById("jobs-total-count-badge");
  const interestedCountNum = document.getElementById("interested-count-num");
  const btnFilterInterestedToggle = document.getElementById(
    "btn-filter-interested-toggle",
  );

  const jobSearchTitleInput = document.getElementById("job-title-search");
  const jobTechFilterSelect = document.getElementById("job-tech-filter");
  const jobLocationFilterSelect = document.getElementById(
    "job-location-filter",
  );
  const jobWorkmodeFilterSelect = document.getElementById(
    "job-workmode-filter",
  );
  const jobSortSelect = document.getElementById("job-sort-select");
  const jobActiveTagsList = document.getElementById("job-active-tags-list");
  const btnClearJobFilters = document.getElementById("btn-clear-job-filters");
  const btnEmptyResetJobs = document.getElementById("btn-empty-reset-jobs");

  // Job Openings Dataset (loaded from live backend /api/candidate/jobs)
  let jobOpeningsData = [];
  let isInterestedOnlyFilter = false;

  function updateInterestedCounter() {
    const interestedCount = jobOpeningsData.filter(
      (j) => j.isInterested,
    ).length;
    if (interestedCountNum) interestedCountNum.textContent = interestedCount;
    if (btnFilterInterestedToggle) {
      if (isInterestedOnlyFilter) {
        btnFilterInterestedToggle.classList.add("active");
      } else {
        btnFilterInterestedToggle.classList.remove("active");
      }
    }
  }

  function filterAndSortJobs() {
    if (!jobsCardsGrid) return;

    const searchKeyword = (jobSearchTitleInput ? jobSearchTitleInput.value : "")
      .trim()
      .toLowerCase();
    const techFilter = jobTechFilterSelect
      ? jobTechFilterSelect.value.toLowerCase()
      : "all";
    const locFilter = jobLocationFilterSelect
      ? jobLocationFilterSelect.value.toLowerCase()
      : "all";
    const modeFilter = jobWorkmodeFilterSelect
      ? jobWorkmodeFilterSelect.value.toLowerCase()
      : "all";
    const sortVal = jobSortSelect ? jobSortSelect.value : "match-desc";

    // 1. Filter
    let filtered = jobOpeningsData.filter((job) => {
      // Interested only
      if (isInterestedOnlyFilter && !job.isInterested) {
        return false;
      }

      // Search Keyword (Title, Company, TechStack)
      if (searchKeyword.length > 0) {
        const matchesTitle = job.title.toLowerCase().includes(searchKeyword);
        const matchesCompany = job.company
          .toLowerCase()
          .includes(searchKeyword);
        const matchesSummary = job.summary
          .toLowerCase()
          .includes(searchKeyword);
        const matchesStack = job.techStack.some((t) =>
          t.toLowerCase().includes(searchKeyword),
        );
        if (
          !matchesTitle &&
          !matchesCompany &&
          !matchesSummary &&
          !matchesStack
        ) {
          return false;
        }
      }

      // Tech Stack
      if (techFilter !== "all") {
        const hasTech = job.techStack.some((t) =>
          t.toLowerCase().includes(techFilter),
        );
        if (!hasTech) return false;
      }

      // Location
      if (locFilter !== "all") {
        if (!job.location.toLowerCase().includes(locFilter)) {
          return false;
        }
      }

      // Work Mode
      if (modeFilter !== "all") {
        if (job.workMode !== modeFilter) {
          return false;
        }
      }

      return true;
    });

    // 2. Sort
    filtered.sort((a, b) => {
      if (sortVal === "match-desc") {
        // Jobs without a real server-provided match score sort last (null-safe).
        return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      } else if (sortVal === "title-asc") {
        return a.title.localeCompare(b.title);
      } else if (sortVal === "title-desc") {
        return b.title.localeCompare(a.title);
      } else if (sortVal === "salary-desc") {
        return b.salaryNumeric - a.salaryNumeric;
      } else if (sortVal === "recent") {
        return 0; // retain initial recent ordering
      }
      return 0;
    });

    // 3. Render Cards
    jobsCardsGrid.innerHTML = "";

    if (filtered.length === 0) {
      if (jobsEmptyState) jobsEmptyState.classList.remove("hidden");
    } else {
      if (jobsEmptyState) jobsEmptyState.classList.add("hidden");

      filtered.forEach((job) => {
        const card = document.createElement("article");
        card.className = "job-card fade-in-up";
        card.setAttribute("data-id", job.id);

        const techTagsHtml = job.techStack
          /* Job listing card: technology names render as plain text; SVG
             icons are reserved for the full job-description modal. */
          .map((t) => techPillHTML(t, "tech-tag-pill"))
          .join("");

        card.innerHTML = `
          <div class="job-card-top">
            <div class="company-avatar-box" style="background: ${job.logoBg};">
              ${job.logoInitials}
            </div>
            <div class="job-card-meta">
              <div class="company-name-row">
                <span>${job.company}</span>
                <span>&bull;</span>
                <span>${job.postedTime}</span>
              </div>
              <h3 class="job-role-title">${job.title}</h3>
            </div>
            ${
              job.matchScore != null
                ? `<div class="match-score-pill" title="ATS Profile Compatibility">
                     <span class="status-dot"></span>
                     ${job.matchScore}% Match
                   </div>`
                : ""
            }
          </div>

          <div class="job-card-location-row">
            <span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 2px;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              ${job.location}
            </span>
            <span class="work-mode-pill ${job.workMode}">${job.workMode.toUpperCase()}</span>
            <span class="job-salary-pill">${job.salary}</span>
          </div>

          <p class="job-summary-text"></p>

          <div class="job-stack-tags">
            ${techTagsHtml}
          </div>

          <div class="job-card-footer">
            <button
              class="btn-job-interest ${job.isInterested ? "interested" : ""}"
              data-id="${job.id}"
              type="button"
              aria-pressed="${job.isInterested ? "true" : "false"}"
              title="${job.isInterested ? "Click to withdraw interest" : "Click to mark as interested"}"
            >
              ${
                job.isInterested
                  ? `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <polyline points="20 6 9 17 4 12"></polyline>
                   </svg>
                   <span>Interested &check;</span>`
                  : `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                     <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                   </svg>
                   <span>Interested</span>`
              }
            </button>

            <button class="btn-job-details" data-id="${job.id}" type="button">
              <span>View Details</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        `;

        jobsCardsGrid.appendChild(card);
      });

      // Attach card listeners
      attachJobCardListeners();
    }

    // Update Header Pill
    if (jobsTotalCountBadge) {
      jobsTotalCountBadge.textContent = `${filtered.length} Open Role${filtered.length === 1 ? "" : "s"}`;
    }

    renderActiveFilterTags();
    updateInterestedCounter();
  }

  function attachJobCardListeners() {
    if (!jobsCardsGrid) return;

    // "Interested" toggle buttons
    const interestBtns = jobsCardsGrid.querySelectorAll(".btn-job-interest");
    interestBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const jobId = btn.getAttribute("data-id");
        toggleJobInterest(jobId);
      });
    });

    // "View Details" buttons
    const detailsBtns = jobsCardsGrid.querySelectorAll(".btn-job-details");
    detailsBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const jobId = btn.getAttribute("data-id");
        openJobDetailsModal(jobId);
      });
    });
  }

  /**
   * Maps a failed apply/withdraw response to an honest user-facing message,
   * following the backend's status conventions instead of a generic alert.
   */
  async function alertJobActionError(res, actionLabel) {
    const errData = await res.json().catch(() => ({}));
    const backendMessage = (errData && (errData.message || errData.error)) || "";

    if (res.status === 401) {
      sessionStorage.setItem(
        "euodoo-pending-toast",
        JSON.stringify({
          type: "error",
          message: "Your session has expired or you are not logged in. Please log in again.",
        }),
      );
      window.location.href = "/login";
      return;
    }
    if (res.status === 403) {
      toast.error(
        backendMessage ||
          `Access denied: your account cannot ${actionLabel}. Paid plan candidates may need an active subscription.`,
      );
      return;
    }
    if (res.status === 404) {
      toast.error(`This job is no longer available. Please refresh the page and try again.`);
      return;
    }
    if (res.status === 410 || (errData && errData.code === "JOB_NOT_ACTIVE")) {
      toast.error(backendMessage || "This job is not accepting applications.");
      return;
    }
    toast.error(backendMessage || `Failed to ${actionLabel}. Please try again later.`);
  }

  async function toggleJobInterest(jobId) {
    const job = jobOpeningsData.find((j) => j.id === jobId);
    if (!job) return;

    if (!job.isInterested) {
      try {
        const res = await withCsrf(`/api/candidate/jobs/${encodeURIComponent(jobId)}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const application = await res.json().catch(() => null);
          if (application && application.id) job.applicationId = application.id;
          job.isInterested = true;
          syncModalInterestButton(job);
          filterAndSortJobs();
          refreshInterestedJobsModal();
          if (typeof syncRealShortlistedApplications === "function") {
            syncRealShortlistedApplications();
          }
          toast.success("Application submitted successfully.");
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg = (errData && (errData.message || errData.error)) || "";
          if (msg.toLowerCase().includes("already")) {
            // Duplicate application: reflect the real saved state instead of failing.
            job.isInterested = true;
            syncModalInterestButton(job);
            filterAndSortJobs();
            refreshInterestedJobsModal();
            toast.warning("You have already applied to this job.");
          } else {
            await alertJobActionError(res, "apply for this job");
          }
        }
      } catch (err) {
        // Network failure or server unreachable: keep the REAL state (not interested).
        console.error("Apply error:", err);
        toast.error(
          "Unable to connect to the server. Your interest was NOT saved. Please check your connection and try again.",
        );
      }
    } else {
      // Toggling off = withdraw the real application record, not just the UI flag.
      if (!job.applicationId) {
        // No application record known (stale state): refresh from the backend truth.
        await syncRealPublishedJobs();
        return;
      }
      try {
        const res = await withCsrf(
          `/api/candidate/applications/${encodeURIComponent(job.applicationId)}/withdraw`,
          { method: "POST" },
        );
        if (res.ok) {
          job.isInterested = false;
          syncModalInterestButton(job);
          filterAndSortJobs();
          refreshInterestedJobsModal();
          toast.success("Application withdrawn.");
        } else {
          // e.g. already shortlisted / hired / withdrawn â€” surface the real reason.
          await alertJobActionError(res, "withdraw your interest");
        }
      } catch (err) {
        console.error("Withdraw interest error:", err);
        toast.error(
          "Unable to connect to the server. Your interest is still saved. Please try again.",
        );
      }
    }
  }

  // =========================================================================
  // 13b. INTERESTED JOBS DIALOG (REAL SAVED JOBS FROM MONGODB APPLICATIONS)
  // =========================================================================
  /** Re-renders the Interested Jobs dialog only while it is open on screen. */
  function refreshInterestedJobsModal() {
    const modal = document.getElementById("modal-interested-jobs");
    if (modal && !modal.classList.contains("hidden")) {
      renderInterestedJobsModal();
    }
  }

  function openInterestedJobsModal() {
    renderInterestedJobsModal();
    const modal = document.getElementById("modal-interested-jobs");
    if (modal) modal.classList.remove("hidden");
  }

  function renderInterestedJobsModal() {
    const listEl = document.getElementById("modal-interested-jobs-list");
    const emptyEl = document.getElementById("modal-interested-empty-state");
    const countEl = document.getElementById("modal-interested-count");
    if (!listEl) return;

    const interestedJobs = jobOpeningsData.filter((j) => j.isInterested);
    listEl.innerHTML = "";

    if (emptyEl) {
      emptyEl.classList.toggle("hidden", interestedJobs.length > 0);
    }
    if (countEl) {
      countEl.textContent = String(interestedJobs.length);
    }

    interestedJobs.forEach((job) => {
      const card = document.createElement("article");
      card.className = "job-card interested-modal-job-card";
      card.setAttribute("data-id", job.id);

      const techTagsHtml = job.techStack
        /* Interested-jobs listing: technology names render as plain text
           (SVG icons only on the full job-description modal). */
        .map((t) => techPillHTML(t, "tech-tag-pill"))
        .join("");

      card.innerHTML = `
        <div class="job-card-top">
          <div class="company-avatar-box" style="background: ${job.logoBg};">
            ${job.logoInitials}
          </div>
          <div class="job-card-meta">
            <div class="company-name-row">
              <span>${job.company}</span>
              <span>&bull;</span>
              <span>${job.postedTime}</span>
            </div>
            <h3 class="job-role-title">${job.title}</h3>
          </div>
          <div class="match-score-pill" title="ATS Profile Compatibility">
            <span class="status-dot"></span>
            ${job.matchScore}% Match
          </div>
        </div>

        <div class="job-card-location-row">
          <span>${job.location}</span>
          <span class="work-mode-pill ${job.workMode}">${job.workMode.toUpperCase()}</span>
          <span class="job-salary-pill">${job.salary}</span>
        </div>

        <p class="job-summary-text"></p>

        <div class="job-stack-tags">
          ${techTagsHtml}
        </div>

        <div class="job-card-footer">
          <button class="btn-job-view-details" data-id="${job.id}" type="button">
            <span>View Details</span>
          </button>
          <button class="btn-job-interest interested" data-id="${job.id}" type="button">
            <span>Interested &check;</span>
          </button>
        </div>
      `;
      listEl.appendChild(card);
    });

    // Reuse the same handlers as the Job Openings grid: View Details opens the
    // real job modal; Interested toggles the real withdrawal of interest.
    listEl.querySelectorAll(".btn-job-view-details").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openJobDetailsModal(btn.getAttribute("data-id"));
      });
    });
    listEl.querySelectorAll(".btn-job-interest").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleJobInterest(btn.getAttribute("data-id"));
      });
    });
  }

  async function syncRealPublishedJobs() {
    try {
      const [jobsRes, appsRes] = await Promise.all([
        fetch("/api/candidate/jobs?page=0&size=50", { credentials: "include" }),
        fetch("/api/candidate/applications?page=0&size=50", { credentials: "include" })
      ]);
      if (!jobsRes.ok) {
        jobOpeningsData = [];
        filterAndSortJobs();
        return;
      }
      const jobsData = await jobsRes.json();
      const realJobs = (jobsData && jobsData.content) ? jobsData.content : [];

      let appliedJobIds = new Set();
      const applicationIdByJobId = new Map();
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        const appsList = (appsData && appsData.content) ? appsData.content : [];
        // A WITHDRAWN / REJECTED record no longer counts as active interest;
        // otherwise a past withdrawn application would keep resurfacing this
        // job as "Interested" after every refresh.
        appsList.forEach(a => {
          if (!a.jobId) return;
          if (a.status === "WITHDRAWN" || a.status === "REJECTED") return;
          appliedJobIds.add(a.jobId);
          if (a.id) applicationIdByJobId.set(a.jobId, a.id);
        });
      }

      // Sync applications count stat card
      const statAppsSent = document.getElementById("stat-applications-sent");
      if (statAppsSent) {
        statAppsSent.textContent = String(appliedJobIds.size);
        statAppsSent.setAttribute("data-count", String(appliedJobIds.size));
      }
      const inReviewEl = document.getElementById("stat-in-review-count");
      if (inReviewEl) {
        inReviewEl.textContent = `${appliedJobIds.size} submitted`;
      }

      const JOB_GRADIENTS = [
        "linear-gradient(135deg, #0d9488 0%, #047857 100%)",
        "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
        "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
        "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
        "linear-gradient(135deg, #059669 0%, #047857 100%)",
        "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
      ];

      jobOpeningsData = realJobs.map((rj, idx) => {
        const minSal = rj.minSalaryInr ? Math.round(rj.minSalaryInr / 100000) : null;
        const maxSal = rj.maxSalaryInr ? Math.round(rj.maxSalaryInr / 100000) : null;
        let salaryText = "â€”";
        if (minSal != null && maxSal != null) {
          salaryText = `â‚¹${minSal} - â‚¹${maxSal} LPA`;
        } else if (minSal != null) {
          salaryText = `From â‚¹${minSal} LPA`;
        } else if (maxSal != null) {
          salaryText = `Up to â‚¹${maxSal} LPA`;
        }

        // Real company name resolved server-side; when the job has no company
        // link the name is unknown â€” show "â€”", never an invented brand.
        const company = rj.companyName || "â€”";
        const title = rj.title || "â€”";

        return {
          id: rj.id,
          title: title,
          company: company,
          location: rj.location || "â€”",
          workMode: (rj.workMode || "â€”").toLowerCase(),
          salary: salaryText,
          salaryNumeric: rj.maxSalaryInr || 0,
          // Only a real server-provided match score may be rendered; a missing
          // score stays null so no fake percentage is displayed.
          matchScore: typeof rj.matchScore === "number" ? rj.matchScore : null,
          techStack: (Array.isArray(rj.techStack) && rj.techStack.length) ? rj.techStack : (Array.isArray(rj.requiredSkills) && rj.requiredSkills.length ? rj.requiredSkills : []),
          summary: rj.description || "",
          postedTime: rj.createdAt ? new Date(rj.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "â€”",
          isInterested: appliedJobIds.has(rj.id),
          applicationId: applicationIdByJobId.get(rj.id) || null,
          logoInitials: (company ? company.charAt(0) : "J").toUpperCase(),
          logoBg: JOB_GRADIENTS[idx % JOB_GRADIENTS.length],
          description: rj.description || "",
          // Only the job's own responsibilities list; nothing generated.
          requirements: rj.responsibilities ? rj.responsibilities.split("\n").filter(Boolean) : []
        };
      });

      filterAndSortJobs();
      updateInterestedCounter();
    } catch (err) {
      console.warn("Failed to sync published jobs:", err);
      jobOpeningsData = [];
      filterAndSortJobs();
    }
  }
  syncRealPublishedJobs();

  function renderActiveFilterTags() {
    if (!jobActiveTagsList || !btnClearJobFilters) return;

    jobActiveTagsList.innerHTML = "";
    const tags = [];

    const searchKeyword = jobSearchTitleInput
      ? jobSearchTitleInput.value.trim()
      : "";
    if (searchKeyword)
      tags.push({
        label: `Title: "${searchKeyword}"`,
        clear: () => {
          jobSearchTitleInput.value = "";
        },
      });

    if (jobTechFilterSelect && jobTechFilterSelect.value !== "all") {
      tags.push({
        label: `Tech: ${jobTechFilterSelect.options[jobTechFilterSelect.selectedIndex].text}`,
        clear: () => {
          jobTechFilterSelect.value = "all";
        },
      });
    }

    if (jobLocationFilterSelect && jobLocationFilterSelect.value !== "all") {
      tags.push({
        label: `Location: ${jobLocationFilterSelect.options[jobLocationFilterSelect.selectedIndex].text}`,
        clear: () => {
          jobLocationFilterSelect.value = "all";
        },
      });
    }

    if (jobWorkmodeFilterSelect && jobWorkmodeFilterSelect.value !== "all") {
      tags.push({
        label: `Mode: ${jobWorkmodeFilterSelect.options[jobWorkmodeFilterSelect.selectedIndex].text}`,
        clear: () => {
          jobWorkmodeFilterSelect.value = "all";
        },
      });
    }

    if (isInterestedOnlyFilter) {
      tags.push({
        label: "Filter: Interested Only",
        clear: () => {
          isInterestedOnlyFilter = false;
        },
      });
    }

    if (tags.length > 0) {
      btnClearJobFilters.classList.remove("hidden");
      tags.forEach((t) => {
        const tagEl = document.createElement("span");
        tagEl.className = "active-filter-tag";
        tagEl.innerHTML = `
          <span>${t.label}</span>
          <button type="button" aria-label="Remove filter">&times;</button>
        `;
        tagEl.querySelector("button").addEventListener("click", () => {
          t.clear();
          filterAndSortJobs();
        });
        jobActiveTagsList.appendChild(tagEl);
      });
    } else {
      btnClearJobFilters.classList.add("hidden");
    }
  }

  function resetAllJobFilters() {
    if (jobSearchTitleInput) jobSearchTitleInput.value = "";
    if (jobTechFilterSelect) jobTechFilterSelect.value = "all";
    if (jobLocationFilterSelect) jobLocationFilterSelect.value = "all";
    if (jobWorkmodeFilterSelect) jobWorkmodeFilterSelect.value = "all";
    if (jobSortSelect) jobSortSelect.value = "match-desc";
    isInterestedOnlyFilter = false;
    filterAndSortJobs();
  }

  // Filter input event listeners
  if (jobSearchTitleInput) {
    jobSearchTitleInput.addEventListener("input", () => filterAndSortJobs());
  }

  if (jobTechFilterSelect) {
    jobTechFilterSelect.addEventListener("change", () => filterAndSortJobs());
  }

  if (jobLocationFilterSelect) {
    jobLocationFilterSelect.addEventListener("change", () =>
      filterAndSortJobs(),
    );
  }

  if (jobWorkmodeFilterSelect) {
    jobWorkmodeFilterSelect.addEventListener("change", () =>
      filterAndSortJobs(),
    );
  }

  if (jobSortSelect) {
    jobSortSelect.addEventListener("change", () => filterAndSortJobs());
  }

  if (btnFilterInterestedToggle) {
    btnFilterInterestedToggle.addEventListener("click", () => {
      isInterestedOnlyFilter = !isInterestedOnlyFilter;
      filterAndSortJobs();
    });
  }

  if (btnClearJobFilters) {
    btnClearJobFilters.addEventListener("click", resetAllJobFilters);
  }

  if (btnEmptyResetJobs) {
    btnEmptyResetJobs.addEventListener("click", resetAllJobFilters);
  }

  // Initial render of Job Openings
  filterAndSortJobs();

  // =========================================================================
  // 14. PORTFOLIO STUDIO & PROJECT LINKS SHOWCASE
  // =========================================================================
  const addProjectCard = document.getElementById("add-project-card");
  const btnOpenAddProject = document.getElementById("btn-open-add-project");
  const btnCloseProjectCard = document.getElementById("btn-close-project-card");
  const btnCancelProject = document.getElementById("btn-cancel-project");
  const newProjectForm = document.getElementById("new-project-form");
  const portfolioProjectsGrid = document.getElementById(
    "portfolio-projects-grid",
  );
  const btnCopyPortfolioLink = document.getElementById(
    "btn-copy-portfolio-link",
  );

  const projectTitleInput = document.getElementById("project-title-input");
  const projectCategorySelect = document.getElementById(
    "project-category-select",
  );
  const projectDemoInput = document.getElementById("project-demo-input");
  const projectGithubInput = document.getElementById("project-github-input");
  const projectTechInput = document.getElementById("project-tech-input");
  const projectDescInput = document.getElementById("project-desc-input");

  // Initial Projects List (loaded from backend /api/candidate/portfolio)
  let portfolioProjects = [];

  function openAddProjectForm() {
    if (addProjectCard) {
      addProjectCard.classList.remove("hidden");
      if (projectTitleInput) {
        projectTitleInput.focus();
      }
    }
  }

  function closeAddProjectForm() {
    if (addProjectCard) {
      addProjectCard.classList.add("hidden");
    }
    if (newProjectForm) {
      newProjectForm.reset();
    }
  }

  function renderPortfolioProjects() {
    if (!portfolioProjectsGrid) return;
    portfolioProjectsGrid.innerHTML = "";

    portfolioProjects.forEach((proj, idx) => {
      const card = document.createElement("article");
      card.className = "portfolio-project-card fade-in-up";
      card.setAttribute("data-id", proj.id);

      const stackPills = proj.techStack
        /* Portfolio card: technology names render as plain text (SVG icons
           only on the full job-description modal). */
        .map((s) => techPillHTML(s, "project-tech-pill"))
        .join("");

      card.innerHTML = `
        <span class="project-category-badge">${proj.category}</span>
        <h3 class="project-card-title">${proj.title}</h3>
        <p class="project-card-desc">${proj.description}</p>
        <div class="project-stack-wrap">
          ${stackPills}
        </div>
        <div class="project-links-bar">
          ${
            proj.demoUrl
              ? `
            <a class="btn-project-link demo" href="https://${proj.demoUrl}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Live Demo</span>
            </a>
          `
              : ""
          }
          ${
            proj.githubUrl
              ? `
            <a class="btn-project-link github" href="https://github.com/${proj.githubUrl}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
          `
              : ""
          }
          <button class="btn-project-link icon-only btn-copy-proj-link" data-url="${proj.demoUrl || proj.githubUrl}" type="button" title="Copy link">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="btn-delete-project" data-index="${idx}" type="button" title="Remove project from portfolio">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      portfolioProjectsGrid.appendChild(card);
    });

    // Copy link listeners
    portfolioProjectsGrid
      .querySelectorAll(".btn-copy-proj-link")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const url = btn.getAttribute("data-url");
          if (navigator.clipboard) {
            navigator.clipboard.writeText(`https://${url}`);
          }
        });
      });

    // Delete listeners
    portfolioProjectsGrid
      .querySelectorAll(".btn-delete-project")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          portfolioProjects.splice(idx, 1);
          renderPortfolioProjects();
        });
      });
  }

  if (btnOpenAddProject) {
    btnOpenAddProject.addEventListener("click", () => {
      openPortfolioBuilderModal();
    });
  }

  if (btnCloseProjectCard) {
    btnCloseProjectCard.addEventListener("click", closeAddProjectForm);
  }

  if (btnCancelProject) {
    btnCancelProject.addEventListener("click", closeAddProjectForm);
  }

  if (btnCopyPortfolioLink) {
    btnCopyPortfolioLink.addEventListener("click", () => {
      const liveUrl = (userAccount && userAccount.portfolioUrl) || "https://portfolio.live";
      if (navigator.clipboard) {
        navigator.clipboard.writeText(liveUrl);
      }
    });
  }

  // Handle New Project Form Submit
  if (newProjectForm) {
    newProjectForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const title = projectTitleInput ? projectTitleInput.value.trim() : "";
      const category = projectCategorySelect
        ? projectCategorySelect.value
        : "Web Application";
      let demoUrl = projectDemoInput
        ? projectDemoInput.value.trim().replace(/^https?:\/\//, "")
        : "";
      let githubUrl = projectGithubInput
        ? projectGithubInput.value
            .trim()
            .replace(/^https?:\/\/github\.com\//, "")
        : "";
      const techStackStr = projectTechInput
        ? projectTechInput.value.trim()
        : "";
      const desc = projectDescInput ? projectDescInput.value.trim() : "";

      if (!title || !desc) {
        return;
      }

      const techStack = techStackStr
        ? techStackStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : ["React", "TypeScript", "Tailwind CSS"];

      const newProj = {
        id: `proj-${Date.now()}`,
        title: title,
        category: category,
        demoUrl: demoUrl,
        githubUrl: githubUrl,
        techStack: techStack,
        description: desc,
      };

      portfolioProjects.unshift(newProj);
      renderPortfolioProjects();
      closeAddProjectForm();
    });
  }

  // Initial render of Portfolio Projects
  renderPortfolioProjects();

  // =========================================================================
  // 15. UNIVERSAL MODALS HANDLING (RESUME PREVIEW, JOB DETAILS, ATS BUILDER)
  // =========================================================================
  const modalResumePreview = document.getElementById("modal-resume-preview");
  const closePreviewModal = document.getElementById("close-preview-modal");
  const btnModalPrintResume = document.getElementById("btn-modal-print-resume");
  const btnModalDownloadResume = document.getElementById(
    "btn-modal-download-resume",
  );

  const modalJobDetails = document.getElementById("modal-job-details");
  const closeJobModal = document.getElementById("close-job-modal");
  const modalJobTitle = document.getElementById("job-modal-title");
  const modalJobCompany = document.getElementById("job-modal-company");
  const modalJobLogo = document.getElementById("job-modal-logo");
  const modalJobBody = document.getElementById("modal-job-body");
  const modalJobInterestBtn = document.getElementById("modal-job-interest-btn");
  const modalInterestLabel = document.getElementById("modal-interest-label");
  const modalJobApplyBtn = document.getElementById("modal-job-apply-btn");

  const modalAtsBuilder = document.getElementById("modal-ats-builder");
  const closeAtsModal = document.getElementById("close-ats-modal");
  const btnCloseAtsBottom = document.getElementById("btn-close-ats-bottom");

  // Portfolio Builder Modal Elements (Matching Image 3)
  const modalPortfolioBuilder = document.getElementById(
    "modal-portfolio-builder",
  );
  const closePortfolioModal = document.getElementById("close-portfolio-modal");
  const btnClosePortfolioBottom = document.getElementById(
    "btn-close-portfolio-bottom",
  );
  const btnSavePublishPortfolio = document.getElementById(
    "btn-save-publish-portfolio",
  );
  const btnBuilderCopySlug = document.getElementById("btn-builder-copy-slug");
  const btnModalAddProjectItem = document.getElementById(
    "btn-modal-add-project-item",
  );
  const modalProjectsList = document.getElementById("modal-projects-list");
  const modalProjectCountBadge = document.getElementById(
    "modal-project-count-badge",
  );
  const statusProjCount = document.getElementById("status-proj-count");
  const statusLiveUrl = document.getElementById("status-live-url");
  const modalNewProjTitle = document.getElementById("modal-new-proj-title");
  const modalNewProjCat = document.getElementById("modal-new-proj-cat");
  const modalNewProjDemo = document.getElementById("modal-new-proj-demo");
  const modalNewProjGithub = document.getElementById("modal-new-proj-github");
  const modalNewProjStack = document.getElementById("modal-new-proj-stack");
  const modalNewProjDesc = document.getElementById("modal-new-proj-desc");

  let currentModalJobId = null;

  function openJobDetailsModal(jobId) {
    const job = jobOpeningsData.find((j) => j.id === jobId);
    if (!job || !modalJobDetails) return;

    currentModalJobId = jobId;

    if (modalJobTitle) modalJobTitle.textContent = job.title;
    if (modalJobCompany)
      modalJobCompany.textContent = `${job.company} &bull; ${job.location}`;
    if (modalJobLogo) {
      modalJobLogo.style.background = job.logoBg;
      modalJobLogo.textContent = job.logoInitials;
    }

    if (modalJobBody) {
      const reqListHtml = (job.requirements || [])
        .map((r) => `<li>${r}</li>`)
        .join("");

      const techTagsHtml = job.techStack
        /* Full job-description view: the ONLY place where technology SVG
           icons render, with the shared name tooltip on hover/focus. */
        .map((t) => techIconPillHTML(t, "tech-tag-pill"))
        .join("");

      modalJobBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; background: var(--surface-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <span class="work-mode-pill ${job.workMode}">${job.workMode.toUpperCase()}</span>
              <span class="job-salary-pill" style="font-size: 0.95rem;">${job.salary}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${job.location}</span>
            </div>
            ${job.matchScore != null
              ? `<div class="match-score-pill">
                   <span class="status-dot"></span>
                   ${job.matchScore}% ATS Compatibility
                 </div>`
              : ""}
          </div>

          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main);">Role Overview</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">${job.description || job.summary}</p>
          </div>

          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main);">Core Tech Stack</h4>
            <div class="job-stack-tags">
              ${techTagsHtml}
            </div>
          </div>

          ${job.requirements && job.requirements.length ? `
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main);">Key Requirements</h4>
            <ul style="margin-left: 1.25rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6;">
              ${reqListHtml}
            </ul>
          </div>` : ""}

          <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-sm); padding: 0.75rem 1rem; font-size: 0.8rem; color: #166534;">
            <strong>ATS Profile Match:</strong> Run a real ATS evaluation against this job in the Resume Checker â€” percentages here are shown only after that check scores your resume.
          </div>
        </div>
      `;
    }

    syncModalInterestButton(job);

    modalJobDetails.classList.remove("hidden");
  }

  function syncModalInterestButton(job) {
    if (!modalJobInterestBtn) return;
    if (job.isInterested) {
      modalJobInterestBtn.className = "btn-job-interest interested";
      if (modalInterestLabel) modalInterestLabel.textContent = "Interested âœ“";
    } else {
      modalJobInterestBtn.className = "btn-job-interest";
      if (modalInterestLabel) modalInterestLabel.textContent = "Interested";
    }
  }

  if (modalJobInterestBtn) {
    modalJobInterestBtn.addEventListener("click", () => {
      if (currentModalJobId) {
        toggleJobInterest(currentModalJobId);
      }
    });
  }

  if (modalJobApplyBtn) {
    modalJobApplyBtn.addEventListener("click", async () => {
      if (!currentModalJobId) return;
      // Quick Apply means applying WITH the primary resume. If the candidate has
      // no active resume, stop honestly and point at the resume-management flow.
      const active = getActiveResume();
      if (!active) {
        if (modalJobDetails) modalJobDetails.classList.add("hidden");
        // Direct the candidate to the existing resume-management workflow.
        const documentsNav = document.getElementById("nav-documents");
        if (documentsNav) {
          documentsNav.click();
        } else {
          const resumeSection = document.getElementById("section-resume");
          if (resumeSection) {
            resumeSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        toast.warning(
          "You don't have an active primary resume yet. Upload or set one under your resume documents, then use Quick Apply with Primary Resume again.",
        );
        return;
      }
      const job = jobOpeningsData.find((j) => j.id === currentModalJobId);
      if (job && job.isInterested) {
        // Already applied elsewhere â€” don't submit a duplicate request.
        if (modalJobDetails) modalJobDetails.classList.add("hidden");
        toast.warning("You have already applied to this job.");
        return;
      }
      await toggleJobInterest(currentModalJobId);
      if (modalJobDetails) modalJobDetails.classList.add("hidden");
    });
  }

function initATSResumeChecker() {
  const input = document.getElementById("ats-resume-upload");
  const name = document.getElementById("ats-file-name");
  const analyze = document.getElementById("ats-analyze-btn");
  const status = document.getElementById("ats-analysis-status");
  const results = document.getElementById("ats-results");
  const remainingEl = document.getElementById("ats-remaining");
  const targetJob = document.getElementById("ats-target-job");
  const jobDescription = document.getElementById("ats-job-description");
  const skillList = document.getElementById("ats-skill-list");
  const historySection = document.getElementById("ats-history");
  const historyList = document.getElementById("ats-history-list");
  const storedResumeRow = document.getElementById("ats-stored-resume-row");
  const useStoredResume = document.getElementById("ats-use-stored-resume");
  const storedResumeName = document.getElementById("ats-stored-resume-name");

  if (!input || !name || !analyze) return;

  let selectedFile = null;
  let remainingChecks = 0;
  let jobsLoaded = false;
  let historyLoaded = false;
  let storedResumeAvailable = false;
  // Fresh idempotency key per modal open: accidental double submissions of the
  // SAME attempt replay without a new charge; a new attempt charges normally.
  let attemptKey = null;

  function renderRemaining(remaining) {
    if (typeof remaining === "number") remainingChecks = remaining;
    if (remainingEl) {
      remainingEl.textContent = remainingChecks > 0
        ? `You have ${remainingChecks} free ATS check${remainingChecks === 1 ? "" : "s"} remaining.`
        : "You have used all your free ATS checks. Upgrade your plan to continue.";
    }
  }

  async function loadEntitlement() {
    try {
      const res = await fetch("/api/candidate/ats-entitlement", { credentials: "include" });
      if (!res.ok) return false;
      const data = await res.json();
      if (data && typeof data.remainingChecks === "number") {
        remainingChecks = data.remainingChecks;
        renderRemaining(remainingChecks);
        return true;
      }
      return false;
    } catch (error) {
      return false; // keep last known state; the backend still enforces limits
    }
  }

  async function loadJobs() {
    if (!targetJob) return;
    // Genuinely eligible openings only (server-side verified: ACTIVE status,
    // deadline not passed). Never falls back to sample jobs.
    targetJob.innerHTML = '<option value="">-- Select a target job opening --</option>';
    const loadingOption = document.createElement("option");
    loadingOption.textContent = "Loading job openingsâ€¦";
    loadingOption.disabled = true;
    targetJob.appendChild(loadingOption);
    try {
      const res = await fetch("/api/candidate/ats-eligible-jobs", { credentials: "include" });
      const placeholder = targetJob.querySelector('[disabled]');
      if (placeholder) placeholder.remove();
      if (!res.ok) {
        const errOption = document.createElement("option");
        errOption.textContent = "Could not load job openings â€” you can still paste a job description.";
        errOption.disabled = true;
        targetJob.appendChild(errOption);
        return;
      }
      const data = await res.json();
      const jobs = (data && data.content) || [];
      if (jobs.length === 0) {
        const emptyOption = document.createElement("option");
        emptyOption.textContent = "No active job openings are currently available.";
        emptyOption.disabled = true;
        targetJob.appendChild(emptyOption);
        return;
      }
      jobs
        .filter((job) => job && job.id && job.title)
        .forEach((job) => {
          const option = document.createElement("option");
          option.value = job.id;
          const loc = job.location ? ` Â· ${job.location}` : "";
          const company = job.company ? ` (${job.company})` : "";
          option.textContent = `${job.title}${company}${loc}`;
          targetJob.appendChild(option);
        });
      jobsLoaded = true;
    } catch (error) {
      const placeholder = targetJob.querySelector('[disabled]');
      if (placeholder) placeholder.remove();
      const errOption = document.createElement("option");
      errOption.textContent = "Could not load job openings â€” you can still paste a job description.";
      errOption.disabled = true;
      targetJob.appendChild(errOption);
    }
  }

  async function loadStoredResumeInfo() {
    if (!storedResumeRow || !useStoredResume || !storedResumeName) return;
    try {
      const res = await fetch("/api/candidate/profile", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.resumeOriginalFilename) {
          storedResumeAvailable = true;
          storedResumeName.textContent = data.resumeOriginalFilename;
          storedResumeRow.style.display = "";
          return;
        }
      }
    } catch (error) {
      /* fall through to hidden state */
    }
    storedResumeAvailable = false;
    storedResumeRow.style.display = "none";
  }

  function formatAtsDate(iso) {
    if (!iso) return "Unknown date";
    const d = new Date(iso);
    return isNaN(d)
      ? "Unknown date"
      : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  async function loadHistory() {
    if (!historyList) return;
    try {
      const res = await fetch("/api/candidate/ats-evaluations?page=0&size=10", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const evaluations = (data && data.content) || [];
      historyList.replaceChildren();
      if (!evaluations.length) {
        const li = document.createElement("li");
        li.textContent = "No saved ATS checks yet.";
        historyList.appendChild(li);
      }
      evaluations.forEach((item) => {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = `${item.score ?? 0} â€” ${item.jobTitle || "Pasted job description"} Â· ${formatAtsDate(item.createdAt)}`;
        const view = document.createElement("button");
        view.type = "button";
        view.textContent = "View";
        view.style.cssText =
          "background:none;border:none;color:var(--brand-d,#0f766e);cursor:pointer;text-decoration:underline;font-size:0.78rem;padding:0";
        view.addEventListener("click", () => viewSavedAtsResult(item.id));
        li.appendChild(label);
        li.appendChild(view);
        historyList.appendChild(li);
      });
      historyLoaded = true;
    } catch (error) {
      /* history stays hidden on failure */
    }
  }

  async function viewSavedAtsResult(id) {
    try {
      const res = await fetch("/api/candidate/ats-evaluations/" + encodeURIComponent(id),
        { credentials: "include" });
      if (!res.ok) {
        showAtsStatus("Could not open the saved result.", true);
        toast.error("Could not open the saved result.");
        return;
      }
      const data = await res.json(); // opening a saved result NEVER consumes a check
      renderResults(data);
    } catch (error) {
      showAtsStatus("Could not open the saved result.", true);
      toast.error("Could not open the saved result.");
    }
  }

  function showAtsStatus(message, isError) {
    if (!status) return;
    if (!message) {
      status.textContent = "";
      status.classList.add("hidden");
      return;
    }
    status.textContent = message;
    status.style.color = isError ? "var(--red-500, #dc2626)" : "";
    status.classList.remove("hidden");
  }

  function renderResults(data) {
    const scoreEl = document.getElementById("ats-result-score");
    const summaryEl = document.getElementById("ats-score-summary");
    const improvements = document.getElementById("ats-improvement-list");
    if (scoreEl) scoreEl.textContent = `${data.score ?? 0}`;
    if (summaryEl) summaryEl.textContent = data.summary || "Review the details below.";

    if (skillList) {
      skillList.replaceChildren();
      const add = (text) => {
        const li = document.createElement("li");
        li.textContent = text;
        skillList.appendChild(li);
      };
      (data.matchedRequiredSkills || []).forEach((s) => add(`Matched: ${s}`));
      (data.missingRequiredSkills || []).forEach((s) => add(`Missing: ${s}`));
      if (data.missingPreferredSkills?.length) {
        add(`Preferred gaps: ${data.missingPreferredSkills.join(", ")}`);
      }
    }

    if (improvements) {
      improvements.replaceChildren();
      (data.missingRequiredSkills || []).forEach((skill) => {
        const li = document.createElement("li");
        li.textContent = `Add evidence of "${skill}" to your resume (a skill entry or a concrete project).`;
        improvements.appendChild(li);
      });
      const exp = (data.breakdown || {}).experience || {};
      if (exp.applicable && typeof exp.yearsFound === "number"
          && exp.yearsFound < (exp.yearsRequired || 0)) {
        const li = document.createElement("li");
        li.textContent = `The job asks for ${exp.yearsRequired}+ years of experience; your resume evidences about ${exp.yearsFound} years.`;
        improvements.appendChild(li);
      }
      if (!(data.missingRequiredSkills || []).length) {
        const li = document.createElement("li");
        li.textContent = "All required skills matched â€” tailor your summary and impact statements to this role.";
        improvements.appendChild(li);
      }
    }

    // Live-update the dashboard ATS overview with the freshly saved result
    refreshDashboardAtsPanel(data);

    results?.classList.remove("hidden");
    showAtsStatus(null, false);
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0];

    results?.classList.add("hidden");

    if (!file) {
      selectedFile = null;
      name.textContent = "No file selected";
      analyze.disabled = true;
      return;
    }

    if (!/\.(pdf|docx|txt)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
      input.value = "";
      selectedFile = null;
      name.textContent = "No file selected";
      analyze.disabled = true;
      showAtsStatus("Choose a PDF, DOCX, or TXT file up to 5 MB.", true);
      toast.error("Choose a PDF, DOCX, or TXT file up to 5 MB.");
      return;
    }

    selectedFile = file;
    name.textContent = file.name;
    analyze.disabled = false;
    showAtsStatus(null, false);
  });

  // Refresh allowance + job list every time the modal opens
  const modalAtsBuilder = document.getElementById("modal-ats-builder");
  if (modalAtsBuilder) {
    const observer = new MutationObserver(() => {
      if (!modalAtsBuilder.classList.contains("hidden")) {
        attemptKey = "ats-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        loadEntitlement();
        loadJobs();
        loadHistory();
        loadStoredResumeInfo();
      }
    });
    observer.observe(modalAtsBuilder, { attributes: true, attributeFilter: ["class"] });
  }

  analyze.addEventListener("click", async () => {
    const hasJob = !!(targetJob && targetJob.value);
    const jd = (jobDescription?.value || "").trim();

    if (!hasJob && jd.length < 40) {
      showAtsStatus("Select a target job or paste its job description (at least 40 characters).", true);
      return;
    }
    if (remainingChecks <= 0) {
      showAtsStatus("You have used all your free ATS checks. Upgrade your plan to continue.", true);
      toast.warning("You have used all your free ATS checks. Upgrade your plan to continue.");
      return;
    }
    const storedRequested = storedResumeAvailable && useStoredResume.checked;
    if (!storedRequested && !selectedFile) {
      showAtsStatus("Upload a resume file or evaluate your uploaded resume.", true);
      return;
    }

    analyze.disabled = true;
    showAtsStatus("Analyzing against the job requirementsâ€¦", false);
    const loadingToastId = toast.loading("Analyzing against the job requirementsâ€¦");
    results?.classList.add("hidden");

    try {
      let response;
      if (storedRequested) {
        const body = { useStoredResume: true };
        if (hasJob) body.jobId = targetJob.value;
        else body.jobDescription = jd;
        body.idempotencyKey = attemptKey || "ats-" + Date.now();
        response = await fetch("/api/candidate/ats-evaluate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } else if (selectedFile) {
        const formData = new FormData();
        formData.append("resume", selectedFile);
        if (hasJob) formData.append("jobId", targetJob.value);
        else formData.append("jobDescription", jd);
        formData.append("idempotencyKey", attemptKey || "ats-" + Date.now());
        response = await fetch("/api/candidate/ats-evaluate", {
          method: "POST",
          body: formData,
          credentials: "include"
        });
      } else {
        throw new Error("Upload a resume file or evaluate your uploaded resume.");
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data && data.code === "ATS_LIMIT_REACHED") {
          renderRemaining(0);
          throw new Error(data.message || "You have used all your free ATS checks.");
        }
        if (data && data.code === "RESUME_NOT_AVAILABLE") {
          storedRequested && useStoredResume && (useStoredResume.checked = false);
          throw new Error(data.message || "No stored resume found. Upload a resume file instead.");
        }
        throw new Error((data && data.message) || "Resume analysis failed.");
      }

      renderResults(data);
      await loadEntitlement();
      await loadHistory();
      toast.update(loadingToastId, {
        type: "success",
        message: "ATS evaluation completed successfully.",
      });
    } catch (error) {
      showAtsStatus(error.message || "Could not analyze your resume. No check was consumed.", true);
      toast.update(loadingToastId, {
        type: "error",
        message: error.message || "Could not analyze your resume. No check was consumed.",
      });
    } finally {
      const storedOn = storedResumeAvailable && useStoredResume?.checked;
      analyze.disabled = remainingChecks <= 0 || !(storedOn || selectedFile);
    }
  });

  if (useStoredResume) {
    useStoredResume.addEventListener("change", () => {
      const storedOn = storedResumeAvailable && useStoredResume.checked;
      analyze.disabled = remainingChecks <= 0 || !(storedOn || selectedFile);
      if (storedOn) {
        showAtsStatus(null, false);
      }
    });
  }

  if (targetJob) {
    targetJob.addEventListener("change", () => {
      if (targetJob.value) {
        showAtsStatus(null, false);
      }
    });
  }

  if (jobDescription) {
    jobDescription.addEventListener("input", () => {
      if (jobDescription.value.trim().length >= 40) {
        showAtsStatus(null, false);
      }
    });
  }
}

  function openAtsModal() {
    if (modalAtsBuilder) {
      modalAtsBuilder.classList.remove("hidden");
    }
  }

  // =========================================================================
  // 16. PORTFOLIO BUILDER MODAL OPERATIONS (MATCHING IMAGE 3)
  // =========================================================================
  function openPortfolioBuilderModal() {
    if (modalPortfolioBuilder) {
      modalPortfolioBuilder.classList.remove("hidden");
      renderModalProjectsList();
    }
  }

  function renderModalProjectsList() {
    if (!modalProjectsList) return;
    modalProjectsList.innerHTML = "";

    if (modalProjectCountBadge) {
      modalProjectCountBadge.textContent = `${portfolioProjects.length} Project${portfolioProjects.length === 1 ? "" : "s"}`;
    }
    if (statusProjCount) {
      statusProjCount.textContent = portfolioProjects.length;
    }

    portfolioProjects.forEach((proj, idx) => {
      const item = document.createElement("div");
      item.className = "modal-project-item";

      const techPreview =
        proj.techStack.slice(0, 3).join(", ") +
        (proj.techStack.length > 3 ? "..." : "");

      item.innerHTML = `
        <div class="modal-project-info">
          <div class="doc-type-icon-box portfolio-icon-bg" style="width: 32px; height: 32px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <div style="min-width: 0; flex: 1;">
            <div class="modal-project-name" title="${proj.title}">${proj.title}</div>
            <div class="modal-project-meta">${proj.category} &bull; ${techPreview}</div>
          </div>
        </div>
        <div class="modal-project-actions">
          ${
            proj.demoUrl
              ? `
            <a class="btn-modal-proj-action" href="https://${proj.demoUrl}" target="_blank" rel="noopener noreferrer" title="View live demo">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Demo</span>
            </a>
          `
              : ""
          }
          ${
            proj.githubUrl
              ? `
            <a class="btn-modal-proj-action" href="https://github.com/${proj.githubUrl}" target="_blank" rel="noopener noreferrer" title="View GitHub repository">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>Code</span>
            </a>
          `
              : ""
          }
          <button class="btn-modal-proj-action delete btn-modal-delete-proj" data-index="${idx}" type="button" title="Remove project from portfolio">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      modalProjectsList.appendChild(item);
    });

    // Delete listeners inside modal
    modalProjectsList
      .querySelectorAll(".btn-modal-delete-proj")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.getAttribute("data-index"), 10);
          portfolioProjects.splice(idx, 1);
          renderModalProjectsList();
          renderPortfolioProjects();
        });
      });
  }

  // Quick add project item from modal
  if (btnModalAddProjectItem) {
    btnModalAddProjectItem.addEventListener("click", () => {
      const title = modalNewProjTitle ? modalNewProjTitle.value.trim() : "";
      const cat = modalNewProjCat ? modalNewProjCat.value : "Web Application";
      const demo = modalNewProjDemo
        ? modalNewProjDemo.value.trim().replace(/^https?:\/\//, "")
        : "";
      const gh = modalNewProjGithub
        ? modalNewProjGithub.value
            .trim()
            .replace(/^https?:\/\/github\.com\//, "")
        : "";
      const stackStr = modalNewProjStack ? modalNewProjStack.value.trim() : "";
      const desc = modalNewProjDesc ? modalNewProjDesc.value.trim() : "";

      if (!title) {
        if (modalNewProjTitle) modalNewProjTitle.focus();
        return;
      }

      const techStack = stackStr
        ? stackStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : ["React", "TypeScript", "Tailwind CSS"];

      const newProj = {
        id: `proj-${Date.now()}`,
        title: title,
        category: cat,
        demoUrl: demo,
        githubUrl: gh,
        techStack: techStack,
        description:
          desc ||
          "High-performance software engineering project featuring modern responsive UI architecture and robust APIs.",
      };

      portfolioProjects.unshift(newProj);
      renderModalProjectsList();
      renderPortfolioProjects();

      // Reset modal project inputs
      if (modalNewProjTitle) modalNewProjTitle.value = "";
      if (modalNewProjDemo) modalNewProjDemo.value = "";
      if (modalNewProjGithub) modalNewProjGithub.value = "";
      if (modalNewProjStack) modalNewProjStack.value = "";
      if (modalNewProjDesc) modalNewProjDesc.value = "";
    });
  }

  // Copy slug button in modal
  if (btnBuilderCopySlug) {
    btnBuilderCopySlug.addEventListener("click", () => {
      const slugInput = document.getElementById("builder-portfolio-slug");
      const slugVal = slugInput ? slugInput.value.trim() : "portfolio";
      const fullUrl = `${window.location.origin}/portfolio/${slugVal}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(fullUrl);
      }
    });
  }

  // Portfolio change review status (approved portfolio + latest submission).
  // Portfolio approval is a candidate change request reviewed by an admin and is
  // completely separate from ATS scoring: submitting a portfolio change never
  // runs, creates or alters an ATS evaluation.
  const portfolioReviewStatus = document.getElementById(
    "portfolio-review-status",
  );

  function setPortfolioReviewStatus(message, tone) {
    if (!portfolioReviewStatus) return;
    portfolioReviewStatus.textContent = message || "";
    const colors = { ok: "#047857", pending: "#b45309", error: "#b91c1c" };
    portfolioReviewStatus.style.color = colors[tone] || "#0f766e";
  }

  async function loadPortfolioStatus() {
    try {
      const res = await fetch("/api/candidate/portfolio", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();

      // Show the approved portfolio when the backend has one. Until a change is
      // approved the previously approved projects remain in effect.
      if (Array.isArray(data.projects) && data.projects.length) {
        portfolioProjects = data.projects.map((p, i) => ({
          id: p.id || "proj-" + (i + 1),
          title: p.title || "Untitled project",
          category: p.category || "Project",
          demoUrl: (p.projectUrl || "").replace(/^https?:\/\//, ""),
          githubUrl: (p.repoUrl || "").replace(/^https?:\/\//, ""),
          techStack: Array.isArray(p.techStack) ? p.techStack : [],
          description: p.description || "",
        }));
        renderPortfolioProjects();
      }

      const latest = data.latestChangeRequest;
      if (!latest) {
        setPortfolioReviewStatus("", "");
        return;
      }
      if (latest.status === "PENDING") {
        setPortfolioReviewStatus(
          "Your latest portfolio changes are pending admin review.",
          "pending",
        );
      } else if (latest.status === "APPROVED") {
        setPortfolioReviewStatus(
          "Your latest portfolio changes were approved and are now live.",
          "ok",
        );
      } else if (latest.status === "REJECTED") {
        setPortfolioReviewStatus(
          "Your latest portfolio changes were not approved." +
            (latest.reviewNote ? " Reason: " + latest.reviewNote : ""),
          "error",
        );
      }
    } catch (error) {
      /* Status is best-effort; the builder still works without it. */
    }
  }

  // Save & publish portfolio â€” submits a change request for admin review.
  if (btnSavePublishPortfolio) {
    btnSavePublishPortfolio.addEventListener("click", async () => {
      const slugInput = document.getElementById("builder-portfolio-slug");
      const slugVal =
        slugInput && slugInput.value.trim()
          ? slugInput.value.trim()
          : "portfolio";

      const projects = (portfolioProjects || []).map((p) => ({
        title: p.title || "",
        description: p.description || "",
        projectUrl: p.demoUrl || p.projectUrl || "",
        repoUrl: p.githubUrl || p.repoUrl || "",
        techStack: Array.isArray(p.techStack) ? p.techStack : [],
      }));

      const label = btnSavePublishPortfolio.querySelector("span");
      const originalLabel = label ? label.textContent : "";
      btnSavePublishPortfolio.disabled = true;
      if (label) label.textContent = "Submittingâ€¦";
      setPortfolioReviewStatus(
        "Submitting portfolio changes for reviewâ€¦",
        "pending",
      );

      try {
        const res = await fetch("/api/candidate/portfolio/change-request", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: slugVal, projects }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            (data && (data.message || data.error)) ||
              "Could not submit portfolio changes.",
          );
        }
        if (statusLiveUrl) {
          statusLiveUrl.textContent = "portfolio.live/" + slugVal;
        }
        closeAllModals();
        await loadPortfolioStatus();
        toast.success("Portfolio changes submitted for admin review.");
      } catch (error) {
        setPortfolioReviewStatus(
          error.message || "Could not submit portfolio changes.",
          "error",
        );
      } finally {
        btnSavePublishPortfolio.disabled = false;
        if (label) label.textContent = originalLabel;
      }
    });
  }

  loadPortfolioStatus();

  // =========================================================================
  // 17. RECRUITER SHORTLISTS (JOBS WHERE RECRUITER SHORTLISTED CANDIDATE)
  // =========================================================================
  let shortlistedJobsData = [];
  let shortlistStatusCounts = {};
  let shortlistTotalElements = 0;
  let shortlistsLoaded = false;
  let shortlistsError = false;

  const shortlistedCardsGrid = document.getElementById(
    "shortlisted-cards-grid",
  );
  const shortlistFilterChips = document.querySelectorAll(
    "#shortlist-filter-chips .filter-chip",
  );
  const shortlistCountBadge = document.getElementById("shortlist-count-badge");
  const navShortlistBadge = document.getElementById("nav-shortlist-badge");

  /** Real pipeline stage derived from the persisted application status. */
  const STAGES_BY_STATUS = {
    SHORTLISTED: "shortlisted",
    HIRE_REQUESTED: "hireRequested",
    RELEASED: "hired",
    HIRED: "hired",
  };

  const STAGE_CARD = {
    shortlisted: {
      chip: "shortlisted",
      // Visual classes/colors reuse the existing stage-pill styles.
      color: "scheduled",
      dot: "#10B981",
      text: "Shortlisted by Recruiter",
      tsKey: "shortlistedAt",
      labelKey: "shortlistedDate",
    },
    hireRequested: {
      color: "awaiting",
      dot: "#F59E0B",
      text: "Hire Request Raised",
      tsKey: "hireRequestedAt",
      labelKey: "hireRequestedDate",
    },
    hired: {
      color: "final",
      dot: "#9333EA",
      text: "Released / Hired",
      tsKey: "releasedAt",
      labelKey: "releasedDate",
    },
  };

  function formatShortlistDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatSalary(min, max, currency) {
    if (!min && !max) return null;
    const symbol = currency === "USD" ? "$" : "â‚¹";
    const fmt = (v) => `${symbol}${Math.round(v / 100000)}L`;
    if (min && max && min !== max) return `${fmt(min)}â€“${fmt(max)}`;
    return fmt(min || max);
  }

  function renderShortlistChips() {
    if (!shortlistFilterChips || !shortlistFilterChips.length) return;
    shortlistFilterChips.forEach((chip) => {
      const stage = chip.getAttribute("data-stage") || "all";
      let count = 0;
      if (stage === "all") {
        count = shortlistTotalElements;
      } else if (stage === "hired") {
        count =
          (Number(shortlistStatusCounts.RELEASED) || 0) +
          (Number(shortlistStatusCounts.HIRED) || 0);
      } else {
        count = Number(shortlistStatusCounts[stage.toUpperCase()]) || 0;
      }
      const baseLabel = {
        all: "All",
        SHORTLISTED: "Shortlisted",
        HIRE_REQUESTED: "Hire Requested",
        hired: "Released / Hired",
      }[stage] || "All";
      chip.textContent = `${baseLabel} (${count})`;
    });
  }

  function renderShortlistedCards(filter = "all") {
    if (!shortlistedCardsGrid) return;
    shortlistedCardsGrid.innerHTML = "";

    if (shortlistCountBadge) {
      if (!shortlistsLoaded) {
        shortlistCountBadge.innerHTML = `<span class="pulse-indicator"></span> Loading shortlistsâ€¦`;
      } else {
        shortlistCountBadge.innerHTML = `<span class="pulse-indicator"></span> ${shortlistedJobsData.length} Roles Shortlisted`;
      }
    }
    if (navShortlistBadge && shortlistsLoaded) {
      navShortlistBadge.textContent = shortlistedJobsData.length;
    }

    // Loading state (first fetch in flight)
    if (!shortlistsLoaded) {
      shortlistedCardsGrid.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
          <p class="empty-title">Loading shortlistsâ€¦</p>
          <p class="empty-desc">Fetching your real recruiter shortlist records.</p>
        </div>
      `;
      return;
    }

    // The backend could not be reached â€” say so instead of showing a fake-empty state
    if (shortlistsError && shortlistedJobsData.length === 0) {
      shortlistedCardsGrid.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
          <p class="empty-title">Could not load shortlists</p>
          <p class="empty-desc">Your recruiter shortlist records could not be reached right now. Please try again later.</p>
        </div>
      `;
      return;
    }

    const filtered = shortlistedJobsData.filter((item) => {
      if (filter === "all") return true;
      return item.stage === filter;
    });

    if (filtered.length === 0) {
      shortlistedCardsGrid.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
          <p class="empty-title">No shortlisted roles in this category</p>
          <p class="empty-desc">Check back soon or select "All" to view all active recruiter shortlists.</p>
        </div>
      `;
      return;
    }

    filtered.forEach((item) => {
      const card = document.createElement("article");
      card.className = "shortlisted-card fade-in-up";

      const stageInfo = STAGE_CARD[item.stage] || STAGE_CARD.shortlisted;

      const companyInitial = (item.company || item.recruiterName || "R").trim().charAt(0).toUpperCase();

      const salaryPill = item.salary ? `<span class="job-salary-pill">${escapeHtml(item.salary)}</span>` : "";
      const stageLine = item.stageDate
        ? `<span style="color: var(--text-muted); font-size: 0.74rem;">${escapeHtml(item.stageLabel)}: <strong>${escapeHtml(item.stageDate)}</strong></span>`
        : "";

      const recruiterLine = item.recruiterName
        ? `<div class="recruiter-info-left">
             <div class="recruiter-avatar-mini" style="background: ${item.recruiterBg};">${escapeHtml(item.recruiterAvatar)}</div>
             <div>
               <span class="recruiter-name-text">${escapeHtml(item.recruiterName)}</span>
               ${item.recruiterRole ? `<span class="recruiter-role-text">&bull; ${escapeHtml(item.recruiterRole)}</span>` : ""}
             </div>
           </div>`
        : `<div class="recruiter-info-left">
             <div class="recruiter-avatar-mini" style="background: ${item.recruiterBg};">${escapeHtml(companyInitial)}</div>
             <div>
               <span class="recruiter-name-text">â€”</span>
             </div>
           </div>`;

      const noteBubble = item.recruiterNote
        ? `<p class="shortlist-quote-bubble">&ldquo;${escapeHtml(item.recruiterNote)}&rdquo;</p>`
        : "";

      card.innerHTML = `
        <div class="shortlist-top-bar">
          <div class="shortlist-company-group">
            <div class="shortlist-company-avatar" style="background: ${item.recruiterBg};">
              ${escapeHtml(companyInitial)}
            </div>
            <div>
              <h3 class="shortlist-role-title">${escapeHtml(item.jobTitle || "â€”")}</h3>
              <span class="shortlist-company-sub">${escapeHtml(item.company || "")} &bull; ${escapeHtml(item.location || "â€”")}</span>
            </div>
          </div>
          ${item.matchScore || item.matchScore === 0
            ? `<div class="match-score-pill"><span class="status-dot"></span>${item.matchScore}% ATS</div>`
            : ""}
        </div>

        <div class="shortlist-meta-row">
          ${item.workMode ? `<span class="work-mode-pill ${escapeHtml(String(item.workMode).toLowerCase())}">${escapeHtml(item.workModeLabel || String(item.workMode).toUpperCase())}</span>` : ""}
          ${salaryPill}
          ${stageLine}
        </div>

        <div class="shortlist-recruiter-box">
          <div class="recruiter-profile-line">
            ${recruiterLine}
            ${item.stageDate ? `<span class="shortlist-date-badge">${escapeHtml(item.stageDate)}</span>` : ""}
          </div>
          ${noteBubble}
        </div>

        <div class="shortlist-stage-status">
          <span class="stage-pill ${stageInfo.color}">
            <span class="status-dot" style="background: ${stageInfo.dot};"></span>
            ${escapeHtml(stageInfo.text)}
          </span>
          <div class="shortlist-actions-group">
            <button type="button" class="btn-secondary-outline btn-shortlist-job" data-id="${escapeHtml(item.jobRefId || "")}" style="padding: 4px 10px; font-size: 0.74rem;">
              View Job
            </button>
          </div>
        </div>
      `;

      shortlistedCardsGrid.appendChild(card);
    });

    // Attach listeners
    shortlistedCardsGrid
      .querySelectorAll(".btn-shortlist-job")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const refId = btn.getAttribute("data-id");
          if (refId) openJobDetailsModal(refId);
        });
      });
  }

  // Filter chips
  shortlistFilterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      shortlistFilterChips.forEach((c) => {
        c.classList.remove("active");
        c.setAttribute("aria-selected", "false");
      });
      chip.classList.add("active");
      chip.setAttribute("aria-selected", "true");
      const stage = chip.getAttribute("data-stage") || "all";
      renderShortlistedCards(stage);
    });
  });

  // Fetch REAL shortlist records from MongoDB (enriched with the actual job,
  // company and recruiter each application references). No fallback data:
  // an empty result or a failed request is shown as such.
  async function syncRealShortlistedApplications() {
    try {
      const res = await fetch("/api/candidate/shortlists?page=0&size=50", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      shortlistStatusCounts = (data && data.statusCounts) || {};
      shortlistTotalElements = Number(data && data.totalElements) || 0;
      shortlistedJobsData = (((data && data.content) || []) || [])
        .filter((app) => app && app.id && app.status)
        .map((app) => {
          const stage = STAGES_BY_STATUS[app.status] || "shortlisted";
          const stageInfo = STAGE_CARD[stage];
          const stageDate =
            formatShortlistDate(app[stageInfo.tsKey]) ||
            formatShortlistDate(app.shortlistedAt);
          const recruiter = app.recruiter || {};
          return {
            id: app.id,
            jobTitle: app.jobTitle || null,
            company: app.companyName || recruiter.companyName || null,
            location: app.jobLocation || app.jobCity || null,
            workMode: app.workMode || null,
            workModeLabel: app.workMode || null,
            salary: formatSalary(app.minSalaryInr, app.maxSalaryInr, app.salaryCurrency),
            matchScore: typeof app.atsScore === "number" ? Math.round(app.atsScore) : null,
            recruiterName: recruiter.name || null,
            recruiterRole: recruiter.designation || null,
            recruiterAvatar: (recruiter.initials || "").slice(0, 2).toUpperCase(),
            recruiterBg: "linear-gradient(135deg, #0d9488 0%, #047857 100%)",
            stage: stage,
            stageLabel:
              app.status === "SHORTLISTED"
                ? "Shortlisted"
                : app.status === "HIRE_REQUESTED"
                ? "Hire requested"
                : app.status === "RELEASED"
                ? "Contact released"
                : app.status === "HIRED"
                ? "Hired"
                : stage.toLowerCase(),
            stageDate: stageDate || null,
            recruiterNote: app.recruiterNote || null,
            jobRefId: app.jobId || null,
          };
        });
      shortlistsError = false;
      shortlistsLoaded = true;
    } catch {
      // Keep previously loaded rows visible; surface the error only when we
      // have no data at all (no fabricated records are ever injected).
      shortlistsError = true;
      shortlistsLoaded = true;
    }
    renderShortlistChips();
    const activeChip = document.querySelector("#shortlist-filter-chips .filter-chip.active");
    renderShortlistedCards(activeChip ? activeChip.getAttribute("data-stage") || "all" : "all");
  }
  syncRealShortlistedApplications();

  // =========================================================================
  // 18. RECRUITER ACTIVITY LOG (REAL DATA â€” MongoDB via /api/candidate/recruiter-activities)
  // =========================================================================
  // Every row comes from a real activity record written by the backend after
  // an authorized recruiter action succeeded. Nothing below is fabricated:
  // missing fields render as "Not available".
  const profileViewsTbody = document.getElementById("profile-views-tbody");
  const viewsSearchInput = document.getElementById("views-search-input");
  const viewsCountPill = document.getElementById("views-count-pill");

  // Cosmetic only: deterministic avatar gradient per recruiter ID (visual identity, not data)
  const ACTIVITY_AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #0F9488 0%, #0B756B 100%)",
    "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
    "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
    "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
    "linear-gradient(135deg, #059669 0%, #047857 100%)",
    "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
  ];

  let recruiterActivityRows = [];
  let recruiterActivityStats = null;
  let recruiterActivityLoaded = false;
  let recruiterActivityError = false;

  function recruiterInitials(name) {
    if (!name) return "R";
    const parts = String(name).trim().split(/\s+/);
    return ((parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0][0]) || "R").toUpperCase();
  }

  function recruiterGradient(id) {
    let h = 0;
    const s = String(id || "r");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return ACTIVITY_AVATAR_GRADIENTS[h % ACTIVITY_AVATAR_GRADIENTS.length];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatActivityTimestamp(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "â€”";
    const dayKey = (x) =>
      new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const now = new Date();
    const dayDiff = (dayKey(now) - dayKey(d)) / 86400000;
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (dayDiff === 0) return `Today, ${time}`;
    if (dayDiff === 1) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}, ${time}`;
  }

  /** Fills the KPI strip above the table from real record counts. */
  function renderActivityStats() {
    const setKpi = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        const n = Math.max(0, Number(value) || 0);
        el.textContent = String(n);
        el.setAttribute("data-count", String(n));
      }
    };

    if (!recruiterActivityStats) {
      // Backend unreachable: render honest zeros instead of stale placeholder
      // numbers, and mark the badge unavailable rather than inventing a value.
      ["kpi-impressions", "kpi-companies", "kpi-resume-downloads", "kpi-interview-pipeline"]
        .forEach((id) => setKpi(id, 0));
      const badge = document.getElementById("views-impressions-badge");
      if (badge) {
        badge.innerHTML = `<span class="pulse-indicator"></span> Recruiter impressions unavailable`;
      }
      return;
    }

    setKpi("kpi-impressions", recruiterActivityStats.impressions);
    setKpi("kpi-companies", recruiterActivityStats.companies);
    setKpi("kpi-resume-downloads", recruiterActivityStats.resumeDownloads);
    setKpi("kpi-interview-pipeline", recruiterActivityStats.interviewPipeline);

    const badge = document.getElementById("views-impressions-badge");
    if (badge) {
      const views = Number(recruiterActivityStats.impressions) || 0;
      badge.innerHTML = `<span class="pulse-indicator"></span> ${views} Recruiter Impressions`;
    }

    const statPortViews = document.getElementById("stat-portfolio-views");
    if (statPortViews) {
      const views = Number(recruiterActivityStats.impressions) || 0;
      statPortViews.textContent = views.toLocaleString();
      statPortViews.setAttribute("data-count", String(views));
    }
  }

  function renderProfileViews(filterQuery = "") {
    if (!profileViewsTbody) return;
    profileViewsTbody.innerHTML = "";

    const query = filterQuery.toLowerCase().trim();
    const filtered = recruiterActivityRows.filter((item) => {
      if (!query) return true;
      const r = item.recruiter || {};
      return (
        (r.name || "").toLowerCase().includes(query) ||
        (r.company || "").toLowerCase().includes(query) ||
        (item.description || "").toLowerCase().includes(query)
      );
    });

    if (viewsCountPill) {
      const count = recruiterActivityLoaded && !query
        ? (recruiterActivityStats &&
          typeof recruiterActivityStats.recentVisits === "number"
          ? recruiterActivityStats.recentVisits
          : filtered.length)
        : filtered.length;
      viewsCountPill.textContent = `${count} recent visit${count === 1 ? "" : "s"}`;
    }

    // Loading state (first fetch in flight)
    if (!recruiterActivityLoaded) {
      const loadingRow = document.createElement("tr");
      loadingRow.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          Loading recruiter activityâ€¦
        </td>
      `;
      profileViewsTbody.appendChild(loadingRow);
      return;
    }

    // The backend could not be reached â€” say so instead of showing a blank table
    if (recruiterActivityError && recruiterActivityRows.length === 0) {
      const errorRow = document.createElement("tr");
      errorRow.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          Could not load recruiter activity right now. Please try again later.
        </td>
      `;
      profileViewsTbody.appendChild(errorRow);
      return;
    }

    if (filtered.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          ${
            query
              ? `No recruiter activity matching "${escapeHtml(filterQuery)}". Try clearing your search keyword.`
              : "No recruiter activity yet. When a recruiter views your profile, downloads your resume or shortlists you, it will appear here."
          }
        </td>
      `;
      profileViewsTbody.appendChild(emptyRow);
      return;
    }

    filtered.forEach((item) => {
      const r = item.recruiter || {};
      const row = document.createElement("tr");
      row.className = "document-row";

      const initials = r.initials || recruiterInitials(r.name);
      // Optional fields that the backend did not capture render as a neutral
      // placeholder â€” a recruiter name/company is never invented here.
      const displayName = r.name || "â€”";
      const designation = r.designation || "";
      const company = r.company || "";
      const metaLine = [designation, company].filter(Boolean).join(" â€¢ ");
      const actionText = item.description || "Interacted With Candidate";
      const discovery = item.discoverySource || "â€”";

      row.innerHTML = `
        <td>
          <div class="doc-name-cell">
            <div class="recruiter-avatar-mini" style="background: ${recruiterGradient(r.userId || r.name)}; width: 34px; height: 34px; font-size: 0.82rem; font-weight: 800;">
              ${escapeHtml(initials)}
            </div>
            <div class="doc-text-meta">
              <span class="doc-filename">${escapeHtml(displayName)}</span>
              ${metaLine ? `<span class="doc-format">${escapeHtml(metaLine)}</span>` : `<span class="doc-format">â€”</span>`}
            </div>
          </div>
        </td>
        <td>
          <span class="badge-action-type ${item.actionType || ""}">
            ${
              item.actionType === "download"
                ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`
                : item.actionType === "shortlist"
                ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                : `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
            }
            ${escapeHtml(actionText)}
          </span>
        </td>
        <td>
          <span class="discovery-query-pill">${escapeHtml(discovery)}</span>
        </td>
        <td>
          <span class="edited-text" style="display: flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${escapeHtml(formatActivityTimestamp(item.timestamp))}
          </span>
        </td>
        <td class="text-right">
          <div class="action-buttons-cell">
            ${
              item.contactUnlocked && item.recruiterEmail
                ? `<a type="button" class="btn-version-pill-action btn-views-connect"
                      href="mailto:${escapeHtml(item.recruiterEmail)}?subject=${encodeURIComponent("Contact via Euodoo Hire")}"
                      style="text-decoration:none">Connect / InMail</a>`
                : `<button type="button" class="btn-version-pill-action btn-views-connect" disabled
                      title="Contact details unlock automatically after the hiring fee is verified and the candidate is released.">
                      Connect / InMail
                    </button>`
            }
          </div>
        </td>
      `;

      profileViewsTbody.appendChild(row);
    });
  }

  if (viewsSearchInput) {
    viewsSearchInput.addEventListener("input", (e) => {
      renderProfileViews(e.target.value);
    });
  }

  /** Loads the authenticated candidate's real recruiter activity records. */
  async function loadRecruiterActivities() {
    try {
      const res = await fetch("/api/candidate/recruiter-activities?page=0&size=25", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      recruiterActivityRows = Array.isArray(data.content) ? data.content : [];
      recruiterActivityStats = data.stats || null;
      recruiterActivityError = false;
    } catch (err) {
      // Keep previously loaded rows visible; only surface the error when we have no data
      recruiterActivityError = true;
    } finally {
      recruiterActivityLoaded = true;
      renderActivityStats();
      renderProfileViews(viewsSearchInput ? viewsSearchInput.value : "");
    }
  }

  loadRecruiterActivities();
  // Live Activity Tracking: periodically refresh the real activity records
  setInterval(loadRecruiterActivities, 30000);

  initATSResumeChecker();
  // =========================================================================
  // 19. ACCOUNT SETTINGS (EDIT PERSONAL INFO, BASIC/PREMIUM, DELETE ACCOUNT)
  // =========================================================================
  let userAccount = {
    name: "Candidate",
    headline: "Software Developer",
    email: "",
    phone: "",
    location: "Bengaluru, India",
    portfolioUrl: "https://portfolio.live",
    skills:
      "React, TypeScript, Next.js, Node.js, Spring Boot, Tailwind CSS, GraphQL",
    bio: "Software Developer with proven expertise architecting high-performance web applications, scalable component systems, and real-time dashboard interfaces.",
    plan: "basic",
    planActivated: false,
    avatarInitial: "C",
  };

  function applyUserProfile(data) {
    if (!data) return;
    if (data.name || data.fullName) userAccount.name = data.name || data.fullName;
    if (data.email) userAccount.email = data.email;
    if (data.headline || data.currentDesignation) userAccount.headline = data.headline || data.currentDesignation;
    if (data.phone) userAccount.phone = data.phone;
    if (data.location) userAccount.location = data.location;
    if (data.skills) {
      userAccount.skills = Array.isArray(data.skills) ? data.skills.join(", ") : data.skills;
    }
    if (data.bio) userAccount.bio = data.bio;
    if (data.plan) userAccount.plan = String(data.plan).toLowerCase();
    if (typeof data.planActivated === "boolean") {
      userAccount.planActivated = data.planActivated;
    }

    const initials = (userAccount.name || "C")
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    userAccount.avatarInitial = initials || "C";
    updateAvatarDisplays(initials || "C");

    const firstName = (userAccount.name || "Candidate").trim().split(/\s+/)[0];
    updateWelcomeHeading(`Good morning, ${firstName}`);

    document
      .querySelectorAll(".user-name")
      .forEach((el) => (el.textContent = firstName));
    document
      .querySelectorAll(".user-role")
      .forEach((el) => (el.textContent = userAccount.headline));
    document
      .querySelectorAll(".profile-full-name")
      .forEach((el) => (el.textContent = userAccount.name));
    document
      .querySelectorAll(".profile-email")
      .forEach((el) => (el.textContent = userAccount.email));

    const paperName = document.getElementById("paperCandidateName") || document.querySelector(".resume-paper-name");
    if (paperName) paperName.textContent = userAccount.name;
    const paperEmail = document.getElementById("paperCandidateEmail");
    if (paperEmail) paperEmail.textContent = userAccount.email;

    if (settingsInputName) settingsInputName.value = userAccount.name;
    if (settingsInputHeadline) settingsInputHeadline.value = userAccount.headline;
    if (settingsInputEmail) settingsInputEmail.value = userAccount.email;
    if (settingsInputPhone) settingsInputPhone.value = userAccount.phone;
    if (settingsInputLocation) settingsInputLocation.value = userAccount.location;
    if (settingsInputSkills) settingsInputSkills.value = userAccount.skills;
    if (settingsInputBio) settingsInputBio.value = userAccount.bio;

    updatePlanUI();
  }

  window.setPaidUserProfile = applyUserProfile;
  const onProfileUpdated = (e) => {
    if (e.detail) applyUserProfile(e.detail);
  };
  window.addEventListener("hrm:profile-updated", onProfileUpdated);

  const modalAccountSettings = document.getElementById(
    "modal-account-settings",
  );
  const closeSettingsModal = document.getElementById("close-settings-modal");
  const btnCloseSettingsBottom = document.getElementById(
    "btn-close-settings-bottom",
  );
  const btnTabPersonal = document.getElementById("btn-tab-personal");
  const btnTabPlan = document.getElementById("btn-tab-plan");
  const btnTabDanger = document.getElementById("btn-tab-danger");
  const panePersonal = document.getElementById("pane-personal");
  const panePlan = document.getElementById("pane-plan");
  const paneDanger = document.getElementById("pane-danger");

  const settingsInputName = document.getElementById("settings-input-name");
  const settingsInputHeadline = document.getElementById(
    "settings-input-headline",
  );
  const settingsInputEmail = document.getElementById("settings-input-email");
  const settingsInputPhone = document.getElementById("settings-input-phone");
  const settingsInputLocation = document.getElementById(
    "settings-input-location",
  );
  const settingsInputPortfolioUrl = document.getElementById(
    "settings-input-portfolio-url",
  );
  const settingsInputSkills = document.getElementById("settings-input-skills");
  const settingsInputBio = document.getElementById("settings-input-bio");
  const btnSavePersonalInfo = document.getElementById(
    "btn-save-personal-info",
  );
  const btnChangeAvatar = document.getElementById("btn-change-avatar");
  const btnResetAvatar = document.getElementById("btn-reset-avatar");

  const currentPlanNameEl = document.getElementById("current-plan-name");
  const currentPlanBadgeEl = document.getElementById("current-plan-badge");
  const currentPlanDescEl = document.getElementById("current-plan-desc");
  const btnQuickTogglePlan = document.getElementById("btn-quick-toggle-plan");
  const btnSelectBasicPlan = document.getElementById("btn-select-basic-plan");
  const btnSelectPremiumPlan = document.getElementById(
    "btn-select-premium-plan",
  );
  const planCardBasic = document.getElementById("plan-card-basic");
  const planCardPremium = document.getElementById("plan-card-premium");

  const inputDeleteConfirm = document.getElementById("input-delete-confirm");
  const btnConfirmDeleteAccount = document.getElementById(
    "btn-confirm-delete-account",
  );

  function openAccountSettingsModal(initialTab = "personal") {
    if (!modalAccountSettings) return;

    if (settingsInputName) settingsInputName.value = userAccount.name;
    if (settingsInputHeadline)
      settingsInputHeadline.value = userAccount.headline;
    if (settingsInputEmail) settingsInputEmail.value = userAccount.email;
    if (settingsInputPhone) settingsInputPhone.value = userAccount.phone;
    if (settingsInputLocation)
      settingsInputLocation.value = userAccount.location;
    if (settingsInputPortfolioUrl)
      settingsInputPortfolioUrl.value = userAccount.portfolioUrl;
    if (settingsInputSkills) settingsInputSkills.value = userAccount.skills;
    if (settingsInputBio) settingsInputBio.value = userAccount.bio;
    if (inputDeleteConfirm) inputDeleteConfirm.value = "";

    updatePlanUI();
    switchSettingsTab(initialTab);
    // Keep the Certifications & Licenses card in sync with persisted MongoDB
    // data every time the Account Settings modal opens.
    if (typeof refreshCertifications === "function") refreshCertifications();

    modalAccountSettings.classList.remove("hidden");
  }

  function switchSettingsTab(tabName) {
    const tabs = [
      { name: "personal", btn: btnTabPersonal, pane: panePersonal },
      { name: "plan", btn: btnTabPlan, pane: panePlan },
      { name: "danger", btn: btnTabDanger, pane: paneDanger },
    ];

    tabs.forEach((t) => {
      if (t.btn && t.pane) {
        if (t.name === tabName) {
          t.btn.classList.add("active");
          t.pane.classList.remove("hidden");
          t.pane.classList.add("active");
        } else {
          t.btn.classList.remove("active");
          t.pane.classList.add("hidden");
          t.pane.classList.remove("active");
        }
      }
    });
  }

  if (btnTabPersonal)
    btnTabPersonal.addEventListener("click", () =>
      switchSettingsTab("personal"),
    );
  if (btnTabPlan)
    btnTabPlan.addEventListener("click", () => switchSettingsTab("plan"));
  if (btnTabDanger)
    btnTabDanger.addEventListener("click", () => switchSettingsTab("danger"));

  // Change / Reset Avatar Initials
  if (btnChangeAvatar) {
    btnChangeAvatar.addEventListener("click", () => {
      const initials = (userAccount.name || "A")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      userAccount.avatarInitial = initials;
      updateAvatarDisplays(initials);
    });
  }

  if (btnResetAvatar) {
    btnResetAvatar.addEventListener("click", () => {
      userAccount.avatarInitial = "A";
      updateAvatarDisplays("A");
    });
  }

  function updateAvatarDisplays(char) {
    document.querySelectorAll(".avatar-circle span").forEach((el) => {
      el.textContent = char;
    });
  }

  // Save Personal Info
  if (btnSavePersonalInfo) {
    btnSavePersonalInfo.addEventListener("click", () => {
      const newName = settingsInputName ? settingsInputName.value.trim() : "";
      const newHeadline = settingsInputHeadline
        ? settingsInputHeadline.value.trim()
        : "";
      const newEmail = settingsInputEmail
        ? settingsInputEmail.value.trim()
        : "";
      const newPhone = settingsInputPhone
        ? settingsInputPhone.value.trim()
        : "";
      const newLoc = settingsInputLocation
        ? settingsInputLocation.value.trim()
        : "";
      const newPort = settingsInputPortfolioUrl
        ? settingsInputPortfolioUrl.value.trim()
        : "";
      const newSkills = settingsInputSkills
        ? settingsInputSkills.value.trim()
        : "";
      const newBio = settingsInputBio ? settingsInputBio.value.trim() : "";

      if (!newName || !newEmail) {
        return;
      }

      userAccount.name = newName;
      userAccount.headline = newHeadline;
      userAccount.email = newEmail;
      userAccount.phone = newPhone;
      userAccount.location = newLoc;
      userAccount.portfolioUrl = newPort;
      userAccount.skills = newSkills;
      userAccount.bio = newBio;

      // Sync across dashboard
      const firstName = newName.split(" ")[0];
      updateWelcomeHeading(`Good morning, ${firstName}`);

      document
        .querySelectorAll(".user-name")
        .forEach((el) => (el.textContent = firstName));
      document
        .querySelectorAll(".user-role")
        .forEach((el) => (el.textContent = newHeadline));
      document
        .querySelectorAll(".profile-full-name")
        .forEach((el) => (el.textContent = newName));
      document
        .querySelectorAll(".profile-email")
        .forEach((el) => (el.textContent = newEmail));

      closeAllModals();
      toast.success("Profile updated successfully.");
    });
  }

  // =========================================================================
  // =========================================================================
  // 13. ACCOUNT SETTINGS: CERTIFICATIONS & LICENSES (MongoDB-backed)
  // =========================================================================
  // Wires the existing "Certifications &amp; Licenses" card inside the Account
  // Settings modal (Paid_Dashboard.jsx #certifications-settings-card). File
  // selection, validation and submission go against the real backend:
  // POST /api/candidate/certifications (multipart/form-data). Success is only
  // ever reported after the backend confirms persistence.

  const CERT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (mirrors backend rule)
  const CERT_ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"];

  let certCount = 0;
  let lastCertStrength = null;

  /** HTML-escapes untrusted text before it is rendered into list items. */
  function certEscape(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  /** True when the selected file's magic bytes match PDF / PNG / JPG. */
  async function certSniffMatches(file) {
    try {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46)
        return true; // %PDF-
      if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)
        return true; // PNG
      if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true; // JPG
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Loads the persisted certification list from the backend and renders it.
   * Safe to call from anywhere (also before the settings modal exists).
   */
  async function refreshCertifications() {
    const listEl = document.getElementById("certifications-items-list");
    if (!listEl) return;
    try {
      const res = await fetch("/api/candidate/certifications", { credentials: "include" });
      if (!res.ok) {
        listEl.replaceChildren();
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data && data.content) ? data.content : [];
      certCount = items.length;
      const badge = document.getElementById("cert-count-badge");
      if (badge) badge.textContent = String(certCount);
      renderCertificationItems(items);
      updateCertCountStatus();
    } catch {
      /* network/session problem: leave the currently rendered list alone */
    }
  }

  /** Keeps "Added Certifications (n)" side text consistent with real state. */
  function updateCertCountStatus() {
    const el = document.getElementById("cert-count-status");
    if (!el) return;
    const strengthPct =
      lastCertStrength && typeof lastCertStrength.percentage === "number"
        ? lastCertStrength.percentage
        : null;
    if (strengthPct !== null && strengthPct >= 100) {
      el.textContent = "100% profile strength reached";
    } else if (certCount > 0) {
      el.textContent = `${certCount} added \u2014 keep going to reach 100%`;
    } else {
      el.textContent = "Add 1+ to reach 100%";
    }
  }

  /**
   * Reflects the REAL backend profile strength (from /api/candidate/profile)
   * into the certifications card callout, so the "72%" wording is never
   * hardcoded and updates the moment certifications are added or removed.
   */
  function updateCertCardFromStrength(strength) {
    if (!strength || typeof strength.percentage !== "number") return;
    lastCertStrength = strength;
    const pct = Math.min(100, Math.max(0, Math.round(strength.percentage)));
    const badge = document.getElementById("cert-header-badge");
    const callout = document.getElementById("cert-boost-callout");
    const title = document.getElementById("cert-boost-callout-title");
    const desc = document.getElementById("cert-boost-callout-desc");
    const complete = pct >= 100;

    if (badge) {
      badge.textContent = complete ? "100% Complete" : `${pct}% \u2192 100% Boost`;
      badge.classList.toggle("completed", complete);
    }
    if (callout) {
      callout.classList.toggle("completed", complete);
    }
    if (title) {
      title.textContent = complete
        ? "Profile strength complete"
        : "Add certifications to reach 100% profile strength";
    }
    if (desc) {
      desc.innerHTML = complete
        ? "You have at least one verifiable certification on file. Your profile is fully complete."
        : `Your profile is currently at <strong>${pct}%</strong>. Adding verifiable certifications boosts your profile strength and recruiter ranking.`;
    }
    updateCertCountStatus();
  }

  /** Renders certifications with the card list styles that already exist. */
  function renderCertificationItems(items) {
    const listEl = document.getElementById("certifications-items-list");
    if (!listEl) return;

    if (!items.length) {
      listEl.replaceChildren();
      listEl.innerHTML = `
        <div class="cert-empty-box">
          <div class="cert-empty-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="6"></circle>
              <path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"></path>
            </svg>
          </div>
          <div class="cert-empty-title">No certifications added yet</div>
          <div class="cert-empty-desc">Add your first professional certification or license to complete your profile.</div>
        </div>`;
      return;
    }

    const iconSvg = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="6"></circle>
          <path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"></path>
        </svg>`;

    const rows = items.map((cert) => {
      const id = certEscape(cert.id || "");
      const title = certEscape(cert.title || "Untitled certification");
      const issuer = certEscape(cert.issuer || "");
      const period = [
        cert.issueDate || "\u2014",
        cert.neverExpires ? "No expiration" : cert.expirationDate || "\u2014",
      ].filter(Boolean).join(" \u2192 ");
      const meta = `${issuer} \u2022 ${certEscape(period)}`;

      const tags = [];
      if (cert.hasDocument && cert.documentUrl) {
        tags.push(`<span class="cert-doc-pill">${certEscape(cert.documentKind || "Document")} attached</span>`);
        tags.push(
          `<a class="cert-link-btn" href="${certEscape(cert.documentUrl)}" target="_blank" rel="noopener noreferrer">View File \u2197</a>`,
        );
      }
      if (cert.credentialId) {
        tags.push(`<span class="cert-doc-pill">ID: ${certEscape(cert.credentialId)}</span>`);
      }
      if (cert.verificationUrl) {
        tags.push(
          `<a class="cert-link-btn" href="${certEscape(cert.verificationUrl)}" target="_blank" rel="noopener noreferrer">Verify Credential \u2197</a>`,
        );
      }

      return `
        <div class="cert-card-item" data-cert-id="${id}">
          <div class="cert-item-icon">${iconSvg}</div>
          <div class="cert-item-content">
            <div class="cert-item-title">${title}</div>
            <div class="cert-item-meta">${meta}</div>
            <div class="cert-item-tags">${tags.join("")}</div>
          </div>
          <button type="button" class="btn-delete-cert" data-cert-id="${id}" aria-label="Delete ${title}">&times;</button>
        </div>`;
    });

    listEl.innerHTML = rows.join("");
  }

  const certFileInput = document.getElementById("cert-file-input");
  const certDropzone = document.getElementById("cert-dropzone");
  const btnCertBrowse = document.getElementById("btn-cert-browse");
  const certAttachedBox = document.getElementById("cert-attached-box");
  const certAttachedName = document.getElementById("cert-attached-name");
  const certAttachedSize = document.getElementById("cert-attached-size");
  const btnCertRemoveFile = document.getElementById("btn-cert-remove-file");
  const certInputName = document.getElementById("cert-input-name");
  const certInputIssuer = document.getElementById("cert-input-issuer");
  const certInputIssueDate = document.getElementById("cert-input-issue-date");
  const certInputExpiryDate = document.getElementById("cert-input-expiry-date");
  const certInputId = document.getElementById("cert-input-id");
  const certInputUrl = document.getElementById("cert-input-url");
  const btnCertClearFields = document.getElementById("btn-cert-clear-fields");
  const btnCertAddSubmit = document.getElementById("btn-cert-add-submit");
  const certificationsItemsListEl = document.getElementById("certifications-items-list");

  if (
    certFileInput &&
    certDropzone &&
    btnCertBrowse &&
    certAttachedBox &&
    certAttachedName &&
    certAttachedSize &&
    btnCertRemoveFile &&
    certInputName &&
    certInputIssuer &&
    certInputIssueDate &&
    certInputExpiryDate &&
    certInputId &&
    certInputUrl &&
    btnCertClearFields &&
    btnCertAddSubmit &&
    certificationsItemsListEl
  ) {
    let selectedCertFile = null;
    let certSubmitting = false;

    function certShowFile(file) {
      selectedCertFile = file;
      certFileInput.value = "";
      certAttachedName.textContent = file.name;
      certAttachedSize.textContent = `(${(file.size / 1048576).toFixed(1)} MB)`;
      certAttachedBox.classList.remove("hidden");
    }

    function certClearFile() {
      selectedCertFile = null;
      certFileInput.value = "";
      certAttachedBox.classList.add("hidden");
      certAttachedName.textContent = "document.pdf";
      certAttachedSize.textContent = "";
    }

    /** Client-side validation mirroring the backend rules exactly. */
    async function certAcceptFile(file) {
      if (!file || !file.name) return;
      const ext = file.name.split(".").pop().toLowerCase();
      if (!CERT_ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error("Unsupported file type. Please choose a PDF, PNG or JPG certificate.");
        return;
      }
      if (file.size > CERT_MAX_FILE_BYTES) {
        toast.error(
          `Certificate files must be smaller than 10 MB (selected file is ${(file.size / 1048576).toFixed(1)} MB).`,
        );
        return;
      }
      if (file.size === 0) {
        toast.error("The selected file is empty.");
        return;
      }
      if (!(await certSniffMatches(file))) {
        toast.error("This file is not a valid PDF, PNG or JPG document.");
        return;
      }
      // Selecting another valid file replaces the previous selection.
      certShowFile(file);
    }

    certFileInput.addEventListener("change", () => {
      const file = certFileInput.files && certFileInput.files[0];
      if (file) certAcceptFile(file);
    });

    // Clicking the dropzone opens the native file picker; the Browse button
    // opens the very same picker without re-triggering the dropzone click.
    certDropzone.addEventListener("click", () => certFileInput.click());
    btnCertBrowse.addEventListener("click", (event) => {
      event.stopPropagation();
      certFileInput.click();
    });

    // Keyboard-accessible file selection (dropzone has role=button + tabindex).
    certDropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        certFileInput.click();
      }
    });

    ["dragenter", "dragover"].forEach((type) =>
      certDropzone.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
        certDropzone.classList.add("dragover");
      }),
    );
    ["dragleave", "drop"].forEach((type) =>
      certDropzone.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
        certDropzone.classList.remove("dragover");
      }),
    );
    certDropzone.addEventListener("drop", (event) => {
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) certAcceptFile(files[0]);
    });

    certFileInput.type = "file";
    certFileInput.setAttribute("accept", ".pdf,.png,.jpg,.jpeg");

    btnCertRemoveFile.addEventListener("click", certClearFile);

    // Quick presets only populate fields; they never submit the form.
    document.querySelectorAll(".btn-cert-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        certInputName.value = btn.getAttribute("data-name") || certInputName.value;
        certInputIssuer.value = btn.getAttribute("data-issuer") || certInputIssuer.value;
        certInputIssueDate.value = btn.getAttribute("data-issue") || certInputIssueDate.value;
        certInputExpiryDate.value = btn.getAttribute("data-expiry") || certInputExpiryDate.value;
        certInputId.value = btn.getAttribute("data-id") || certInputId.value;
        certInputUrl.value = btn.getAttribute("data-url") || certInputUrl.value;
      });
    });

    /** Clear Form resets the entry form â€” saved certifications are untouched. */
    btnCertClearFields.addEventListener("click", () => {
      certInputName.value = "";
      certInputIssuer.value = "";
      certInputIssueDate.value = "";
      certInputExpiryDate.value = "";
      certInputId.value = "";
      certInputUrl.value = "";
      certClearFile();
    });

    /**
     * Add Certification & Reach 100%: validates locally, then submits
     * everything as multipart/form-data to the real backend. The button is
     * disabled while processing so a double click can never create a
     * duplicate record; success is only shown once the backend confirms.
     */
    btnCertAddSubmit.addEventListener("click", async () => {
      if (certSubmitting) return;

      const title = certInputName.value.trim();
      const issuer = certInputIssuer.value.trim();
      const issueDate = certInputIssueDate.value.trim();
      const expirationRaw = certInputExpiryDate.value.trim();
      const credentialId = certInputId.value.trim();
      const verificationUrl = certInputUrl.value.trim();
      const neverExpires =
        expirationRaw.length === 0 || /^(never|no\s*expir|not\s*expir)/i.test(expirationRaw);

      if (!title || !issuer) {
        toast.error("Please enter the certification name and the issuing organization.");
        (!title ? certInputName : certInputIssuer).focus();
        return;
      }
      if (verificationUrl) {
        try {
          const parsed = new URL(verificationUrl);
          if (!/^https?:$/.test(parsed.protocol)) throw new Error("scheme");
        } catch {
          toast.error("The verification URL must be a valid http or https address.");
          certInputUrl.focus();
          return;
        }
      }
      if (!neverExpires && expirationRaw) {
        // Reuse the backend's accepted date shapes; it validates again anyway.
        const looksLikeDate =
          /^\d{4}(-\d{2}(-\d{2})?)?$/.test(expirationRaw) ||
          /^\d{1,2}[/-]\d{4}$/.test(expirationRaw) ||
          /^\d{4}[/-]\d{1,2}$/.test(expirationRaw) ||
          /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(\.?)(\s+\d{0,4})?$/i.test(expirationRaw.replace(/\s+/g, " ").trim()) ||
          /^[a-z]+\s+\d{1,2},?\s+\d{4}$/i.test(expirationRaw) ||
          /^\d{1,2}\s+[a-z]+\.?(\s+\d{4})?$/i.test(expirationRaw);
        if (!looksLikeDate) {
          toast.error("The expiration date must look like a real date (e.g. May 2027) or be empty/\"Never\".");
          certInputExpiryDate.focus();
          return;
        }
      }
      if (issueDate) {
        // Issue date is validated fully on the backend; a light sanity check
        // here prevents obvious typos early.
        if (issueDate.length > 40) {
          toast.error("The issue date is too long.");
          certInputIssueDate.focus();
          return;
        }
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("issuer", issuer);
      if (issueDate) formData.append("issueDate", issueDate);
      if (neverExpires) {
        formData.append("neverExpires", "true");
      } else {
        formData.append("expirationDate", expirationRaw);
      }
      if (credentialId) formData.append("credentialId", credentialId);
      if (verificationUrl) formData.append("verificationUrl", verificationUrl);
      if (selectedCertFile) {
        formData.append("file", selectedCertFile, selectedCertFile.name);
      }

      certSubmitting = true;
      btnCertAddSubmit.disabled = true;
      const submitLabel = btnCertAddSubmit.querySelector("span");
      const originalLabel = submitLabel ? submitLabel.textContent : null;
      if (submitLabel) submitLabel.textContent = "Adding\u2026";

      try {
        const res = await withCsrf("/api/candidate/certifications", {
          method: "POST",
          body: formData,
        });
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok || !data || !data.certification) {
          // Failure: the backend reports what went wrong; nothing is saved,
          // nothing is cleared, and no success message is ever shown.
          const message =
            data && data.message
              ? data.message
              : res.status === 401
                ? "Your session has expired. Please sign in again."
                : "Could not add the certification. Please try again.";
          toast.error(message);
          return;
        }

        // Backend confirmed the record was persisted.
        toast.success(data.message || "Certification added successfully.");
        btnCertClearFields.click();
        await refreshCertifications();
        loadProfileStrength();
      } catch {
        toast.error("Network problem. Check your connection and try again.");
      } finally {
        certSubmitting = false;
        btnCertAddSubmit.disabled = false;
        if (submitLabel && originalLabel) submitLabel.textContent = originalLabel;
      }
    });

    // Sidebar hint click opens Account Settings -> Personal Info -> Certifications
    const sidebarStrengthHint = document.getElementById("sidebar-strength-hint");
    if (sidebarStrengthHint) {
      sidebarStrengthHint.addEventListener("click", () => {
        openAccountSettingsModal("personal");
        const card = document.getElementById("certifications-settings-card");
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }

    // Initial fetch of certifications on load
    refreshCertifications();

    // List actions (delete) via delegation so re-rendered rows stay wired.
    certificationsItemsListEl.addEventListener("click", async (event) => {
      const deleteBtn = event.target.closest && event.target.closest(".btn-delete-cert");
      if (!deleteBtn) return;
      const certificationId = deleteBtn.getAttribute("data-cert-id");
      if (!certificationId || deleteBtn.disabled) return;

      deleteBtn.disabled = true;
      try {
        const res = await withCsrf(`/api/candidate/certifications/${encodeURIComponent(certificationId)}`, {
          method: "DELETE",
        });
        let data = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (!res.ok) {
          toast.error(
            data && data.message ? data.message : "Could not delete the certification. Please try again.",
          );
          return;
        }
        toast.success("Certification deleted.");
        await refreshCertifications();
        loadProfileStrength();
      } catch {
        toast.error("Network problem. Check your connection and try again.");
      } finally {
        deleteBtn.disabled = false;
      }
    });
  }

  // Plan Updates (Basic vs Premium) â€” driven by the real backend plan
  function updatePlanUI() {
    const isPremium = userAccount.plan === "premium";

    if (currentPlanNameEl) {
      currentPlanNameEl.textContent = "Premium Career Pro Plan";
    }
    if (currentPlanBadgeEl) {
      currentPlanBadgeEl.textContent = isPremium
        ? "ACTIVE PREMIUM PLAN"
        : "SUBSCRIPTION PENDING";
      currentPlanBadgeEl.className = isPremium ? "status-pill-success" : "status-pill-warn";
    }
    if (currentPlanDescEl) {
      currentPlanDescEl.textContent = isPremium
        ? "One-time registration fee paid â€¢ Gold crown badge â€¢ Priority placement at the top of recruiter lists"
        : "One-time registration fee paid â€¢ Profile visible to recruiters â€¢ Upgrade to Premium (â‚¹499) for priority placement";
    }

    // Upgrade entry point: Premium users must NOT see any upgrade option.
    if (btnQuickTogglePlan) {
      btnQuickTogglePlan.style.display = isPremium ? "none" : "inline-flex";
    }

    if (planCardBasic && planCardPremium) {
      if (isPremium) {
        planCardBasic.classList.remove("current");
        planCardPremium.classList.add("current");
        // Premium: no upgrade buttons, no downgrade option.
        if (btnSelectBasicPlan) {
          btnSelectBasicPlan.style.display = "none";
          btnSelectBasicPlan.disabled = true;
        }
        if (btnSelectPremiumPlan) {
          btnSelectPremiumPlan.textContent = "âœ“ Active Premium Subscription";
          btnSelectPremiumPlan.disabled = true;
          btnSelectPremiumPlan.style.display = "";
        }
      } else {
        planCardBasic.classList.add("current");
        planCardPremium.classList.remove("current");
        if (btnSelectBasicPlan) {
          btnSelectBasicPlan.textContent = "âœ“ Current Plan";
          btnSelectBasicPlan.disabled = true;
          btnSelectBasicPlan.style.display = "";
        }
        if (btnSelectPremiumPlan) {
          btnSelectPremiumPlan.textContent = "Upgrade to Premium â€” â‚¹499";
          btnSelectPremiumPlan.disabled = false;
          btnSelectPremiumPlan.style.display = "";
        }
      }
    }

    // Header Plan Pill sync
    document.querySelectorAll(".profile-plan-pill").forEach((el) => {
      el.textContent = isPremium ? "PREMIUM DEVELOPER â˜…" : "CANDIDATE";
      el.style.background = isPremium ? "var(--light-teal)" : "#F1F5F9";
      el.style.color = isPremium ? "var(--dark-teal)" : "#64748B";
    });

    // Premium banner show/hide
    const premiumBanner = document.getElementById("premium-plan-banner");
    if (premiumBanner) {
      premiumBanner.style.display = isPremium ? "flex" : "none";
    }

    // Show the crown beside the profile name, never on the avatar.
    document.querySelectorAll(".crown-badge-name").forEach((crown) => {
      crown.style.display = isPremium ? "inline-flex" : "none";
    });

    // Fetch and display subscription expiry in the plan pane
    const subExpiryEl = document.getElementById("sub-expiry-info");
    if (subExpiryEl) {
      fetch("/api/subscriptions/status", { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          if (data.active && data.expiresAt) {
            const d = new Date(data.expiresAt).toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric"});
            subExpiryEl.innerHTML = '<span class="sub-expiry-badge sub-expiry-active">&#10003; Subscription active &bull; Expires ' + d + '</span>';
          } else if (data.hasSubscription) {
            subExpiryEl.innerHTML = '<span class="sub-expiry-badge sub-expiry-expired">Subscription ' + (data.status||'expired') + '</span>';
          } else {
            subExpiryEl.innerHTML = '<span class="sub-expiry-badge sub-expiry-none">No active subscription</span>';
          }
        }).catch(() => {});
    }
  }

  // ---------------------------------------------------------------------------
  // PLAN UPGRADE (real Razorpay flow â€” no frontend-only plan changes).
  // The backend validates: role (CANDIDATE only), current plan (rejects
  // "already on this plan"), and the server-authoritative â‚¹499 PREMIUM amount.
  // The upgrade button is hidden entirely for Premium users, so this flow only
  // runs for eligible (Basic/Free) authenticated candidates.
  // ---------------------------------------------------------------------------
  async function startPremiumUpgrade() {
    const triggerBtn =
      (btnSelectPremiumPlan && !btnSelectPremiumPlan.disabled
        ? btnSelectPremiumPlan
        : null) || btnQuickTogglePlan;
    const originalHtml = triggerBtn ? triggerBtn.innerHTML : "";

    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Razorpayâ€¦';
    }

    try {
      // 1. Server-authoritative Premium order (â‚¹499) in the Spring Boot backend
      const res = await fetch("/api/payments/plan-order?plan=PREMIUM", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 401) {
          try {
            sessionStorage.setItem(
              "euodoo-pending-toast",
              JSON.stringify({ type: "error", message: "Your login session has expired. Redirecting you to loginâ€¦" }),
            );
          } catch (_) {}
          window.location.href = "/login";
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || `Order initialization failed (HTTP ${res.status})`,
        );
      }

      const order = await res.json();

      // 2. Load Razorpay Checkout SDK when needed
      if (typeof window.Razorpay === "undefined") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = resolve;
          s.onerror = () =>
            reject(new Error("Unable to load Razorpay checkout script."));
          document.head.appendChild(s);
        });
      }

      // 3. Official Razorpay Checkout modal
      const options = {
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || "INR",
        name: "Euodoo Hire",
        description: "Premium Career Pro Upgrade",
        order_id: order.gatewayOrderId,
        prefill: {
          name: userAccount.name || "Candidate",
          email: userAccount.email || "candidate@example.com",
          contact: userAccount.phone || "",
        },
        theme: { color: "#0E8478" },
        handler: async function (response) {
          if (triggerBtn)
            triggerBtn.innerHTML =
              '<i class="fa-solid fa-spinner fa-spin"></i> Activating subscriptionâ€¦';
          try {
            // 4. Backend verifies the signature and activates the plan
            const vRes = await fetch(
              `/api/payments/verify?orderId=${encodeURIComponent(response.razorpay_order_id)}&paymentId=${encodeURIComponent(response.razorpay_payment_id)}&signature=${encodeURIComponent(response.razorpay_signature)}`,
              {
                method: "POST",
                credentials: "include",
                headers: { Accept: "application/json" },
              },
            );
            if (!vRes.ok) {
              const vErr = await vRes.json().catch(() => ({}));
              throw new Error(vErr.message || "Payment verification failed.");
            }
            const vData = await vRes.json().catch(() => ({}));

            // 5. Invoice generated by the backend for the verified payment
            const invoiceUrl =
              vData?.downloadUrl || "/api/invoices/latest/download";
            try {
              const bRes = await fetch(invoiceUrl, { credentials: "include" });
              if (bRes.ok) {
                const blob = await bRes.blob();
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `Invoice-${vData?.invoiceNumber || "Upgrade"}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
              }
            } catch {
              /* invoice auto-download is best-effort; the invoice stays in the dashboard */
            }

            // Success toast survives the reload via the pending-toast queue:
            // payment notifications only ever fire AFTER backend verification.
            try {
              sessionStorage.setItem(
                "euodoo-pending-toast",
                JSON.stringify({
                  type: "success",
                  message: "Payment verified! Your Premium plan is active and your invoice was downloaded.",
                }),
              );
            } catch (_) {}
            // Full reload so every UI surface reflects the plan straight from the database
            window.location.href = "/paid-dashboard";
          } catch (vErr) {
            toast.error("Verification failed: " + vErr.message);
            if (triggerBtn) {
              triggerBtn.disabled = false;
              triggerBtn.innerHTML = originalHtml;
            }
          }
        },
        modal: {
          ondismiss: function () {
            toast.info("Payment window closed before completion.");
            if (triggerBtn) {
              triggerBtn.disabled = false;
              triggerBtn.innerHTML = originalHtml;
            }
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        toast.error(
          "Payment failed: " +
            (resp.error ? resp.error.description : "Transaction declined."),
        );
        if (triggerBtn) {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = originalHtml;
        }
      });
      rzp.open();
    } catch (err) {
      toast.error("Payment initiation error: " + err.message);
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.innerHTML = originalHtml;
      }
    }
  }

  // Premium upgrade button (only reachable when the real plan is not Premium)
  if (btnSelectPremiumPlan) {
    btnSelectPremiumPlan.addEventListener("click", startPremiumUpgrade);
  }
  if (btnQuickTogglePlan) {
    btnQuickTogglePlan.addEventListener("click", startPremiumUpgrade);
  }
  // Downgrading is not offered: the Basic card button is display-only.

  // ---------------------------------------------------------------------------
  // Billing & Invoice history â€” REAL verified invoices from /api/invoices.
  // ---------------------------------------------------------------------------
  const btnDownloadInvoice = document.getElementById("btn-download-invoice");
  let currentInvoice = null;

  function formatInvoiceDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(iso || "");
    }
  }

  function setInvoiceText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setInvoiceNone(message) {
    setInvoiceText("invoice-plan-name", "No invoice yet");
    setInvoiceText("invoice-number", "â€”");
    setInvoiceText("invoice-date", "â€”");
    setInvoiceText("invoice-total", "â€”");
    setInvoiceText("invoice-detail-period", "â€”");
    setInvoiceText("invoice-detail-payer", "â€”");
    setInvoiceText("invoice-detail-subtotal", "â€”");
    setInvoiceText("invoice-detail-tax", "Included");
    const note = document.getElementById("invoice-demo-note");
    if (note) note.textContent = message;
    if (btnDownloadInvoice) btnDownloadInvoice.disabled = true;
  }

  async function loadLatestInvoice() {
    try {
      const res = await fetch("/api/invoices?page=0&size=1", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const inv =
        data && Array.isArray(data.content) ? data.content[0] || null : null;
      if (!inv) {
        setInvoiceNone(
          "Your invoice appears here after your first verified plan payment.",
        );
        return;
      }
      currentInvoice = inv;

      // Latest invoice first; prefer the plan payment invoice type when both exist
      const amountInr = Number(inv.amountInr ?? 0).toFixed(2);
      setInvoiceText(
        "invoice-plan-name",
        inv.description ||
          (userAccount.plan === "premium"
            ? "Premium Career Pro Plan"
            : "Candidate Plan"),
      );
      setInvoiceText("invoice-number", inv.invoiceNumber || "â€”");
      setInvoiceText("invoice-date", formatInvoiceDate(inv.issuedAt));
      setInvoiceText("invoice-total", `â‚¹${amountInr}`);
      setInvoiceText("invoice-detail-period", "One-time registration fee");
      setInvoiceText("invoice-detail-payer", inv.payerName || userAccount.name);
      setInvoiceText("invoice-detail-subtotal", `â‚¹${amountInr}`);
      setInvoiceText("invoice-detail-tax", "Included");
      const note = document.getElementById("invoice-demo-note");
      if (note) {
        note.textContent =
          "Every verified payment generates an invoice that you can download from your dashboard.";
      }
      if (btnDownloadInvoice) btnDownloadInvoice.disabled = false;
    } catch {
      setInvoiceNone(
        "Billing details could not be loaded. Please try again later.",
      );
    }
  }

  if (btnDownloadInvoice) {
    btnDownloadInvoice.addEventListener("click", async () => {
      if (!currentInvoice) {
        toast.info("No invoice yet â€” complete a plan payment first.");
        return;
      }
      try {
        const res = await fetch(`/api/invoices/${currentInvoice.id}/download`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Invoice download failed (HTTP ${res.status})`);
        }
        const blob = await res.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${currentInvoice.invoiceNumber || "Invoice"}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        toast.success("Invoice downloaded.");
      } catch (e) {
        toast.error(e.message || "Invoice download failed.");
      }
    });
  }

  // Align the plan UI with the real plan value immediately (applyUserProfile
  // re-runs it the moment /api/candidate/profile responds with the DB value).
  updatePlanUI();
  loadLatestInvoice();

  // Delete Account Handling
  if (btnConfirmDeleteAccount) {
    btnConfirmDeleteAccount.addEventListener("click", () => {
      const confirmText = inputDeleteConfirm
        ? inputDeleteConfirm.value.trim()
        : "";
      if (confirmText !== "DELETE") {
        if (inputDeleteConfirm) inputDeleteConfirm.focus();
        return;
      }

      // Reset Demo State
      userAccount = {
        name: "Demo Candidate",
        headline: "Frontend Engineer",
        email: "candidate@demo.com",
        phone: "+91 00000 00000",
        location: "Bangalore, India",
        portfolioUrl: "https://candidate.demo/portfolio",
        skills: "JavaScript, HTML, CSS",
        bio: "Web developer seeking entry level and junior software engineering roles.",
        plan: "basic",
        avatarInitial: "D",
      };

      if (settingsInputName) settingsInputName.value = userAccount.name;
      if (settingsInputHeadline)
        settingsInputHeadline.value = userAccount.headline;
      if (settingsInputEmail) settingsInputEmail.value = userAccount.email;
      if (inputDeleteConfirm) inputDeleteConfirm.value = "";

      updatePlanUI();
      updateAvatarDisplays("D");

      updateWelcomeHeading("Good morning, Demo Candidate");
      document
        .querySelectorAll(".user-name")
        .forEach((el) => (el.textContent = "Demo"));
      document
        .querySelectorAll(".user-role")
        .forEach((el) => (el.textContent = "Frontend Engineer"));

      closeAllModals();
    });
  }

  // Initial render of Shortlisted Cards and Profile Views
  renderShortlistedCards();
  renderProfileViews();
  updatePlanUI(); // Sync plan pill in header on page load

  // =========================================================================
  // 20. UNIVERSAL MODALS HANDLING
  // =========================================================================
  function closeAllModals() {
    if (modalResumePreview) modalResumePreview.classList.add("hidden");
    // Release the previewed file and stop any pending preview load.
    resumePreviewRequestId++;
    releaseResumePreviewUrl();
    const previewFrame = document.getElementById("resume-preview-frame");
    if (previewFrame) previewFrame.removeAttribute("src");
    currentPreviewResumeId = null;
    if (modalJobDetails) modalJobDetails.classList.add("hidden");
    if (modalAtsBuilder) modalAtsBuilder.classList.add("hidden");
    if (modalPortfolioBuilder) modalPortfolioBuilder.classList.add("hidden");
    if (modalAccountSettings) modalAccountSettings.classList.add("hidden");
    const modalInterestedJobs = document.getElementById("modal-interested-jobs");
    if (modalInterestedJobs) modalInterestedJobs.classList.add("hidden");
    const interestedNav = document.getElementById("nav-interested-jobs");
    if (interestedNav) interestedNav.classList.remove("active");
  }

  // Interested Jobs dialog dismiss buttons
  const closeInterestedJobsModal = document.getElementById("close-interested-jobs-modal");
  if (closeInterestedJobsModal)
    closeInterestedJobsModal.addEventListener("click", closeAllModals);
  const btnCloseInterestedModal = document.getElementById("btn-close-interested-modal");
  if (btnCloseInterestedModal)
    btnCloseInterestedModal.addEventListener("click", closeAllModals);
  const btnBrowseMatches = document.getElementById("btn-modal-browse-matches");
  if (btnBrowseMatches) {
    btnBrowseMatches.addEventListener("click", () => {
      closeAllModals();
      const jobsSection = document.getElementById("section-jobs");
      if (jobsSection) jobsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Modal dismiss buttons
  if (closePreviewModal)
    closePreviewModal.addEventListener("click", closeAllModals);
  if (closeJobModal) closeJobModal.addEventListener("click", closeAllModals);
  if (closeAtsModal) closeAtsModal.addEventListener("click", closeAllModals);
  if (btnCloseAtsBottom)
    btnCloseAtsBottom.addEventListener("click", closeAllModals);
  if (closePortfolioModal)
    closePortfolioModal.addEventListener("click", closeAllModals);
  if (btnClosePortfolioBottom)
    btnClosePortfolioBottom.addEventListener("click", closeAllModals);
  if (closeSettingsModal)
    closeSettingsModal.addEventListener("click", closeAllModals);
  if (btnCloseSettingsBottom)
    btnCloseSettingsBottom.addEventListener("click", closeAllModals);

  const btnUnsupportedDownload = document.getElementById(
    "btn-unsupported-download",
  );
  if (btnUnsupportedDownload) {
    btnUnsupportedDownload.addEventListener("click", () => {
      downloadResumeVersion(
        currentPreviewResumeId || (getActiveResume() || {}).id,
      );
    });
  }

  if (btnModalDownloadResume) {
    btnModalDownloadResume.addEventListener("click", () => {
      // Download whichever resume is currently being previewed.
      downloadResumeVersion(currentPreviewResumeId || (getActiveResume() || {}).id);
    });
  }

  if (btnModalPrintResume) {
    btnModalPrintResume.addEventListener("click", () => {
      const frame = document.getElementById("resume-preview-frame");
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          return;
        } catch (error) {
          /* fall back to opening print for object url or printing */
        }
      }
      if (resumePreviewObjectUrl) {
        const printWin = window.open(resumePreviewObjectUrl, "_blank");
        if (printWin) {
          printWin.focus();
          printWin.print();
          return;
        }
      }
      window.print();
    });
  }

  // Click outside to dismiss modals
  [
    modalResumePreview,
    modalJobDetails,
    modalAtsBuilder,
    modalPortfolioBuilder,
    modalAccountSettings,
  ].forEach((m) => {
    if (m) {
      m.addEventListener("click", (e) => {
        if (e.target === m) {
          closeAllModals();
        }
      });
    }
  });

  // Escape to close modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });

  // Return cleanup handler
  return () => {
    delete window.setPaidUserProfile;
    window.removeEventListener("hrm:profile-updated", onProfileUpdated);
  };
}
