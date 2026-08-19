import { useState, useEffect, useMemo } from "react";
import { Home, Users, Layers, Trash2, ChevronRight, FileText, Search, Radio, Mail, Phone, Briefcase, Clock, PackagePlus, Check, X, AlertTriangle, Building2, Undo2, UserPlus, UserRound, LogOut, Eye, Settings, UserCog, Crown, HardDrive, Upload, KeyRound, Copy, BarChart3, TrendingUp } from "lucide-react";
import { money, DESIGNATIONS, TOP_DESIGNATIONS, UNIQUE_DESIGNATIONS, COMMON_DESIGNATIONS, ROLE_LABEL, PENDING_ALERT_DAYS, floorsFor } from "../data/constants";
import { oversightMatrix, warrantyLedger, scrapRegistry, pendingAssignments, yearsOfService, departmentAssets, agingTickets, technicianLedger } from "../data/derived";
import { Shell, Section } from "../components/Shell";
import { Badge, Empty, StatusBadge, Btn, Modal, Bar, Donut, DonutLegend } from "../components/primitives";
import { AccountPanel, SignOutModal } from "../components/Account";
import { OnboardingForm } from "../components/Onboarding";
import { OrgPanel } from "../components/OrgPanel";
import { MyDevicesPanel } from "../components/MyDevices";
import { ImportPanel } from "../components/ImportPanel";

