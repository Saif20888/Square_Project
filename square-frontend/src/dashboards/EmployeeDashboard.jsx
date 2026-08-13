import { useState, useEffect } from "react";
import { Plus, Home, FileText, Search, HelpCircle, UserRound, LogOut, Clock } from "lucide-react";
import { PROBLEM_TYPES, PROBLEM_ICON, KB_ARTICLES, KB_CATEGORIES, floorsFor } from "../data/constants";
import { Shell, Section } from "../components/Shell";
import { Btn, Empty, Badge, StatusBadge, Stepper, Modal } from "../components/primitives";
import { AccountPanel, SignOutModal } from "../components/Account";
import { MyDevicesPanel } from "../components/MyDevices";

/* ----------------------------------- Employee (User) ----------------------------- */
export default function EmployeeDashboard({ ds, user, notify, onSignOut, homeTick }) {
  const [view, setView] = useState("devices");
  const [signOutOpen, setSignOutOpen] = useState(false);

  // The SQUARE logo in the top bar jumps back to Home
  useEffect(() => { if (homeTick) setView("devices"); }, [homeTick]);
  const deptNames = ds.departments.map((d) => d.name);
  const locNames = ds.locations.map((l) => l.name);
  const [open, setOpen] = useState(false);
  const emptyForm = { location: locNames[0] || "", floor: 1, department: deptNames[0] || "", problemType: PROBLEM_TYPES[0], customDescription: "", assetId: "" };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [kbSearch, setKbSearch] = useState("");
  const [kbCategory, setKbCategory] = useState("ALL");

  const myAssets = ds.assets.filter((a) => a.userId === user.id);
  const myTickets = ds.tickets.filter((t) => t.raisedByUsername === user.username);

  const setLocation = (location) => setForm((f) => ({ ...f, location, floor: 1 }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.problemType === "Other" && !form.customDescription.trim()) {
      notify("Describe the problem before submitting.", "crit"); return;
    }
    if (form.problemType === "Hardware Malfunction" && myAssets.length > 0 && !form.assetId) {
      notify("Select which of your devices is malfunctioning.", "crit"); return;
    }
    setBusy(true);
    const description = form.problemType === "Other" ? form.customDescription.trim() : form.problemType;
    const r = await ds.createTicket({
      raisedByUsername: user.username, location: form.location, floor: Number(form.floor),
      department: form.department, problemType: form.problemType, description,
      assetId: form.problemType === "Hardware Malfunction" && form.assetId ? Number(form.assetId) : null,
    });
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      setForm(emptyForm);
      setToken({ id: r.data?.id, createdAt: r.data?.createdAt || new Date().toISOString(), summary: description });
    } else notify("Couldn't submit the request.", "crit");
  };

  const kbResults = KB_ARTICLES.filter((a) => {
    if (kbCategory !== "ALL" && a.category !== kbCategory) return false;
    const q = kbSearch.trim().toLowerCase();
    if (!q) return true;
    return a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
  });

  const items = [
    { key: "devices", label: "Home", icon: Home },
    { key: "requests", label: "My requests", icon: FileText, badge: myTickets.length || null },
    { key: "knowledge", label: "Knowledge base", icon: Search },
    { key: "account", label: "My Account", icon: UserRound },
    { key: "signout", label: "Sign Out", icon: LogOut },
  ];

  const handleSelect = (k) => { if (k === "signout") setSignOutOpen(true); else setView(k); };

  return (
    <Shell items={items} active={view} onSelect={handleSelect}>
      {view === "devices" && (
        <MyDevicesPanel ds={ds} user={user} notify={notify}
          extraAction={<Btn variant="primary" icon={Plus} onClick={() => setOpen(true)}>Report an issue</Btn>} />
      )}

      {view === "requests" && (
        <Section eyebrow="Tracked end to end" title="My requests" action={<Btn variant="primary" icon={Plus} onClick={() => setOpen(true)}>Report an issue</Btn>}>
          {myTickets.length === 0 ? (
            <Empty title="No requests yet" hint="Report an issue and it will show up here with live status." />
          ) : (
            <div className="sq-stack">
              {myTickets.map((t) => {
                const Ic = PROBLEM_ICON[t.problemType] || HelpCircle;
                return (
                  <div key={t.id} className="sq-card sq-req">
                    <div className="sq-req-head">
                      <div className="sq-req-title sq-mono sq-dim">TKT-{String(t.id).padStart(6, "0")}</div>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="sq-req-meta">
                      <span className="sq-comp"><Ic size={13} strokeWidth={2.1} />{t.problemType}</span>
                      <span className="sq-cell-desc">{t.location} · Floor {t.floor} · {t.department}</span>
                      <span className="sq-comp sq-cell-desc"><Clock size={12} />{new Date(t.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="sq-req-desc">{t.description}</div>
                    <Stepper status={t.status} />
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {view === "account" && <AccountPanel ds={ds} user={user} notify={notify} onDone={() => setView("devices")} />}

      {view === "knowledge" && (
        <Section eyebrow="Self-service" title="Knowledge base">
          <div className="sq-field" style={{ marginBottom: 12 }}>
            <div className="sq-search">
              <Search size={15} />
              <input className="sq-input sq-search-input" placeholder="Search articles… e.g. Wi‑Fi, printer, VPN" value={kbSearch} onChange={(e) => setKbSearch(e.target.value)} />
            </div>
          </div>
          <div className="sq-chip-row" style={{ marginBottom: 16 }}>
            <button type="button" className={`sq-chip${kbCategory === "ALL" ? " is-on" : ""}`} onClick={() => setKbCategory("ALL")}>All topics</button>
            {KB_CATEGORIES.map((c) => (
              <button type="button" key={c} className={`sq-chip${kbCategory === c ? " is-on" : ""}`} onClick={() => setKbCategory(c)}>{c}</button>
            ))}
          </div>
          {kbResults.length === 0 ? (
            <Empty icon={Search} title="No articles match" hint="Try a different search term or topic." />
          ) : (
            <div className="sq-grid cols-2">
              {kbResults.map((a) => (
                <div key={a.id} className="sq-card sq-kb">
                  <Badge tone="brand" dot={false}>{a.category}</Badge>
                  <div className="sq-kb-title">{a.title}</div>
                  <div className="sq-cell-desc">{a.body}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Report an issue" sub="Tell us where you are and what's wrong.">
        <form onSubmit={submit} className="sq-form">
          <div className="sq-form-row">
            <label className="sq-field"><span className="sq-label">Location</span>
              <select className="sq-input" value={form.location} onChange={(e) => setLocation(e.target.value)}>
                {locNames.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="sq-field"><span className="sq-label">Floor</span>
              <select className="sq-input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}>
                {floorsFor(form.location, ds.locations).map((f) => <option key={f} value={f}>Floor {f}</option>)}
              </select>
            </label>
          </div>
          <label className="sq-field"><span className="sq-label">Department</span>
            <select className="sq-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="sq-field"><span className="sq-label">Problem</span>
            <select className="sq-input" value={form.problemType} onChange={(e) => setForm({ ...form, problemType: e.target.value, assetId: "" })}>
              {PROBLEM_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {form.problemType === "Hardware Malfunction" && (
            myAssets.length > 0 ? (
              <label className="sq-field"><span className="sq-label">Which of your devices?</span>
                <select className="sq-input" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} required>
                  <option value="">Select a device…</option>
                  {myAssets.map((a) => <option key={a.id} value={a.id}>{a.deviceType} · {a.serialNumber}</option>)}
                </select>
              </label>
            ) : (
              <div className="sq-cell-desc">You have no registered devices — the ticket will be submitted without one.</div>
            )
          )}
          {form.problemType === "Other" && (
            <label className="sq-field"><span className="sq-label">Describe the problem</span>
              <textarea className="sq-input" rows={3} value={form.customDescription} onChange={(e) => setForm({ ...form, customDescription: e.target.value })} required placeholder="Tell us what's happening." />
            </label>
          )}
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</Btn>
          </div>
        </form>
      </Modal>

      <Modal open={!!token} onClose={() => { setToken(null); setView("requests"); }} title="Request submitted" sub="Your ticket is on its way to IT.">
        {token && (
          <div className="sq-token">
            <div className="sq-token-id">TKT-{String(token.id).padStart(6, "0")}</div>
            <div className="sq-token-row"><span className="sq-eyebrow">Submitted</span><span className="sq-mono">{new Date(token.createdAt).toLocaleString()}</span></div>
            <div className="sq-token-row"><span className="sq-eyebrow">Issue</span><span>{token.summary}</span></div>
            <Btn variant="primary" onClick={() => { setToken(null); setView("requests"); }}>Done</Btn>
          </div>
        )}
      </Modal>

      <SignOutModal open={signOutOpen} onCancel={() => setSignOutOpen(false)} onConfirm={onSignOut} />
    </Shell>
  );
}
