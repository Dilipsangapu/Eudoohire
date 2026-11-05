
import { techPillHTML } from "../components/TechnologyIcon.jsx";
import { toast } from "../components/Toast.jsx";
import { csrfHeaders, RAZORPAY_KEY_ID } from "../services/api.js";

export function initUnpaidDashboard() {
  const ac = new AbortController();
  const nativeAdd = EventTarget.prototype.addEventListener;

  // Every listener added while init runs gets this abort signal
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const o = typeof opts === "object" && opts ? opts : { capture: !!opts };
    return nativeAdd.call(this, type, fn, { ...o, signal: ac.signal });
  };

  let innerCleanup;
  try {
    innerCleanup = initUnpaidDashboardInner();
  } finally {
    EventTarget.prototype.addEventListener = nativeAdd; // always restore
  }

  return () => {
    ac.abort(); // removes every listener registered during init
    if (typeof innerCleanup === "function") innerCleanup();
  };
}

function initUnpaidDashboardInner() {
    
  // Track document-level listeners so React can remove them on unmount.
  const _docListeners = [];
  const onDoc = (type, fn, opts) => {
    document.addEventListener(type, fn, opts);
    _docListeners.push([type, fn, opts]);
  };

  'use strict';

  function escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // 1. STATE & LOCAL STORAGE KEYS
  // =========================================================================
  const STORAGE_KEYS = {
    SAVED_DRAFT: 'hrm_unpaid_resume_draft',
    SAVED_JOBS: 'hrm_unpaid_saved_jobs',
    USER_PROFILE: 'hrm_unpaid_user_profile',
    READ_NOTIFS: 'hrm_unpaid_read_notifications',
    ACTIVE_TEMPLATE: 'hrm_unpaid_active_template'
  };

  // Default Candidate Profile State
  const defaultProfile = {
    fullName: 'Candidate',
    role: 'Software Developer',
    email: '',
    phone: '',
    location: 'Bengaluru, India',
    skills: 'JavaScript (ES6+), HTML5, CSS3, React, TypeScript, Git, REST APIs',
    summary: 'Dedicated Software Developer building responsive, reliable web applications and clean frontend architectures.',
    experience: '',
    education: '',
    profileStrength: 50
  };

  // Load state from localStorage or initialize defaults
  let cachedProfile = null;
  try {
    cachedProfile = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PROFILE));
    if (cachedProfile && cachedProfile.fullName && cachedProfile.fullName.toLowerCase().includes('aarav')) {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      cachedProfile = null;
    }
  } catch(e) {}

  let currentProfile = cachedProfile || defaultProfile;
  // Real ATS quota comes from the backend entitlement endpoint (persisted in
  // MongoDB) — never from localStorage.
  let atsChecksRemaining = 2;
  let atsEntitlementLoaded = false;
  let savedJobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_JOBS)) || [];
  let savedDraft = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_DRAFT)) || null;
  let activeTemplate = localStorage.getItem(STORAGE_KEYS.ACTIVE_TEMPLATE) || 'Aurora';

  // =========================================================================
  // 2. DOM ELEMENT REFERENCES
  // =========================================================================
  // Navigation & Shell
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const searchFeedbackBanner = document.getElementById('searchFeedbackBanner');
  const activeSearchQuery = document.getElementById('activeSearchQuery');
  const resetSearchBannerBtn = document.getElementById('resetSearchBannerBtn');
  const emptySearchState = document.getElementById('emptySearchState');
  const emptySearchTerm = document.getElementById('emptySearchTerm');
  const clearSearchEmptyBtn = document.getElementById('clearSearchEmptyBtn');

  // Topbar Dropdowns
  const notificationBtn = document.getElementById('notificationBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');
  const notificationBadge = document.getElementById('notificationBadge');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  const unreadNotifCount = document.getElementById('unreadNotifCount');
  const profileToggleBtn = document.getElementById('profileToggleBtn');
  const profileDropdown = document.getElementById('profileDropdown');

  // Dynamic Displays
  const welcomeUserName = document.getElementById('welcomeUserName');
  const topbarCandidateName = document.getElementById('topbarCandidateName');
  const topbarCandidateRole = document.getElementById('topbarCandidateRole');
  const dropdownCandidateName = document.getElementById('dropdownCandidateName');
  const dropdownCandidateEmail = document.getElementById('dropdownCandidateEmail');
  const sidebarProfilePercent = document.getElementById('sidebarProfilePercent');
  const sidebarProgressBar = document.getElementById('sidebarProgressBar');
  const sidebarProfileHint = document.getElementById('sidebarProfileHint');
  const statProfileStrength = document.getElementById('statProfileStrength');

  // ATS Counters
  const navAtsPill = document.getElementById('navAtsPill');
  const atsChecksRemainingPill = document.getElementById('atsChecksRemainingPill');
  const atsChecksRemainingCount = document.getElementById('atsChecksRemainingCount');
  const usageAtsCount = document.getElementById('usageAtsCount');
  const usageAtsBar = document.getElementById('usageAtsBar');
  const usageAtsHint = document.getElementById('usageAtsHint');
  const dropdownAtsCount = document.getElementById('dropdownAtsCount');
  const atsModalChecksRemaining = document.getElementById('atsModalChecksRemaining');

  // Modals
  const upgradeModal = document.getElementById('upgradeModal');
  const upgradeModalTitle = document.getElementById('upgradeModalTitle');
  const upgradeTargetFeature = document.getElementById('upgradeTargetFeature');
  const upgradeTargetDesc = document.getElementById('upgradeTargetDesc');
  const upgradeModalCloseBtn = document.getElementById('upgradeModalCloseBtn');
  const upgradeModalDismissBtn = document.getElementById('upgradeModalDismissBtn');
  const upgradeModalExploreBtn = document.getElementById('upgradeModalExploreBtn');

  const pricingModal = document.getElementById('pricingModal');
  const pricingModalCloseBtn = document.getElementById('pricingModalCloseBtn');
  const pricingDemoUpgradeBtn = document.getElementById('pricingDemoUpgradeBtn');

  const atsModal = document.getElementById('atsModal');
  const atsModalCloseBtn = document.getElementById('atsModalCloseBtn');
  const openAtsModalBtn = document.getElementById('openAtsModalBtn');
  const statOpenAtsBtn = document.getElementById('statOpenAtsBtn');
  const atsResumeText = document.getElementById('atsResumeText');
  const atsRunCheckBtn = document.getElementById('atsRunCheckBtn');
  const atsFillSampleBtn = document.getElementById('atsFillSampleBtn');
  const atsResultsArea = document.getElementById('atsResultsArea');
  const atsInputSection = document.getElementById('atsInputSection');
  const atsRecheckBtn = document.getElementById('atsRecheckBtn');
  const scoreMetricValue = document.getElementById('scoreMetricValue');
  const scoreStatusText = document.getElementById('scoreStatusText');
  const scoreAnalysisDesc = document.getElementById('scoreAnalysisDesc');
  const detectedSkillsList = document.getElementById('detectedSkillsList');
  const breakdownGrid = document.getElementById('breakdownGrid');
  const suggestionsList = document.getElementById('suggestionsList');
  const atsJobDescription = document.getElementById('atsJobDescription');
  const atsHistoryList = document.getElementById('atsHistoryList');

  const resumeEditorModal = document.getElementById('resumeEditorModal');
  const resumeEditorCloseBtn = document.getElementById('resumeEditorCloseBtn');
  const currentEditingTemplateName = document.getElementById('currentEditingTemplateName');
  const previewTemplatePill = document.getElementById('previewTemplatePill');
  const editorSaveDraftBtn = document.getElementById('editorSaveDraftBtn');
  const editorDownloadBtn = document.getElementById('editorDownloadBtn');

  // Resume Editor Form Fields
  const edFullName = document.getElementById('edFullName');
  const edJobTitle = document.getElementById('edJobTitle');
  const edEmail = document.getElementById('edEmail');
  const edPhone = document.getElementById('edPhone');
  const edLocation = document.getElementById('edLocation');
  const edSummary = document.getElementById('edSummary');
  const edSkills = document.getElementById('edSkills');
  const edExperience = document.getElementById('edExperience');
  const edEducation = document.getElementById('edEducation');

  // Resume Live Preview Elements
  const prevName = document.getElementById('prevName');
  const prevTitle = document.getElementById('prevTitle');
  const prevEmail = document.getElementById('prevEmail');
  const prevPhone = document.getElementById('prevPhone');
  const prevLocation = document.getElementById('prevLocation');
  const prevSummary = document.getElementById('prevSummary');
  const prevSkillsWrap = document.getElementById('prevSkillsWrap');
  const prevExperience = document.getElementById('prevExperience');
  const prevEducation = document.getElementById('prevEducation');

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const settingsModalCloseBtn = document.getElementById('settingsModalCloseBtn');
  const settingsCancelBtn = document.getElementById('settingsCancelBtn');
  const profileSettingsForm = document.getElementById('profileSettingsForm');
  const setFullName = document.getElementById('setFullName');
  const setTitle = document.getElementById('setTitle');
  const setEmail = document.getElementById('setEmail');
  const setLocation = document.getElementById('setLocation');
  const setSkills = document.getElementById('setSkills');
  const setBio = document.getElementById('setBio');

  // Questions Modal
  const questionsModal = document.getElementById('questionsModal');
  const questionsModalCloseBtn = document.getElementById('questionsModalCloseBtn');
  const openQuestionsModalBtn = document.getElementById('openQuestionsModalBtn');

  // Portfolio Modal
  const portfolioModal = document.getElementById('portfolioModal');
  const portfolioModalCloseBtn = document.getElementById('portfolioModalCloseBtn');
  const previewPortfolioBtn = document.getElementById('previewPortfolioBtn');
  const tablePreviewPortfolioBtn = document.getElementById('tablePreviewPortfolioBtn');

  // Job Preview Modal
  const jobPreviewModal = document.getElementById('jobPreviewModal');
  const jobModalCloseBtn = document.getElementById('jobModalCloseBtn');
  const openJob1DetailsBtn = document.getElementById('openJob1DetailsBtn');
  const bookmarkJob1Btn = document.getElementById('bookmarkJob1Btn');
  const jobSaveToggleBtn = document.getElementById('jobSaveToggleBtn');
  const jobSaveBtnText = document.getElementById('jobSaveBtnText');

  // Toast Container
  // (legacy DOM-based toast viewer; no longer rendered into)

  // =========================================================================
  // 3. CORE TOAST NOTIFICATION SYSTEM
  // =========================================================================
  /**
   * Thin delegation shim: every legacy `showToast(...)` call site now emits
   * through the app's single centralized toast system (components/Toast.jsx),
   * so this dashboard no longer runs its own duplicate toast implementation.
   * The legacy `duration` argument is ignored; the central system enforces
   * consistent auto-dismiss timings for every toast.
   */
  function showToast(message, type = 'info', _duration = 4000) {
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else if (type === 'warning') toast.warning(message);
    else toast.info(message);
  }

  // =========================================================================
  // 4. MODAL MANAGEMENT SYSTEM
  // =========================================================================
  function openModal(modalEl) {
    if (!modalEl) return;
    // Close any other open modals first
    document.querySelectorAll('.modal-backdrop.active').forEach(m => {
      if (m !== modalEl) closeModal(m);
    });
    modalEl.classList.add('active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    modalEl.setAttribute('aria-hidden', 'true');
    // Restore body overflow if no other modal is open
    if (!document.querySelector('.modal-backdrop.active')) {
      document.body.style.overflow = '';
    }
  }

  // Close when clicking outside modal dialog
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop);
      }
    });
  });

  // Global ESC Key handler
  onDoc('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-backdrop.active');
      if (activeModal) {
        closeModal(activeModal);
      }
      closeAllDropdowns();
      if (sidebar.classList.contains('mobile-open')) {
        closeMobileSidebar();
      }
    }
  });

  // Reusable Upgrade Modal Trigger
  window.showUpgradeModal = function(featureName, featureDesc) {
    if (!upgradeModal) return;
    upgradeModalTitle.textContent = 'Unlock Premium Features';
    upgradeTargetFeature.textContent = featureName || 'Premium Feature';
    upgradeTargetDesc.textContent = featureDesc || 'Upgrade your candidate account to unlock full professional capabilities, advanced tools, and unmetered access.';
    openModal(upgradeModal);
  };

  // Close buttons for upgrade modal
  if (upgradeModalCloseBtn) upgradeModalCloseBtn.addEventListener('click', () => closeModal(upgradeModal));
  if (upgradeModalDismissBtn) upgradeModalDismissBtn.addEventListener('click', () => closeModal(upgradeModal));
  if (upgradeModalExploreBtn) {
    upgradeModalExploreBtn.addEventListener('click', () => {
      closeModal(upgradeModal);
      openModal(pricingModal);
    });
  }

  // Pricing Modal triggers
  const openPricingTriggers = [
    document.getElementById('sidebarUpgradeBtn'),
    document.getElementById('bannerUpgradeBtn'),
    document.getElementById('bannerCompareBtn'),
    document.getElementById('menuUpgradePremium'),
    document.getElementById('usageUpgradeBtn'),
    document.getElementById('footerUpgradeLink'),
    document.getElementById('notifUpgradeCTA')
  ];

  openPricingTriggers.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeAllDropdowns();
        openModal(pricingModal);
      });
    }
  });

  if (pricingModalCloseBtn) {
    pricingModalCloseBtn.addEventListener('click', () => closeModal(pricingModal));
  }

 
  // ==================== PREMIUM PAYMENT CHECKOUT ====================

  const paymentCheckout = document.getElementById("paymentCheckout");
  const pricingCardsGrid = document.querySelector(
    "#pricingModal .pricing-cards-grid"
  );
  const pricingNoticeBox = document.getElementById("pricingNoticeBox");
  const paymentBackBtn = document.getElementById("paymentBackBtn");
  const paymentForm = document.getElementById("paymentForm");
  const paymentFullName = document.getElementById("paymentFullName");
  const paymentEmail = document.getElementById("paymentEmail");
  const paymentPhone = document.getElementById("paymentPhone");
  const paymentPayBtn = document.getElementById("paymentPayBtn");

  const paymentSuccessMessage = document.getElementById(
    "paymentSuccessMessage"
  );
  const paymentDoneBtn = document.getElementById("paymentDoneBtn");
  const pricingUpgradeBasicBtn = document.getElementById("pricingUpgradeBasicBtn");
  let selectedUpgradePlan = "PREMIUM";

  function showPaymentCheckout(plan = "PREMIUM") {
    if (!paymentCheckout || !pricingCardsGrid) return;
    selectedUpgradePlan = plan;

    // Update dynamic text in checkout order summary
    const summaryTitle = document.getElementById("checkoutSummaryPlanTitle");
    const summaryDesc = document.getElementById("checkoutSummaryPlanDesc");
    const summaryPrice = document.getElementById("checkoutSummaryPlanPrice");
    const summaryTotal = document.getElementById("checkoutSummaryTotal");
    const payBtnText = document.getElementById("paymentPayBtnText");
    const benefitNote = document.getElementById("checkoutSummaryBenefitNote");

    selectedUpgradePlan = "PREMIUM";
    if (summaryTitle) summaryTitle.textContent = "Premium Career Pro";
    if (summaryDesc) summaryDesc.textContent = "Candidate subscription · one-time payment";
    if (summaryPrice) summaryPrice.textContent = "₹499.00";
    if (summaryTotal) summaryTotal.textContent = "₹499";
    if (payBtnText) payBtnText.textContent = "Pay ₹499 with Razorpay";
    if (benefitNote) benefitNote.innerHTML = '<i class="fa-solid fa-circle-check"></i> Portfolio publishing, unlimited ATS checks, direct HR applications, top recruiter search placement, and full template access.';

    pricingCardsGrid.style.display = "none";

    if (pricingNoticeBox) {
      pricingNoticeBox.style.display = "none";
    }

    paymentCheckout.style.display = "block";
    paymentCheckout.setAttribute("aria-hidden", "false");

    if (paymentFullName && !paymentFullName.value) {
      paymentFullName.value = currentProfile?.fullName || "";
    }
    if (paymentEmail && !paymentEmail.value) {
      paymentEmail.value = currentProfile?.email || "";
    }
    if (paymentPhone && !paymentPhone.value) {
      paymentPhone.value = currentProfile?.phone || "";
    }

    if (paymentForm) {
      paymentForm.style.display = "block";
    }

    if (paymentSuccessMessage) {
      paymentSuccessMessage.style.display = "none";
    }

    const orderSummary = paymentCheckout.querySelector(
      ".payment-order-summary"
    );

    if (orderSummary) {
      orderSummary.style.display = "block";
    }

    const dialog = pricingModal?.querySelector(".modal-dialog");

    if (dialog) {
      dialog.scrollTop = 0;
    }
  }

  function showPricingPlans() {
    if (!paymentCheckout || !pricingCardsGrid) return;

    paymentCheckout.style.display = "none";
    paymentCheckout.setAttribute("aria-hidden", "true");
    pricingCardsGrid.style.display = "";

    if (pricingNoticeBox) {
      pricingNoticeBox.style.display = "";
    }

    if (paymentForm) {
      paymentForm.style.display = "block";
    }

    if (paymentSuccessMessage) {
      paymentSuccessMessage.style.display = "none";
    }

    const orderSummary = paymentCheckout.querySelector(
      ".payment-order-summary"
    );

    if (orderSummary) {
      orderSummary.style.display = "block";
    }
  }

  // Upgrade button on Basic pricing card is discontinued (candidate has single ₹499 plan)
  if (pricingUpgradeBasicBtn) {
    pricingUpgradeBasicBtn.style.display = "none";
  }

  // Upgrade button on Premium pricing card (₹499)
  if (pricingDemoUpgradeBtn) {
    pricingDemoUpgradeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      showPaymentCheckout("PREMIUM");
    });
  }

  // Return to pricing plans
  if (paymentBackBtn) {
    paymentBackBtn.addEventListener("click", showPricingPlans);
  }

  // Real Razorpay Checkout & Backend Verification
  async function handleRazorpayPayment() {
    const payBtn = paymentPayBtn || pricingDemoUpgradeBtn;
    const originalHtml = payBtn ? payBtn.innerHTML : "";
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Razorpay...';
    }

    try {
      // 1. Create plan upgrade order in Spring Boot backend for selected plan (BASIC or PREMIUM)
      const targetPlan = "PREMIUM";
      const res = await fetch(`/api/payments/plan-order?plan=PREMIUM`, {
        method: "POST",
        credentials: "include",
        headers: { "Accept": "application/json" }
      });

      if (!res.ok) {
        if (res.status === 401) {
          try {
            sessionStorage.setItem(
              "euodoo-pending-toast",
              JSON.stringify({ type: "error", message: "Your login session has expired. Redirecting you to login..." }),
            );
          } catch (_) {}
          window.location.href = "/login";
          return;
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Order initialization failed (HTTP ${res.status})`);
      }

      const orderData = await res.json();
      const orderId = orderData.gatewayOrderId;
      const amountPaise = orderData.amountPaise || 49900;
      const keyId = orderData.keyId || RAZORPAY_KEY_ID;
      const planDesc = "Premium Career Pro Upgrade";

      // 2. Load Razorpay Checkout SDK if needed
      if (typeof window.Razorpay === "undefined") {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = resolve;
          s.onerror = () => reject(new Error("Unable to load Razorpay checkout script."));
          document.head.appendChild(s);
        });
      }

      // 3. Launch official Razorpay Checkout modal
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: orderData.currency || "INR",
        name: "Euodoo Hire",
        description: planDesc,
        order_id: orderId,
        prefill: {
          name: paymentFullName?.value.trim() || currentProfile?.fullName || "Candidate",
          email: paymentEmail?.value.trim() || currentProfile?.email || "candidate@example.com",
          contact: paymentPhone?.value.trim() || currentProfile?.phone || ""
        },
        theme: {
          color: "#0E8478"
        },
        handler: async function (response) {
          if (payBtn) payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Activating subscription...';
          try {
            // 4. Verify payment on Spring Boot backend
            const vRes = await fetch(
              `/api/payments/verify?orderId=${encodeURIComponent(response.razorpay_order_id)}&paymentId=${encodeURIComponent(response.razorpay_payment_id)}&signature=${encodeURIComponent(response.razorpay_signature)}`,
              {
                method: "POST",
                credentials: "include",
                headers: { "Accept": "application/json" }
              }
            );

            if (!vRes.ok) {
              const vErr = await vRes.json().catch(() => ({}));
              throw new Error(vErr.message || "Payment verification failed.");
            }

            const vData = await vRes.json().catch(() => ({}));

            // 5. Success: update local flag, auto-download invoice & redirect to paid dashboard
            localStorage.setItem("euodoo-account-type", "paid");

            // Automatically download invoice PDF
            const invoiceDownloadUrl = vData?.downloadUrl || (vData?.invoiceId ? `/api/invoices/${vData.invoiceId}/download` : '/api/invoices/latest/download');
            const link = document.createElement("a");
            link.href = invoiceDownloadUrl;
            link.setAttribute("download", `Invoice-${vData?.invoiceNumber || 'Upgrade'}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (paymentForm) paymentForm.style.display = "none";
            const orderSummary = paymentCheckout?.querySelector(".payment-order-summary");
            if (orderSummary) orderSummary.style.display = "none";
            if (paymentSuccessMessage) {
              paymentSuccessMessage.innerHTML = `
                <span class="payment-success-icon"><i class="fa-solid fa-circle-check"></i></span>
                <h3>Payment Verified &amp; Invoice Downloaded!</h3>
                <p>Your subscription is active and your official tax invoice <strong>(${vData?.invoiceNumber || ''})</strong> has been downloaded to your computer.</p>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 16px;">
                  <a href="${invoiceDownloadUrl}" class="btn btn-secondary-light" download style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    <i class="fa-solid fa-file-arrow-down"></i> Re-download Invoice
                  </a>
                  <button type="button" class="btn btn-primary" onclick="window.location.href='/paid-dashboard'">
                    Continue to Paid Dashboard
                  </button>
                </div>
              `;
              paymentSuccessMessage.style.display = "block";
            }

            showToast("Payment verified! Official invoice downloaded.", "success", 4000);
            setTimeout(() => {
              window.location.href = "/paid-dashboard";
            }, 3500);
          } catch (vErr) {
            toast.error("Verification failed: " + vErr.message);
            if (payBtn) {
              payBtn.disabled = false;
              payBtn.innerHTML = originalHtml;
            }
          }
        },
        modal: {
          ondismiss: function () {
            toast.info("Payment window closed before completion.");
            if (payBtn) {
              payBtn.disabled = false;
              payBtn.innerHTML = originalHtml;
            }
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        toast.error("Payment failed: " + (resp.error ? resp.error.description : "Transaction declined."));
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.innerHTML = originalHtml;
        }
      });
      rzp.open();
    } catch (err) {
      toast.error("Payment initiation error: " + err.message);
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.innerHTML = originalHtml;
      }
    }
  }

  if (paymentForm) {
    paymentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!paymentForm.reportValidity()) return;
      handleRazorpayPayment();
    });
  }

  // Done button redirects to Paid Dashboard
  if (paymentDoneBtn) {
    paymentDoneBtn.addEventListener("click", () => {
      window.location.href = "/paid-dashboard";
    });
  }


  // =========================================================================
  // 5. GLOBAL CLICK DELEGATION FOR LOCKED FEATURES
  // =========================================================================
  onDoc('click', (e) => {
    const lockedTrigger = e.target.closest('[data-locked="true"]');
    if (lockedTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const feature = lockedTrigger.getAttribute('data-feature') || 'Premium Tool';
      const desc = lockedTrigger.getAttribute('data-desc') || 'This feature is exclusive to HR Module Pro candidates.';
      showUpgradeModal(feature, desc);
    }
  });

  // Tooltip integration for locked elements
  document.querySelectorAll('[data-locked="true"]').forEach(el => {
    if (!el.hasAttribute('data-tooltip') && !el.classList.contains('job-card') && !el.classList.contains('template-card')) {
      el.setAttribute('data-tooltip', 'Available with Premium');
    }
  });

  // =========================================================================
  // 6. RESPONSIVE SIDEBAR & MOBILE NAVIGATION
  // =========================================================================
  function openMobileSidebar() {
    sidebar.classList.add('mobile-open');
    sidebarOverlay.classList.add('active');
    sidebarOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('active');
    sidebarOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', openMobileSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Smooth scroll and active state for sidebar links
  const sidebarNavLinks = document.querySelectorAll('.sidebar-nav .nav-item');
  sidebarNavLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      if (this.hasAttribute('data-locked')) return; // Handled by locked delegator
      sidebarNavLinks.forEach(item => item.classList.remove('active'));
      this.classList.add('active');
      if (window.innerWidth <= 768) {
        closeMobileSidebar();
      }
    });
  });

  // =========================================================================
  // 7. TOPBAR DROPDOWNS & NOTIFICATIONS
  // =========================================================================
  function closeAllDropdowns() {
    if (notificationDropdown) notificationDropdown.classList.remove('active');
    if (profileDropdown) profileDropdown.classList.remove('active');
    if (notificationBtn) notificationBtn.setAttribute('aria-expanded', 'false');
    if (profileToggleBtn) profileToggleBtn.setAttribute('aria-expanded', 'false');
  }

  // React handles the actual route change; this event closes any legacy dropdown state.
  window.addEventListener('hrm:unpaid-signout', closeAllDropdowns);

  // Sync profile data dynamically when authenticated user profile loads
  window.addEventListener('hrm:profile-updated', (e) => {
    if (e.detail) {
      currentProfile = { ...currentProfile, ...e.detail };
      renderProfile();
    }
  });

  if (notificationBtn) {
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = notificationDropdown.classList.contains('active');
      closeAllDropdowns();
      if (!isOpen) {
        notificationDropdown.classList.add('active');
        notificationBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (profileToggleBtn) {
    profileToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileDropdown.classList.contains('active');
      closeAllDropdowns();
      if (!isOpen) {
        profileDropdown.classList.add('active');
        profileToggleBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // Close dropdowns on outside click
  onDoc('click', (e) => {
    if (!e.target.closest('.dropdown-wrapper')) {
      closeAllDropdowns();
    }
  });

 

if (localStorage.getItem(STORAGE_KEYS.READ_NOTIFS) === "true") {
  document
    .querySelectorAll(".hrm-unpaid .notif-item.unread")
    .forEach((item) => {
      item.classList.remove("unread");
    });

  if (notificationBadge) {
    notificationBadge.style.display = "none";
  }

  if (unreadNotifCount) {
    unreadNotifCount.textContent = "0 unread updates";
  }
}



  // Restore notification read state
  // if (localStorage.getItem(STORAGE_KEYS.READ_NOTIFS) === 'true') {
  //   const unreadItems = document.querySelectorAll('.notif-item.unread');
  //   unreadItems.forEach(item => item.classList.remove('unread'));
  //   if (notificationBadge) notificationBadge.style.display = 'none';
  //   if (unreadNotifCount) unreadNotifCount.textContent = '0 unread updates';
  // }

  // Sign out dummy button
  // const menuSignOut = document.getElementById('menuSignOut');
  // if (menuSignOut) {
  //   menuSignOut.addEventListener('click', () => {
  //     showToast('You are running the Free Candidate Local Prototype.', 'info', 3000);
  //     closeAllDropdowns();
  //   });
  // }

  // =========================================================================
  // 8. PROFILE & SETTINGS SYSTEM
  // =========================================================================
  function renderProfile() {
    if (welcomeUserName) welcomeUserName.textContent = currentProfile.fullName.split(' ')[0] || 'Candidate';
    if (topbarCandidateName) topbarCandidateName.textContent = currentProfile.fullName.split(' ')[0] || 'Candidate';
    if (topbarCandidateRole) topbarCandidateRole.textContent = currentProfile.role || 'Software Developer';
    if (dropdownCandidateName) dropdownCandidateName.textContent = currentProfile.fullName;
    if (dropdownCandidateEmail) dropdownCandidateEmail.textContent = currentProfile.email;

    // Progress and strength
    const strength = currentProfile.profileStrength || 50;
    if (sidebarProfilePercent) sidebarProfilePercent.textContent = `${strength}%`;
    if (sidebarProgressBar) sidebarProgressBar.style.width = `${strength}%`;
    if (sidebarProfileHint) sidebarProfileHint.textContent = `${strength}% complete`;
    if (statProfileStrength) statProfileStrength.textContent = `${strength}%`;

    // Populate Settings Modal fields
    if (setFullName) setFullName.value = currentProfile.fullName;
    if (setTitle) setTitle.value = currentProfile.role;
    if (setEmail) setEmail.value = currentProfile.email;
    if (setLocation) setLocation.value = currentProfile.location;
    if (setSkills) setSkills.value = currentProfile.skills;
    if (setBio) setBio.value = currentProfile.summary;

    // Populate Resume Editor fields
    if (edFullName) edFullName.value = currentProfile.fullName;
    if (edJobTitle) edJobTitle.value = currentProfile.role;
    if (edEmail) edEmail.value = currentProfile.email;
    if (edPhone) edPhone.value = currentProfile.phone;
    if (edLocation) edLocation.value = currentProfile.location;
    if (edSummary) edSummary.value = currentProfile.summary;
    if (edSkills) edSkills.value = currentProfile.skills;
    if (edExperience) edExperience.value = currentProfile.experience;
    if (edEducation) edEducation.value = currentProfile.education;

    // Update live preview
    updateResumePreview();
  }

  function openSettingsModal(startTab = 'info') {
    closeAllDropdowns();
    renderProfile();
    // Switch to the requested tab
    switchSettingsTab(startTab);
    openModal(settingsModal);
  }

  // Settings tab switcher
  function switchSettingsTab(tab) {
    const panels = {
      info:    document.getElementById('stab-panel-info'),
      upgrade: document.getElementById('stab-panel-upgrade'),
      danger:  document.getElementById('stab-panel-danger'),
    };
    const btns = {
      info:    document.getElementById('stab-info'),
      upgrade: document.getElementById('stab-upgrade'),
      danger:  document.getElementById('stab-danger'),
    };
    Object.keys(panels).forEach(key => {
      if (panels[key]) panels[key].style.display = (key === tab) ? 'block' : 'none';
      if (btns[key]) {
        btns[key].classList.toggle('active', key === tab);
        btns[key].setAttribute('aria-selected', key === tab ? 'true' : 'false');
      }
    });
  }

  // Wire settings tab buttons
  ['info', 'upgrade', 'danger'].forEach(tab => {
    const btn = document.getElementById(`stab-${tab}`);
    if (btn) btn.addEventListener('click', () => switchSettingsTab(tab));
  });

  // Upgrade button inside settings opens pricing modal
  const settingsUpgradeBtn = document.getElementById('settingsUpgradeBtn');
  if (settingsUpgradeBtn) {
    settingsUpgradeBtn.addEventListener('click', () => {
      closeModal(settingsModal);
      openModal(pricingModal);
    });
  }

  // Delete account flow
  const deleteAccountBtn     = document.getElementById('deleteAccountBtn');
  const deleteConfirmStep    = document.getElementById('deleteConfirmStep');
  const deleteConfirmInput   = document.getElementById('deleteConfirmInput');
  const confirmDeleteAccBtn  = document.getElementById('confirmDeleteAccountBtn');
  const cancelDeleteBtn      = document.getElementById('cancelDeleteBtn');

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', () => {
      if (deleteConfirmStep) deleteConfirmStep.style.display = 'block';
      deleteAccountBtn.style.display = 'none';
    });
  }
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      if (deleteConfirmStep) deleteConfirmStep.style.display = 'none';
      if (deleteAccountBtn) deleteAccountBtn.style.display = 'flex';
      if (deleteConfirmInput) deleteConfirmInput.value = '';
      if (confirmDeleteAccBtn) confirmDeleteAccBtn.disabled = true;
    });
  }
  if (deleteConfirmInput) {
    deleteConfirmInput.addEventListener('input', () => {
      if (confirmDeleteAccBtn) {
        confirmDeleteAccBtn.disabled = deleteConfirmInput.value !== 'DELETE';
      }
    });
  }
  if (confirmDeleteAccBtn) {
    confirmDeleteAccBtn.addEventListener('click', () => {
      // Clear all localStorage data
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      closeModal(settingsModal);
      showToast('Account data cleared from this device. This is a prototype — no server-side data was deleted.', 'info', 6000);
    });
  }

  const openSettingsTriggers = [
    document.getElementById('nav-settings'),
    document.getElementById('sidebarCompleteProfileBtn'),
    document.getElementById('statOpenProfileBtn'),
    document.getElementById('menuMyProfile'),
    document.getElementById('menuAccountSettings')
  ];

  openSettingsTriggers.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openSettingsModal();
      });
    }
  });

  if (settingsModalCloseBtn) settingsModalCloseBtn.addEventListener('click', () => closeModal(settingsModal));
  if (settingsCancelBtn) settingsCancelBtn.addEventListener('click', () => closeModal(settingsModal));

  if (profileSettingsForm) {
    profileSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentProfile.fullName = setFullName.value.trim() || currentProfile.fullName || 'Candidate';
      currentProfile.role = setTitle.value.trim() || currentProfile.role || 'Software Developer';
      currentProfile.email = setEmail.value.trim() || currentProfile.email || '';
      currentProfile.location = setLocation.value.trim() || 'Bengaluru, India';
      currentProfile.skills = setSkills.value.trim() || '';
      currentProfile.summary = setBio.value.trim() || '';
      
      // Calculate new profile strength based on filled fields
      let score = 45;
      if (currentProfile.skills.length > 20) score += 20;
      if (currentProfile.summary.length > 30) score += 15;
      if (currentProfile.location.length > 3) score += 10;
      currentProfile.profileStrength = Math.min(score, 90);

      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(currentProfile));
      renderProfile();
      closeModal(settingsModal);
      showToast('Profile and settings updated successfully!', 'success');

      // Persist updates to Spring Boot backend MongoDB database
      fetch('/api/candidate/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: currentProfile.fullName,
          headline: currentProfile.role,
          location: currentProfile.location,
          bio: currentProfile.summary,
          skills: currentProfile.skills ? currentProfile.skills.split(',').map(s => s.trim()).filter(Boolean) : []
        })
      }).catch(() => {});
    });
  }

  // =========================================================================
  // 9. ATS CHECKER (quota + engine live in the section below, backend-driven)
  // =========================================================================

  // =========================================================================
  // 9. ATS CHECKER — FILE UPLOAD + PASTE TABS + REAL BACKEND QUOTA ENGINE
  // =========================================================================
  // ---- Tab switching ----
  const atsTabUpload = document.getElementById('atsTabUpload');
  const atsTabPaste  = document.getElementById('atsTabPaste');
  const atsUploadPanel = document.getElementById('atsUploadPanel');
  const atsPastePanel  = document.getElementById('atsPastePanel');
  let atsCurrentTab = 'upload'; // 'upload' | 'paste'
  let atsFile = null;           // the REAL uploaded resume file (sent to the backend)
  let atsHistoryItems = [];     // saved ATS checks from MongoDB
  let atsSessionKey = null;     // per-attempt idempotency key (renewed per modal open)

  function updateAtsQuotaDisplay() {
    const remaining = Math.max(0, Number.isFinite(atsChecksRemaining) ? atsChecksRemaining : 0);
    if (atsChecksRemainingCount) atsChecksRemainingCount.textContent = remaining;
    if (navAtsPill) navAtsPill.textContent = `${remaining} Left`;
    if (usageAtsCount) usageAtsCount.textContent = `${remaining} Remaining`;
    if (dropdownAtsCount) dropdownAtsCount.textContent = `${remaining} / 2`;
    if (atsModalChecksRemaining) atsModalChecksRemaining.textContent = remaining;
    const noticeBarChecks = document.getElementById('noticeBarAtsChecks');
    if (noticeBarChecks) noticeBarChecks.textContent = remaining;

    const percent = Math.max(0, Math.min(100, (remaining / 2) * 100));
    if (usageAtsBar) usageAtsBar.style.width = `${percent}%`;
    if (usageAtsHint) {
      usageAtsHint.textContent = remaining > 0
        ? `${remaining} free check${remaining === 1 ? '' : 's'} remaining in current free cycle`
        : 'Free checks exhausted. Upgrade for unlimited analysis.';
    }

    if (atsChecksRemainingPill) {
      atsChecksRemainingPill.className = 'badge-quota-pill';
      atsChecksRemainingPill.innerHTML = remaining <= 0
        ? '<i class="fa-solid fa-lock"></i> 0 Free Checks Left'
        : `<i class="fa-solid fa-bolt"></i> <span id="atsChecksRemainingCount">${remaining}</span> Free Checks Left`;
    }
  }

  /**
   * Fetches the REAL entitlement from the backend (persisted usage in
   * MongoDB). Failure keeps the last known display — the backend still
   * enforces every request server-side.
   */
  async function fetchAtsEntitlement() {
    try {
      const res = await fetch('/api/candidate/ats-entitlement', { credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json();
      if (data && typeof data.remainingChecks === 'number') {
        atsChecksRemaining = data.remainingChecks;
        atsEntitlementLoaded = true;
        updateAtsQuotaDisplay();
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function formatAtsDate(iso) {
    if (!iso) return 'Unknown date';
    const d = new Date(iso);
    return isNaN(d) ? 'Unknown date'
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function loadAtsHistory() {
    try {
      const res = await fetch('/api/candidate/ats-evaluations?page=0&size=10', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      atsHistoryItems = (data && Array.isArray(data.content)) ? data.content : [];
      renderAtsHistory();
    } catch (error) {
      /* history stays unchanged on failure — the backend list is the source of truth */
    }
  }

  function renderAtsHistory() {
    if (!atsHistoryList) return;
    atsHistoryList.replaceChildren();
    if (!atsHistoryItems.length) {
      const li = document.createElement('li');
      li.textContent = 'No saved ATS checks yet. Your completed checks will be listed here.';
      atsHistoryList.appendChild(li);
      return;
    }
    atsHistoryItems.forEach((item) => {
      const li = document.createElement('li');
      li.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
      const label = document.createElement('span');
      label.textContent = `${item.score ?? 0}% — ${item.jobTitle || 'Pasted job description'} · ${formatAtsDate(item.createdAt)}`;
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'btn btn-link-subtle btn-sm';
      view.textContent = 'View';
      // Opening a saved result NEVER consumes another check
      view.addEventListener('click', () => viewSavedAtsResult(item.id));
      li.appendChild(label);
      li.appendChild(view);
      atsHistoryList.appendChild(li);
    });
  }

  async function viewSavedAtsResult(id) {
    try {
      const res = await fetch('/api/candidate/ats-evaluations/' + encodeURIComponent(id),
        { credentials: 'include' });
      if (!res.ok) {
        showToast('Could not open the saved result.', 'warning');
        return;
      }
      const data = await res.json();
      renderAtsResult(data);
      atsInputSection.style.display = 'none';
      atsResultsArea.style.display = 'flex';
    } catch (error) {
      showToast('Could not open the saved result.', 'warning');
    }
  }

  /** Renders the real backend result (score, matched/missing skills, breakdown). */
  function renderAtsResult(data) {
    if (scoreMetricValue) scoreMetricValue.textContent = `${data.score ?? 0}%`;
    if (scoreStatusText) {
      const s = data.score ?? 0;
      scoreStatusText.textContent =
        s >= 80 ? 'High ATS Match' : s >= 65 ? 'Moderate Match' : 'Needs Improvement';
    }
    if (scoreAnalysisDesc) scoreAnalysisDesc.textContent = data.summary || 'Review the details below.';

    if (detectedSkillsList) {
      detectedSkillsList.replaceChildren();
      (data.matchedRequiredSkills || []).forEach((skill) => {
        const pill = document.createElement('span');
        pill.className = 'detected-pill';
        pill.innerHTML = `<i class="fa-solid fa-check"></i> ${skill}`;
        detectedSkillsList.appendChild(pill);
      });
      (data.missingRequiredSkills || []).forEach((skill) => {
        const pill = document.createElement('span');
        pill.className = 'detected-pill';
        pill.style.opacity = '0.75';
        pill.innerHTML = `<i class="fa-solid fa-xmark"></i> ${skill}`;
        detectedSkillsList.appendChild(pill);
      });
    }

    if (breakdownGrid) {
      const b = data.breakdown || {};
      const req = b.requiredSkills || {};
      const exp = b.experience || {};
      const ed = b.education || {};
      const cp = b.certificationsProjects || {};
      const row = (label, value, ok) =>
        `<div class="breakdown-item"><span>${label}</span><strong class="${ok ? 'text-success' : 'text-warning'}">${value}</strong></div>`;
      breakdownGrid.innerHTML =
        row('Required Skills', req.applicable ? `${Math.round(req.score ?? 0)}/100` : 'Not applicable', (req.score ?? 0) >= 70 || !req.applicable) +
        row('Experience', exp.applicable
          ? `${Math.round(exp.score ?? 0)}/100 (${exp.yearsFound ?? 0} yr found / ${exp.yearsRequired ?? 0} yr required)`
          : 'Not applicable', (exp.score ?? 0) >= 70 || !exp.applicable) +
        row('Education', ed.applicable ? `${Math.round(ed.score ?? 0)}/100` : 'Not applicable', (ed.score ?? 0) >= 70 || !ed.applicable) +
        row('Certifications & Projects', `${Math.round(cp.score ?? 0)}/100`, (cp.score ?? 0) >= 70);
    }

    if (suggestionsList) {
      const missing = data.missingRequiredSkills || [];
      const exp = (data.breakdown || {}).experience || {};
      const items = [];
      missing.forEach((s) => {
        items.push(`Add evidence of “${s}” to your resume (skills section or a project).`);
      });
      if (exp.applicable && typeof exp.yearsFound === 'number'
          && exp.yearsFound < (exp.yearsRequired || 0)) {
        items.push(`The job asks for ${exp.yearsRequired}+ years of experience; your resume evidences about ${exp.yearsFound} years.`);
      }
      if (!missing.length) {
        items.push('All required skills matched — tailor your summary and impact statements to this role.');
      }
      items.push('Use standard section headings (Summary, Skills, Experience, Education) so ATS parsers read your structure correctly.');
      suggestionsList.innerHTML = items.map((s) => `<li><i class="fa-solid fa-lightbulb"></i> ${s}</li>`).join('');
    }

    // Dashboard stat cards reflect the real score
    const gaugeDisplayScore = document.getElementById('gaugeDisplayScore');
    const statAtsScore = document.getElementById('statAtsScore');
    if (gaugeDisplayScore) gaugeDisplayScore.textContent = `${data.score ?? 0}%`;
    if (statAtsScore) statAtsScore.textContent = `${data.score ?? 0}%`;
  }

  function switchAtsTab(tab) {
    atsCurrentTab = tab;
    if (tab === 'upload') {
      atsTabUpload.classList.add('active');
      atsTabPaste.classList.remove('active');
      atsUploadPanel.style.display = 'block';
      atsPastePanel.style.display = 'none';
    } else {
      atsTabPaste.classList.add('active');
      atsTabUpload.classList.remove('active');
      atsPastePanel.style.display = 'block';
      atsUploadPanel.style.display = 'none';
    }
  }

  if (atsTabUpload) atsTabUpload.addEventListener('click', () => switchAtsTab('upload'));
  if (atsTabPaste)  atsTabPaste.addEventListener('click',  () => switchAtsTab('paste'));

  // ---- File input / dropzone ----
  const atsFileInput      = document.getElementById('atsFileInput');
  const atsDropzone       = document.getElementById('atsDropzone');
  const atsBrowseFileBtn  = document.getElementById('atsBrowseFileBtn');
  const atsFileSelectedRow = document.getElementById('atsFileSelectedRow');
  const atsFileName       = document.getElementById('atsFileName');
  const atsFileMeta       = document.getElementById('atsFileMeta');
  const atsRemoveFileBtn  = document.getElementById('atsRemoveFileBtn');
  const atsClearBtn       = document.getElementById('atsClearBtn');

  function showFileSelected(name, sizeKB) {
    if (atsDropzone) atsDropzone.style.display = 'none';
    if (atsFileSelectedRow) atsFileSelectedRow.style.display = 'flex';
    if (atsFileName) atsFileName.textContent = name;
    if (atsFileMeta) atsFileMeta.textContent = `${sizeKB} KB — Ready to analyze — not saved to profile`;
  }

  function clearFileUpload() {
    atsFile = null;
    if (atsFileInput) atsFileInput.value = '';
    if (atsDropzone) atsDropzone.style.display = 'flex';
    if (atsFileSelectedRow) atsFileSelectedRow.style.display = 'none';
  }

  function handleFile(file) {
    if (!file) return;
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast('File too large. Maximum size is 5 MB.', 'warning');
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc', 'txt'].includes(ext)) {
      showToast('Unsupported file type. Please upload a PDF, DOCX, or TXT file.', 'warning');
      return;
    }
    // The real file is sent to the backend — text extraction happens on the
    // server with the same PDF/DOCX parsers the platform already uses.
    atsFile = file;
    showFileSelected(file.name, Math.round(file.size / 1024));
    showToast(`“${file.name}” loaded successfully. Click Analyze Resume.`, 'success', 3000);
  }

  if (atsBrowseFileBtn) atsBrowseFileBtn.addEventListener('click', () => atsFileInput && atsFileInput.click());
  if (atsDropzone) {
    atsDropzone.addEventListener('click', (e) => {
      if (e.target !== atsBrowseFileBtn && !atsBrowseFileBtn.contains(e.target)) {
        atsFileInput && atsFileInput.click();
      }
    });
    atsDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      atsDropzone.classList.add('drag-over');
    });
    atsDropzone.addEventListener('dragleave', () => atsDropzone.classList.remove('drag-over'));
    atsDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      atsDropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }
  if (atsFileInput) {
    atsFileInput.addEventListener('change', () => {
      if (atsFileInput.files[0]) handleFile(atsFileInput.files[0]);
    });
  }
  if (atsRemoveFileBtn) atsRemoveFileBtn.addEventListener('click', clearFileUpload);
  if (atsClearBtn) {
    atsClearBtn.addEventListener('click', () => {
      clearFileUpload();
      if (atsResumeText) atsResumeText.value = '';
      if (atsJobDescription) atsJobDescription.value = '';
      showToast('Cleared.', 'info', 1500);
    });
  }

  async function loadUnpaidAtsJobs() {
    const targetJobEl = document.getElementById('atsTargetJob');
    if (!targetJobEl) return;
    // Genuinely eligible openings only (server-side verified: ACTIVE status,
    // deadline not passed). Never falls back to sample jobs.
    targetJobEl.innerHTML = '<option value="">-- Select a target job opening --</option>';
    const loadingOption = document.createElement('option');
    loadingOption.textContent = 'Loading job openings…';
    loadingOption.disabled = true;
    targetJobEl.appendChild(loadingOption);
    try {
      const res = await fetch('/api/candidate/ats-eligible-jobs', { credentials: 'include' });
      const placeholder = targetJobEl.querySelector('[disabled]');
      if (placeholder) placeholder.remove();
      if (!res.ok) {
        const errOption = document.createElement('option');
        errOption.textContent = 'Could not load job openings — you can still paste a job description.';
        errOption.disabled = true;
        targetJobEl.appendChild(errOption);
        return;
      }
      const data = await res.json();
      const jobs = (data && data.content) || [];
      if (jobs.length === 0) {
        const emptyOption = document.createElement('option');
        emptyOption.textContent = 'No active job openings are currently available.';
        emptyOption.disabled = true;
        targetJobEl.appendChild(emptyOption);
        return;
      }
      jobs.filter((j) => j && j.id && j.title).forEach((j) => {
        const opt = document.createElement('option');
        opt.value = j.id;
        const loc = j.location ? ` · ${j.location}` : '';
        const comp = j.company ? ` (${j.company})` : '';
        opt.textContent = `${j.title}${comp}${loc}`;
        targetJobEl.appendChild(opt);
      });
    } catch (e) {
      const placeholder = targetJobEl.querySelector('[disabled]');
      if (placeholder) placeholder.remove();
      const errOption = document.createElement('option');
      errOption.textContent = 'Could not load job openings — you can still paste a job description.';
      errOption.disabled = true;
      targetJobEl.appendChild(errOption);
    }
  }

  // ---- ATS modal open ----
  function openAtsChecker() {
    openModal(atsModal);
    // Fresh idempotency key per modal open: an accidental double submission of
    // THIS attempt replays without a new charge; a new attempt charges again.
    atsSessionKey = 'ats-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    // Reset to a fresh check
    clearFileUpload();
    switchAtsTab('upload');
    if (atsJobDescription) atsJobDescription.value = '';
    const targetJobEl = document.getElementById('atsTargetJob');
    if (targetJobEl) targetJobEl.value = '';
    atsInputSection.style.display = 'block';
    atsResultsArea.style.display = 'none';
    fetchAtsEntitlement(); // real remaining checks from MongoDB
    loadAtsHistory();      // real saved results list
    loadUnpaidAtsJobs();   // real eligible jobs list
  }

  if (openAtsModalBtn) openAtsModalBtn.addEventListener('click', async () => {
    await fetchAtsEntitlement();
    if (atsEntitlementLoaded && atsChecksRemaining <= 0) {
      showUpgradeModal('Unlimited ATS Resume Checks',
        'You have used all free ATS checks for this cycle. Upgrade to Premium for unmetered checks, line-by-line keyword audits, and ATS parse validation.');
      return;
    }
    openAtsChecker();
  });
  if (statOpenAtsBtn) statOpenAtsBtn.addEventListener('click', async () => {
    await fetchAtsEntitlement();
    if (atsEntitlementLoaded && atsChecksRemaining <= 0) {
      showUpgradeModal('Unlimited ATS Resume Checks',
        'You have used all free ATS checks for this cycle. Upgrade to Premium for unmetered checks, line-by-line keyword audits, and ATS parse validation.');
      return;
    }
    openAtsChecker();
  });
  const navAtsChecker = document.getElementById('nav-ats-checker');
  if (navAtsChecker) {
    navAtsChecker.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetchAtsEntitlement();
      if (atsEntitlementLoaded && atsChecksRemaining <= 0) {
        showUpgradeModal('Unlimited ATS Resume Checks',
          'You have used all free ATS checks for this cycle. Upgrade to Premium for unmetered checks, line-by-line keyword audits, and ATS parse validation.');
        return;
      }
      openAtsChecker();
    });
  }
  if (atsModalCloseBtn) atsModalCloseBtn.addEventListener('click', () => closeModal(atsModal));

  // Fill sample for paste tab
  if (atsFillSampleBtn) {
    atsFillSampleBtn.addEventListener('click', () => {
      if (atsResumeText) {
        atsResumeText.value = `${currentProfile.fullName || 'Candidate'}\n${currentProfile.role || 'Software Developer'} | ${currentProfile.location || 'Bengaluru, India'} | ${currentProfile.email || 'candidate@example.com'}

SUMMARY
Passionate Developer with proven experience building responsive, accessible web interfaces. Proficient in HTML5, CSS3, modern JavaScript, and React.

TECHNICAL SKILLS
Languages & Frameworks: JavaScript (ES6+), HTML5, CSS3, React, TypeScript, Node.js
Tools: Git, GitHub, REST APIs, Webpack, Agile, ATS Optimization

WORK EXPERIENCE
Junior Front-End Developer — TechNova Solutions (2024 - Present)
- Developed responsive component library used across 4 internal HR SaaS modules.
- Improved Core Web Vitals page speed scores by 34% through code-splitting.

WEB Developer Intern — AlphaCode Labs (2023 - 2024)
- Built interactive client landing pages using HTML, CSS, and Vanilla JavaScript.

EDUCATION
Bachelor of Technology in Computer Science
National Institute of Technology (NIT) — Graduated 2023`;
        showToast('Sample resume loaded.', 'info', 2000);
      }
    });
  }

  // ---- Analyze button (REAL backend evaluation — never a fabricated score) ----
  if (atsRunCheckBtn) {
    atsRunCheckBtn.addEventListener('click', async () => {
      // Resume source: a real uploaded file OR pasted text
      let payload = null;
      let sharedBody = null;
      if (atsCurrentTab === 'upload') {
        if (!atsFile) {
          showToast('Please upload a resume file first.', 'warning');
          return;
        }
        payload = new FormData();
        payload.append('resume', atsFile);
      } else {
        const text = (atsResumeText?.value || '').trim();
        if (text.length < 50) {
          showToast('Please paste a more detailed resume (at least 50 characters).', 'warning');
          return;
        }
        sharedBody = { resumeText: text };
      }

      // Target job selection or pasted description
      const targetJobEl = document.getElementById('atsTargetJob');
      const hasJob = !!(targetJobEl && targetJobEl.value);
      const jd = (atsJobDescription?.value || '').trim();
      if (!hasJob && jd.length < 40) {
        showToast('Select a target job or paste its job description (at least 40 characters).', 'warning');
        return;
      }

      if (atsChecksRemaining <= 0) {
        closeModal(atsModal);
        showUpgradeModal('Unlimited ATS Resume Checks',
          'You have exhausted your free quota. Upgrade to run unlimited ATS checks.');
        return;
      }

      // Loading state
      const originalBtnHtml = atsRunCheckBtn.innerHTML;
      atsRunCheckBtn.disabled = true;
      atsRunCheckBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing on server…';

      try {
        let res;
        if (payload) {
          if (hasJob) payload.append('jobId', targetJobEl.value);
          else payload.append('jobDescription', jd);
          payload.append('idempotencyKey', atsSessionKey || 'ats-' + Date.now());
          res = await fetch('/api/candidate/ats-evaluate', {
            method: 'POST',
            body: payload,
            credentials: 'include'
          });
        } else {
          if (hasJob) sharedBody.jobId = targetJobEl.value;
          else sharedBody.jobDescription = jd;
          sharedBody.idempotencyKey = atsSessionKey || 'ats-' + Date.now();
          res = await fetch('/api/candidate/ats-evaluate', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sharedBody)
          });
        }

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (data && (data.code === 'ATS_LIMIT_REACHED')) {
            await fetchAtsEntitlement();
            closeModal(atsModal);
            showUpgradeModal('Unlimited ATS Resume Checks',
              data.message || 'You have used all free ATS checks. Upgrade your plan to continue.');
            return;
          }
          throw new Error((data && data.message) || 'Could not complete the ATS evaluation.');
        }

        atsInputSection.style.display = 'none';
        atsResultsArea.style.display = 'flex';
        renderAtsResult(data);
        // Refresh the REAL remaining quota and the saved history from MongoDB
        await fetchAtsEntitlement();
        await loadAtsHistory();
        showToast(`ATS evaluation complete! Score: ${data.score}%. No free checks were fabricated and failed attempts cost nothing.`, 'success');
        // Reset input for the next check
        if (payload) {
          clearFileUpload();
        }
        if (sharedBody && atsResumeText) atsResumeText.value = '';
      } catch (error) {
        showToast(error.message || 'Could not complete the ATS evaluation. No free check was consumed.', 'warning');
      } finally {
        atsRunCheckBtn.disabled = false;
        atsRunCheckBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  if (atsRecheckBtn) {
    atsRecheckBtn.addEventListener('click', () => {
      atsResultsArea.style.display = 'none';
      clearFileUpload();
      if (atsResumeText) atsResumeText.value = '';
      if (atsJobDescription) atsJobDescription.value = '';
      switchAtsTab('upload');
      atsInputSection.style.display = 'block';
    });
  }

  // =========================================================================
  // 10. RESUME TEMPLATES & RESUME EDITOR
  // =========================================================================
  // Category Filtering
  const filterPills = document.querySelectorAll('.filter-pill');
  const templateCards = document.querySelectorAll('.template-card');

  function filterTemplates(category = 'all', searchQuery = '') {
    let visibleCount = 0;
    const query = searchQuery.toLowerCase().trim();

    templateCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardName = card.getAttribute('data-name').toLowerCase();
const cardSummary = (card.querySelector('.template-cat-sub')?.textContent || '').toLowerCase();
      const matchesCat = (category === 'all' || cardCategory === category);
      const matchesSearch = (!query || cardName.includes(query) || cardSummary.includes(query) || cardCategory.includes(query));

      if (matchesCat && matchesSearch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    return visibleCount;
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
      const cat = pill.getAttribute('data-category');
      filterTemplates(cat, globalSearchInput.value);
    });
  });

  // Browse Templates button scrolls smoothly to templates section
  const browseTemplatesBtn = document.getElementById('browseTemplatesBtn');
  if (browseTemplatesBtn) {
    browseTemplatesBtn.addEventListener('click', () => {
      const targetSec = document.getElementById('resume-templates');
      if (targetSec) targetSec.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Live Resume Preview Updater
  function updateResumePreview() {
    if (prevName) prevName.textContent = edFullName ? edFullName.value : currentProfile.fullName;
    if (prevTitle) prevTitle.textContent = edJobTitle ? edJobTitle.value : currentProfile.role;
    if (prevEmail) prevEmail.textContent = edEmail ? edEmail.value : currentProfile.email;
    if (prevPhone) prevPhone.textContent = edPhone ? edPhone.value : currentProfile.phone;
    if (prevLocation) prevLocation.textContent = edLocation ? edLocation.value : currentProfile.location;
    if (prevSummary) prevSummary.textContent = edSummary ? edSummary.value : currentProfile.summary;
    if (prevExperience) prevExperience.textContent = edExperience ? edExperience.value : currentProfile.experience;
    if (prevEducation) prevEducation.textContent = edEducation ? edEducation.value : currentProfile.education;

    // Render skills chips (plain text chips — SVG icons are reserved for the
    // full job-description view, so this stays text-only here)
    if (prevSkillsWrap) {
      const rawSkills = edSkills ? edSkills.value : currentProfile.skills;
      const skillsArr = rawSkills.split(',').map(s => s.trim()).filter(Boolean);
      prevSkillsWrap.innerHTML = skillsArr.map(skill => techPillHTML(skill, 'paper-skill-chip')).join('');
    }
  }

  // Real-time listener on all editor inputs
  [edFullName, edJobTitle, edEmail, edPhone, edLocation, edSummary, edSkills, edExperience, edEducation].forEach(input => {
    if (input) {
      input.addEventListener('input', updateResumePreview);
    }
  });

  function openResumeEditor(templateName = 'Aurora') {
    activeTemplate = templateName;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TEMPLATE, activeTemplate);
    if (currentEditingTemplateName) currentEditingTemplateName.textContent = templateName;
    if (previewTemplatePill) previewTemplatePill.textContent = `${templateName} Layout`;
    
    // Fill with current profile or draft
    renderProfile();
    openModal(resumeEditorModal);
  }

  // "Use Template" Buttons on Free Cards
  document.querySelectorAll('.btn-use-template').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tplName = btn.getAttribute('data-template') || 'Aurora';
      openResumeEditor(tplName);
    });
  });

  // Table "Edit Draft" button
  const tableEditDraftBtn = document.getElementById('tableEditDraftBtn');
  if (tableEditDraftBtn) {
    tableEditDraftBtn.addEventListener('click', () => {
      openResumeEditor(activeTemplate || 'Aurora');
    });
  }

  if (resumeEditorCloseBtn) {
    resumeEditorCloseBtn.addEventListener('click', () => closeModal(resumeEditorModal));
  }

  // Save Draft to localStorage
  if (editorSaveDraftBtn) {
    editorSaveDraftBtn.addEventListener('click', () => {
      const draftData = {
        template: activeTemplate,
        fullName: edFullName.value,
        role: edJobTitle.value,
        email: edEmail.value,
        phone: edPhone.value,
        location: edLocation.value,
        summary: edSummary.value,
        skills: edSkills.value,
        experience: edExperience.value,
        education: edEducation.value,
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      localStorage.setItem(STORAGE_KEYS.SAVED_DRAFT, JSON.stringify(draftData));
      
      // Update table metadata
      const tableDoc1Edited = document.getElementById('tableDoc1Edited');
      if (tableDoc1Edited) tableDoc1Edited.textContent = `Just now (${draftData.savedAt})`;

      showToast(`Resume draft "${activeTemplate}" saved successfully to your Free Workspace!`, 'success');
      closeModal(resumeEditorModal);
    });
  }

  // Download Sample HTML Resume
  function downloadResumeHTML() {
    const candidateName = edFullName ? edFullName.value : currentProfile.fullName;
    const candidateRole = edJobTitle ? edJobTitle.value : currentProfile.role;
    const candidateEmail = edEmail ? edEmail.value : currentProfile.email;
    const candidatePhone = edPhone ? edPhone.value : currentProfile.phone;
    const candidateLocation = edLocation ? edLocation.value : currentProfile.location;
    const candidateSummary = edSummary ? edSummary.value : currentProfile.summary;
    const candidateSkills = edSkills ? edSkills.value : currentProfile.skills;
    const candidateExp = edExperience ? edExperience.value : currentProfile.experience;
    const candidateEdu = edEducation ? edEducation.value : currentProfile.education;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${candidateName} - Resume (${activeTemplate} Template)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { margin-bottom: 4px; color: #08675F; }
    .role { font-size: 1.2rem; color: #0D998C; font-weight: 600; margin-bottom: 8px; }
    .contact { font-size: 0.9rem; color: #64748b; margin-bottom: 24px; border-bottom: 2px solid #0D998C; padding-bottom: 12px; }
    h2 { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 24px; }
    p { margin: 8px 0; }
    .skills-box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .experience { white-space: pre-line; }
  </style>
</head>
<body>
  <h1>${candidateName}</h1>
  <div class="role">${candidateRole}</div>
  <div class="contact">${candidateEmail} • ${candidatePhone} • ${candidateLocation}</div>

  <h2>Professional Summary</h2>
  <p>${candidateSummary}</p>

  <h2>Technical Skills</h2>
  <div class="skills-box">${candidateSkills}</div>

  <h2>Work Experience</h2>
  <div class="experience">${candidateExp}</div>

  <h2>Education</h2>
  <p>${candidateEdu}</p>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    const safeName = candidateName.replace(/\s+/g, '_');
    downloadLink.href = url;
    downloadLink.download = `${safeName}_Resume_${activeTemplate}.html`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    showToast(`Downloaded sample resume "${downloadLink.download}"!`, 'success');
  }

  if (editorDownloadBtn) editorDownloadBtn.addEventListener('click', downloadResumeHTML);
  const tableDownloadDraftBtn = document.getElementById('tableDownloadDraftBtn');
  if (tableDownloadDraftBtn) tableDownloadDraftBtn.addEventListener('click', downloadResumeHTML);

  // =========================================================================
  // 11. GLOBAL SEARCH FUNCTIONALITY
  // =========================================================================
  function performGlobalSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      searchClearBtn.style.display = 'none';
      searchFeedbackBanner.style.display = 'none';
      emptySearchState.style.display = 'none';
      // Reset items
      document.querySelectorAll('.template-card, .job-card, #documentsTableBody tr').forEach(el => el.style.display = '');
      return;
    }

    searchClearBtn.style.display = 'flex';
    searchFeedbackBanner.style.display = 'flex';
    activeSearchQuery.textContent = `"${query}"`;

    let totalMatches = 0;

    // Filter Templates
    templateCards.forEach(card => {
      const name = card.getAttribute('data-name').toLowerCase();
      const cat = card.getAttribute('data-category').toLowerCase();
     const desc = (card.querySelector('.template-cat-sub')?.textContent || '').toLowerCase();
      if (name.includes(q) || cat.includes(q) || desc.includes(q)) {
        card.style.display = 'flex';
        totalMatches++;
      } else {
        card.style.display = 'none';
      }
    });

    // Filter Documents Table
    const docRows = document.querySelectorAll('#documentsTableBody tr');
    docRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (text.includes(q)) {
        row.style.display = '';
        totalMatches++;
      } else {
        row.style.display = 'none';
      }
    });

    // Filter Job Cards
    const jobCards = document.querySelectorAll('.job-card');
    jobCards.forEach(job => {
      const title = job.getAttribute('data-job-title').toLowerCase();
      const text = job.textContent.toLowerCase();
      if (title.includes(q) || text.includes(q)) {
        job.style.display = 'flex';
        totalMatches++;
      } else {
        job.style.display = 'none';
      }
    });

    // Handle Empty State
    if (totalMatches === 0) {
      emptySearchState.style.display = 'block';
      emptySearchTerm.textContent = query;
    } else {
      emptySearchState.style.display = 'none';
    }
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      performGlobalSearch(e.target.value);
    });
  }

  function clearSearch() {
    if (globalSearchInput) globalSearchInput.value = '';
    performGlobalSearch('');
  }

  if (searchClearBtn) searchClearBtn.addEventListener('click', clearSearch);
  if (resetSearchBannerBtn) resetSearchBannerBtn.addEventListener('click', clearSearch);
  if (clearSearchEmptyBtn) clearSearchEmptyBtn.addEventListener('click', clearSearch);

  // =========================================================================
  // 12. JOB MATCHES & BOOKMARK TOGGLING
  // =========================================================================
  function renderSavedJobState() {
    const isSaved = savedJobs.includes('job-1');
    if (bookmarkJob1Btn) {
      if (isSaved) {
        bookmarkJob1Btn.classList.add('saved');
        bookmarkJob1Btn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
      } else {
        bookmarkJob1Btn.classList.remove('saved');
        bookmarkJob1Btn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
      }
    }
    if (jobSaveToggleBtn) {
      if (isSaved) {
        jobSaveToggleBtn.classList.add('btn-primary');
        jobSaveToggleBtn.classList.remove('btn-secondary-light');
        jobSaveToggleBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved to Profile';
      } else {
        jobSaveToggleBtn.classList.remove('btn-primary');
        jobSaveToggleBtn.classList.add('btn-secondary-light');
        jobSaveToggleBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Save Job';
      }
    }
  }

  function toggleSaveJob1() {
    const idx = savedJobs.indexOf('job-1');
    if (idx === -1) {
      savedJobs.push('job-1');
      showToast('Saved "Junior Front-End Developer" to your local opportunities list!', 'success');
    } else {
      savedJobs.splice(idx, 1);
      showToast('Removed job from saved opportunities', 'info');
    }
    localStorage.setItem(STORAGE_KEYS.SAVED_JOBS, JSON.stringify(savedJobs));
    renderSavedJobState();
  }

  if (bookmarkJob1Btn) bookmarkJob1Btn.addEventListener('click', toggleSaveJob1);
  if (jobSaveToggleBtn) jobSaveToggleBtn.addEventListener('click', toggleSaveJob1);

  if (openJob1DetailsBtn) {
    openJob1DetailsBtn.addEventListener('click', () => {
      renderSavedJobState();
      openModal(jobPreviewModal);
    });
  }

  if (jobModalCloseBtn) {
    jobModalCloseBtn.addEventListener('click', () => closeModal(jobPreviewModal));
  }

  
  if (openQuestionsModalBtn) {
    openQuestionsModalBtn.addEventListener('click', () => openModal(questionsModal));
  }
  const navInterviewPrep = document.getElementById('nav-interview-prep');
  if (navInterviewPrep) {
    navInterviewPrep.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(questionsModal);
    });
  }
  if (questionsModalCloseBtn) {
    questionsModalCloseBtn.addEventListener('click', () => closeModal(questionsModal));
  }

  document.querySelectorAll('.q-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.q-card');
      card.classList.toggle('open');
    });
  });

  
  const navPortfolioBuilder = document.getElementById('nav-portfolio-builder');
  if (navPortfolioBuilder) {
    navPortfolioBuilder.addEventListener('click', (e) => {
      e.preventDefault();
      showUpgradeModal(
        'Portfolio Website Builder & Publisher',
        'Build and publish a live personal portfolio site with your own domain, auto-SSL, and global CDN — exclusive to Premium Career Pro candidates.'
      );
    });
  }
  // table preview portfolio also locked
  if (tablePreviewPortfolioBtn) {
    tablePreviewPortfolioBtn.addEventListener('click', () => {
      showUpgradeModal(
        'Portfolio Website Builder & Publisher',
        'Publish your portfolio online and share a live link with recruiters. Upgrade to Premium to activate.'
      );
    });
  }

  // Summary preview in documents table
  const tablePreviewAtsSummaryBtn = document.getElementById('tablePreviewAtsSummaryBtn');
  if (tablePreviewAtsSummaryBtn) {
    tablePreviewAtsSummaryBtn.addEventListener('click', openAtsChecker);
  }

  // View All Documents & Locked Document Table Handlers
  const viewAllDocsBtn = document.getElementById('viewAllDocsBtn');
  if (viewAllDocsBtn) {
    viewAllDocsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showUpgradeModal('Cloud Document History & Multi-File Storage', 'Unlock unlimited cloud document storage, version rollback history, and batch PDF/DOCX downloads with Premium Career Pro.');
    });
  }

  const unlockDocsTableBtn = document.getElementById('unlockDocsTableBtn');
  if (unlockDocsTableBtn) {
    unlockDocsTableBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showUpgradeModal('Cloud Document History & Multi-File Storage', 'Unlock unlimited cloud document storage, version rollback history, and multi-file resume management with Premium Career Pro.');
    });
  }

  const documentsTableCard = document.getElementById('documentsTableCard');
  if (documentsTableCard) {
    documentsTableCard.addEventListener('click', (e) => {
      e.preventDefault();
      showUpgradeModal('Cloud Document History & Multi-File Storage', 'Unlock unlimited cloud document storage, version rollback history, and multi-file resume management with Premium Career Pro.');
    });
  }

  const navMyDocuments = document.getElementById('nav-my-documents');
  if (navMyDocuments) {
    navMyDocuments.addEventListener('click', (e) => {
      e.preventDefault();
      showUpgradeModal('Cloud Document History & Multi-File Storage', 'Access your full cloud document archive, version history, and multi-file downloads by upgrading to Premium Career Pro.');
    });
  }

  // Footer links demo toasts
  ['footerHelpLink', 'footerPrivacyLink', 'footerTermsLink'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Documentation & policies are simulated for this HR Module candidate prototype.', 'info', 3000);
      });
    }
  });

  // =========================================================================

  // =========================================================================
  // RESUME COUNT HISTORY & MODAL (Unpaid / Free Candidate Tier)
  // =========================================================================
  let unpaidResumeStats = {
    totalResumes: 0,
    createdCount: 0,
    uploadedCount: 0,
    lastUpdated: null,
    lastUpdatedFormatted: "None",
  };
  let unpaidResumeList = [];

  function formatUnpaidResumeDate(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (isNaN(date)) return "—";
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function loadUnpaidResumeStats() {
    try {
      const res = await fetch("/api/candidate/resumes/stats", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        unpaidResumeStats = {
          totalResumes: typeof data.totalResumes === "number" ? data.totalResumes : 0,
          createdCount: typeof data.createdCount === "number" ? data.createdCount : 0,
          uploadedCount: typeof data.uploadedCount === "number" ? data.uploadedCount : 0,
          lastUpdated: data.lastUpdated || null,
          lastUpdatedFormatted:
            data.lastUpdatedFormatted ||
            (data.lastUpdated ? formatUnpaidResumeDate(data.lastUpdated) : "None"),
        };
        renderUnpaidResumeStatsUI();
      }
    } catch (e) {
      /* ignore */
    }
  }

  async function loadUnpaidResumeList() {
    try {
      const res = await fetch("/api/candidate/resumes", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      unpaidResumeList = Array.isArray(data && data.content) ? data.content : [];
      renderUnpaidDocumentsTable();
    } catch (e) {
      unpaidResumeList = [];
      renderUnpaidDocumentsTable();
    }
  }

  function renderUnpaidDocumentsTable() {
    const tableBody = document.getElementById("documentsTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (!unpaidResumeList || unpaidResumeList.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: #64748B;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
              <i class="fa-regular fa-folder-open" style="font-size: 2rem; color: #94A3B8;"></i>
              <p style="font-weight: 500; margin: 0; color: #334155;">No resumes uploaded or created yet</p>
              <span style="font-size: 0.85rem; color: #94A3B8;">Pick a template below to build your resume or upload a PDF document</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    unpaidResumeList.forEach((item) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-doc-id", item.id);
      const isPdf = (item.originalFilename || item.name || "").toLowerCase().endsWith(".pdf");
      const iconClass = isPdf ? "fa-solid fa-file-pdf" : "fa-regular fa-file-lines";
      const name = item.originalFilename || item.name || "Resume Draft";
      const typeLabel = item.source === "UPLOADED" ? "Uploaded" : "Created";
      const updatedDate = item.updatedAt ? formatUnpaidResumeDate(item.updatedAt) : (item.createdAt ? formatUnpaidResumeDate(item.createdAt) : "Recently");
      const atsScore = (item.ats && typeof item.ats.score === "number" && item.ats.score > 0) ? `${item.ats.score}%` : "Not scanned";

      tr.innerHTML = `
        <td>
          <div class="doc-title-cell">
            <div class="doc-type-icon-box icon-mint">
              <i class="${iconClass}"></i>
            </div>
            <div>
              <div class="doc-name font-semibold">${escapeHTML(name)}</div>
              <span class="doc-format">${isPdf ? "PDF Document" : "Resume Document"}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="pill-type-resume">${typeLabel}</span>
        </td>
        <td>
          <span class="pill-score-match">
            <span class="score-dot-green"></span> ${atsScore}
          </span>
        </td>
        <td>
          <span class="text-muted-date">${updatedDate}</span>
        </td>
        <td class="text-right">
          <div class="table-actions-group">
            <a href="/api/candidate/resumes/${encodeURIComponent(item.id)}/file" target="_blank" class="btn-table-icon" title="View Document" aria-label="View Document">
              <i class="fa-regular fa-eye"></i>
            </a>
            <a href="/api/candidate/resumes/${encodeURIComponent(item.id)}/file?download=true" target="_blank" download class="btn-table-icon" title="Download Document" aria-label="Download Document">
              <i class="fa-solid fa-download"></i>
            </a>
            <button type="button" class="btn-table-icon btn-delete-unpaid-resume" data-resume-id="${encodeURIComponent(item.id)}" title="Delete Document" aria-label="Delete Document" style="color: #EF4444;">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    tableBody.querySelectorAll(".btn-delete-unpaid-resume").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-resume-id");
        if (!id) return;
        if (!confirm("Are you sure you want to delete this resume?")) return;
        try {
          const res = await fetch(`/api/candidate/resumes/${encodeURIComponent(id)}`, {
            method: "DELETE",
            credentials: "include",
            headers: csrfHeaders()
          });
          if (res.ok) {
            showToast("Resume deleted successfully", "success");
            await loadUnpaidResumeList();
            await loadUnpaidResumeStats();
            renderUnpaidDocumentsTable();
          } else {
            showToast("Failed to delete resume", "error");
          }
        } catch {
          showToast("Network error deleting resume", "error");
        }
      });
    });
  }


  function renderUnpaidResumeStatsUI() {
    const elTotal = document.getElementById("rch-total-count");
    const elCreated = document.getElementById("rch-created-count");
    const elUploaded = document.getElementById("rch-uploaded-count");
    const elUpdated = document.getElementById("rch-last-updated");

    if (elTotal) elTotal.textContent = unpaidResumeStats.totalResumes;
    if (elCreated) elCreated.textContent = unpaidResumeStats.createdCount;
    if (elUploaded) elUploaded.textContent = unpaidResumeStats.uploadedCount;
    if (elUpdated) {
      elUpdated.textContent = unpaidResumeStats.lastUpdatedFormatted || "None";
    }

    const mTotal = document.getElementById("modal-hist-total");
    const mCreated = document.getElementById("modal-hist-created");
    const mUploaded = document.getElementById("modal-hist-uploaded");
    const mUpdated = document.getElementById("modal-hist-last-updated");

    if (mTotal) mTotal.textContent = unpaidResumeStats.totalResumes;
    if (mCreated) mCreated.textContent = unpaidResumeStats.createdCount;
    if (mUploaded) mUploaded.textContent = unpaidResumeStats.uploadedCount;
    if (mUpdated) mUpdated.textContent = unpaidResumeStats.lastUpdatedFormatted || "None";
  }

  const btnViewResumeHistory = document.getElementById("rch-view-history-btn");
  const modalResumeHistory = document.getElementById("modal-resume-history");
  const closeResumeHistoryBtn = document.getElementById("close-resume-history-modal");
  const btnCloseHistoryModal = document.getElementById("btn-close-history-modal");
  const resumeHistoryTbody = document.getElementById("resume-history-tbody");
  const resumeHistoryEmpty = document.getElementById("resume-history-empty");

  async function openUnpaidResumeHistoryModal() {
    if (!modalResumeHistory) return;
    await loadUnpaidResumeStats();
    await loadUnpaidResumeList();
    renderUnpaidResumeHistoryModal();
    modalResumeHistory.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function closeUnpaidResumeHistoryModal() {
    if (!modalResumeHistory) return;
    modalResumeHistory.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function renderUnpaidResumeHistoryModal() {
    renderUnpaidResumeStatsUI();
    if (!resumeHistoryTbody) return;
    resumeHistoryTbody.innerHTML = "";

    if (!unpaidResumeList || unpaidResumeList.length === 0) {
      if (resumeHistoryEmpty) resumeHistoryEmpty.classList.remove("hidden");
      return;
    }

    if (resumeHistoryEmpty) resumeHistoryEmpty.classList.add("hidden");

    unpaidResumeList.forEach((item) => {
      const tr = document.createElement("tr");
      const isCreated = (item.source || "").toUpperCase() === "CREATED";
      const sourceBadge = isCreated
        ? '<span class="badge-source-created">✦ Created</span>'
        : '<span class="badge-source-uploaded">⬆ Uploaded</span>';

      const statusBadge = item.active
        ? '<span class="badge-status-active">● Active Primary</span>'
        : '<span class="badge-status-inactive">○ Stored</span>';

      const title = item.resumeTitle || item.originalFilename || "Resume";
      const createdDate = formatUnpaidResumeDate(item.uploadedAt || item.createdAt);
      const updatedDate = formatUnpaidResumeDate(
        item.updatedAt || item.uploadedAt || item.createdAt,
      );

      tr.innerHTML = `
        <td>
          <div class="resume-name-cell">
            <div class="resume-icon-box">${isCreated ? "📝" : "📄"}</div>
            <div>
              <strong style="color: #0F172A; font-size: 0.88rem; display: block; margin-bottom: 2px;">${title}</strong>
              <div style="font-size: 0.75rem; color: #64748B;">${item.versionLabel || ("v" + item.version)}</div>
            </div>
          </div>
        </td>
        <td>${sourceBadge}</td>
        <td style="color: #475569; font-size: 0.82rem; white-space: nowrap;">${createdDate}</td>
        <td style="color: #475569; font-size: 0.82rem; white-space: nowrap;">${updatedDate}</td>
        <td style="white-space: nowrap;">${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <div class="rch-actions-cell">
            <a href="/api/candidate/resumes/${encodeURIComponent(item.id)}/file" target="_blank" class="rch-btn-view" title="Preview resume">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>View</span>
            </a>
            <a href="/api/candidate/resumes/${encodeURIComponent(item.id)}/file?download=true" target="_blank" download class="rch-btn-download" title="Download resume">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download</span>
            </a>
          </div>
        </td>
      `;

            resumeHistoryTbody.appendChild(tr);
    });
  }

  if (btnViewResumeHistory) {
    btnViewResumeHistory.addEventListener("click", () => openUnpaidResumeHistoryModal());
  }
  if (closeResumeHistoryBtn) {
    closeResumeHistoryBtn.addEventListener("click", () => closeUnpaidResumeHistoryModal());
  }
  if (btnCloseHistoryModal) {
    btnCloseHistoryModal.addEventListener("click", () => closeUnpaidResumeHistoryModal());
  }
  if (modalResumeHistory) {
    modalResumeHistory.addEventListener("click", (e) => {
      if (e.target === modalResumeHistory) closeUnpaidResumeHistoryModal();
    });
  }

  // Load the authenticated user's real profile from the backend (MongoDB) and
  // reflect it across the dashboard. Missing endpoint/401 responses are
  // non-fatal so the dashboard still works in offline/cached scenarios.
  function loadUserProfile() {
    fetch('/api/candidate/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        currentProfile = {
          ...currentProfile,
          fullName: data.fullName || currentProfile.fullName,
          role: data.headline || currentProfile.role,
          email: data.email || currentProfile.email,
          phone: data.phone || currentProfile.phone,
          location: data.location || currentProfile.location,
          skills: Array.isArray(data.skills)
            ? data.skills.join(', ')
            : data.skills || currentProfile.skills,
        };
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(currentProfile));
        renderProfile();
      })
      .catch(() => {});
  }

  // Recommended Job Matches — real active jobs from MongoDB, display-only chips
  async function loadUnpaidJobs() {
    const grid = document.getElementById('jobsGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/candidate/jobs?page=0&size=6', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const jobs = (data && data.content) || [];
      const usable = jobs.filter((j) => j && j.id && j.title);
      if (!usable.length) return;
      grid.innerHTML = '';
      usable.forEach((j) => {
        const company = j.companyName || '—';
        const chip = document.createElement('div');
        chip.className = 'job-card job-match-chip';
        chip.setAttribute('data-job-title', j.title);

        const logo = document.createElement('div');
        logo.className = 'company-logo logo-technova';
        logo.textContent = (company.charAt(0) || 'J').toUpperCase();

        const body = document.createElement('div');
        body.className = 'job-chip-body';

        const header = document.createElement('div');
        header.className = 'job-chip-header';
        const title = document.createElement('span');
        title.className = 'job-title';
        title.textContent = j.title;
        const companyEl = document.createElement('span');
        companyEl.className = 'job-company';
        companyEl.textContent = company;
        header.appendChild(title);
        header.appendChild(companyEl);

        const tags = document.createElement('div');
        tags.className = 'job-tags-row';
        const locTag = document.createElement('span');
        locTag.className = 'job-tag';
        locTag.textContent = (j.location || '—') + ' · ' + String(j.workMode || '—').toLowerCase();
        tags.appendChild(locTag);
        if (j.minSalaryInr || j.maxSalaryInr) {
          const salTag = document.createElement('span');
          salTag.className = 'job-tag job-tag-salary';
          const min = j.minSalaryInr ? Math.round(j.minSalaryInr / 100000) : null;
          const max = j.maxSalaryInr ? Math.round(j.maxSalaryInr / 100000) : null;
          salTag.textContent = min && max ? `₹${min} - ₹${max} LPA` : (min ? `From ₹${min} LPA` : `Up to ₹${max} LPA`);
          tags.appendChild(salTag);
        }

        body.appendChild(header);
        body.appendChild(tags);
        chip.appendChild(logo);
        chip.appendChild(body);
        grid.appendChild(chip);
      });
    } catch (e) {
      /* jobs section stays empty on network issues */
    }
  }

  // Notifications — real latest notifications for the authenticated candidate
  async function loadUnpaidNotifications() {
    const list = document.getElementById('notificationList');
    if (!list) return;
    try {
      const res = await fetch('/api/notifications?page=0&size=5', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data && data.content) || [];
      if (!items.length) return;
      const escapeHtml = (v) => String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      list.innerHTML = '';
      items.forEach((n) => {
        const type = String(n.type || '').toUpperCase();
        const iconCls = /APPROV|SUCCESS|VERIFIED/.test(type) ? 'success'
          : /WARN|REJECT|EXPIR|FAIL/.test(type) ? 'warning' : 'info';
        const time = n.createdAt
          ? new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '';
        const item = document.createElement('div');
        item.className = 'notif-item' + (n.read ? '' : ' unread');
        item.innerHTML =
          `<div class="notif-icon ${iconCls}"><i class="fa-solid fa-bell"></i></div>` +
          `<div class="notif-content">` +
            `<div class="notif-text">${escapeHtml(n.message || n.title || '')}</div>` +
            `<div class="notif-time">${escapeHtml(time)}</div>` +
          `</div>`;
        list.appendChild(item);
      });
    } catch (e) {
      /* notifications stay hidden on network issues */
    }
  }

  // Initial load
  loadUnpaidResumeStats();


    // 15. INITIALIZATION
  // =========================================================================
  renderProfile();
  loadUserProfile();
  updateAtsQuotaDisplay();
  fetchAtsEntitlement();
  loadUnpaidResumeStats();
  loadUnpaidResumeList();
  loadUnpaidJobs();
  loadUnpaidNotifications();
  renderSavedJobState();

  console.log('HR Module Unpaid Candidate Dashboard initialized successfully.');
  return function cleanupUnpaidDashboard() {
    _docListeners.forEach(([type, fn, opts]) => {
      document.removeEventListener(type, fn, opts);
    });
    delete window.showUpgradeModal;
    document.body.style.overflow = '';
  };
}