import { useState, useEffect, useMemo } from "react";
import { Inbox, Home, Wrench, ClipboardList, Boxes, FileText, UserCheck, X, Check, PackageCheck, PackagePlus, Hammer, Trash2, HelpCircle, ShieldCheck, ShieldOff, Send, Bell, CalendarDays, Download, UserRound, LogOut, Search, HardDrive } from "lucide-react";
import { PROBLEM_ICON, money, REPAIR_SHOP_WARRANTY, REPAIR_SHOP_TRUSTED, STORAGE_LOCATIONS } from "../data/constants";
import { poolSummary, loanerLedger, technicianLedger, repairLog, pendingAssignments, scrapRegistry, monthlyRecords, monthLabel } from "../data/derived";
import { Shell, Section } from "../components/Shell";
import { Empty, Btn, Modal, Bar, Badge } from "../components/primitives";
import { AccountPanel, SignOutModal } from "../components/Account";
import { MyDevicesPanel } from "../components/MyDevices";

/* ----------------------------------- IT Team ------------------------------------- */
export default function TechDashboard({ ds, user, notify, onSignOut, homeTick }) {
  const [view, setView] = useState("queue");
  const [signOutOpen, setSignOutOpen] = useState(false);

  // The SQUARE logo in the top bar jumps back to Home
  useEffect(() => { if (homeTick) setView("queue"); }, [homeTick]);
  const [scrapTarget, setScrapTarget] = useState(null);
  const [scrapReason, setScrapReason] = useState("");
  const [scrapBusy, setScrapBusy] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [acceptedBy, setAcceptedBy] = useState("");
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [rejectBusyId, setRejectBusyId] = useState(null);

  // Hardware-malfunction resolve flow: fixed -> return to employee;
  // not fixed -> issue a loaner + route to a repair shop by warranty.
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveStep, setResolveStep] = useState("ask"); // ask | notfixed
  const [faultyId, setFaultyId] = useState("");
  const [loanerId, setLoanerId] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);

  // "Device returned" flow on the Repair log. Trusted shop: fixed -> back to the
  // employee, not fixed -> scrap + new inventory device. Original shop (warranty):
  // fixed & returned, or a brand-new replacement received under warranty.
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnStep, setReturnStep] = useState("ask"); // ask | replace | warranty
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [returnBusy, setReturnBusy] = useState(false);

  // Employee assign pool: confirm popup showing how many days the loaner was out
  const [loanerReturn, setLoanerReturn] = useState(null);
  const [loanerBusy, setLoanerBusy] = useState(false);

  // Offboarding notifications: receive a device and pick where to store it
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [storage, setStorage] = useState(STORAGE_LOCATIONS[0]);
  const [receiveBusy, setReceiveBusy] = useState(false);

  // Monthly records: which month to show / print
  const [recordMonth, setRecordMonth] = useState("");

  // IT support stock: device explorer (search + availability / in-use filters)
  const [devSearch, setDevSearch] = useState("");
  const [devFilter, setDevFilter] = useState("ALL"); // ALL | AVAILABLE | IN_USE
  const [availCond, setAvailCond] = useState("ALL"); // ALL | New | Used | Repaired
  const [useDept, setUseDept] = useState("ALL");

  // Keep the incoming queue and the notification inbox fresh without a manual reload
  useEffect(() => {
    if (view !== "queue" && view !== "notifications") return;
    const id = setInterval(() => ds.refresh({ silent: true }), 8000);
    return () => clearInterval(id);
  }, [view, ds.refresh]);

  const openQueue = ds.tickets.filter((t) => t.status === "OPEN").sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const solving = ds.tickets.filter((t) => t.status === "SOLVING").sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const pool = useMemo(() => poolSummary(ds.assets), [ds.assets]);
  // Inventory = brand-new stock only; the loaner pool holds used, repaired and old devices.
  const inventoryAssets = ds.assets.filter((a) => a.status === "AVAILABLE_IN_POOL" && a.poolCondition === "NEW");
  const loanerPoolAssets = ds.assets.filter((a) => a.status === "AVAILABLE_IN_POOL" && a.poolCondition !== "NEW");
  const loaners = useMemo(() => loanerLedger(ds.assets, ds.users), [ds.assets, ds.users]);
  const ledger = useMemo(() => technicianLedger(ds.tickets, ds.users), [ds.tickets, ds.users]);
  const repairs = useMemo(() => repairLog(ds.assets, ds.users), [ds.assets, ds.users]);
  const pending = useMemo(() => pendingAssignments(ds.assets, ds.users), [ds.assets, ds.users]);
  const scrapped = useMemo(() => scrapRegistry(ds.assets), [ds.assets]);
  const techNames = ds.users.filter((u) => u.role === "IT_TECH").map((u) => u.name);
  // Device notifications only — password-reset requests belong to the Superuser
  const notifs = (ds.notifications || []).filter((n) => n.type !== "PASSWORD_RESET").map((n) => {
    const dueInDays = n.dueAt ? Math.ceil((new Date(n.dueAt).getTime() - Date.now()) / 86400000) : 0;
    return { ...n, dueInDays, due: dueInDays <= 0 };
  });
  const dueNotifs = notifs.filter((n) => n.due);
  const records = useMemo(() => monthlyRecords(ds.tickets, ds.users), [ds.tickets, ds.users]);
  const activeMonth = recordMonth || records.months[0] || "";
  const monthRows = records.rows[activeMonth] || [];

  // The device explorer inside IT support stock
  const explorerRows = ds.assets
    .filter((a) => a.status === "AVAILABLE_IN_POOL" || a.status === "ALLOCATED_IN_USE")
    .map((a) => {
      const holder = a.userId != null ? ds.users.find((u) => u.id === a.userId) : null;
      const cond = a.status === "AVAILABLE_IN_POOL"
        ? (a.poolCondition === "NEW" ? "New" : a.poolCondition === "REPAIRED" ? "Repaired" : "Used")
        : null;
      return { ...a, holder, cond };
    })
    .filter((r) => {
      if (devFilter === "AVAILABLE") {
        if (r.status !== "AVAILABLE_IN_POOL") return false;
        if (availCond !== "ALL" && r.cond !== availCond) return false;
      }
      if (devFilter === "IN_USE") {
        if (r.status !== "ALLOCATED_IN_USE") return false;
        if (useDept !== "ALL" && (r.holder?.department || r.department) !== useDept) return false;
      }
      const q = devSearch.trim().toLowerCase();
      if (!q) return true;
      return r.serialNumber.toLowerCase().includes(q)
        || (r.deviceType || "").toLowerCase().includes(q)
        || (r.holder?.name || "").toLowerCase().includes(q);
    });

  const items = [
    { key: "queue", label: "Home", icon: Home, badge: openQueue.length || null },
    { key: "notifications", label: "Notifications", icon: Bell, badge: dueNotifs.length || null },
    { key: "solving", label: "Being solved", icon: Wrench, badge: solving.length || null },
    { key: "repairs", label: "Repair log", icon: Hammer, badge: repairs.length || null },
    { key: "ledger", label: "Ledger", icon: ClipboardList },
    { key: "records", label: "Monthly records", icon: CalendarDays },
    { key: "pool", label: "IT support stock", icon: Boxes, badge: pending.length || null },
    { key: "loaners", label: "Employee assign pool", icon: FileText, badge: loaners.length || null },
    { key: "mydevices", label: "My devices", icon: HardDrive },
    { key: "scrap", label: "Scrap", icon: Trash2 },
    { key: "account", label: "My Account", icon: UserRound },
    { key: "signout", label: "Sign Out", icon: LogOut },
  ];

  const handleSelect = (k) => { if (k === "signout") setSignOutOpen(true); else setView(k); };

  const openAccept = (t) => {
    setAcceptTarget(t);
    setAcceptedBy(techNames.includes(user?.name) ? user.name : (techNames[0] || ""));
  };
  const doAccept = async () => {
    if (!acceptTarget || !acceptedBy) { notify("Pick who's accepting this ticket.", "crit"); return; }
    setAcceptBusy(true);
    const r = await ds.acceptTicket(acceptTarget.id, acceptedBy);
    setAcceptBusy(false);
    if (r.ok) { notify("Ticket accepted — status set to Solving.", "ok"); setAcceptTarget(null); }
    else notify("Couldn't accept the ticket.", "crit");
  };
  const doReject = async (id) => {
    setRejectBusyId(id);
    const r = await ds.reject(id);
    setRejectBusyId(null);
    notify(r.ok ? "Ticket rejected." : "Couldn't reject.", r.ok ? "ok" : "crit");
  };

  // Employee assign pool: the popup states how many days the device was out
  const confirmLoanerReturn = async () => {
    if (!loanerReturn) return;
    setLoanerBusy(true);
    const r = await ds.assignAsset(loanerReturn.id, null);
    setLoanerBusy(false);
    if (r.ok) { notify(`${loanerReturn.serialNumber} returned after ${loanerReturn.daysOut} day${loanerReturn.daysOut === 1 ? "" : "s"}.`, "ok"); setLoanerReturn(null); }
    else notify("Couldn't update the device.", "crit");
  };

  // Offboarding notification: receive the device and store it — updates the stock live
  const doReceive = async () => {
    if (!receiveTarget) return;
    setReceiveBusy(true);
    const r = await ds.receiveDevice(receiveTarget.assetId, storage);
    setReceiveBusy(false);
    if (r.ok) { notify(`Device received — stored in ${storage}. IT support stock updated.`, "ok"); setReceiveTarget(null); }
    else notify("Couldn't receive the device.", "crit");
  };

  // Opens a printable month report; the browser's print dialog saves it as PDF.
  const downloadPdf = () => {
    if (!activeMonth) return;
    const rowsHtml = monthRows.map((r) => `<tr>
      <td>TKT-${String(r.id).padStart(6, "0")}</td><td>${r.solver}</td><td>${r.employee} (${r.employeeId})</td>
      <td>${r.problem}</td><td>${new Date(r.resolvedAt).toLocaleDateString()}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) { notify("Allow pop-ups to download the report.", "crit"); return; }
    w.document.write(`<!doctype html><html><head><title>SQUARE IT Team — ${monthLabel(activeMonth)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px}h2{font-size:13px;color:#666;font-weight:500}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12.5px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #ddd}
      th{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:#666}</style></head><body>
      <h1>SQUARE GROUP — IT Team monthly record</h1><h2>${monthLabel(activeMonth)} · ${monthRows.length} solved</h2>
      <table><thead><tr><th>Ticket</th><th>Solved by</th><th>Employee</th><th>Problem</th><th>Resolved</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <script>window.onload = () => window.print()</` + `script></body></html>`);
    w.document.close();
  };

  // Hardware tickets go through the fixed / not-fixed dialog; everything else resolves directly.
  const startResolve = async (t) => {
    if (t.problemType === "Hardware Malfunction") {
      setResolveTarget(t); setResolveStep("ask");
      setFaultyId(t.assetId ? String(t.assetId) : "");
      setLoanerId("");
    } else {
      const r = await ds.resolveTicket(t.id);
      notify(r.ok ? "Ticket marked resolved." : "Couldn't resolve.", r.ok ? "ok" : "crit");
    }
  };

  const resolveFixed = async () => {
    if (!resolveTarget) return;
    setResolveBusy(true);
    const r = await ds.resolveTicket(resolveTarget.id);
    setResolveBusy(false);
    if (r.ok) { notify("Device fixed — returned to the employee. Ticket resolved.", "ok"); setResolveTarget(null); }
    else notify("Couldn't resolve the ticket.", "crit");
  };

  const raiser = resolveTarget ? ds.users.find((u) => u.username === resolveTarget.raisedByUsername) : null;
  const raiserAssets = raiser ? ds.assets.filter((a) => a.userId === raiser.id && a.status === "ALLOCATED_IN_USE" && !a.isLoaner) : [];
  const faultyAsset = faultyId ? ds.assets.find((a) => a.id === Number(faultyId)) : null;
  const underWarranty = faultyAsset ? faultyAsset.warrantyDaysRemaining > 0 : false;
  const repairShop = underWarranty ? REPAIR_SHOP_WARRANTY : REPAIR_SHOP_TRUSTED;

  const resolveNotFixed = async () => {
    if (!resolveTarget) return;
    if (!faultyAsset) { notify("Select the faulty device first.", "crit"); return; }
    if (loanerPoolAssets.length > 0 && !loanerId) { notify("Pick a loaner device for the employee.", "crit"); return; }
    setResolveBusy(true);
    let ok = true;
    if (loanerId && raiser) {
      const lr = await ds.issueLoaner(Number(loanerId), raiser.id);
      ok = ok && lr.ok;
    }
    const rr = await ds.sendToRepair(faultyAsset.id, repairShop);
    ok = ok && rr.ok;
    const tr = await ds.resolveTicket(resolveTarget.id);
    ok = ok && tr.ok;
    setResolveBusy(false);
    if (ok) {
      notify(`${loanerId ? "Loaner issued. " : ""}${faultyAsset.serialNumber} sent to the ${underWarranty ? "original shop (under warranty)" : "trusted repair shop"}.`, "ok");
      setResolveTarget(null);
    } else notify("Something went wrong while processing the repair.", "crit");
  };

  // --- Repair log: device came back from the shop ---
  const startReturn = (a) => { setReturnTarget(a); setReturnStep("ask"); setNewDeviceId(""); setNewSerial(""); };
  const underWarrantyReturn = returnTarget?.repairShop === REPAIR_SHOP_WARRANTY;

  // Warranty replacement — the original shop sent a brand-new unit
  const confirmWarrantyReplace = async () => {
    if (!returnTarget) return;
    setReturnBusy(true);
    const r = await ds.warrantyReplace(returnTarget.id, newSerial.trim() || null);
    setReturnBusy(false);
    if (r.ok) {
      notify(`New device received under warranty${newSerial.trim() ? ` (${newSerial.trim()})` : ""} — assigned to ${returnTarget.ownerName} with a fresh 1-year warranty.`, "ok");
      setReturnTarget(null);
    } else notify("Couldn't process the warranty replacement.", "crit");
  };

  const returnFixed = async () => {
    if (!returnTarget) return;
    setReturnBusy(true);
    const r = await ds.repairReturn(returnTarget.id, true);
    setReturnBusy(false);
    if (r.ok) { notify(`${returnTarget.serialNumber} repaired — returned to ${returnTarget.ownerName}.`, "ok"); setReturnTarget(null); }
    else notify("Couldn't update the device.", "crit");
  };

  const returnNotFixed = async () => {
    if (!returnTarget) return;
    if (inventoryAssets.length > 0 && !newDeviceId) { notify("Pick a new device from the inventory.", "crit"); return; }
    setReturnBusy(true);
    const ownerId = returnTarget.userId; // capture before the scrap clears it
    let ok = true;
    const sr = await ds.repairReturn(returnTarget.id, false);
    ok = ok && sr.ok;
    if (newDeviceId && ownerId != null) {
      const nr = await ds.requestNewDevice(Number(newDeviceId), ownerId);
      ok = ok && nr.ok;
    }
    setReturnBusy(false);
    if (ok) {
      notify(`${returnTarget.serialNumber} moved to Scrap.${newDeviceId ? " New device request sent to the Superuser for acceptance." : ""}`, "ok");
      setReturnTarget(null);
    } else notify("Couldn't complete the return.", "crit");
  };

  const doScrap = async () => {
    if (!scrapTarget || !scrapReason.trim()) { notify("Add a reason before scrapping.", "crit"); return; }
    setScrapBusy(true);
    const r = await ds.scrapAsset(scrapTarget.id, scrapReason.trim());
    setScrapBusy(false);
    if (r.ok) { notify(`${scrapTarget.serialNumber} moved to the Scrap Registry.`, "ok"); setScrapTarget(null); setScrapReason(""); }
    else notify("Couldn't scrap that asset.", "crit");
  };

  return (
    <Shell items={items} active={view} onSelect={handleSelect}>
        {view === "account" && <AccountPanel ds={ds} user={user} notify={notify} onDone={() => setView("queue")} />}
        {view === "queue" && (
          <Section eyebrow="Straight to IT · no approval needed" title="Incoming tickets">
            {openQueue.length === 0 ? (
              <Empty icon={Inbox} title="Queue is empty" hint="New tickets from employees land here immediately." />
            ) : (
              <div className="sq-stack">
                {openQueue.map((t) => {
                  const Ic = PROBLEM_ICON[t.problemType] || HelpCircle;
                  const device = t.assetId ? ds.assets.find((a) => a.id === t.assetId) : null;
                  return (
                    <div key={t.id} className="sq-card sq-approval">
                      <div className="sq-approval-main">
                        <div className="sq-approval-top">
                          <span className="sq-mono sq-dim">TKT-{String(t.id).padStart(6, "0")}</span>
                          <span className="sq-comp"><Ic size={13} />{t.problemType}</span>
                          {device && <span className="sq-mono sq-dim">{device.serialNumber}</span>}
                        </div>
                        <div className="sq-approval-title">{t.location} · Floor {t.floor} · {t.department}</div>
                        <div className="sq-cell-desc">{t.description}</div>
                      </div>
                      <div className="sq-approval-actions">
                        <Btn variant="success" size="sm" icon={UserCheck} onClick={() => openAccept(t)} disabled={rejectBusyId === t.id}>Accept</Btn>
                        <Btn variant="danger" size="sm" icon={X} onClick={() => doReject(t.id)} disabled={rejectBusyId === t.id}>Reject</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {view === "notifications" && (
          <Section eyebrow="From the Superuser & the system" title="Notifications">
            {notifs.length === 0 ? (
              <Empty icon={Bell} title="No notifications" hint="Offboarding releases and 14-day desk-collection reminders land here." />
            ) : (
              <div className="sq-stack">
                {notifs.map((n) => (
                  <div key={n.id} className="sq-card sq-approval">
                    <div className="sq-approval-main">
                      <div className="sq-approval-top">
                        <span className="sq-comp"><Bell size={13} />{n.type === "DEVICE_RELEASE" ? "Device released by Superuser" : "Desk collection"}</span>
                        {n.due
                          ? <Badge tone="warn">Action needed</Badge>
                          : <Badge tone="neutral">Due in {n.dueInDays} day{n.dueInDays === 1 ? "" : "s"}</Badge>}
                      </div>
                      <div className="sq-cell-desc">{n.message}</div>
                    </div>
                    <div className="sq-approval-actions">
                      <Btn variant="success" size="sm" icon={PackageCheck} disabled={!n.due}
                        onClick={() => { setReceiveTarget(n); setStorage(STORAGE_LOCATIONS[0]); }}>
                        {n.due ? "Receive device" : "Waiting"}
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {view === "records" && (
          <Section eyebrow="Month-wise solved problems" title="Monthly records"
            action={
              <div className="sq-row-actions" style={{ display: "flex", gap: 8 }}>
                <select className="sq-input" value={activeMonth} onChange={(e) => setRecordMonth(e.target.value)} style={{ width: "auto" }}>
                  {records.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <Btn icon={Download} onClick={downloadPdf} disabled={!monthRows.length}>Download PDF</Btn>
              </div>
            }>
            <div className="sq-card sq-table-card">
              {monthRows.length === 0 ? <Empty icon={CalendarDays} title="No solved tickets this month" /> : (
                <table className="sq-table">
                  <thead><tr><th>Ticket</th><th>Solved by</th><th>Employee</th><th>Problem</th><th>Resolved</th></tr></thead>
                  <tbody>
                    {monthRows.map((r) => (
                      <tr key={r.id}>
                        <td className="sq-mono sq-dim">TKT-{String(r.id).padStart(6, "0")}</td>
                        <td className="sq-cell-strong">{r.solver}</td>
                        <td>{r.employee} <span className="sq-mono sq-dim">· {r.employeeId}</span></td>
                        <td>{r.problem}</td>
                        <td className="sq-mono sq-dim">{new Date(r.resolvedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "solving" && (
          <Section eyebrow="Accepted · in progress" title="Being solved">
            <div className="sq-card sq-table-card">
              {solving.length === 0 ? <Empty icon={Wrench} title="Nothing in progress" hint="Tickets you accept will show up here until resolved." /> : (
                <table className="sq-table">
                  <thead><tr><th>Ticket</th><th>Location</th><th>Problem</th><th>Accepted by</th><th className="sq-ta-r">Action</th></tr></thead>
                  <tbody>
                    {solving.map((t) => (
                      <tr key={t.id}>
                        <td className="sq-mono sq-dim">TKT-{String(t.id).padStart(6, "0")}</td>
                        <td className="sq-cell-desc">{t.location} · Floor {t.floor}</td>
                        <td>{t.problemType}</td>
                        <td>{t.acceptedBy}</td>
                        <td className="sq-ta-r"><Btn size="sm" variant="success" icon={Check} onClick={() => startResolve(t)}>Mark resolved</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "repairs" && (
          <Section eyebrow="Devices out at a shop" title="Repair log">
            <div className="sq-card sq-table-card">
              {repairs.length === 0 ? <Empty icon={Hammer} title="Nothing out for repair" hint="Faulty devices sent to a shop from the resolve flow will show up here." /> : (
                <table className="sq-table">
                  <thead><tr><th>Serial</th><th>Device</th><th>Owner</th><th>Shop</th><th>Days out</th><th className="sq-ta-r">Action</th></tr></thead>
                  <tbody>
                    {repairs.map((a) => (
                      <tr key={a.id}>
                        <td className="sq-mono">{a.serialNumber}</td>
                        <td className="sq-cell-strong">{a.deviceType}</td>
                        <td>{a.ownerName}</td>
                        <td className="sq-cell-desc">{a.repairShop || "—"}</td>
                        <td className="sq-mono">{a.daysOut} day{a.daysOut === 1 ? "" : "s"}</td>
                        <td className="sq-ta-r"><Btn size="sm" icon={PackageCheck} onClick={() => startReturn(a)}>Device returned</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "ledger" && (
          <Section eyebrow="Productivity & workload" title="IT Team ledger">
            <div className="sq-card sq-table-card">
              {ledger.length === 0 ? <Empty icon={ClipboardList} title="No IT Team members yet" /> : (
                <table className="sq-table">
                  <thead><tr><th>IT Team member</th><th>Total assigned</th><th>Solved / closed</th><th>Active open</th></tr></thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.username}>
                        <td className="sq-cell-strong">{row.name}{!row.registered && <span className="sq-dim"> · unregistered</span>}</td>
                        <td className="sq-mono">{row.assigned}</td>
                        <td className="sq-mono sq-pos">{row.solved}</td>
                        <td className="sq-mono">{row.active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "pool" && (
          <Section eyebrow="New · repaired · used — the whole device stock in one place" title="IT support stock">
            <div className="sq-grid cols-3">
              <div className="sq-card sq-pool">
                <div className="sq-pool-head"><PackagePlus size={16} /> New devices</div>
                <Bar label="In stock" value={pool.NEW} max={pool.total || 1} sub={`${pool.NEW} of ${pool.total}`} tone="ok" />
                <div className="sq-cell-desc">Brand-new inventory — issued only with Superuser acceptance.</div>
              </div>
              <div className="sq-card sq-pool">
                <div className="sq-pool-head"><Wrench size={16} /> Repaired devices</div>
                <Bar label="In stock" value={pool.REPAIRED} max={pool.total || 1} sub={`${pool.REPAIRED} of ${pool.total}`} tone="info" />
                <div className="sq-cell-desc">Returned and repaired units, ready to loan out.</div>
              </div>
              <div className="sq-card sq-pool">
                <div className="sq-pool-head"><Boxes size={16} /> Used devices</div>
                <Bar label="In stock" value={pool.USED} max={pool.total || 1} sub={`${pool.USED} of ${pool.total}`} tone="warn" />
                <div className="sq-cell-desc">Working stock returned from employees — used for short-term loans.</div>
              </div>
            </div>
            {pending.length > 0 && (
              <div className="sq-stack" style={{ marginTop: 16 }}>
                {pending.map((a) => (
                  <div key={a.id} className="sq-card sq-approval">
                    <div className="sq-approval-main">
                      <div className="sq-approval-top">
                        <span className="sq-mono sq-dim">{a.serialNumber}</span>
                        <Badge tone="warn">Awaiting Superuser acceptance</Badge>
                      </div>
                      <div className="sq-approval-title">{a.deviceType} → {a.targetName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Device explorer — search every device, filter by availability or usage */}
            <div className="sq-card" style={{ marginTop: 16 }}>
              <div className="sq-warranty-actions" style={{ flexWrap: "wrap", marginBottom: 12 }}>
                <div className="sq-search sq-search-sm">
                  <Search size={14} />
                  <input className="sq-input sq-search-input" placeholder="Search all devices…" value={devSearch} onChange={(e) => setDevSearch(e.target.value)} />
                </div>
                <div className="sq-segment">
                  <button className={devFilter === "ALL" ? "is-on" : ""} onClick={() => setDevFilter("ALL")}>All</button>
                  <button className={devFilter === "AVAILABLE" ? "is-on" : ""} onClick={() => setDevFilter("AVAILABLE")}>Available devices</button>
                  <button className={devFilter === "IN_USE" ? "is-on" : ""} onClick={() => setDevFilter("IN_USE")}>Devices in use</button>
                </div>
                {devFilter === "AVAILABLE" && (
                  <select className="sq-input" style={{ width: "auto" }} value={availCond} onChange={(e) => setAvailCond(e.target.value)}>
                    <option value="ALL">All conditions</option>
                    <option value="New">New device</option>
                    <option value="Used">Used device</option>
                    <option value="Repaired">Repaired device</option>
                  </select>
                )}
                {devFilter === "IN_USE" && (
                  <select className="sq-input" style={{ width: "auto" }} value={useDept} onChange={(e) => setUseDept(e.target.value)}>
                    <option value="ALL">All departments</option>
                    {ds.departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                )}
              </div>
              {explorerRows.length === 0 ? <Empty icon={Boxes} title="No matching devices" hint="Try a different search or filter." /> : (
                <table className="sq-table">
                  <thead><tr><th>Serial</th><th>Device</th><th>Status</th><th>Stored at</th><th>Value</th><th className="sq-ta-r">Action</th></tr></thead>
                  <tbody>
                    {explorerRows.map((r) => (
                      <tr key={r.id}>
                        <td className="sq-mono">{r.serialNumber}</td>
                        <td className="sq-cell-strong">{r.deviceType}</td>
                        <td>
                          {r.status === "AVAILABLE_IN_POOL"
                            ? <Badge tone={r.cond === "New" ? "ok" : r.cond === "Repaired" ? "info" : "neutral"}>Unassigned · {r.cond}</Badge>
                            : <span>{r.isLoaner ? <Badge tone="brand">Loaner</Badge> : <Badge tone="warn">In use</Badge>} <span className="sq-cell-desc" style={{ display: "inline", marginLeft: 6 }}>{r.holder ? `${r.holder.name} (${r.holder.department || "—"})` : "Unknown holder"}</span></span>}
                        </td>
                        <td className="sq-cell-desc">{r.storageLocation || "—"}</td>
                        <td className="sq-mono">{money(r.originalValue)}</td>
                        <td className="sq-ta-r">{r.status === "AVAILABLE_IN_POOL" && <Btn size="sm" variant="danger" icon={Trash2} onClick={() => { setScrapTarget(r); setScrapReason(""); }}>Scrap</Btn>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "mydevices" && <MyDevicesPanel ds={ds} user={user} notify={notify} />}

        {view === "loaners" && (
          <Section eyebrow="Loaners deployed right now" title="Employee assign pool">
            <div className="sq-card sq-table-card">
              {loaners.length === 0 ? <Empty icon={FileText} title="No loaners deployed" hint="Devices issued while a repair is in progress will show up here." /> : (
                <table className="sq-table">
                  <thead><tr><th>Serial</th><th>Device</th><th>Issued to</th><th>Days out</th><th className="sq-ta-r">Action</th></tr></thead>
                  <tbody>
                    {loaners.map((a) => (
                      <tr key={a.id}>
                        <td className="sq-mono">{a.serialNumber}</td>
                        <td className="sq-cell-strong">{a.deviceType}</td>
                        <td>{a.holderName}</td>
                        <td className="sq-mono">{a.daysOut} day{a.daysOut === 1 ? "" : "s"}</td>
                        <td className="sq-ta-r"><Btn size="sm" icon={PackageCheck} onClick={() => setLoanerReturn(a)}>Mark returned</Btn></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

        {view === "scrap" && (
          <Section eyebrow="Decommissioned" title="Scrap">
            <div className="sq-card sq-table-card">
              {scrapped.length === 0 ? <Empty icon={Trash2} title="Nothing scrapped" hint="Devices that can't be repaired end up here." /> : (
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

      <Modal open={!!acceptTarget} onClose={() => setAcceptTarget(null)} title="Accepted by?" sub={acceptTarget ? `TKT-${String(acceptTarget.id).padStart(6, "0")} · ${acceptTarget.problemType}` : ""}>
        <div className="sq-form">
          <label className="sq-field"><span className="sq-label">IT Team member</span>
            <select className="sq-input" value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} autoFocus>
              {techNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setAcceptTarget(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={doAccept} disabled={acceptBusy}>{acceptBusy ? "Accepting…" : "Confirm"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Employee assign pool: the return popup states how long the device was out */}
      <Modal open={!!loanerReturn} onClose={() => setLoanerReturn(null)} title="Device returned"
        sub={loanerReturn ? `${loanerReturn.serialNumber} · ${loanerReturn.deviceType}` : ""}>
        <div className="sq-form">
          <p className="sq-cell-desc">
            This device is being returned by <strong>{loanerReturn?.holderName}</strong> after{" "}
            <strong>{loanerReturn?.daysOut} day{loanerReturn?.daysOut === 1 ? "" : "s"}</strong> on loan.
          </p>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setLoanerReturn(null)}>Cancel</Btn>
            <Btn variant="success" icon={PackageCheck} onClick={confirmLoanerReturn} disabled={loanerBusy}>{loanerBusy ? "Saving…" : "Confirm return"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Offboarding notification: receive the device and pick where to store it */}
      <Modal open={!!receiveTarget} onClose={() => setReceiveTarget(null)} title="Where should this device be stored?"
        sub={receiveTarget ? receiveTarget.message : ""}>
        <div className="sq-form">
          <label className="sq-field"><span className="sq-label">Storage location</span>
            <select className="sq-input" value={storage} onChange={(e) => setStorage(e.target.value)} autoFocus>
              {STORAGE_LOCATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setReceiveTarget(null)}>Cancel</Btn>
            <Btn variant="primary" icon={PackageCheck} onClick={doReceive} disabled={receiveBusy}>{receiveBusy ? "Receiving…" : "Receive & store"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Hardware-malfunction resolve: fixed / not fixed */}
      <Modal open={!!resolveTarget} onClose={() => setResolveTarget(null)}
        title={resolveStep === "ask" ? "Was the device fixed?" : "Not fixed — loaner & repair"}
        sub={resolveTarget ? `TKT-${String(resolveTarget.id).padStart(6, "0")} · raised by ${raiser?.name || resolveTarget.raisedByUsername}` : ""}>
        {resolveStep === "ask" ? (
          <div className="sq-form">
            <p className="sq-cell-desc">If it's fixed, the device goes straight back to the employee. If not, you'll issue a loaner and send the faulty device out for repair.</p>
            <div className="sq-form-actions">
              <Btn variant="danger" icon={X} onClick={() => setResolveStep("notfixed")} disabled={resolveBusy}>Not fixed</Btn>
              <Btn variant="success" icon={Check} onClick={resolveFixed} disabled={resolveBusy}>{resolveBusy ? "Saving…" : "Fixed — return to employee"}</Btn>
            </div>
          </div>
        ) : (
          <div className="sq-form">
            {resolveTarget && !resolveTarget.assetId && (
              raiserAssets.length > 0 ? (
                <label className="sq-field"><span className="sq-label">Faulty device</span>
                  <select className="sq-input" value={faultyId} onChange={(e) => setFaultyId(e.target.value)}>
                    <option value="">Select the employee's device…</option>
                    {raiserAssets.map((a) => <option key={a.id} value={a.id}>{a.deviceType} · {a.serialNumber}</option>)}
                  </select>
                </label>
              ) : (
                <p className="sq-cell-desc">This employee has no registered devices, so the repair can't be logged against one.</p>
              )
            )}
            {faultyAsset && (
              <div className="sq-card" style={{ padding: 12 }}>
                <div className="sq-cell-strong">{faultyAsset.deviceType} · <span className="sq-mono">{faultyAsset.serialNumber}</span></div>
                <div style={{ marginTop: 6 }}>
                  {underWarranty
                    ? <Badge tone="ok"><ShieldCheck size={11} style={{ marginRight: 3 }} />Under warranty — send to the original shop</Badge>
                    : <Badge tone="warn"><ShieldOff size={11} style={{ marginRight: 3 }} />Warranty expired — send to a trusted repair shop</Badge>}
                </div>
              </div>
            )}
            <label className="sq-field"><span className="sq-label">Loaner device for the employee</span>
              {loanerPoolAssets.length === 0 ? (
                <span className="sq-cell-desc">Loaner pool is empty — the repair will proceed without a loaner.</span>
              ) : (
                <select className="sq-input" value={loanerId} onChange={(e) => setLoanerId(e.target.value)}>
                  <option value="">Select a loaner…</option>
                  {loanerPoolAssets.map((a) => <option key={a.id} value={a.id}>{a.deviceType} · {a.serialNumber} ({a.poolCondition || "USED"})</option>)}
                </select>
              )}
            </label>
            <div className="sq-form-actions">
              <Btn type="button" onClick={() => setResolveStep("ask")}>Back</Btn>
              <Btn variant="primary" icon={Send} onClick={resolveNotFixed} disabled={resolveBusy || !faultyAsset}>
                {resolveBusy ? "Processing…" : `Issue loaner & send to ${underWarranty ? "original shop" : "trusted shop"}`}
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Repair log: device returned from the shop */}
      <Modal open={!!returnTarget} onClose={() => setReturnTarget(null)}
        title={returnStep === "ask" ? (underWarrantyReturn ? "Back from the original shop" : "Device fixed or not fixed?") : returnStep === "warranty" ? "New device received under warranty" : "Not fixed — scrap & replace"}
        sub={returnTarget ? `${returnTarget.serialNumber} · ${returnTarget.deviceType} · owner ${returnTarget.ownerName}` : ""}>
        {returnStep === "ask" && underWarrantyReturn ? (
          <div className="sq-form">
            <p className="sq-cell-desc">This device was under warranty at the original shop. Either it came back <strong>fixed</strong>, or the shop sent a <strong>brand-new replacement device</strong>.</p>
            <div className="sq-form-actions">
              <Btn variant="primary" icon={PackagePlus} onClick={() => setReturnStep("warranty")} disabled={returnBusy}>New device received</Btn>
              <Btn variant="success" icon={Check} onClick={returnFixed} disabled={returnBusy}>{returnBusy ? "Saving…" : "Device fixed & returned"}</Btn>
            </div>
          </div>
        ) : returnStep === "warranty" ? (
          <div className="sq-form">
            <p className="sq-cell-desc">The replacement goes straight to <strong>{returnTarget?.ownerName}</strong> with a fresh 1-year warranty. If the new unit has a different serial number, enter it below.</p>
            <label className="sq-field"><span className="sq-label">New serial number (optional)</span>
              <input className="sq-input" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} placeholder={`leave empty to keep ${returnTarget?.serialNumber || ""}`} />
            </label>
            <div className="sq-form-actions">
              <Btn type="button" onClick={() => setReturnStep("ask")}>Back</Btn>
              <Btn variant="primary" icon={PackageCheck} onClick={confirmWarrantyReplace} disabled={returnBusy}>{returnBusy ? "Processing…" : "Receive replacement"}</Btn>
            </div>
          </div>
        ) : returnStep === "ask" ? (
          <div className="sq-form">
            <p className="sq-cell-desc">If the shop fixed it, the device goes back to the employee. If not, it's scrapped and a new device is issued from the inventory (with Superuser acceptance).</p>
            <div className="sq-form-actions">
              <Btn variant="danger" icon={X} onClick={() => setReturnStep("replace")} disabled={returnBusy}>Not fixed</Btn>
              <Btn variant="success" icon={Check} onClick={returnFixed} disabled={returnBusy}>{returnBusy ? "Saving…" : "Fixed — return to employee"}</Btn>
            </div>
          </div>
        ) : (
          <div className="sq-form">
            <p className="sq-cell-desc"><strong>{returnTarget?.serialNumber}</strong> will move to the Scrap tab. Pick a new device from the inventory for {returnTarget?.ownerName} — the assignment needs the Superuser's acceptance before it's final.</p>
            <label className="sq-field"><span className="sq-label">New device from inventory</span>
              {inventoryAssets.length === 0 ? (
                <span className="sq-cell-desc">Inventory has no new devices — the old one will be scrapped without a replacement.</span>
              ) : (
                <select className="sq-input" value={newDeviceId} onChange={(e) => setNewDeviceId(e.target.value)}>
                  <option value="">Select a new device…</option>
                  {inventoryAssets.map((a) => <option key={a.id} value={a.id}>{a.deviceType} · {a.serialNumber}</option>)}
                </select>
              )}
            </label>
            <div className="sq-form-actions">
              <Btn type="button" onClick={() => setReturnStep("ask")}>Back</Btn>
              <Btn variant="danger" icon={Trash2} onClick={returnNotFixed} disabled={returnBusy}>
                {returnBusy ? "Processing…" : newDeviceId ? "Scrap & request new device" : "Scrap device"}
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!scrapTarget} onClose={() => setScrapTarget(null)} title="Scrap this asset?" sub={scrapTarget ? `${scrapTarget.serialNumber} · ${scrapTarget.deviceType}` : ""}>
        <div className="sq-form">
          <label className="sq-field"><span className="sq-label">Reason</span>
            <textarea className="sq-input" rows={3} value={scrapReason} onChange={(e) => setScrapReason(e.target.value)} placeholder="Why is this device being decommissioned?" />
          </label>
          <div className="sq-form-actions">
            <Btn type="button" onClick={() => setScrapTarget(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={doScrap} disabled={scrapBusy}>{scrapBusy ? "Scrapping…" : "Scrap asset"}</Btn>
          </div>
        </div>
      </Modal>

      <SignOutModal open={signOutOpen} onCancel={() => setSignOutOpen(false)} onConfirm={onSignOut} />
    </Shell>
  );
}
