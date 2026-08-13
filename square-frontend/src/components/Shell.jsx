import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { ROLE_LABEL } from "../data/constants";
import { SquareMark } from "./primitives";

/* ================================================================================= */
/*  Shell — top bar + rail                                                           */
/* ================================================================================= */
export function TopBar({ user, profile, mode, onSignOut, onHome, crumb }) {
  const [open, setOpen] = useState(false);
  const initials = (user.name || user.username).split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const p = profile || user;
  return (
    <header className="sq-topbar">
      {/* The logo doubles as a "back to Home" button */}
      <button className="sq-brand sq-brand-btn" onClick={onHome} title="Back to Home">
        <SquareMark size={22} />
        <span className="sq-wordmark">SQUARE</span>
        <span className="sq-brand-sub">IT Operations</span>
      </button>
      <div className="sq-crumb sq-mono">{crumb}</div>
      <div className="sq-topbar-right">
        <span className={`sq-env ${mode === "live" ? "ok" : "warn"}`}>
          <span className="sq-dot" />
          {mode === "live" ? "Postgres · live"
            : mode === "demo" ? "Demo data · offline"
            : mode === "offline" ? "Server unreachable"
            : "Connecting…"}
        </span>
        <div className="sq-profile">
          {/* The name itself is the button — click for details + sign out */}
          <button className={`sq-rolechip sq-rolechip-btn${open ? " is-open" : ""}`} onClick={() => setOpen(!open)}>
            <span className="sq-avatar">{initials}</span>
            <span className="sq-rolechip-text">
              <span className="sq-rolechip-name">{user.name || user.username}</span>
              <span className="sq-rolechip-role">{ROLE_LABEL[user.role]}</span>
            </span>
          </button>
          {open && (
            <>
              <div className="sq-profile-scrim" onClick={() => setOpen(false)} />
              <div className="sq-profile-pop">
                <div className="sq-profile-head">
                  <span className="sq-avatar lg">{initials}</span>
                  <div>
                    <div className="sq-cell-strong">{p.name || p.username}</div>
                    <div className="sq-cell-desc">{ROLE_LABEL[p.role] || p.role}</div>
                  </div>
                </div>
                <div className="sq-profile-rows">
                  <div className="sq-profile-row"><span className="sq-eyebrow">Employee ID</span><span className="sq-mono">{p.employeeId || "—"}</span></div>
                  <div className="sq-profile-row"><span className="sq-eyebrow">Designation</span><span>{p.jobTitle || "—"}</span></div>
                  <div className="sq-profile-row"><span className="sq-eyebrow">Department</span><span>{p.department || "—"}</span></div>
                  <div className="sq-profile-row"><span className="sq-eyebrow">E-Mail</span><span>{p.email || p.username}</span></div>
                </div>
                <button className="sq-profile-signout" onClick={() => { setOpen(false); onSignOut(); }}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Rail({ items, active, onSelect }) {
  return (
    <nav className="sq-rail">
      {items.map((it) => (
        <button key={it.key} className={`sq-rail-item${active === it.key ? " is-active" : ""}`} onClick={() => onSelect(it.key)}>
          <it.icon size={17} strokeWidth={2.1} />
          <span>{it.label}</span>
          {it.badge ? <span className="sq-rail-badge">{it.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

// Shared responsive shell used by every dashboard — a fixed sidebar on desktop
// that collapses into a hamburger-triggered off-canvas drawer on tablet/mobile.
export function Shell({ items, active, onSelect, children }) {
  const [railOpen, setRailOpen] = useState(false);
  return (
    <div className="sq-shell">
      <button className="sq-hamburger" onClick={() => setRailOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
      {railOpen && <div className="sq-rail-scrim" onClick={() => setRailOpen(false)} />}
      <div className={`sq-rail-wrap${railOpen ? " is-open" : ""}`}>
        <Rail items={items} active={active} onSelect={(k) => { onSelect(k); setRailOpen(false); }} />
      </div>
      <main className="sq-main">{children}</main>
    </div>
  );
}

export function Section({ eyebrow, title, action, children }) {
  return (
    <section className="sq-section">
      <div className="sq-section-head">
        <div>
          {eyebrow && <div className="sq-eyebrow">{eyebrow}</div>}
          <h2 className="sq-h2">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
