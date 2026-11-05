import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, toast } from "./components/Toast";
import { setSessionExpiryNotifier, SESSION_EXPIRED_MESSAGE } from "./services/api";

import Portal from "./Pages/Portal";
import LoginPage from "./Pages/LoginPage";
import CandidateRegistration from "./Pages/CandidateRegistration";
import RecruiterLoginPage from "./Pages/RecruiterLoginPage";
import RecruiterRegistrationPage from "./Pages/RecruiterRegistrationPage";
import ForgotPasswordPage from "./Pages/ForgotPasswordPage";
import AdminPage from "./Pages/AdminPage";
import Paid_Dashboard from "./Pages/Paid_Dashboard";
import UnPaidDashboard from "./Pages/UnPaidDashboard";
import AgencyDashboard from "./Pages/AgencyDashboard";
import AgencyLoginPage from "./Pages/AgencyLoginPage";
import AgencyRegistrationPage from "./Pages/AgencyRegistrationPage";
import CandidateSubscriptionPage from "./Pages/CandidateSubscriptionPage";
import RecruiterSubscriptionPage from "./Pages/RecruiterSubscriptionPage";
import { initPortal } from "./Pages/portalLogic";

import "./style.css";

// Fire a single toast when an authenticated session is lost mid-use
// (detected centrally by the API client) — not on plain logged-out visits.
setSessionExpiryNotifier(() => {
  toast.warning(SESSION_EXPIRED_MESSAGE);
});

function PortalPage() {
  useEffect(() => {
    initPortal();
  }, []);

  return <Portal />;
}

function ProtectedDashboard({ requiredPlan = null, children }) {
  const { user, loading, isAuthenticated, isPaid } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ textAlign: "center", color: "#64748b", fontFamily: "inherit" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⌛</div>
          <p style={{ fontWeight: 600, margin: 0 }}>Verifying Euodoo session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "RECRUITER") {
    window.location.href = "/recruiter/dashboard";
    return null;
  }

  if (user?.role === "CLIENT_ADMIN") {
    window.location.href = "/client-admin/dashboard";
    return null;
  }

  if (user?.role === "AGENCY_ADMIN" || user?.role === "AGENCY_STAFF") {
    return <Navigate to="/agency-dashboard" replace />;
  }

  if (requiredPlan === "paid" && !isPaid) {
    return <Navigate to="/unpaid-dashboard" replace />;
  }

  if (requiredPlan === "unpaid" && isPaid) {
    return <Navigate to="/paid-dashboard" replace />;
  }

  return children;
}

function DashboardRoute() {
  const { user, loading, isAuthenticated, isPaid } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === "RECRUITER") {
    window.location.href = "/recruiter/dashboard";
    return null;
  }
  if (user?.role === "CLIENT_ADMIN") {
    window.location.href = "/client-admin/dashboard";
    return null;
  }
  if (user?.role === "AGENCY_ADMIN" || user?.role === "AGENCY_STAFF") {
    return <Navigate to="/agency-dashboard" replace />;
  }
  return isPaid ? <Navigate to="/paid-dashboard" replace /> : <Navigate to="/unpaid-dashboard" replace />;
}

function ProtectedAgencyDashboard({ children }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ textAlign: "center", color: "#64748b", fontFamily: "inherit" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⌛</div>
          <p style={{ fontWeight: 600, margin: 0 }}>Verifying Euodoo session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/agency-login" replace />;
  }

  const isAgency = user?.role === "AGENCY_ADMIN" || user?.role === "AGENCY_STAFF";
  const isAdmin = user?.role === "CLIENT_ADMIN" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  if (!isAgency && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<PortalPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Dynamic dashboard routing based on authenticated user plan */}
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route
            path="/paid-dashboard"
            element={
              <ProtectedDashboard requiredPlan="paid">
                <Paid_Dashboard />
              </ProtectedDashboard>
            }
          />
          <Route
            path="/unpaid-dashboard"
            element={
              <ProtectedDashboard requiredPlan="unpaid">
                <UnPaidDashboard />
              </ProtectedDashboard>
            }
          />

          <Route path="/register" element={<CandidateRegistration />} />

          {/* Candidate forgot password */}
          <Route path="/forgot-password" element={<ForgotPasswordPage accountType="candidate" />} />

          {/* Recruiter routes */}
          <Route path="/recruiter-login" element={<RecruiterLoginPage />} />
          <Route path="/recruiter-register" element={<RecruiterRegistrationPage />} />
          <Route path="/recruiter-forgot-password" element={<ForgotPasswordPage accountType="recruiter" />} />

          {/* Agency authentication routes */}
          <Route path="/agency-login" element={<AgencyLoginPage />} />
          <Route path="/agency-register" element={<AgencyRegistrationPage />} />
          <Route path="/agency-forgot-password" element={<ForgotPasswordPage accountType="agency" />} />

          {/* Admin portal */}
          <Route path="/admin-page" element={<AdminPage />} />

          {/* Subscription routes */}
          <Route path="/candidate-subscription" element={<CandidateSubscriptionPage />} />
          <Route path="/recruiter-subscription" element={<RecruiterSubscriptionPage />} />

          {/* Job Consultant / Agency Dashboard */}
          <Route
            path="/agency-dashboard"
            element={
              <ProtectedAgencyDashboard>
                <AgencyDashboard />
              </ProtectedAgencyDashboard>
            }
          />
          <Route path="/agency/dashboard" element={<Navigate to="/agency-dashboard" replace />} />

          {/* Fallback for unknown URLs */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}