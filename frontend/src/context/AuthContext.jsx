import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authApi.getCurrentUser();
      if (res && res.authenticated && res.user) {
        setUser(res.user);
        // Sync local storage convenience flags
        localStorage.setItem("euodoo-account-type", isUserPaid(res.user) ? "paid" : "unpaid");
        localStorage.setItem("euodoo-demo-email", res.user.email);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  function isUserPaid(u) {
    if (!u) return false;
    return Boolean(u.planActivated && (u.plan === "BASIC" || u.plan === "PREMIUM"));
  }

  const login = async (email, password, loginContext) => {
    setError(null);
    try {
      const response = await authApi.login(email, password, loginContext);
      if (response && response.user) {
        setUser(response.user);
        const paid = isUserPaid(response.user);
        localStorage.setItem("euodoo-account-type", paid ? "paid" : "unpaid");
        localStorage.setItem("euodoo-demo-email", response.user.email);
        return response;
      }
      throw new Error("Invalid response from server");
    } catch (err) {
      setError(err.message || "Login failed");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      localStorage.removeItem("euodoo-account-type");
      localStorage.removeItem("euodoo-demo-email");
    }
  };

  const value = {
    user,
    setUser,
    loading,
    error,
    setError,
    isAuthenticated: Boolean(user),
    isPaid: isUserPaid(user),
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
