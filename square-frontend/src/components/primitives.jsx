import { useState, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { Check, X, Copy, Inbox, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import { STATUS_META, LIFECYCLE, STEP_LABEL } from "../data/constants";

/* ================================================================================= */
/*  Primitive components                                                             */
/* ================================================================================= */
// The SQUARE corporate mark — a 3×3 grid of brand-green squares
export function SquareMark({ size = 22 }) {
  const g = size / 3;
  const cells = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: "block" }}>
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * g + 0.6} y={y * g + 0.6} width={g - 1.2} height={g - 1.2} fill="var(--logo-green, #34A853)" />
      ))}
    </svg>
  );
}

export function Badge({ tone = "neutral", children, dot = true }) {
  return (
    <span className={`sq-badge ${tone}`}>
      {dot && <span className="sq-dot" />}
      {children}
    </span>
  );
}
export const StatusBadge = ({ status }) => { const m = STATUS_META[status] || { tone: "neutral", label: status }; return <Badge tone={m.tone}>{m.label}</Badge>; };

export function Btn({ children, variant = "ghost", size, icon: Icon, ...props }) {
  return (
    <button className={`sq-btn ${variant}${size === "sm" ? " sm" : ""}`} {...props}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, tone = "neutral", icon: Icon }) {
  return (
    <div className="sq-card sq-stat">
      <div className="sq-stat-top">
        <span className="sq-eyebrow">{label}</span>
        {Icon && <span className={`sq-stat-ic ${tone}`}><Icon size={15} strokeWidth={2.2} /></span>}
      </div>
      <div className="sq-stat-value">{value}</div>
      {sub && <div className={`sq-stat-sub ${tone}`}>{sub}</div>}
    </div>
  );
}

export function CopyChip({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className="sq-copy" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      <span className="sq-mono">{text}</span>
      {done ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.2} />}
    </button>
  );
}

/* The signature element: a connected lifecycle stepper driven by the real states */
export function Stepper({ status }) {
  const idx = status === "REJECTED" ? 1 : Math.max(0, LIFECYCLE.indexOf(status));
  const pct = (idx / (LIFECYCLE.length - 1)) * 100;
  const rejected = status === "REJECTED";
  return (
    <div className="sq-stepper" style={{ "--fill": pct + "%" }}>
      <div className="sq-step-rail"><div className={`sq-step-fill${rejected ? " crit" : ""}`} /></div>
      {LIFECYCLE.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? (rejected ? "crit" : "active") : "todo";
        return (
          <div key={s} className={`sq-step ${state}`}>
            <span className="sq-step-node">
              {state === "done" ? <Check size={11} strokeWidth={3} /> : state === "crit" ? <X size={11} strokeWidth={3} /> : <span className="sq-step-pip" />}
            </span>
            <span className="sq-step-label sq-mono">{rejected && i === 1 ? "Rejected" : STEP_LABEL[s]}</span>
          </div>
        );
      })}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, sub, children }) {
  const titleId = useId();
  const modalRef = useRef(null);
  const restoreFocusRef = useRef(null);

  // Keyboard handling: Escape closes, Tab is trapped inside the dialog.
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // On open: remember what had focus and move focus into the dialog.
  // On close: give focus back so keyboard/screen-reader users aren't dropped at <body>.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement;
    const focusable = modalRef.current?.querySelectorAll(FOCUSABLE);
    (focusable?.[0] || modalRef.current)?.focus();
    return () => { restoreFocusRef.current?.focus?.(); };
  }, [open]);

  if (!open) return null;
  // Rendered as a portal on <body>: an ancestor with a transform/filter (e.g. an
  // animated section) would otherwise trap the fixed backdrop inside its own box.
  return createPortal(
    <div className="sq-backdrop" onMouseDown={onClose}>
      <div className="sq-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={modalRef} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sq-modal-head">
          <div>
            <h3 className="sq-modal-title" id={titleId}>{title}</h3>
            {sub && <p className="sq-modal-sub">{sub}</p>}
          </div>
          <button className="sq-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Empty({ icon: Icon = Inbox, title, hint }) {
  return (
    <div className="sq-empty">
      <Icon size={22} strokeWidth={1.8} />
      <div className="sq-empty-title">{title}</div>
      {hint && <div className="sq-empty-hint">{hint}</div>}
    </div>
  );
}

export function Toasts({ items, dismiss }) {
  return (
    <div className="sq-toasts">
      {items.map((t) => (
        <div key={t.id} className={`sq-toast ${t.tone}`} onClick={() => dismiss(t.id)}>
          <span className="sq-toast-ic">
            {t.tone === "ok" ? <CheckCircle2 size={16} /> : t.tone === "crit" ? <AlertCircle size={16} /> : <Activity size={16} />}
          </span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export function Bar({ label, value, max, sub, tone = "brand" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="sq-barrow">
      <div className="sq-barrow-head"><span>{label}</span><span className="sq-mono sq-dim">{sub}</span></div>
      <div className="sq-bar-track"><div className={`sq-bar-fill ${tone}`} style={{ width: pct + "%" }} /></div>
    </div>
  );
}
