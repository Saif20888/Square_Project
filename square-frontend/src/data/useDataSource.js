import { useState, useRef, useCallback } from "react";
import { API_BASE, DEMO_FALLBACK_ENABLED, SEED_USERS, SEED_TICKETS, SEED_ASSETS, DEFAULT_LOCATIONS, DEFAULT_DEPARTMENTS, dateDaysAgo } from "./constants";

/* ================================================================================= */
/*  Data layer — network with graceful demo fallback                                 */
/*  Demo-mode changes are persisted to localStorage so they survive a page reload,   */
/*  behaving like a permanent database until the seed version changes.               */
/* ================================================================================= */
const DEMO_KEY = "sq-demo-store-v5";

// Free-tier hosts (e.g. Render) sleep the backend after idle and can take
// 30-50s to wake on the next request — a tight timeout here would misreport
// "server unreachable" while it's just cold-starting.
const REQUEST_TIMEOUT_MS = 20000;

function loadDemoStore() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.tickets) || !Array.isArray(parsed.assets)) return null;
    return parsed;
  } catch { return null; }
}

// --- API security: every request carries the Bearer token issued at login ---
const TOKEN_KEY = "sq-token";
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };
export const authFetch = (url, init = {}) => {
  const token = getToken();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
};

export function useDataSource() {
  const [mode, setMode] = useState("connecting"); // connecting | live | demo
  const [tickets, setTickets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [importLogs, setImportLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  // Set when the server rejects our token (401) — the app must send the user
  // back to the login screen instead of silently dropping to demo data.
  const [sessionExpired, setSessionExpired] = useState(false);
  const demoTickets = useRef(null);
  const demoSeq = useRef(100);
  const demoAssets = useRef(null);
  const demoOffboarding = useRef(null);    // username -> plan, demo-mode only
  const demoNotifications = useRef(null);  // IT Team inbox, demo-mode only
  const demoOffboarded = useRef(null);     // usernames removed from rosters, demo-mode only
  const demoExtraUsers = useRef(null);     // employees onboarded by the Superuser, demo-mode only
  const demoProfile = useRef(null);        // username -> profile/password overrides, demo-mode only
  const demoLocations = useRef(null);      // Superuser-managed offices, demo-mode only
  const demoDepartments = useRef(null);    // Superuser-managed departments, demo-mode only
  const demoImportLogs = useRef(null);     // import history, demo-mode only

  // Loads the persisted demo store (or falls back to the seeds) exactly once.
  const ensureStore = () => {
    if (!demoTickets.current) {
      const saved = loadDemoStore();
      demoTickets.current = saved ? saved.tickets : SEED_TICKETS.map((t) => ({ ...t }));
      demoAssets.current = saved ? saved.assets : SEED_ASSETS.map((a) => ({ ...a }));
      demoOffboarding.current = saved?.offboarding || {};
      demoNotifications.current = saved?.notifications || [];
      demoOffboarded.current = saved?.offboarded || [];
      demoExtraUsers.current = saved?.extraUsers || [];
      demoProfile.current = saved?.profile || {};
      demoLocations.current = saved?.locations || DEFAULT_LOCATIONS.map((l) => ({ ...l }));
      demoDepartments.current = saved?.departments || DEFAULT_DEPARTMENTS.map((d) => ({ ...d }));
      demoImportLogs.current = saved?.importLogs || [];
      demoSeq.current = saved?.seq || 100;
    }
  };
  const persistDemo = () => {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({
        tickets: demoTickets.current, assets: demoAssets.current,
        offboarding: demoOffboarding.current, notifications: demoNotifications.current,
        offboarded: demoOffboarded.current, extraUsers: demoExtraUsers.current,
        profile: demoProfile.current, locations: demoLocations.current,
        departments: demoDepartments.current, importLogs: demoImportLogs.current,
        seq: demoSeq.current,
      }));
    } catch { /* storage full/blocked — demo keeps working in memory */ }
  };
  const ensureDemo = () => { ensureStore(); return demoTickets.current; };
  const ensureDemoAssets = () => { ensureStore(); return demoAssets.current; };
  // Seeded + Superuser-onboarded users, with My Account edits layered on top.
  const demoUsers = () => {
    ensureStore();
    return [...SEED_USERS, ...demoExtraUsers.current].map((u) => ({
      ...u, ...(demoProfile.current[u.username] || {}),
      offboarded: demoOffboarded.current.includes(u.username),
    }));
  };
  const pendingDemoNotifications = () => {
    ensureStore();
    return demoNotifications.current.filter((n) => n.status === "PENDING");
  };

  // `silent` skips the loading flag — used after mutations so we don't unmount
  // (and lose the local state of) the dashboard that's still on screen.
  const refresh = useCallback(async (opts) => {
    const silent = opts?.silent;
    if (!silent) setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/tickets`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
      // Token rejected (e.g. server restarted and wiped in-memory tokens) — this
      // is NOT a network outage, so don't fall to demo. Clear creds and force login.
      if (res.status === 401) { setToken(""); setSessionExpired(true); return; }
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      setTickets(data);
      setMode("live");
      // assets/users are optional on the backend; try, but never block
      try {
        const ar = await authFetch(`${API_BASE}/api/assets`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
        if (ar.ok) setAssets(await ar.json());
        else setAssets(SEED_ASSETS);
      } catch { setAssets(SEED_ASSETS); }
      try {
        const ur = await authFetch(`${API_BASE}/api/users`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
        if (ur.ok) setUsers(await ur.json());
        else setUsers(SEED_USERS);
      } catch { setUsers(SEED_USERS); }
      try {
        const nr = await authFetch(`${API_BASE}/api/notifications`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
        if (nr.ok) setNotifications(await nr.json());
        else setNotifications([]);
      } catch { setNotifications([]); }
      try {
        const lr = await authFetch(`${API_BASE}/api/org/locations`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
        if (lr.ok) { const d = await lr.json(); if (d.length) setLocations(d); }
        const dr = await authFetch(`${API_BASE}/api/org/departments`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
        if (dr.ok) { const d = await dr.json(); if (d.length) setDepartments(d); }
      } catch { /* org lists keep their defaults */ }
      try {
        const ir = await authFetch(`${API_BASE}/api/import-logs`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
        if (ir.ok) setImportLogs(await ir.json());
      } catch { /* history stays as-is */ }
    } catch {
      // In a production build the seed-data fallback is switched off: showing
      // fake data during a real outage would hide the outage from everyone.
      if (!DEMO_FALLBACK_ENABLED) { setMode("offline"); return; }
      setTickets(ensureDemo().map((t) => ({ ...t })));
      setAssets(ensureDemoAssets().map((a) => ({ ...a })));
      setUsers(demoUsers());
      setNotifications(pendingDemoNotifications().map((n) => ({ ...n })));
      ensureStore();
      setLocations(demoLocations.current.map((l) => ({ ...l })));
      setDepartments(demoDepartments.current.map((d) => ({ ...d })));
      setImportLogs(demoImportLogs.current.map((l) => ({ ...l })));
      setMode("demo");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const res = await authFetch(`${API_BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }), signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) {
        const d = await res.json();
        setToken(d.token || "");
        setSessionExpired(false);
        return { ok: true, user: { id: d.id, username: d.username, role: d.role, name: d.name || d.username } };
      }
      if (res.status === 401) return { ok: false, error: "Wrong username or password." };
      if (res.status === 423) {
        const d = await res.json().catch(() => null);
        return { ok: false, error: d?.message || "Account temporarily locked — try again later." };
      }
      throw new Error("unreachable");
    } catch {
      // Production builds must never authenticate against the local seed list —
      // those passwords are in the shipped bundle. Fail closed instead.
      if (!DEMO_FALLBACK_ENABLED) {
        return { ok: false, error: "Cannot reach the server. Please try again shortly." };
      }
      // Demo fallback — includes onboarded employees and changed passwords.
      const u = demoUsers().find((x) => x.username === username && x.password === password);
      if (u) return { ok: true, user: { id: u.id, username: u.username, role: u.role, name: u.name } };
      return { ok: false, error: "Wrong username or password." };
    }
  }, []);

  const mutate = useCallback(async (livePath, init, demoApply) => {
    if (mode === "demo") {
      const store = ensureDemo();
      const data = demoApply(store);
      persistDemo();
      setTickets(store.map((t) => ({ ...t })));
      return { ok: true, data };
    }
    try {
      const res = await authFetch(`${API_BASE}${livePath}`, init);
      let data = null;
      try { data = await res.json(); } catch { /* no body */ }
      await refresh({ silent: true });
      return { ok: res.ok, data };
    } catch {
      return { ok: false };
    }
  }, [mode, refresh]);

  const mutateAsset = useCallback(async (livePath, init, demoApply) => {
    if (mode === "demo") {
      const store = ensureDemoAssets();
      const data = demoApply(store);
      persistDemo();
      setAssets(store.map((a) => ({ ...a })));
      return { ok: true, data };
    }
    try {
      const res = await authFetch(`${API_BASE}${livePath}`, init);
      let data = null;
      try { data = await res.json(); } catch { /* no body */ }
      await refresh({ silent: true });
      return { ok: res.ok, data };
    } catch {
      return { ok: false };
    }
  }, [mode, refresh]);

  const createTicket = (payload) =>
    mutate(`/api/tickets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      (store) => {
        const id = ++demoSeq.current;
        const ticket = { ...payload, id, status: "OPEN", acceptedBy: null, resolvedAt: null, createdAt: new Date().toISOString() };
        store.unshift(ticket);
        return ticket;
      });

  // Every ticket routes straight to IT — no approval gate. A technician accepts...
  const acceptTicket = (id, acceptedBy) =>
    mutate(`/api/tickets/${id}/accept`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptedBy }) },
      (store) => { const t = store.find((x) => x.id === id); if (t) { t.status = "SOLVING"; t.acceptedBy = acceptedBy; } });

  // ...or rejects it, closing it out.
  const reject = (id) =>
    mutate(`/api/tickets/${id}/reject`, { method: "PUT" },
      (store) => { const t = store.find((x) => x.id === id); if (t) { t.status = "REJECTED"; t.resolvedAt = new Date().toISOString(); } });

  // Marks a ticket that's being worked on as resolved.
  const resolveTicket = (id) =>
    mutate(`/api/tickets/${id}/resolve`, { method: "PUT" },
      (store) => { const t = store.find((x) => x.id === id); if (t) { t.status = "CLOSED"; t.resolvedAt = new Date().toISOString(); } });

  const scrapAsset = (id, reason) =>
    mutateAsset(`/api/assets/${id}/scrap`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        a.status = "SCRAPPED"; a.scrapReason = reason; a.scrappedAt = new Date().toISOString().slice(0, 10);
        a.userId = null; a.repairShop = null; a.sentToRepairAt = null; a.pendingUserId = null;
      });

  const assignAsset = (id, userId) =>
    mutateAsset(`/api/assets/${id}/assign`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        if (userId != null) { a.userId = userId; a.status = "ALLOCATED_IN_USE"; }
        else { a.userId = null; a.status = "AVAILABLE_IN_POOL"; a.isLoaner = false; a.loanerIssuedAt = null; }
      });

  // Issues a pool device as a temporary loaner while the owner's device is repaired.
  const issueLoaner = (id, userId) =>
    mutateAsset(`/api/assets/${id}/loan`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        a.userId = userId; a.status = "ALLOCATED_IN_USE"; a.isLoaner = true;
        a.loanerIssuedAt = new Date().toISOString().slice(0, 10);
      });

  // Sends a faulty device to a repair shop; userId keeps pointing at the owner.
  const sendToRepair = (id, shop) =>
    mutateAsset(`/api/assets/${id}/repair`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shop }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        a.status = "IN_REPAIR"; a.repairShop = shop;
        a.sentToRepairAt = new Date().toISOString().slice(0, 10);
      });

  // Device came back from the shop: fixed -> owner, not fixed -> Scrap Registry.
  const repairReturn = (id, fixed) =>
    mutateAsset(`/api/assets/${id}/repair-return`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fixed }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        if (fixed) {
          a.status = a.userId != null ? "ALLOCATED_IN_USE" : "AVAILABLE_IN_POOL";
        } else {
          a.status = "SCRAPPED";
          a.scrapReason = `Returned from ${a.repairShop || "repair"} unrepaired — decommissioned`;
          a.scrappedAt = new Date().toISOString().slice(0, 10);
          a.userId = null;
        }
        a.repairShop = null; a.sentToRepairAt = null;
      });

  // IT receives a device back from an offboarded employee and stores it; the
  // matching notification is closed out and the stock updates in real time.
  const receiveDevice = useCallback(async (id, storage) => {
    if (mode === "demo") {
      const store = ensureDemoAssets();
      const a = store.find((x) => x.id === id);
      if (a) {
        a.userId = null; a.status = "AVAILABLE_IN_POOL"; a.storageLocation = storage;
        a.isLoaner = false; a.loanerIssuedAt = null;
      }
      demoNotifications.current.forEach((n) => { if (n.assetId === id && n.status === "PENDING") n.status = "DONE"; });
      persistDemo();
      setAssets(store.map((x) => ({ ...x })));
      setNotifications(pendingDemoNotifications().map((n) => ({ ...n })));
      return { ok: true };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/assets/${id}/receive`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storage }),
      });
      await refresh({ silent: true });
      return { ok: res.ok };
    } catch { return { ok: false }; }
  }, [mode, refresh]);

  // Technician asks to issue a new inventory device — needs supervisor acceptance.
  const requestNewDevice = (id, userId) =>
    mutateAsset(`/api/assets/${id}/request-assign`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        a.status = "UNDER_REVIEW"; a.pendingUserId = userId;
      });

  // Supervisor accepts or rejects a pending new-device assignment.
  const approveAssignment = (id, approve) =>
    mutateAsset(`/api/assets/${id}/approve-assign`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        if (approve && a.pendingUserId != null) {
          a.userId = a.pendingUserId; a.status = "ALLOCATED_IN_USE"; a.poolCondition = null;
        } else {
          a.status = "AVAILABLE_IN_POOL";
        }
        a.pendingUserId = null;
      });

  // Employee self-service — "+ Add device" on My Devices. The price becomes
  // originalValue so it rolls into the capitalized-value total and the logs.
  const registerDevice = (payload) =>
    mutateAsset(`/api/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      (store) => {
        const id = Math.max(0, ...store.map((a) => a.id)) + 1;
        const warrantyDaysRemaining = payload.warrantyExpiry
          ? Math.round((new Date(payload.warrantyExpiry).getTime() - Date.now()) / 86400000)
          : 0;
        const toInventory = payload.userId == null;
        const asset = {
          id, serialNumber: payload.serialNumber, deviceType: payload.deviceType, deviceKind: payload.deviceKind || null,
          prNumber: payload.prNumber || null, assetCategory: payload.assetCategory || null, assetNumber: payload.assetNumber || null,
          supplierName: payload.supplierName || null, department: payload.department || null, storageLocation: null,
          ipAddress: payload.ipAddress || null, specifications: payload.specifications || "",
          status: toInventory ? "AVAILABLE_IN_POOL" : "ALLOCATED_IN_USE", userId: payload.userId ?? null,
          purchaseDate: new Date().toISOString().slice(0, 10),
          warrantyDaysRemaining: payload.warrantyExpiry ? warrantyDaysRemaining : 365,
          originalValue: Number(payload.originalValue) || 0, usefulLifeYears: 4,
          poolCondition: toInventory ? "NEW" : null, isLoaner: false,
          loanerIssuedAt: null, repairShop: null, sentToRepairAt: null, pendingUserId: null, scrapReason: null, scrappedAt: null,
        };
        store.unshift(asset);
        return asset;
      });

  // Warranty replacement received from the original shop — fresh 1-year
  // warranty, optionally a new serial, straight back to the owner.
  const warrantyReplace = (id, newSerial) =>
    mutateAsset(`/api/assets/${id}/warranty-replace`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newSerial }) },
      (store) => {
        const a = store.find((x) => x.id === id); if (!a) return;
        if (newSerial && newSerial.trim()) a.serialNumber = newSerial.trim();
        a.status = a.userId != null ? "ALLOCATED_IN_USE" : "AVAILABLE_IN_POOL";
        a.warrantyDaysRemaining = 365;
        a.purchaseDate = new Date().toISOString().slice(0, 10);
        a.repairShop = null; a.sentToRepairAt = null;
      });

  // --- Superuser organization management ---
  const orgMutate = useCallback(async (livePath, init, demoApply) => {
    if (mode === "demo") {
      ensureStore();
      const result = demoApply();
      persistDemo();
      setLocations(demoLocations.current.map((l) => ({ ...l })));
      setDepartments(demoDepartments.current.map((d) => ({ ...d })));
      return result || { ok: true };
    }
    try {
      const res = await authFetch(`${API_BASE}${livePath}`, init);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        return { ok: false, error: d?.message || "Couldn't update the organization." };
      }
      await refresh({ silent: true });
      return { ok: true };
    } catch { return { ok: false, error: "Couldn't reach the server." }; }
  }, [mode, refresh]);

  const addLocation = (name, floors) =>
    orgMutate(`/api/org/locations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, floors }) },
      () => {
        if (demoLocations.current.some((l) => l.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: "This office already exists." };
        demoLocations.current.push({ id: ++demoSeq.current, name, floors: Math.max(1, Number(floors) || 6) });
      });

  const removeLocation = (id) =>
    orgMutate(`/api/org/locations/${id}`, { method: "DELETE" },
      () => { demoLocations.current = demoLocations.current.filter((l) => l.id !== id); });

  const addDepartment = (name) =>
    orgMutate(`/api/org/departments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) },
      () => {
        if (demoDepartments.current.some((d) => d.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: "This department already exists." };
        demoDepartments.current.push({ id: ++demoSeq.current, name });
      });

  const removeDepartment = (id) =>
    orgMutate(`/api/org/departments/${id}`, { method: "DELETE" },
      () => { demoDepartments.current = demoDepartments.current.filter((d) => d.id !== id); });

  // Records one import run in the history/audit log.
  const addImportLog = useCallback(async (entry) => {
    if (mode === "demo") {
      ensureStore();
      demoImportLogs.current.unshift({ id: ++demoSeq.current, createdAt: new Date().toISOString(), ...entry });
      persistDemo();
      setImportLogs(demoImportLogs.current.map((l) => ({ ...l })));
      return { ok: true };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/import-logs`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry),
      });
      await refresh({ silent: true });
      return { ok: res.ok };
    } catch { return { ok: false }; }
  }, [mode, refresh]);

  // "Forgot password" on the login page — notifies the Superuser, who hands
  // over a temporary password in person.
  const forgotPassword = useCallback(async (username) => {
    try {
      const res = await authFetch(`${API_BASE}/api/auth/forgot`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }), signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return { ok: true };
      throw new Error("unreachable");
    } catch {
      // demo fallback
      ensureStore();
      const u = demoUsers().find((x) => x.username === username.trim());
      if (u && !demoNotifications.current.some((n) => n.type === "PASSWORD_RESET" && n.employeeUsername === u.username && n.status === "PENDING")) {
        demoNotifications.current.push({
          id: ++demoSeq.current, type: "PASSWORD_RESET",
          message: `${u.name || u.username} forgot their password and requested a reset.`,
          assetId: null, employeeUsername: u.username, status: "PENDING",
          dueAt: dateDaysAgo(0), createdAt: new Date().toISOString(),
        });
        persistDemo();
      }
      return { ok: true };
    }
  }, []);

  // Superuser resets a forgotten password — returns the one-time temp password.
  const resetPassword = useCallback(async (userId) => {
    if (mode === "demo") {
      ensureStore();
      const u = demoUsers().find((x) => x.id === userId);
      if (!u) return { ok: false };
      const temp = `TempPass${Math.floor(100 + Math.random() * 900)}!`;
      demoProfile.current[u.username] = { ...(demoProfile.current[u.username] || {}), password: temp };
      demoNotifications.current.forEach((n) => {
        if (n.type === "PASSWORD_RESET" && n.employeeUsername === u.username && n.status === "PENDING") n.status = "DONE";
      });
      persistDemo();
      setNotifications(pendingDemoNotifications().map((n) => ({ ...n })));
      return { ok: true, tempPassword: temp, username: u.username };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/users/${userId}/reset-password`, { method: "POST" });
      if (!res.ok) return { ok: false };
      const d = await res.json();
      await refresh({ silent: true });
      return { ok: true, tempPassword: d.tempPassword, username: d.username };
    } catch { return { ok: false }; }
  }, [mode, refresh]);

  // My Account — self-service profile edit.
  const updateProfile = useCallback(async (id, payload) => {
    if (mode === "demo") {
      ensureStore();
      const u = demoUsers().find((x) => x.id === id);
      if (!u) return { ok: false };
      demoProfile.current[u.username] = { ...(demoProfile.current[u.username] || {}), ...payload };
      persistDemo();
      setUsers(demoUsers());
      return { ok: true };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/users/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      await refresh({ silent: true });
      return { ok: res.ok };
    } catch { return { ok: false }; }
  }, [mode, refresh]);

  // My Account — password change; verifies the current password first.
  const changePassword = useCallback(async (id, currentPassword, newPassword) => {
    if (mode === "demo") {
      ensureStore();
      const u = demoUsers().find((x) => x.id === id);
      if (!u) return { ok: false, error: "Account not found." };
      if (u.password !== currentPassword) return { ok: false, error: "Current password is incorrect." };
      demoProfile.current[u.username] = { ...(demoProfile.current[u.username] || {}), password: newPassword };
      persistDemo();
      return { ok: true };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/users/${id}/password`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) return { ok: true };
      const d = await res.json().catch(() => null);
      return { ok: false, error: d?.message || "Couldn't update the password." };
    } catch { return { ok: false, error: "Couldn't reach the server." }; }
  }, [mode]);

  // Superuser onboarding — creates the account (username = e-mail) and, if a
  // device was allocated, the asset. Returns the credentials for the modal.
  const onboardEmployee = useCallback(async (payload) => {
    if (mode === "demo") {
      ensureStore();
      const all = demoUsers();
      if (all.some((x) => x.username === payload.email || x.email === payload.email)) {
        return { ok: false, error: "An account with this e-mail already exists." };
      }
      if (payload.employeeId && all.some((x) => (x.employeeId || "").toLowerCase() === payload.employeeId.toLowerCase())) {
        return { ok: false, error: "This Employee ID is already in use." };
      }
      const id = Math.max(0, ...all.map((x) => x.id)) + 1;
      const unit = payload.department === "HR and Admin" ? payload.unit || null : null;
      demoExtraUsers.current.push({
        id, username: payload.email, password: payload.tempPassword,
        role: unit === "IT" || payload.employeeType === "IT Team" ? "IT_TECH" : "EMPLOYEE",
        name: payload.name, jobTitle: payload.designation, employeeId: payload.employeeId,
        department: payload.department, unit, email: payload.email, mobile: payload.mobile,
        phone: payload.phone, dob: payload.dob, location: payload.location, floor: payload.floor,
        managerUsername: payload.managerUsername || null, offboarded: false,
        joinedAt: new Date().toISOString().slice(0, 10),
      });
      if (payload.deviceName) {
        const store = ensureDemoAssets();
        const aid = Math.max(0, ...store.map((a) => a.id)) + 1;
        const warrantyDays = payload.warrantyExpiry
          ? Math.round((new Date(payload.warrantyExpiry).getTime() - Date.now()) / 86400000)
          : 365;
        store.unshift({
          id: aid, serialNumber: payload.assetNumber || `SQ-${payload.employeeId || "U" + id}`,
          deviceType: payload.deviceName, deviceKind: payload.deviceKind || null, specifications: "",
          status: "ALLOCATED_IN_USE", warrantyDaysRemaining: warrantyDays, userId: id,
          purchaseDate: new Date().toISOString().slice(0, 10), originalValue: Number(payload.originalValue) || 0, usefulLifeYears: 4,
          poolCondition: null, isLoaner: false, loanerIssuedAt: null, repairShop: null, sentToRepairAt: null,
          pendingUserId: null, prNumber: payload.prNumber || null, assetCategory: payload.assetCategory || null,
          assetNumber: payload.assetNumber || null, supplierName: payload.supplierName || null, department: payload.department || null,
          ipAddress: payload.ipAddress || null, storageLocation: null, scrapReason: null, scrappedAt: null,
        });
        setAssets(store.map((a) => ({ ...a })));
      }
      persistDemo();
      setUsers(demoUsers());
      return { ok: true };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/users`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        return { ok: false, error: d?.message || "Couldn't onboard the employee." };
      }
      await refresh({ silent: true });
      return { ok: true };
    } catch { return { ok: false, error: "Couldn't reach the server." }; }
  }, [mode, refresh]);

  const submitOffboarding = useCallback(async (employeeUsername, decision, note) => {
    if (mode === "demo") {
      ensureStore();
      const target = demoUsers().find((u) => u.username === employeeUsername);
      const store = ensureDemoAssets();
      const who = target?.name || employeeUsername;
      // The employee leaves the roster; their devices become IT Team notifications —
      // released devices instantly, desk-hold devices after the 14-day window.
      if (!demoOffboarded.current.includes(employeeUsername)) demoOffboarded.current.push(employeeUsername);
      store.filter((a) => a.userId === target?.id && a.status === "ALLOCATED_IN_USE").forEach((a) => {
        if (decision === "RELEASE_TO_IT") {
          demoNotifications.current.push({
            id: ++demoSeq.current, type: "DEVICE_RELEASE",
            message: `${who} was offboarded — ${a.serialNumber} (${a.deviceType}) released to IT. Receive and choose where to store it.`,
            assetId: a.id, employeeUsername, status: "PENDING", dueAt: dateDaysAgo(0), createdAt: new Date().toISOString(),
          });
        } else {
          a.status = "VACANT_DESK";
          demoNotifications.current.push({
            id: ++demoSeq.current, type: "DESK_COLLECTION",
            message: `${who}'s desk hold ends — collect ${a.serialNumber} (${a.deviceType}) from the desk and choose where to store it.`,
            assetId: a.id, employeeUsername, status: "PENDING", dueAt: dateDaysAgo(-14), createdAt: new Date().toISOString(),
          });
        }
      });
      const plan = { employeeUsername, decision, note, holdUntil: decision === "RETAIN_14_DAY" ? dateDaysAgo(-14) : null, createdAt: new Date().toISOString() };
      demoOffboarding.current[employeeUsername] = plan;
      persistDemo();
      setAssets(store.map((a) => ({ ...a })));
      setUsers(demoUsers());
      setNotifications(pendingDemoNotifications().map((n) => ({ ...n })));
      return { ok: true, plan };
    }
    try {
      const res = await authFetch(`${API_BASE}/api/offboarding`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeUsername, decision, note }),
      });
      if (!res.ok) return { ok: false };
      const plan = await res.json();
      await refresh({ silent: true });
      return { ok: true, plan };
    } catch { return { ok: false }; }
  }, [mode, refresh]);

  const getOffboardingPlan = useCallback(async (employeeUsername) => {
    if (mode === "demo") { ensureStore(); return demoOffboarding.current[employeeUsername] || null; }
    try {
      const res = await authFetch(`${API_BASE}/api/offboarding?employee=${encodeURIComponent(employeeUsername)}`);
      if (res.status === 204 || !res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, [mode]);

  return {
    mode, tickets, assets, users, notifications, locations, departments, importLogs, loading, sessionExpired, refresh, login,
    addImportLog,
    createTicket, acceptTicket, reject, resolveTicket,
    scrapAsset, assignAsset, issueLoaner, sendToRepair, repairReturn, warrantyReplace,
    requestNewDevice, approveAssignment, receiveDevice,
    registerDevice, submitOffboarding, getOffboardingPlan,
    updateProfile, changePassword, onboardEmployee,
    addLocation, removeLocation, addDepartment, removeDepartment,
    forgotPassword, resetPassword,
  };
}
