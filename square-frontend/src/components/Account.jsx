import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, X, UserRound, KeyRound, LogOut, Save } from "lucide-react";
import { ROLE_LABEL, floorsFor } from "../data/constants";
import { Section } from "./Shell";
import { Btn, Modal } from "./primitives";

/* ================================================================================= */
/*  My Account + Sign Out — shared by every dashboard                                */
/* ================================================================================= */

// Password input with a show/hide eye toggle
export function PasswordField({ label, value, onChange, autoComplete = "new-password" }) {
  const [show, setShow] = useState(false);
  return (
    <label className="sq-field"><span className="sq-label">{label}</span>
      <span className="sq-pw-wrap">
        <input className="sq-input" type={show ? "text" : "password"} value={value} required
          autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} placeholder="••••••••" />
        <button type="button" className="sq-pw-eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </label>
  );
}

export function AccountPanel({ ds, user, notify, onDone }) {
  const profile = ds.users.find((u) => u.id === user.id) || user;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  // Initialize the editable form once the directory has loaded
  useEffect(() => {
    if (profile && !form) {
      setForm({
        name: profile.name || "", dob: profile.dob || "", mobile: profile.mobile || "",
        phone: profile.phone || "", location: profile.location || "", floor: profile.floor || "",
      });
    }
  }, [profile]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const r = await ds.updateProfile(user.id, { ...form, floor: form.floor === "" ? null : Number(form.floor) });
    setSaving(false);
    notify(r.ok ? "Profile updated." : "Couldn't update the profile.", r.ok ? "ok" : "crit");
  };

  const lengthOk = next.length >= 8;
  const matches = next !== "" && next === confirm;
  const mismatch = confirm !== "" && next !== confirm;
  const canSubmit = current !== "" && lengthOk && matches && !pwBusy;

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPwError("");
    setPwBusy(true);
    const r = await ds.changePassword(user.id, current, next);
    setPwBusy(false);
    if (r.ok) {
      notify("Password updated successfully! Redirecting to dashboard...", "ok");
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(onDone, 1400);
    } else setPwError(r.error || "Couldn't update the password.");
  };

  if (!form) return null;

  const readonly = [
    ["Unique ID", profile.employeeId || "—", true],
    ["Designation", profile.jobTitle || "—", false],
    ["Department", `${profile.department || "—"}${profile.unit ? ` · ${profile.unit} unit` : ""}`, false],
    ["Role", ROLE_LABEL[profile.role] || profile.role, false],
    ["E-Mail (username)", profile.email || profile.username, false],
    ["Joined", profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString() : "—", false],
  ];

  return (
    <Section eyebrow="Your recruitment record · keep it up to date" title="My Account">
      <div className="sq-grid cols-2">
        <div className="sq-card">
          <div className="sq-pool-head"><UserRound size={16} /> Personal information</div>
          <div className="sq-account-facts">
            {readonly.map(([k, v, mono]) => (
              <div key={k} className="sq-account-fact">
                <span className="sq-eyebrow">{k}</span>
                <span className={mono ? "sq-mono" : ""}>{v}</span>
              </div>
            ))}
          </div>
          <form onSubmit={save} className="sq-form" style={{ marginTop: 14 }}>
            <label className="sq-field"><span className="sq-label">Name</span>
              <input className="sq-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Date of birth</span>
                <input className="sq-input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </label>
              <label className="sq-field"><span className="sq-label">Mobile</span>
                <input className="sq-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="e.g. +8801712345678" />
              </label>
            </div>
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Emergency contact number</span>
                <input className="sq-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +8801811223344" />
              </label>
              <label className="sq-field"><span className="sq-label">Location</span>
                <select className="sq-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value, floor: "" })}>
                  <option value="">—</option>
                  {ds.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </label>
            </div>
            {form.location && (
              <label className="sq-field"><span className="sq-label">Floor</span>
                <select className="sq-input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}>
                  <option value="">—</option>
                  {floorsFor(form.location, ds.locations).map((f) => <option key={f} value={f}>Floor {f}</option>)}
                </select>
              </label>
            )}
            <div className="sq-form-actions">
              <Btn variant="primary" type="submit" icon={Save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Btn>
            </div>
          </form>
        </div>

        <div className="sq-card">
          <div className="sq-pool-head"><KeyRound size={16} /> Change password</div>
          <form onSubmit={updatePassword} className="sq-form">
            <PasswordField label="Current / Temporary password" value={current} onChange={setCurrent} autoComplete="current-password" />
            <PasswordField label="New password" value={next} onChange={setNext} />
            <div className={`sq-pw-rule ${next === "" ? "" : lengthOk ? "ok" : "bad"}`}>
              {next !== "" && (lengthOk ? <Check size={13} /> : <X size={13} />)} At least 8 characters long
            </div>
            <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />
            {mismatch && <div className="sq-pw-rule bad"><X size={13} /> Passwords do not match.</div>}
            {pwError && <div className="sq-pw-rule bad"><X size={13} /> {pwError}</div>}
            <div className="sq-form-actions">
              <Btn variant="primary" type="submit" disabled={!canSubmit}>{pwBusy ? "Updating…" : "Update Password"}</Btn>
            </div>
          </form>
        </div>
      </div>
    </Section>
  );
}

// "Are you sure?" gate behind the Sign Out rail tab
export function SignOutModal({ open, onCancel, onConfirm }) {
  return (
    <Modal open={open} onClose={onCancel} title="Are you sure?" sub="You will be returned to the login page.">
      <div className="sq-form">
        <div className="sq-form-actions">
          <Btn type="button" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" icon={LogOut} onClick={onConfirm}>Sign out</Btn>
        </div>
      </div>
    </Modal>
  );
}
