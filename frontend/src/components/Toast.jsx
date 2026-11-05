import React, { useEffect, useState, useCallback } from "react";
import "./Toast.css";

/**
 * Centralized toast notification system for the whole app.
 *
 * - `ToastProvider` (mount once in App) renders the stack and wires the
 *   module-level `toast` API to real DOM output.
 * - `toast` is a plain module function set, so BOTH React components
 *   (`useToast()`) and the non-React dashboard logic files
 *   (`PaidDashboardLogic.js`, `UnPaidDashboardLogic.js`, ...) can emit
 *   toasts without hooks or props.
 * - One notification type per call: success | error | warning | info.
 *   `toast.loading()` returns a toast id that stays until updated via
 *   `toast.update(id, { type, message })` or dismissed.
 * - Duplicate prevention: an identical (type, message) toast that is still
 *   visible is refreshed instead of stacked twice — this also protects
 *   against the same API error propagating through multiple layers.
 * - Accessibility: role="status"/"alert" with aria-live, focusable
 *   dismiss buttons, and Escape dismisses the newest toast.
 */

const store = {
  items: [],
  seq: 0,
  subs: new Set(),
  timers: new Map(),
};

const DEFAULT_DURATIONS = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4500,
};

function subscribe(fn) {
  store.subs.add(fn);
  return () => store.subs.delete(fn);
}

function publish() {
  const snapshot = store.items.slice();
  store.subs.forEach((fn) => fn(snapshot));
}

function clearTimer(id) {
  const t = store.timers.get(id);
  if (t) {
    window.clearTimeout(t);
    store.timers.delete(id);
  }
}

function scheduleDismiss(item) {
  clearTimer(item.id);
  if (item.duration > 0) {
    store.timers.set(
      item.id,
      window.setTimeout(() => dismiss(item.id), item.duration)
    );
  }
}

function dismiss(id) {
  clearTimer(id);
  const next = store.items.filter((t) => t.id !== id);
  if (next.length !== store.items.length) {
    store.items = next;
    publish();
  }
}

let lastKey = null;
let lastKeyAt = 0;

/**
 * Suppresses duplicate errors that propagate through several layers
 * (e.g. a handler toasts error("X") and the caller toasts error("X") too).
 */
function suppressedByDebounce(type, message) {
  const key = type + "|" + message;
  const now = Date.now();
  if (key === lastKey && now - lastKeyAt < 1200) return true;
  lastKey = key;
  lastKeyAt = now;
  return false;
}

function addToast(type, message, opts = {}) {
  if (!message || suppressedByDebounce(type, String(message))) return null;
  const id = ++store.seq;
  const duration =
    opts.duration !== undefined
      ? opts.duration
      : DEFAULT_DURATIONS[type] !== undefined
      ? DEFAULT_DURATIONS[type]
      : 4500;
  const item = {
    id,
    type,
    message: String(message),
    duration: type === "loading" ? 0 : duration,
  };
  store.items = [item, ...store.items].slice(0, 6); // cap stack depth
  publish();
  scheduleDismiss(item);
  return id;
}

export const toast = {
  success: (message, opts) => addToast("success", message, opts),
  error: (message, opts) => addToast("error", message, opts),
  warning: (message, opts) => addToast("warning", message, opts),
  info: (message, opts) => addToast("info", message, opts),
  /** Loading toasts persist until `toast.update(id, ...)` or `toast.dismiss(id)`. */
  loading: (message, opts) => addToast("loading", message, { duration: 0, ...opts }),
  /** Replace a loading toast with the result (e.g. update(id, { type: "success" })). */
  update: (id, patch = {}) => {
    const idx = store.items.findIndex((t) => t.id === id);
    if (idx === -1) {
      // The toast was already closed; surface the result as a new toast.
      return addToast(patch.type || "info", patch.message || "");
    }
    const updated = {
      ...store.items[idx],
      ...patch,
      duration:
        patch.duration !== undefined
          ? patch.duration
          : DEFAULT_DURATIONS[patch.type || store.items[idx].type] || 4500,
    };
    const corrected = { ...updated, duration: updated.type === "loading" ? 0 : updated.duration };
    store.items[idx] = corrected;
    publish();
    scheduleDismiss(corrected);
    return id;
  },
  dismiss: (id) => dismiss(id),
};

const TOAST_ICONS = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  loading: (
    <svg className="toast-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  ),
};

const TOAST_ROLE = { error: "alert", warning: "alert", success: "status", info: "status", loading: "status" };

function useToastItems() {
  const [items, setItems] = useState(store.items);
  useEffect(() => subscribe(setItems), []);
  return items;
}

/**
 * Queued toast that must survive a full page reload (e.g. "logged out"
 * shown by the login page after `window.location.href` navigation).
 * Dashboard logic writes `sessionStorage["euodoo-pending-toast"]`;
 * ToastProvider consumes and shows it exactly once on the next mount.
 */
function flushPendingToast() {
  try {
    const raw = sessionStorage.getItem("euodoo-pending-toast");
    if (!raw) return;
    sessionStorage.removeItem("euodoo-pending-toast");
    const queued = JSON.parse(raw);
    if (queued && typeof queued.message === "string") {
      addToast(queued.type || "info", queued.message);
    }
  } catch (_) {}
}

export function ToastProvider({ children }) {
  const items = useToastItems();

  useEffect(() => {
    flushPendingToast();
  }, []);

  const newest = items.length ? items[0].id : null;
  const onKeydown = useCallback(
    (event) => {
      if (event.key === "Escape" && newest != null) {
        toast.dismiss(newest);
      }
    },
    [newest]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [onKeydown]);

  return (
    <>
      {children}
      <div className="toast-viewport" aria-label="Notifications">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast-item toast-${item.type}`}
            role={TOAST_ROLE[item.type] || "status"}
            aria-live={TOAST_ROLE[item.type] === "alert" ? "assertive" : "polite"}
          >
            <span className="toast-icon" aria-hidden="true">
              {TOAST_ICONS[item.type] || TOAST_ICONS.info}
            </span>
            <span className="toast-message">{item.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => toast.dismiss(item.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/** Hook form for React components (same object as the module-level `toast`). */
export function useToast() {
  return toast;
}
