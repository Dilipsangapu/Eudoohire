/**
 * Centralized API Service for Euodoo Hire frontend.
 * Communicates with the Spring Boot backend via REST APIs using JSON.
 * Handles base URL configuration, credentials (JSESSIONID cookie), and CSRF tokens.
 *
 * Environment configuration:
 *   Development (.env.development): VITE_API_BASE_URL="" (Vite proxy forwards /api/* to localhost:8080)
 *   Production  (.env.production):  VITE_API_BASE_URL=https://eudoohire-production.up.railway.app
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

/**
 * Returns the Razorpay public key ID from the environment.
 * This is the key_id (safe to expose in frontend) — the secret lives only on the backend.
 */
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

/**
 * The single user-facing message for every failed sign-in attempt (wrong
 * email/password, credentials of another role, incompatible login context).
 * Mirrors AuthRestController.GENERIC_AUTH_MESSAGE on the backend — neither
 * ever reveals whether the email exists or which role it belongs to.
 */
export const GENERIC_LOGIN_ERROR = "Invalid credentials. Please check your details and try again.";

/** Shown once when an authenticated session is lost mid-use. */
export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

/**
 * Session-expiry detection wiring: once the app has held an authenticated
 * session, any unexpected 401 on a non-auth endpoint means the session
 * expired. The notifier (registered by ToastProvider) is called at most once
 * per expiry so API errors never spam duplicate toasts.
 */
let authenticatedSessionSeen = false;
let sessionExpiryNotify = null;

export function setSessionExpiryNotifier(fn) {
  sessionExpiryNotify = typeof fn === "function" ? fn : null;
}

function notifySessionExpired() {
  if (!authenticatedSessionSeen) return;
  authenticatedSessionSeen = false;
  if (sessionExpiryNotify) sessionExpiryNotify();
}

function isAuthEndpoint(endpoint) {
  return endpoint.startsWith("/api/auth/") || endpoint.startsWith("/auth/");
}

/** Extracts the raw CSRF token from the XSRF-TOKEN cookie written by Spring Security. */
export function getCsrfTokenFromCookie() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * Returns the headers object carrying the CSRF token for state-changing requests.
 * Spring Security validates POST/PUT/PATCH/DELETE against the XSRF-TOKEN cookie,
 * so callers using both api.js and raw fetch() should attach these headers.
 */
export function csrfHeaders() {
  const token = getCsrfTokenFromCookie();
  return token ? { "X-XSRF-TOKEN": token } : {};
}

/**
 * Core HTTP request handler.
 * Automatically attaches credentials, Content-Type, and CSRF token when applicable.
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const method = (options.method || "GET").toUpperCase();

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  // Only set Content-Type to JSON if body is NOT FormData
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Attach CSRF token on state-changing requests if present
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken && !headers["X-XSRF-TOKEN"] && !headers["X-CSRF-TOKEN"]) {
      headers["X-XSRF-TOKEN"] = csrfToken;
    }
  }

  const fetchOptions = {
    ...options,
    method,
    headers,
    credentials: "include", // Required for Spring Security session cookie (JSESSIONID)
  };

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    throw new Error(
      "Unable to connect to the server. Please check your internet connection or verify the backend is running."
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  // Try parsing JSON response
  let data;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // Authenticated session lost mid-use (not a login/auth flow itself):
    // surface one "session expired" toast instead of raw request errors.
    if (response.status === 401 && !isAuthEndpoint(endpoint)) {
      notifySessionExpired();
    }
    const message =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" && data.length < 200 ? data : null) ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// =========================================================================
// API ENDPOINTS
// =========================================================================

export const authApi = {
  /**
   * Log in with email and password. Establishes Spring Security HTTP session.
   *
   * `loginContext` identifies WHICH login page submitted the credentials
   * ("candidate" | "recruiter" | "admin"). The backend rejects accounts whose
   * role is not authorized for that login page BEFORE creating a session,
   * returning the same generic invalid-credentials response as any other
   * failed attempt (no role or account details are disclosed). Never trust
   * this call to authorize an incompatible role.
   */
  async login(email, password, loginContext) {
    const res = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, loginContext }),
    });
    if (res && res.user) authenticatedSessionSeen = true;
    return res;
  },

  /**
   * Fetch current authenticated session user.
   */
  async getCurrentUser() {
    const res = await request("/api/auth/me");
    if (res && res.authenticated) authenticatedSessionSeen = true;
    return res;
  },

  /**
   * Invalidate current session and log out.
   */
  async logout() {
    try {
      return await request("/api/auth/logout", { method: "POST" });
    } catch {
      return { message: "Logged out" };
    }
  },

  /**
   * Ensure CSRF token is initialized.
   */
  async getCsrfToken() {
    try {
      return await request("/api/auth/csrf");
    } catch {
      return null;
    }
  },

  /**
   * Register a new candidate account.
   */
  async registerCandidate(candidateData) {
    return request("/api/auth/register/candidate", {
      method: "POST",
      body: JSON.stringify(candidateData),
    });
  },

  /**
   * Register a new recruiter account.
   */
  async registerRecruiter(recruiterData) {
    return request("/api/auth/register/recruiter", {
      method: "POST",
      body: JSON.stringify(recruiterData),
    });
  },
};

