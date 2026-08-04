import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { API_BASE, ROLE_LABEL } from "./data/constants";
import { useDataSource, authFetch, setToken } from "./data/useDataSource";
import { Login } from "./components/Login";
import { TopBar } from "./components/Shell";
import { Toasts } from "./components/primitives";
import EmployeeDashboard from "./dashboards/EmployeeDashboard";
import SupervisorDashboard from "./dashboards/SupervisorDashboard";
import TechDashboard from "./dashboards/TechDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";

/* =================================================================================
   SQUARE GROUP — IT OPERATIONS PORTAL
   Talks to the Spring Boot API at API_BASE (see data/constants.js); if that is
   unreachable it transparently runs on seeded demo data so the UI stays usable.
   ================================================================================= */

/* ================================================================================= */
/*  Root                                                                             */
/* ================================================================================= */
// The signed-in user survives a page reload; only an explicit sign-out clears it.
const SESSION_KEY = "sq-session";
const loadSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
};

export default function App() {
  const ds = useDataSource();
  const [user, setUser] = useState(loadSession);
  const [toasts, setToasts] = useState([]);
  // Bumped when the SQUARE logo is clicked — dashboards jump back to their Home tab
  const [homeTick, setHomeTick] = useState(0);
  const seq = useRef(0);

  const notify = useCallback((msg, tone = "ok") => {
    const id = ++seq.current;
    setToasts((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismiss = (id) => setToasts((s) => s.filter((x) => x.id !== id));

  useEffect(() => { if (user) ds.refresh(); }, [user]);

  // Token was rejected by the server (e.g. backend restarted and wiped its
  // in-memory tokens). Drop the stale session and send the user back to login
  // instead of silently showing demo data.
  useEffect(() => {
    if (ds.sessionExpired && user) {
      setToken("");
      setUser(null);
      try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
      notify("Your session expired — please sign in again.", "crit");
    }
  }, [ds.sessionExpired, user, notify]);

  const onLogin = async (u, p) => {
    const r = await ds.login(u, p);
    if (r.ok) {
      setUser(r.user);
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(r.user)); } catch { /* private mode */ }
    }
    return r;
  };

  const onSignOut = () => {
    // best-effort server-side token revocation, then clear everything locally
    authFetch(`${API_BASE}/api/auth/logout`, { method: "POST" }).catch(() => {});
    setToken("");
    setUser(null);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
  };

  const crumb = user ? `${ROLE_LABEL[user.role]} / console` : "";
  const profile = user ? ds.users.find((u) => u.id === user.id) : null;
  const goHome = () => setHomeTick((t) => t + 1);
  const shared = { ds, user, notify, onSignOut, homeTick };

  return (
    <div className="sq-app">
      {!user ? (
        <Login onLogin={onLogin} onForgot={ds.forgotPassword} />
      ) : (
        <>
          <TopBar user={user} profile={profile} mode={ds.mode} onSignOut={onSignOut} onHome={goHome} crumb={crumb} />
          {ds.loading ? (
            <div className="sq-loading"><span className="sq-spinner" /> Loading workspace…</div>
          ) : (
            <>
              {user.role === "EMPLOYEE" && <EmployeeDashboard {...shared} />}
              {user.role === "SUPERVISOR" && <SupervisorDashboard {...shared} />}
              {user.role === "IT_TECH" && <TechDashboard {...shared} />}
              {user.role === "SYSTEM_ADMIN" && <AdminDashboard {...shared} />}
            </>
          )}
        </>
      )}
      <Toasts items={toasts} dismiss={dismiss} />
    </div>
  );
}