/* ----------------------------------- Superuser ----------------------------------- */
export default function SupervisorDashboard({ ds, user, notify, onSignOut, homeTick }) {
  const [view, setView] = useState("oversight");
  const [signOutOpen, setSignOutOpen] = useState(false);

  // The SQUARE logo in the top bar jumps back to Home
  useEffect(() => { if (homeTick) setView("oversight"); }, [homeTick]);
  const [wf, setWf] = useState("ALL");
  const [wfSearch, setWfSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [obTarget, setObTarget] = useState(null);
  const [obDecision, setObDecision] = useState("RETAIN_14_DAY");
  const [obNote, setObNote] = useState("");
  const [obPlan, setObPlan] = useState(null);
  const [obBusy, setObBusy] = useState(false);
  const [obConfirm, setObConfirm] = useState(false);
  const [scrapTarget, setScrapTarget] = useState(null);
  const [scrapReason, setScrapReason] = useState("");
  const [scrapBusy, setScrapBusy] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  // Home (live oversight): search + status filter
  const [ovSearch, setOvSearch] = useState("");
  const [ovStatus, setOvStatus] = useState("ALL");
  // Forgot-password requests: generated temp password shown once
  const [resetTemp, setResetTemp] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);
  // All Employees: search, filters, and which department group is unfolded
  const [empSearch, setEmpSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [desigFilter, setDesigFilter] = useState("ALL");
  const [openDept, setOpenDept] = useState(null);
  // "Manage employee" — the Superuser changes someone's department / designation / place of work
  const [manageTarget, setManageTarget] = useState(null);
  const [manageForm, setManageForm] = useState(null);
  const [manageBusy, setManageBusy] = useState(false);
  // "Promote" — a quick, focused designation change (department/location stay put)
  const [promoteTarget, setPromoteTarget] = useState(null);
  const [promoteDesignation, setPromoteDesignation] = useState("");
  const [promoteBusy, setPromoteBusy] = useState(false);
  // "Assign device" — the Superuser hands a stock device to an employee
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignDeviceId, setAssignDeviceId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [decideBusyId, setDecideBusyId] = useState(null);

  // Keep the oversight matrix fresh without a manual reload
  useEffect(() => {
    if (view !== "oversight") return;
    const id = setInterval(() => ds.refresh({ silent: true }), 8000);
    return () => clearInterval(id);
  }, [view, ds.refresh]);

  const oversightAll = useMemo(() => oversightMatrix(ds.tickets, ds.users), [ds.tickets, ds.users]);
  const techLedger = useMemo(() => technicianLedger(ds.tickets, ds.users), [ds.tickets, ds.users]);
  const techLedgerMax = useMemo(() => techLedger.reduce((m, r) => Math.max(m, r.assigned), 0), [techLedger]);
  const ovQ = ovSearch.trim().toLowerCase();
  const oversight = oversightAll.filter((t) => {
    if (ovStatus !== "ALL" && t.status !== ovStatus) return false;
    if (!ovQ) return true;
    return (t.raiserName || "").toLowerCase().includes(ovQ)
      || `tkt-${String(t.id).padStart(6, "0")}`.includes(ovQ)
      || String(t.id).includes(ovQ)
      || (t.problemType || "").toLowerCase().includes(ovQ)
      || (t.acceptedBy || "").toLowerCase().includes(ovQ)
      || (t.location || "").toLowerCase().includes(ovQ);
  });
  // All Employees — Users AND the IT Team (which sits under HR and Admin);
  // company leadership (Top essentials) is shown separately, view-only.
  const roster = ds.users
    .filter((u) => (u.role === "EMPLOYEE" || u.role === "IT_TECH") && !u.offboarded && !TOP_DESIGNATIONS.includes(u.jobTitle))
    .map((u) => ({ ...u, assets: ds.assets.filter((a) => a.userId === u.id && a.status !== "SCRAPPED") }));
  const topEssentials = ds.users.filter((u) => TOP_DESIGNATIONS.includes(u.jobTitle) && !u.offboarded)
    .sort((a, b) => TOP_DESIGNATIONS.indexOf(a.jobTitle) - TOP_DESIGNATIONS.indexOf(b.jobTitle));

  // Search (name / ID / department) + filters (department, designation), grouped per department
  const q = empSearch.trim().toLowerCase();
  const filtersActive = q !== "" || deptFilter !== "ALL" || desigFilter !== "ALL";
  const matchedRoster = roster.filter((p) => {
    if (deptFilter !== "ALL" && p.department !== deptFilter) return false;
    if (desigFilter !== "ALL" && p.jobTitle !== desigFilter) return false;
    if (!q) return true;
    return (p.name || "").toLowerCase().includes(q)
      || (p.employeeId || "").toLowerCase().includes(q)
      || (p.department || "").toLowerCase().includes(q)
      || p.username.toLowerCase().includes(q);
  });
  const deptNames = useMemo(() => ds.departments.map((d) => d.name), [ds.departments]);
  // Every department must hold each unique designation once and each common one
  // at least once — anything absent is flagged as missing.
  const missingFor = (deptName) => {
    const have = new Set(ds.users
      .filter((u) => !u.offboarded && u.department === deptName && !TOP_DESIGNATIONS.includes(u.jobTitle))
      .map((u) => u.jobTitle));
    return [...UNIQUE_DESIGNATIONS, ...COMMON_DESIGNATIONS].filter((d) => !have.has(d));
  };
  const deptGroups = deptNames
    .map((d) => ({ department: d, people: matchedRoster.filter((p) => p.department === d), missing: missingFor(d) }))
    .filter((g) => (filtersActive ? g.people.length > 0 : true));
  const availableDevices = ds.assets.filter((a) => a.status === "AVAILABLE_IN_POOL");
  const warrantyAll = useMemo(() => warrantyLedger(ds.assets), [ds.assets]);
  const warrantySplit = useMemo(() => {
    const active = warrantyAll.filter((a) => a.warrantyDaysRemaining > 0).length;
    return { active, expired: warrantyAll.length - active };
  }, [warrantyAll]);
  const warranty = warrantyAll.filter((a) => {
    if (wf === "ACTIVE" && !(a.warrantyDaysRemaining > 0)) return false;
    if (wf === "EXPIRED" && !(a.warrantyDaysRemaining <= 0)) return false;
    const q = wfSearch.trim().toLowerCase();
    if (!q) return true;
    return a.deviceType.toLowerCase().includes(q) || a.serialNumber.toLowerCase().includes(q);
  });
  const scrapped = useMemo(() => scrapRegistry(ds.assets), [ds.assets]);
  const pending = useMemo(() => pendingAssignments(ds.assets, ds.users), [ds.assets, ds.users]);
  const departments = useMemo(() => departmentAssets(ds.users, ds.assets, deptNames), [ds.users, ds.assets, deptNames]);
  const aging = useMemo(() => agingTickets(ds.tickets, PENDING_ALERT_DAYS), [ds.tickets]);
  const resetRequests = (ds.notifications || []).filter((n) => n.type === "PASSWORD_RESET");

  const doResetPassword = async (req) => {
    const target = ds.users.find((u) => u.username === req.employeeUsername);
    if (!target) { notify("Couldn't find that account.", "crit"); return; }
    setResetBusy(true);
    const r = await ds.resetPassword(target.id);
    setResetBusy(false);
    if (r.ok) setResetTemp({ username: r.username, tempPassword: r.tempPassword, name: target.name });
    else notify("Couldn't reset the password.", "crit");
  };

  const items = [
    { key: "oversight", label: "Home", icon: Home, badge: aging.length || null },
    { key: "employees", label: "All Employees", icon: Users },
    { key: "onboarding", label: "Employee onboarding", icon: UserPlus },
    { key: "import", label: "Import data", icon: Upload },
    { key: "approvals", label: "Device approvals", icon: PackagePlus, badge: pending.length || null },
    { key: "departments", label: "Departments", icon: Building2 },
    { key: "org", label: "Organization", icon: Settings },
    { key: "mydevices", label: "My devices", icon: HardDrive },
    { key: "warranty", label: "Warranty ledger", icon: Layers },
    { key: "scrap", label: "Scrap registry", icon: Trash2 },
    { key: "account", label: "My Account", icon: UserRound },
    { key: "signout", label: "Sign Out", icon: LogOut },
  ];

  const handleSelect = (k) => { if (k === "signout") setSignOutOpen(true); else setView(k); };

  const decide = async (asset, approve) => {
    setDecideBusyId(asset.id);
    const r = await ds.approveAssignment(asset.id, approve);
    setDecideBusyId(null);
    if (r.ok) notify(approve ? `${asset.serialNumber} assigned to ${asset.targetName}.` : `Request rejected — ${asset.serialNumber} returned to the inventory.`, "ok");
    else notify("Couldn't process the decision.", "crit");
  };

  // Nobody works without a device: an employee's LAST device can't be taken away
  // or scrapped — offboarding is the only way out.
  const wouldLeaveDeviceless = (a) => a.userId != null
    && ds.assets.filter((x) => x.userId === a.userId && x.status !== "SCRAPPED").length <= 1;

  // Superuser pulls a device back from an employee into the IT stock
  const takeOver = async (a) => {
    if (wouldLeaveDeviceless(a)) {
      notify("Error: this is the employee's only device — nobody can be left without a device unless they are offboarding.", "crit");
      return;
    }
    const r = await ds.assignAsset(a.id, null);
    notify(r.ok ? `${a.serialNumber} taken over — moved to the IT support stock.` : "Couldn't take over the device.", r.ok ? "ok" : "crit");
  };

  // Superuser assigns a stock device to an employee
  const openAssign = (person) => { setAssignTarget(person); setAssignDeviceId(""); };
  const doAssign = async () => {
    if (!assignTarget || !assignDeviceId) { notify("Pick a device to assign.", "crit"); return; }
    setAssignBusy(true);
    const r = await ds.assignAsset(Number(assignDeviceId), assignTarget.id);
    setAssignBusy(false);
    if (r.ok) { notify(`Device assigned to ${assignTarget.name}.`, "ok"); setAssignTarget(null); }
    else notify("Couldn't assign the device.", "crit");
  };

  const doScrap = async () => {
    if (!scrapTarget || !scrapReason.trim()) { notify("Add a reason before scrapping.", "crit"); return; }
    if (wouldLeaveDeviceless(scrapTarget)) {
      notify("Error: this is the employee's only device — nobody can be left without a device unless they are offboarding.", "crit");
      return;
    }
    setScrapBusy(true);
    const r = await ds.scrapAsset(scrapTarget.id, scrapReason.trim());
    setScrapBusy(false);
    if (r.ok) { notify(`${scrapTarget.serialNumber} moved to the Scrap Registry.`, "ok"); setScrapTarget(null); setScrapReason(""); }
    else notify("Couldn't scrap that asset.", "crit");
  };

  const openManage = (person) => {
    setManageTarget(person);
    setManageForm({
      department: person.department || deptNames[0] || "",
      unit: person.unit || "",
      jobTitle: person.jobTitle || "",
      location: person.location || "",
      floor: person.floor || "",
    });
  };

  const saveManage = async () => {
    if (!manageTarget) return;
    // A department can hold at most one GM / DGM / AGM / Senior Manager / Manager /
    // Deputy Manager / Assistant Manager.
    if (UNIQUE_DESIGNATIONS.includes(manageForm.jobTitle)) {
      const clash = ds.users.find((u) => u.id !== manageTarget.id && !u.offboarded
        && u.jobTitle === manageForm.jobTitle && u.department === manageForm.department);
      if (clash) {
        notify(`${manageForm.department} already has a ${manageForm.jobTitle} (${clash.name}). Only one is allowed per department.`, "crit");
        return;
      }
    }
    if (manageForm.department === "HR and Admin" && !manageForm.unit) {
      notify("Select the unit — HR and Admin is split into HR, Admin and IT.", "crit");
      return;
    }
    setManageBusy(true);
    const r = await ds.updateProfile(manageTarget.id, {
      department: manageForm.department, jobTitle: manageForm.jobTitle,
      unit: manageForm.department === "HR and Admin" ? manageForm.unit : null,
      location: manageForm.location || null, floor: manageForm.floor === "" ? null : Number(manageForm.floor),
    });
    setManageBusy(false);
    if (r.ok) { notify(`${manageTarget.name}'s position updated.`, "ok"); setManageTarget(null); }
    else notify("Couldn't update the employee.", "crit");
  };

  const openPromote = (person) => {
    setPromoteTarget(person);
    setPromoteDesignation(person.jobTitle || DESIGNATIONS[0] || "");
  };

  const savePromote = async () => {
    if (!promoteTarget || !promoteDesignation) return;
    if (promoteDesignation === promoteTarget.jobTitle) { notify("That's already their designation.", "crit"); return; }
    // Same one-per-department rule as the full Manage flow.
    if (UNIQUE_DESIGNATIONS.includes(promoteDesignation)) {
      const clash = ds.users.find((u) => u.id !== promoteTarget.id && !u.offboarded
        && u.jobTitle === promoteDesignation && u.department === promoteTarget.department);
      if (clash) {
        notify(`${promoteTarget.department} already has a ${promoteDesignation} (${clash.name}). Only one is allowed per department.`, "crit");
        return;
      }
    }
    setPromoteBusy(true);
    const r = await ds.updateProfile(promoteTarget.id, { jobTitle: promoteDesignation });
    setPromoteBusy(false);
    if (r.ok) { notify(`${promoteTarget.name} promoted to ${promoteDesignation}.`, "ok"); setPromoteTarget(null); }
    else notify("Couldn't update the employee's designation.", "crit");
  };

  const openOffboarding = async (username) => {
    setObTarget(username);
    setObDecision("RETAIN_14_DAY");
    setObNote("");
    setObPlan(null);
    const plan = await ds.getOffboardingPlan(username);
    if (plan) { setObPlan(plan); setObDecision(plan.decision); }
  };

  const obPerson = roster.find((p) => p.username === obTarget);

  const saveOffboarding = async () => {
    if (!obTarget) return;
    setObBusy(true);
    const r = await ds.submitOffboarding(obTarget, obDecision, obNote);
    setObBusy(false);
    setObConfirm(false);
    if (r.ok) {
      notify(obDecision === "RELEASE_TO_IT"
        ? "Employee offboarded — the IT Team has been notified to receive the device(s)."
        : "Employee offboarded — devices stay at the desk; IT will be notified after the 14-day hold.", "ok");
      setObTarget(null); setObPlan(null);
    } else notify("Couldn't save the offboarding plan.", "crit");
  };

  return (
    <Shell items={items} active={view} onSelect={handleSelect}>
        {view === "oversight" && (
          <Section eyebrow="Who raised it, who's fixing it" title="Live oversight" action={
            <div className="sq-warranty-actions">
              <div className="sq-search sq-search-sm">
                <Search size={14} />
                <input className="sq-input sq-search-input" placeholder="Search ticket, employee, problem…" value={ovSearch} onChange={(e) => setOvSearch(e.target.value)} />
              </div>
              <select className="sq-input" style={{ width: "auto" }} value={ovStatus} onChange={(e) => setOvStatus(e.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="SOLVING">Solving</option>
                <option value="CLOSED">Resolved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <Badge tone="brand"><Radio size={11} style={{ marginRight: 2 }} />Auto-refreshing</Badge>
            </div>
          }>
            {ds.importLogs?.length > 0 && (
              <div className="sq-card" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 16px" }}>
                <Upload size={15} style={{ color: "var(--brand)", flex: "none" }} />
                <span style={{ fontSize: 13 }}>
                  Last import: <strong>{ds.importLogs[0].fileName}</strong>
                  <span className="sq-cell-desc" style={{ display: "inline", marginLeft: 8 }}>
                    {ds.importLogs[0].recordsAdded} record{ds.importLogs[0].recordsAdded === 1 ? "" : "s"} · {new Date(ds.importLogs[0].createdAt).toLocaleString()}
                  </span>
                </span>
                <Badge tone={ds.importLogs[0].status === "Success" ? "ok" : ds.importLogs[0].status === "Failed" ? "crit" : "brand"} dot={false}>{ds.importLogs[0].status}</Badge>
                <span style={{ marginLeft: "auto" }}>
                  <Btn size="sm" icon={Upload} onClick={() => setView("import")}>Import & history</Btn>
                </span>
              </div>
            )}
            {resetRequests.length > 0 && (
              <div className="sq-card" style={{ marginBottom: 16 }}>
                <div className="sq-pool-head"><KeyRound size={15} /> Password reset requests</div>
                <div className="sq-stack" style={{ gap: 8 }}>
                  {resetRequests.map((req) => (
                    <div key={req.id} className="sq-roster-asset">
                      <span className="sq-cell-desc" style={{ flex: 1 }}>{req.message}</span>
                      <Btn size="sm" variant="primary" icon={KeyRound} onClick={() => doResetPassword(req)} disabled={resetBusy}>
                        {resetBusy ? "Resetting…" : "Generate temp password"}
                      </Btn>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aging.length > 0 && !alertDismissed && (
              <div className="sq-card" style={{ marginBottom: 16, borderColor: "#E8112D55" }}>
                <button className="sq-icon-btn" onClick={() => setAlertDismissed(true)} aria-label="Dismiss alert"
                  style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28 }}>
                  <X size={15} />
                </button>
                <div className="sq-comp" style={{ fontWeight: 600, marginBottom: 8, paddingRight: 36 }}>
                  <AlertTriangle size={15} color="var(--crit-ink)" />
                  <span className="sq-neg">{aging.length} request{aging.length === 1 ? "" : "s"} pending {PENDING_ALERT_DAYS}+ days — contact the IT Team</span>
                </div>
                <div className="sq-stack" style={{ gap: 6 }}>
                  {aging.map((t) => (
                    <div key={t.id} className="sq-cell-desc">
                      <span className="sq-mono sq-dim">TKT-{String(t.id).padStart(6, "0")}</span> · {t.problemType} · {t.location} · pending <strong className="sq-neg">{t.daysPending} days</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {techLedger.length > 0 && (
              <div className="sq-card" style={{ marginBottom: 16 }}>
                <div className="sq-pool-head"><BarChart3 size={16} /> IT Team productivity</div>
                {techLedger.slice(0, 6).map((row) => (
                  <Bar key={row.username} label={row.name} value={row.solved} max={techLedgerMax || 1}
                    sub={`${row.solved} solved · ${row.active} active / ${row.assigned} total`}
                    tone={row.active > 0 ? "brand" : "ok"} />
                ))}
              </div>
            )}
            <div className="sq-card sq-table-card">
              {oversight.length === 0 ? <Empty icon={Eye} title="No tickets yet" /> : (
                <table className="sq-table">
                  <thead><tr><th>Ticket</th><th>Submitted</th><th>Employee</th><th>Problem</th><th>IT Team member</th><th>Status</th></tr></thead>
                  <tbody>
                    {oversight.map((t) => (
                      <tr key={t.id}>
                        <td className="sq-mono sq-dim">TKT-{String(t.id).padStart(6, "0")}</td>
                        <td className="sq-mono sq-dim">{new Date(t.createdAt).toLocaleString()}</td>
                        <td className="sq-cell-strong">{t.raiserName}</td>
                        <td>{t.problemType}</td>
                        <td>{t.acceptedBy || <span className="sq-dim">Unassigned</span>}</td>
                        <td><StatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "employees" && (
          <Section eyebrow="Everyone in the company · Employee ID, department and custody" title="All Employees"
            action={
              <div className="sq-warranty-actions">
                <div className="sq-search sq-search-sm">
                  <Search size={14} />
                  <input className="sq-input sq-search-input" placeholder="Search name, ID or department…" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} />
                </div>
                <select className="sq-input" style={{ width: "auto" }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                  <option value="ALL">All departments</option>
                  {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="sq-input" style={{ width: "auto" }} value={desigFilter} onChange={(e) => setDesigFilter(e.target.value)}>
                  <option value="ALL">All designations</option>
                  {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            }>
            <div className="sq-grid cols-2">
              {deptGroups.length === 0 && topEssentials.length === 0 ? (
                <Empty icon={Users} title="No matching employees" hint="Try a different search or filter." />
              ) : (
                <div className="sq-stack">
                  {!filtersActive && topEssentials.length > 0 && (
                    <div className="sq-card sq-roster-card">
                      <button type="button" className="sq-roster-toggle" onClick={() => setOpenDept(openDept === "__TOP__" ? null : "__TOP__")}>
                        <span className="sq-avatar lg"><Crown size={19} /></span>
                        <span className="sq-roster-toggle-text">
                          <span className="sq-cell-strong">Top essentials</span>
                          <span className="sq-cell-desc">{topEssentials.length} member{topEssentials.length === 1 ? "" : "s"} · view only</span>
                        </span>
                        <Badge tone="brand" dot={false}>{topEssentials.length}</Badge>
                        <ChevronRight size={16} className={`sq-chev${openDept === "__TOP__" ? " is-open" : ""}`} />
                      </button>
                      {openDept === "__TOP__" && (
                        <div className="sq-roster-body">
                          {topEssentials.map((t) => {
                            const initials = (t.name || t.username).split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
                            return (
                              <div key={t.username} className="sq-roster-asset">
                                <span className="sq-avatar lg">{initials}</span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <div className="sq-cell-strong">{t.name} <span className="sq-mono sq-dim">· {t.employeeId || "—"}</span></div>
                                  <div className="sq-cell-desc">{t.jobTitle} · {t.email || "—"} · <span className="sq-mono">{t.phone || "—"}</span></div>
                                </span>
                                <Badge tone="neutral" dot={false}>{t.jobTitle}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {deptGroups.map((g) => {
                    const deptOpen = filtersActive || openDept === g.department;
                    return (
                      <div key={g.department} className="sq-card sq-roster-card">
                        <button type="button" className="sq-roster-toggle" onClick={() => setOpenDept(openDept === g.department ? null : g.department)}>
                          <span className="sq-avatar lg" style={{ background: "#E7F6EC", color: "var(--brand-ink)" }}><Building2 size={19} /></span>
                          <span className="sq-roster-toggle-text">
                            <span className="sq-cell-strong">{g.department}</span>
                            <span className="sq-cell-desc">{g.people.length} employee{g.people.length === 1 ? "" : "s"}</span>
                          </span>
                          {g.missing.length > 0 && <Badge tone="crit" dot={false}>{g.missing.length} role{g.missing.length === 1 ? "" : "s"} missing</Badge>}
                          <Badge tone={g.people.length ? "brand" : "neutral"} dot={false}>{g.people.length}</Badge>
                          <ChevronRight size={16} className={`sq-chev${deptOpen ? " is-open" : ""}`} />
                        </button>
                        {deptOpen && (
                          <div className="sq-roster-body">
                            {g.missing.length > 0 && (
                              <div className="sq-comp" style={{ alignItems: "flex-start" }}>
                                <AlertTriangle size={14} color="var(--crit-ink)" style={{ flex: "none", marginTop: 2 }} />
                                <span className="sq-neg" style={{ fontSize: 12.5 }}>
                                  Every department must have each of these — missing: {g.missing.join(", ")}.
                                </span>
                              </div>
                            )}
                            {g.people.length === 0 ? (
                              <div className="sq-cell-desc">No employees in this department.</div>
                            ) : g.people.map((person) => {
                              const isOpen = expanded === person.username;
                              const initials = (person.name || person.username).split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
                              const years = yearsOfService(person.joinedAt);
                              return (
                                <div key={person.username} className="sq-card sq-roster-card">
                                  <button type="button" className="sq-roster-toggle" onClick={() => setExpanded(isOpen ? null : person.username)}>
                                    <span className="sq-avatar lg">{initials}</span>
                                    <span className="sq-roster-toggle-text">
                                      <span className="sq-cell-strong">{person.name || person.username} <span className="sq-mono sq-dim">· {person.employeeId || "—"}</span></span>
                                      <span className="sq-cell-desc">{person.unit ? `${person.unit} unit · ` : person.role === "IT_TECH" ? `${ROLE_LABEL.IT_TECH} · ` : ""}{person.jobTitle || "—"} · {person.assets.length} asset{person.assets.length === 1 ? "" : "s"}{years != null ? ` · ${years < 1 ? "under a year" : `${years} year${years === 1 ? "" : "s"}`} at SQUARE` : ""}</span>
                                    </span>
                                    {person.assets.length === 0 && <Badge tone="crit">No device</Badge>}
                                    <ChevronRight size={16} className={`sq-chev${isOpen ? " is-open" : ""}`} />
                                  </button>
                                  {isOpen && (
                          <div className="sq-roster-body">
                            <div className="sq-cell-desc" style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginBottom: 10 }}>
                              {person.email && <span className="sq-comp"><Mail size={12} />{person.email}</span>}
                              {person.phone && <span className="sq-comp"><Phone size={12} /><span className="sq-mono">{person.phone}</span></span>}
                              {person.officialNumber && <span className="sq-comp"><Briefcase size={12} /><span className="sq-mono">{person.officialNumber}</span></span>}
                              {person.joinedAt && <span className="sq-comp"><Clock size={12} />Since {new Date(person.joinedAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })}</span>}
                            </div>
                            {person.assets.length === 0 ? (
                              <div className="sq-cell-desc">No hardware currently assigned.</div>
                            ) : (
                              <div className="sq-roster-assets">
                                {person.assets.map((a) => {
                                  const ok = a.warrantyDaysRemaining > 0;
                                  return (
                                    <div key={a.id} className="sq-roster-asset">
                                      <span className="sq-mono">{a.serialNumber}</span>
                                      <span className="sq-cell-desc sq-roster-asset-type">{a.deviceType}</span>
                                      <Badge tone={ok ? "ok" : "warn"}>{ok ? "Device under warranty" : "Warranty expired"}</Badge>
                                      <span className="sq-row-actions" style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                                        <Btn size="sm" icon={Undo2} onClick={() => takeOver(a)}>Take over</Btn>
                                        <Btn size="sm" variant="danger" icon={Trash2} onClick={() => { setScrapTarget(a); setScrapReason(""); }}>Scrap</Btn>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {person.assets.length === 0 && (
                              <div className="sq-comp">
                                <AlertTriangle size={14} color="var(--crit-ink)" />
                                <span className="sq-neg" style={{ fontSize: 12.5 }}>Error: nobody works without a device — assign one now or start offboarding.</span>
                              </div>
                            )}
                            <div className="sq-row-actions" style={{ justifyContent: "flex-start" }}>
                              <Btn size="sm" icon={HardDrive} onClick={() => openAssign(person)}>Assign device</Btn>
                              <Btn size="sm" icon={TrendingUp} onClick={() => openPromote(person)}>Promote</Btn>
                              <Btn size="sm" icon={UserCog} onClick={() => openManage(person)}>Manage</Btn>
                              <Btn size="sm" icon={FileText} onClick={() => openOffboarding(person.username)}>Start offboarding</Btn>
                            </div>
                                  </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="sq-card sq-offboard">
                {obTarget ? (
                  <>
                    <div className="sq-offboard-head"><FileText size={15} /> Offboarding — {obPerson?.name || obTarget} <span className="sq-mono sq-dim">{obPerson?.employeeId || ""}</span></div>
                    {obPlan && (
                      <p className="sq-cell-desc">
                        Current plan: <strong>{obPlan.decision === "RETAIN_14_DAY" ? "Keep at desk (14-day hold)" : "Released to IT"}</strong>
                        {obPlan.createdAt ? ` · set ${new Date(obPlan.createdAt).toLocaleDateString()}` : ""}
                      </p>
                    )}
                    <p className="sq-cell-desc">Choose how custody is handled. The IT Team is notified — instantly for a release, after 14 days for a desk hold.</p>
                    <label className="sq-radio"><input type="radio" name="ob" checked={obDecision === "RETAIN_14_DAY"} onChange={() => setObDecision("RETAIN_14_DAY")} /><span><strong>Keep at desk</strong> — 14-day hold, then IT collects</span></label>
                    <label className="sq-radio"><input type="radio" name="ob" checked={obDecision === "RELEASE_TO_IT"} onChange={() => setObDecision("RELEASE_TO_IT")} /><span><strong>Return now</strong> — IT is notified instantly</span></label>
                    <input className="sq-input" placeholder="Optional note" value={obNote} onChange={(e) => setObNote(e.target.value)} />
                    <Btn variant="primary" onClick={() => setObConfirm(true)} disabled={obBusy}>Offboard employee</Btn>
                  </>
                ) : (
                  <Empty icon={FileText} title="No one selected" hint="Pick 'Start offboarding' on an employee to set their custody plan." />
                )}
              </div>
            </div>
          </Section>
        )}

        {view === "onboarding" && <OnboardingForm ds={ds} user={user} notify={notify} />}

        {view === "org" && <OrgPanel ds={ds} notify={notify} />}

        {view === "import" && <ImportPanel ds={ds} notify={notify} user={user} />}

        {view === "mydevices" && <MyDevicesPanel ds={ds} user={user} notify={notify} />}

        {view === "account" && <AccountPanel ds={ds} user={user} notify={notify} onDone={() => setView("oversight")} />}

        {view === "approvals" && (
          <Section eyebrow="New-device assignments requested by IT" title="Device approvals">
            {pending.length === 0 ? (
              <Empty icon={PackagePlus} title="Nothing to approve" hint="When IT requests a new device for an employee, it lands here for your acceptance." />
            ) : (
              <div className="sq-stack">
                {pending.map((a) => (
                  <div key={a.id} className="sq-card sq-approval">
                    <div className="sq-approval-main">
                      <div className="sq-approval-top">
                        <span className="sq-mono sq-dim">{a.serialNumber}</span>
                        <Badge tone="warn">Awaiting acceptance</Badge>
                      </div>
                      <div className="sq-approval-title">{a.deviceType} · {money(a.originalValue)}</div>
                      <div className="sq-cell-desc">New device from inventory for <strong>{a.targetName}</strong>{a.specifications ? ` · ${a.specifications}` : ""}</div>
                    </div>
                    <div className="sq-approval-actions">
                      <Btn variant="success" size="sm" icon={Check} onClick={() => decide(a, true)} disabled={decideBusyId === a.id}>Accept</Btn>
                      <Btn variant="danger" size="sm" icon={X} onClick={() => decide(a, false)} disabled={decideBusyId === a.id}>Reject</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {view === "departments" && (
          <Section eyebrow="Devices held per department · condition at a glance" title="Departments">
            <div className="sq-card sq-table-card">
              <table className="sq-table">
                <thead><tr><th>Department</th><th>Devices</th><th>Under warranty</th><th>Expired</th><th>In repair</th><th>Missing designations</th></tr></thead>
                <tbody>
                  {departments.map((d) => {
                    const missing = missingFor(d.department);
                    return (
                      <tr key={d.department}>
                        <td className="sq-cell-strong">{d.department}</td>
                        <td className="sq-mono">{d.total}</td>
                        <td className="sq-mono sq-pos">{d.underWarranty}</td>
                        <td className={`sq-mono${d.expired ? " sq-neg" : ""}`}>{d.expired}</td>
                        <td className={`sq-mono${d.inRepair ? " sq-warnt" : ""}`}>{d.inRepair}</td>
                        <td>{missing.length === 0
                          ? <Badge tone="ok">Complete</Badge>
                          : <span className="sq-neg" style={{ fontSize: 12 }}>{missing.join(", ")}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {view === "warranty" && (
          <Section eyebrow="Company-wide" title="Warranty & inventory ledger"
            action={
              <div className="sq-warranty-actions">
                <div className="sq-search sq-search-sm">
                  <Search size={14} />
                  <input className="sq-input sq-search-input" placeholder="Search device or serial…" value={wfSearch} onChange={(e) => setWfSearch(e.target.value)} />
                </div>
                <div className="sq-segment">
                  <button className={wf === "ALL" ? "is-on" : ""} onClick={() => setWf("ALL")}>All</button>
                  <button className={wf === "ACTIVE" ? "is-on" : ""} onClick={() => setWf("ACTIVE")}>Active</button>
                  <button className={wf === "EXPIRED" ? "is-on" : ""} onClick={() => setWf("EXPIRED")}>Expired</button>
                </div>
              </div>
            }>
            {warrantyAll.length > 0 && (
              <div className="sq-card" style={{ marginBottom: 16 }}>
                <div className="sq-pool-head"><Layers size={16} /> Warranty coverage</div>
                <div className="sq-donut-row">
                  <Donut data={[
                    { label: "Under warranty", value: warrantySplit.active, tone: "ok" },
                    { label: "Expired", value: warrantySplit.expired, tone: "crit" },
                  ]} centerValue={warrantyAll.length} centerLabel="devices" />
                  <DonutLegend data={[
                    { label: "Under warranty", value: warrantySplit.active, tone: "ok" },
                    { label: "Expired", value: warrantySplit.expired, tone: "crit" },
                  ]} />
                </div>
              </div>
            )}
            <div className="sq-card sq-table-card">
              {warranty.length === 0 ? <Empty icon={Layers} title="No matching assets" /> : (
                <table className="sq-table">
                  <thead><tr><th>Serial</th><th>Device</th><th>Value</th><th>Warranty</th></tr></thead>
                  <tbody>
                    {warranty.map((a) => (
                      <tr key={a.id}>
                        <td className="sq-mono">{a.serialNumber}</td>
                        <td className="sq-cell-strong">{a.deviceType}</td>
                        <td className="sq-mono">{money(a.originalValue)}</td>
                        <td className={a.warrantyDaysRemaining > 0 ? "sq-pos sq-mono" : "sq-neg sq-mono"}>{a.warrantyDaysRemaining > 0 ? `${a.warrantyDaysRemaining} days` : "Expired"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "scrap" && (
          <Section eyebrow="Decommissioned" title="Scrap registry">
            <div className="sq-card sq-table-card">
              {scrapped.length === 0 ? <Empty icon={Trash2} title="Nothing scrapped" hint="Decommissioned hardware will be listed here." /> : (
                <table className="sq-table">
                  <thead><tr><th>Serial</th><th>Device</th><th>Value</th><th>Reason</th><th>Scrapped</th></tr></thead>
                  <tbody>
                    {scrapped.map((a) => (
                      <tr key={a.id}>
                        <td className="sq-mono">{a.serialNumber}</td>
                        <td className="sq-cell-strong">{a.deviceType}</td>
                        <td className="sq-mono">{money(a.originalValue)}</td>
                        <td className="sq-cell-desc">{a.scrapReason || "—"}</td>
                        <td className="sq-mono sq-dim">{a.scrappedAt || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

      {/* Are-you-sure gate before an employee is offboarded */}
      <Modal open={obConfirm} onClose={() => setObConfirm(false)} title="Are you sure?"
        sub={obPerson ? `${obPerson.name} · ${obPerson.employeeId || ""} · ${obPerson.department || ""}` : ""}>
        <div className="sq-form">
          <p className="sq-cell-desc">
            You are about to offboard <strong>{obPerson?.name || obTarget}</strong>. They will be removed from the roster and
            {obDecision === "RELEASE_TO_IT"
              ? " the IT Team will be notified immediately to receive their device(s)."
              : " their device(s) stay at the desk — the IT Team will be reminded to collect them after 14 days."}
          </p>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setObConfirm(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={saveOffboarding} disabled={obBusy}>{obBusy ? "Offboarding…" : "Yes, offboard"}</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!scrapTarget} onClose={() => setScrapTarget(null)} title="Scrap this device?" sub={scrapTarget ? `${scrapTarget.serialNumber} · ${scrapTarget.deviceType}` : ""}>
        <div className="sq-form">
          <label className="sq-field"><span className="sq-label">Reason</span>
            <textarea className="sq-input" rows={3} value={scrapReason} onChange={(e) => setScrapReason(e.target.value)} placeholder="Why is this device being decommissioned?" />
          </label>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setScrapTarget(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={doScrap} disabled={scrapBusy}>{scrapBusy ? "Scrapping…" : "Scrap device"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Superuser manages an employee's department, designation and place of work */}
      <Modal open={!!manageTarget} onClose={() => setManageTarget(null)} title="Manage employee"
        sub={manageTarget ? `${manageTarget.name} · ${manageTarget.employeeId || ""}` : ""}>
        {manageForm && (
          <div className="sq-form">
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Department</span>
                <select className="sq-input" value={manageForm.department} onChange={(e) => setManageForm({ ...manageForm, department: e.target.value, unit: "" })}>
                  {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="sq-field"><span className="sq-label">Designation</span>
                <select className="sq-input" value={manageForm.jobTitle} onChange={(e) => setManageForm({ ...manageForm, jobTitle: e.target.value })}>
                  <option value="">—</option>
                  {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>
            {manageForm.department === "HR and Admin" && (
              <label className="sq-field"><span className="sq-label">Unit (HR and Admin has three)</span>
                <select className="sq-input" value={manageForm.unit} onChange={(e) => setManageForm({ ...manageForm, unit: e.target.value })}>
                  <option value="">Select a unit…</option>
                  <option value="HR">HR</option>
                  <option value="Admin">Admin</option>
                  <option value="IT">IT</option>
                </select>
              </label>
            )}
            <div className="sq-form-row">
              <label className="sq-field"><span className="sq-label">Office</span>
                <select className="sq-input" value={manageForm.location} onChange={(e) => setManageForm({ ...manageForm, location: e.target.value, floor: "" })}>
                  <option value="">—</option>
                  {ds.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </label>
              <label className="sq-field"><span className="sq-label">Floor</span>
                <select className="sq-input" value={manageForm.floor} onChange={(e) => setManageForm({ ...manageForm, floor: e.target.value })} disabled={!manageForm.location}>
                  <option value="">—</option>
                  {floorsFor(manageForm.location, ds.locations).map((f) => <option key={f} value={f}>Floor {f}</option>)}
                </select>
              </label>
            </div>
            <div className="sq-form-actions">
              <Btn type="button" onClick={() => setManageTarget(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={saveManage} disabled={manageBusy}>{manageBusy ? "Saving…" : "Save changes"}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Superuser promotes an employee — a focused designation-only change */}
      <Modal open={!!promoteTarget} onClose={() => setPromoteTarget(null)} title="Promote employee"
        sub={promoteTarget ? `${promoteTarget.name} · ${promoteTarget.employeeId || ""} · currently ${promoteTarget.jobTitle || "—"}` : ""}>
        {promoteTarget && (
          <div className="sq-form">
            <label className="sq-field"><span className="sq-label">New designation</span>
              <select className="sq-input" value={promoteDesignation} onChange={(e) => setPromoteDesignation(e.target.value)} autoFocus>
                {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <p className="sq-cell-desc">Department and place of work stay the same — use Manage instead for a transfer.</p>
            <div className="sq-form-actions">
              <Btn type="button" onClick={() => setPromoteTarget(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={savePromote} disabled={promoteBusy}>{promoteBusy ? "Saving…" : "Confirm promotion"}</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Superuser assigns a stock device to an employee */}
      <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)} title="Assign a device"
        sub={assignTarget ? `${assignTarget.name} · ${assignTarget.employeeId || ""}` : ""}>
        <div className="sq-form">
          <label className="sq-field"><span className="sq-label">Device from IT support stock</span>
            {availableDevices.length === 0 ? (
              <span className="sq-cell-desc">The stock is empty — add a device from the Organization tab first.</span>
            ) : (
              <select className="sq-input" value={assignDeviceId} onChange={(e) => setAssignDeviceId(e.target.value)} autoFocus>
                <option value="">Select a device…</option>
                {availableDevices.map((a) => (
                  <option key={a.id} value={a.id}>{a.deviceType} · {a.serialNumber} ({a.poolCondition === "NEW" ? "New" : a.poolCondition === "REPAIRED" ? "Repaired" : "Used"})</option>
                ))}
              </select>
            )}
          </label>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setAssignTarget(null)}>Cancel</Btn>
            <Btn variant="primary" icon={HardDrive} onClick={doAssign} disabled={assignBusy || !assignDeviceId}>{assignBusy ? "Assigning…" : "Assign device"}</Btn>
          </div>
        </div>
      </Modal>

      {/* One-time display of the generated temporary password */}
      <Modal open={!!resetTemp} onClose={() => setResetTemp(null)} title="Temporary password generated"
        sub={resetTemp ? `Hand this to ${resetTemp.name || resetTemp.username} in person — it is shown only once.` : ""}>
        {resetTemp && (
          <div className="sq-form">
            <div className="sq-token" style={{ textAlign: "left" }}>
              <div className="sq-token-row"><span className="sq-eyebrow">Username</span><span className="sq-mono">{resetTemp.username}</span></div>
              <div className="sq-token-row"><span className="sq-eyebrow">Temporary password</span><span className="sq-mono">{resetTemp.tempPassword}</span></div>
            </div>
            <p className="sq-cell-desc">They sign in with it and set their own password from My Account.</p>
            <div className="sq-form-actions">
              <Btn icon={Copy} onClick={() => { navigator.clipboard?.writeText(`${resetTemp.username} -> ${resetTemp.tempPassword}`); notify("Copied.", "ok"); }}>Copy</Btn>
              <Btn variant="primary" onClick={() => setResetTemp(null)}>Done</Btn>
            </div>
          </div>
        )}
      </Modal>

      <SignOutModal open={signOutOpen} onCancel={() => setSignOutOpen(false)} onConfirm={onSignOut} />
    </Shell>
  );
}