export const candidateApi = {
  /**
   * Get authenticated candidate's profile.
   */
  async getProfile() {
    return request("/api/candidate/profile");
  },

  /**
   * Update candidate profile details.
   */
  async updateProfile(updates) {
    return request("/api/candidate/profile", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  /**
   * Upload resume document (PDF / DOCX).
   */
  async uploadResume(file) {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/candidate/resume", {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Get secure download URL for uploaded resume.
   */
  async getResumeDownloadUrl() {
    return request("/api/candidate/resume/download");
  },

  /**
   * Get admin approval status of candidate resume.
   */
  async getResumeApprovalStatus() {
    return request("/api/candidate/resume/approval-status");
  },

  /**
   * Upload candidate profile picture.
   */
  async uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append("file", file);
    return request("/api/candidate/profile-picture", {
      method: "POST",
      body: formData,
    });
  },

  /**
   * Search jobs available for candidates.
   */
  async searchJobs({ keyword, location, workMode, page = 0, size = 10 } = {}) {
    const params = new URLSearchParams();
    if (keyword) params.set("keyword", keyword);
    if (location) params.set("location", location);
    if (workMode) params.set("workMode", workMode);
    params.set("page", page.toString());
    params.set("size", size.toString());
    return request(`/api/candidate/jobs?${params.toString()}`);
  },

  /**
   * Get specific job details.
   */
  async getJob(jobId) {
    return request(`/api/candidate/jobs/${jobId}`);
  },

  /**
   * Express interest / apply to a job with optional cover note.
   */
  async applyToJob(jobId, coverNote = null) {
    return request(`/api/candidate/jobs/${jobId}/apply`, {
      method: "POST",
      body: coverNote ? JSON.stringify({ coverNote }) : undefined,
    });
  },

  /**
   * Check if candidate has applied to a specific job.
   */
  async hasApplied(jobId) {
    return request(`/api/candidate/jobs/${jobId}/has-applied`);
  },

  /**
   * Get specific application details.
   */
  async getApplication(applicationId) {
    return request(`/api/candidate/applications/${applicationId}`);
  },

  /**
   * Get candidate's job applications.
   */
  async getMyApplications(page = 0, size = 10) {
    return request(`/api/candidate/applications?page=${page}&size=${size}`);
  },

  /**
   * Withdraw an active application.
   */
  async withdrawApplication(applicationId, reason = "") {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    return request(`/api/candidate/applications/${applicationId}/withdraw${params}`, {
      method: "POST",
    });
  },

  /**
   * Get notifications for candidate.
   */
  async getNotifications(unreadOnly = false, page = 0, size = 20) {
    return request(`/api/candidate/notifications?unreadOnly=${unreadOnly}&page=${page}&size=${size}`);
  },

  /**
   * Mark a notification as read.
   */
  async markNotificationRead(notificationId) {
    return request(`/api/candidate/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
  },

  /**
   * Request account deletion.
   */
  async deleteAccount(password) {
    return request("/api/candidate/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
  },
};

export const publicApi = {
  /**
   * Public preview of active jobs for landing page.
   */
  async getJobs(page = 0, size = 10) {
    return request(`/api/public/jobs?page=${page}&size=${size}`);
  },
};

export const resumeApi = {
  /**
   * Analyze resume file or text for ATS score and suggestions.
   */
  async analyze(fileOrText) {
    if (fileOrText instanceof File) {
      const formData = new FormData();
      formData.append("resume", fileOrText);
      return request("/api/resume/analyze", {
        method: "POST",
        body: formData,
      });
    }

    if (typeof fileOrText === "string") {
      return request("/api/resume/analyze", {
        method: "POST",
        body: JSON.stringify({ text: fileOrText }),
      });
    }

    throw new Error("Invalid resume input for analysis");
  },
};

export const paymentApi = {
  /**
   * Create Razorpay order for plan upgrade (legacy candidate plan flow).
   */
  async createPlanOrder(plan) {
    return request(`/api/payments/plan-order?plan=${encodeURIComponent(plan)}`, {
      method: "POST",
    });
  },

  /**
   * Verify completed payment signature with backend (legacy candidate plan).
   */
  async verifyPayment(orderId, paymentId, signature) {
    const params = new URLSearchParams({
      orderId,
      paymentId,
      signature,
    });
    return request(`/api/payments/verify?${params.toString()}`, {
      method: "POST",
    });
  },
};

export const subscriptionApi = {
  /**
   * Get subscription status for the authenticated user.
   */
  async getStatus() {
    return request("/api/subscriptions/status");
  },

  /**
   * Create Razorpay order for recruiter subscription (₹999).
   */
  async createRecruiterOrder() {
    return request("/api/subscriptions/recruiter/order", { method: "POST" });
  },

  /**
   * Verify recruiter subscription payment and activate.
   */
  async verifyRecruiterPayment(orderId, paymentId, signature) {
    const params = new URLSearchParams({ orderId, paymentId, signature });
    return request(`/api/subscriptions/recruiter/verify?${params.toString()}`, {
      method: "POST",
    });
  },

  /**
   * Create Razorpay order for candidate subscription (₹499).
   */
  async createCandidateOrder() {
    return request("/api/subscriptions/candidate/order", { method: "POST" });
  },

  /**
   * Verify candidate subscription payment and activate.
   */
  async verifyCandidatePayment(orderId, paymentId, signature) {
    const params = new URLSearchParams({ orderId, paymentId, signature });
    return request(`/api/subscriptions/candidate/verify?${params.toString()}`, {
      method: "POST",
    });
  },

  /**
   * Admin: list all subscriptions.
   */
  async adminListAll(page = 0, size = 100) {
    return request(`/api/subscriptions/admin/all?page=${page}&size=${size}`);
  },

  /**
   * Admin: get subscription status for a specific user.
   */
  async adminGetUser(userId) {
    return request(`/api/subscriptions/admin/user/${userId}`);
  },
};

export const invoiceApi = {
  /**
   * Get paginated invoices for current user.
   */
  async getMyInvoices(page = 0, size = 20) {
    return request(`/api/invoices?page=${page}&size=${size}`);
  },

  /**
   * Get specific invoice details.
   */
  async getInvoice(invoiceId) {
    return request(`/api/invoices/${invoiceId}`);
  },

  /**
   * Get download URL for an invoice PDF.
   */
  getDownloadUrl(invoiceId) {
    return `/api/invoices/${invoiceId}/download`;
  },

  /**
   * Get download URL for latest invoice PDF.
   */
  getLatestDownloadUrl() {
    return "/api/invoices/latest/download";
  },
};

export const notificationApi = {
  /**
   * Get paginated notifications for current user.
   */
  async getNotifications(unreadOnly = false, page = 0, size = 20) {
    return request(`/api/notifications?unreadOnly=${unreadOnly}&page=${page}&size=${size}`);
  },

  /**
   * Get unread notification count.
   */
  async getUnreadCount() {
    return request("/api/notifications/unread-count");
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id) {
    return request(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });
  },

  /**
   * Mark all notifications as read for current user.
   */
  async markAllAsRead() {
    return request("/api/notifications/read-all", {
      method: "POST",
    });
  },

  /**
   * Delete a notification.
   */
  async deleteNotification(id) {
    return request(`/api/notifications/${id}`, {
      method: "DELETE",
    });
  },
};

export const hireMatchApi = {
  /**
   * Fetch full hire match details for a HiringRequest record.
   * Authenticated + server-side ownership checks (403/404 handled by caller).
   */
  async getDetails(hireMatchId) {
    return request(`/api/hire-matches/${hireMatchId}`);
  },
};

export const recruiterApi = {
  async getProfile() {
    return request("/api/recruiter/profile");
  },
  async getMyJobs() {
    return request("/api/recruiter/data/jobs");
  },
  async createJob(jobData) {
    return request("/api/recruiter/data/jobs", {
      method: "POST",
      body: JSON.stringify(jobData),
    });
  },
  async updateJob(jobId, jobData) {
    return request(`/api/recruiter/data/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify(jobData),
    });
  },
  async publishJob(jobId) {
    return request(`/api/recruiter/data/jobs/${jobId}/publish`, {
      method: "POST",
    });
  },
  async closeJob(jobId) {
    return request(`/api/recruiter/data/jobs/${jobId}/close`, {
      method: "POST",
    });
  },
  async getJobApplications(jobId) {
    return request(`/api/recruiter/data/jobs/${jobId}/applications`);
  },
  async getCompanies() {
    return request("/api/recruiter/data/companies");
  },
  async getCandidates() {
    return request("/api/recruiter/data/candidates");
  },
  async shortlistApplication(applicationId, note) {
    const params = note ? `?note=${encodeURIComponent(note)}` : "";
    return request(`/api/recruiter/data/applications/${applicationId}/shortlist${params}`, {
      method: "POST",
    });
  },
  async getAgencySubmissions({ page = 0, size = 20 } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    return request(`/api/recruiter/agency-submissions?${params.toString()}`);
  },
  async updateAgencySubmissionAction(submissionId, actionData) {
    return request(`/api/recruiter/agency-submissions/${submissionId}/action`, {
      method: "POST",
      body: JSON.stringify(actionData),
    });
  },
};

// =========================================================================
// RECRUITER AGENCY API (Dedicated alias)
// =========================================================================

export const recruiterAgencyApi = {
  getSubmissions: (opts) => recruiterApi.getAgencySubmissions(opts),
  updateAction: (id, data) => recruiterApi.updateAgencySubmissionAction(id, data),
};

// =========================================================================
// AGENCY API
// =========================================================================

export const agencyApi = {
  // Registration
  async register(registrationData, files = {}) {
    const formData = new FormData();
    formData.append("data", JSON.stringify(registrationData));
    if (files.incorporation) {
      formData.append("incorporationFile", files.incorporation);
    }
    if (files.gstDoc) {
      formData.append("gstFile", files.gstDoc);
    }
    return request("/api/agencies/register", {
      method: "POST",
      body: formData,
    });
  },
  async getRegistrationStatus(identifier) {
    return request(`/api/agencies/registration-status?identifier=${encodeURIComponent(identifier)}`);
  },
  // Dashboard
  async getDashboardSummary(agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/dashboard/summary${q}`);
  },
  async getRecentJobs(limit = 5, agencyId) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/dashboard/recent-jobs?${params.toString()}`);
  },
  async getRecentSubmissions(limit = 5, agencyId) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/dashboard/recent-submissions?${params.toString()}`);
  },
  async getUpcomingInterviews(limit = 5, agencyId) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/dashboard/upcoming-interviews?${params.toString()}`);
  },
  async getPlacementStatistics(agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/dashboard/placement-statistics${q}`);
  },

  // Profile
  async getProfile(agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agencies/profile${q}`);
  },
  async updateProfile(profileData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agencies/profile${q}`, {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  },

  // Clients
  async getClients({ page = 0, size = 50, search, status, agencyId } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/clients?${params.toString()}`);
  },
  async getClient(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/clients/${id}${q}`);
  },
  async addClient(clientData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/clients${q}`, {
      method: "POST",
      body: JSON.stringify(clientData),
    });
  },
  async updateClient(id, clientData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/clients/${id}${q}`, {
      method: "PUT",
      body: JSON.stringify(clientData),
    });
  },
  async updateClientStatus(id, status, agencyId) {
    const params = new URLSearchParams({ status });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/clients/${id}/status?${params.toString()}`, {
      method: "PATCH",
    });
  },

  // Jobs
  async getJobs({ page = 0, size = 50, search, clientCompanyId, status, agencyId } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (search) params.set("search", search);
    if (clientCompanyId) params.set("clientCompanyId", clientCompanyId);
    if (status) params.set("status", status);
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/jobs?${params.toString()}`);
  },
  async getJob(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/jobs/${id}${q}`);
  },
  async createJob(jobData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/jobs${q}`, {
      method: "POST",
      body: JSON.stringify(jobData),
    });
  },
  async updateJob(id, jobData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/jobs/${id}${q}`, {
      method: "PUT",
      body: JSON.stringify(jobData),
    });
  },
  async updateJobStatus(id, status, agencyId) {
    const params = new URLSearchParams({ status });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/jobs/${id}/status?${params.toString()}`, {
      method: "PATCH",
    });
  },

  // Candidates
  async getCandidates({ page = 0, size = 50, skill, minExperience, location, agencyId } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (skill) params.set("skill", skill);
    if (minExperience) params.set("minExperience", minExperience.toString());
    if (location) params.set("location", location);
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/candidates?${params.toString()}`);
  },
  async getCandidate(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/candidates/${id}${q}`);
  },
  async associateCandidate(candidateId, agencyId) {
    const params = new URLSearchParams({ candidateId });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/candidates?${params.toString()}`, {
      method: "POST",
    });
  },
  async uploadCandidateResume(candidateId, file, agencyId) {
    const formData = new FormData();
    formData.append("file", file);
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/candidates/${candidateId}/resume${q}`, {
      method: "POST",
      body: formData,
    });
  },

  // Shortlists
  async getShortlists({ page = 0, size = 50, agencyId } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/shortlists?${params.toString()}`);
  },
  async getJobShortlists(jobId, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/shortlists/job/${jobId}${q}`);
  },
  async shortlistCandidate(shortlistData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/shortlists${q}`, {
      method: "POST",
      body: JSON.stringify(shortlistData),
    });
  },
  async removeShortlist(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/shortlists/${id}${q}`, {
      method: "DELETE",
    });
  },

  // Submissions
  async getSubmissions({ page = 0, size = 50, status, agencyId } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (status) params.set("status", status);
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/submissions?${params.toString()}`);
  },
  async getSubmission(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/submissions/${id}${q}`);
  },
  async createSubmission(submissionData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/submissions${q}`, {
      method: "POST",
      body: JSON.stringify(submissionData),
    });
  },
  async submitToAdmin(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/submissions/${id}/submit-to-admin${q}`, {
      method: "POST",
    });
  },
  async sendToRecruiter(id, recruiterUserId, agencyId) {
    const params = new URLSearchParams();
    if (recruiterUserId) params.set("recruiterUserId", recruiterUserId);
    if (agencyId) params.set("agencyId", agencyId);
    const q = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/agency/submissions/${id}/send-to-recruiter${q}`, {
      method: "POST",
    });
  },
  async getSubmissionTimeline(id) {
    return request(`/api/agency/submissions/${id}/tracking`);
  },

  // Interviews
  async getInterviews({ page = 0, size = 50, status, agencyId } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (status) params.set("status", status);
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/interviews?${params.toString()}`);
  },
  async getInterview(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/interviews/${id}${q}`);
  },
  async scheduleInterview(interviewData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/interviews${q}`, {
      method: "POST",
      body: JSON.stringify(interviewData),
    });
  },
  async recordInterviewFeedback(id, feedbackData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/interviews/${id}/feedback${q}`, {
      method: "PUT",
      body: JSON.stringify(feedbackData),
    });
  },

  // Placements
  async getPlacements({ page = 0, size = 50, status, agencyId } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (status) params.set("status", status);
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agency/placements?${params.toString()}`);
  },
  async getPlacement(id, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/placements/${id}${q}`);
  },
  async createPlacement(placementData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/placements${q}`, {
      method: "POST",
      body: JSON.stringify(placementData),
    });
  },
  async confirmPlacement(id, remarks, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agency/placements/${id}/confirm${q}`, {
      method: "PUT",
      body: JSON.stringify({ remarks: remarks || "Placement confirmed" }),
    });
  },

  // Documents
  async getDocuments(agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agencies/documents${q}`);
  },
  async uploadDocument(type, file, agencyId) {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams({ type });
    if (agencyId) params.set("agencyId", agencyId);
    return request(`/api/agencies/documents/upload?${params.toString()}`, {
      method: "POST",
      body: formData,
    });
  },
};

// =========================================================================
// ADMIN API
// =========================================================================

export const adminApi = {
  // Aggregate Data endpoints
  async getRegistrations() {
    return request("/api/admin/data/registrations");
  },
  async getRecruiters() {
    return request("/api/admin/data/recruiters");
  },
  async getCandidates() {
    return request("/api/admin/data/candidates");
  },
  async getCompanies() {
    return request("/api/admin/data/companies");
  },
  async getHireMatches() {
    return request("/api/admin/data/hire-matches");
  },
  async getPortfolioRequests() {
    return request("/api/admin/data/portfolio-requests");
  },
  async getResumeRequests() {
    return request("/api/admin/data/resume-requests");
  },
  async getJobs() {
    return request("/api/admin/data/jobs");
  },
  async getSubscriptions(page = 0, size = 100) {
    return request(`/api/admin/data/subscriptions?page=${page}&size=${size}`);
  },
  async getUserSubscription(userId) {
    return request(`/api/admin/data/subscriptions/user/${encodeURIComponent(userId)}`);
  },

  // Candidate Approvals
  async approveCandidate(userId) {
    return request(`/api/admin/data/candidates/${encodeURIComponent(userId)}/approve`, {
      method: "POST",
    });
  },
  async rejectCandidate(userId, reason = "Rejected by admin") {
    return request(
      `/api/admin/data/candidates/${encodeURIComponent(userId)}/reject?reason=${encodeURIComponent(reason)}`,
      { method: "POST" }
    );
  },

  // Recruiter Approvals
  async approveRecruiter(userId) {
    return request(`/api/admin/data/recruiters/${encodeURIComponent(userId)}/approve`, {
      method: "POST",
    });
  },
  async rejectRecruiter(userId, reason = "Rejected by admin") {
    return request(
      `/api/admin/data/recruiters/${encodeURIComponent(userId)}/reject?reason=${encodeURIComponent(reason)}`,
      { method: "POST" }
    );
  },

  // Company Approvals
  async approveCompany(companyId) {
    return request(`/api/admin/data/companies/${encodeURIComponent(companyId)}/approve`, {
      method: "POST",
    });
  },
  async rejectCompany(companyId, reason = "Rejected by admin") {
    return request(
      `/api/admin/data/companies/${encodeURIComponent(companyId)}/reject?reason=${encodeURIComponent(reason)}`,
      { method: "POST" }
    );
  },

  // Hire Match Approvals
  async approveHireMatch(id) {
    return request(`/api/admin/data/hire-matches/${encodeURIComponent(id)}/approve`, {
      method: "POST",
    });
  },
  async releaseCandidate(id) {
    return request(`/api/admin/data/hire-matches/${encodeURIComponent(id)}/release`, {
      method: "POST",
    });
  },

  // Portfolio & Resume Approvals
  async approvePortfolio(id) {
    return request(`/api/admin/data/portfolio-requests/${encodeURIComponent(id)}/approve`, {
      method: "POST",
    });
  },
  async rejectPortfolio(id, note = "") {
    return request(
      `/api/admin/data/portfolio-requests/${encodeURIComponent(id)}/reject?note=${encodeURIComponent(note)}`,
      { method: "POST" }
    );
  },
  async approveResume(id) {
    return request(`/api/admin/data/resume-requests/${encodeURIComponent(id)}/approve`, {
      method: "POST",
    });
  },
  async rejectResume(id, note = "") {
    return request(
      `/api/admin/data/resume-requests/${encodeURIComponent(id)}/reject?note=${encodeURIComponent(note)}`,
      { method: "POST" }
    );
  },

  // Agency Management
  async getAgencies({ page = 0, size = 10, status } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (status) params.set("status", status);
    return request(`/api/admin/agencies?${params.toString()}`);
  },
  async getAgency(id) {
    return request(`/api/admin/agencies/${encodeURIComponent(id)}`);
  },
  async approveAgency(id, remarks = "Approved by administrator") {
    return request(`/api/admin/agencies/${encodeURIComponent(id)}/approve`, {
      method: "PUT",
      body: JSON.stringify({ remarks }),
    });
  },
  async rejectAgency(id, reason = "Registration rejected by administrator") {
    return request(`/api/admin/agencies/${encodeURIComponent(id)}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
  },
  async requestAgencyResubmission(id, remarks = "Document or detail resubmission required") {
    return request(`/api/admin/agencies/${encodeURIComponent(id)}/request-resubmission`, {
      method: "PUT",
      body: JSON.stringify({ remarks }),
    });
  },

  // Agency Candidate Submissions Review
  async getSubmissions({ page = 0, size = 10, status } = {}) {
    const params = new URLSearchParams({ page: page.toString(), size: size.toString() });
    if (status) params.set("status", status);
    return request(`/api/admin/submissions?${params.toString()}`);
  },
  async getSubmission(id) {
    return request(`/api/admin/submissions/${encodeURIComponent(id)}`);
  },
  async approveSubmission(id, comments = "Approved by administrator") {
    return request(`/api/admin/submissions/${encodeURIComponent(id)}/approve`, {
      method: "PUT",
      body: JSON.stringify({ comments }),
    });
  },
  async rejectSubmission(id, comments = "Rejected by administrator") {
    return request(`/api/admin/submissions/${encodeURIComponent(id)}/reject`, {
      method: "PUT",
      body: JSON.stringify({ comments }),
    });
  },
  async requestSubmissionResubmission(id, comments = "Resubmission required") {
    return request(`/api/admin/submissions/${encodeURIComponent(id)}/request-resubmission`, {
      method: "PUT",
      body: JSON.stringify({ comments }),
    });
  },
  async releaseSubmissionCandidate(id) {
    return request(`/api/admin/submissions/${encodeURIComponent(id)}/release`, {
      method: "PUT",
    });
  },

  // Document Verification
  async verifyDocument(documentId, verificationData, agencyId) {
    const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
    return request(`/api/agencies/documents/${encodeURIComponent(documentId)}${q}`, {
      method: "PUT",
      body: JSON.stringify(verificationData),
    });
  },
};

export default {
  auth: authApi,
  candidate: candidateApi,
  agency: agencyApi,
  admin: adminApi,
  notification: notificationApi,
  public: publicApi,
  resume: resumeApi,
  payment: paymentApi,
  subscription: subscriptionApi,
  invoice: invoiceApi,
  recruiter: recruiterApi,
  recruiterAgency: recruiterAgencyApi,
};
