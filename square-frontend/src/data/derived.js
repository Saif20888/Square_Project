import { Inbox, CheckCircle2, X, Plus, Trash2 } from "lucide-react";

// --- Straight-line depreciation, used by the System Admin valuation dashboard ---
export function bookValue(a) {
  const original = a.originalValue || 0;
  if (!a.purchaseDate || !a.usefulLifeYears) return original;
  const ageYears = (Date.now() - new Date(a.purchaseDate).getTime()) / (365 * 86400000);
  const salvageFloor = original * 0.1;
  return Math.max(original * Math.max(0, 1 - ageYears / a.usefulLifeYears), salvageFloor);
}

// --- Derived views over the asset/user lists — identical whether the lists came
//     from Postgres (live mode) or the SEED_* constants (demo mode). ---
// Bulk stock rows (general IT stock, no serial number) share the assets table
// but have no warranty/pool/repair lifecycle — every function below that
// assumes a serialized device excludes them explicitly.
export function warrantyLedger(assets) {
  return assets.filter((a) => a.serialNumber != null && a.status !== "SCRAPPED");
}
export function scrapRegistry(assets) {
  return assets.filter((a) => a.status === "SCRAPPED")
    .sort((a, b) => new Date(b.scrappedAt || 0) - new Date(a.scrappedAt || 0));
}
export function poolSummary(assets) {
  const pool = assets.filter((a) => a.status === "AVAILABLE_IN_POOL");
  const count = (cond) => pool.filter((a) => a.poolCondition === cond).length;
  // "Used" covers everything that isn't brand-new or freshly repaired
  const used = pool.filter((a) => a.poolCondition !== "NEW" && a.poolCondition !== "REPAIRED").length;
  return { total: pool.length, NEW: count("NEW"), REPAIRED: count("REPAIRED"), USED: used };
}
export function loanerLedger(assets, users) {
  return assets.filter((a) => a.isLoaner && a.status === "ALLOCATED_IN_USE").map((a) => {
    const holder = users.find((u) => u.id === a.userId);
    const daysOut = a.loanerIssuedAt ? Math.floor((Date.now() - new Date(a.loanerIssuedAt).getTime()) / 86400000) : 0;
    return { ...a, holderName: holder ? (holder.name || holder.username) : "Unassigned", daysOut };
  });
}
export function assetValuation(assets) {
  const active = assets.filter((a) => a.serialNumber != null && a.status !== "SCRAPPED");
  const byType = {};
  active.forEach((a) => {
    const k = a.deviceType || "Other";
    if (!byType[k]) byType[k] = { type: k, count: 0, original: 0, book: 0 };
    byType[k].count += 1;
    byType[k].original += a.originalValue || 0;
    byType[k].book += bookValue(a);
  });
  const rows = Object.values(byType).sort((a, b) => b.original - a.original);
  return {
    totalOriginal: rows.reduce((s, r) => s + r.original, 0),
    totalBook: rows.reduce((s, r) => s + r.book, 0),
    byType: rows,
  };
}
// Same shape as assetValuation, grouped by the owner's department instead of
// device type — pool/scrapped devices (no owner) land in "Unassigned".
export function assetValuationByDepartment(users, assets) {
  const active = assets.filter((a) => a.serialNumber != null && a.status !== "SCRAPPED");
  const byDept = {};
  active.forEach((a) => {
    const owner = users.find((u) => u.id === a.userId);
    const k = owner?.department || a.department || "Unassigned";
    if (!byDept[k]) byDept[k] = { type: k, count: 0, original: 0, book: 0 };
    byDept[k].count += 1;
    byDept[k].original += a.originalValue || 0;
    byDept[k].book += bookValue(a);
  });
  const rows = Object.values(byDept).sort((a, b) => b.original - a.original);
  return {
    totalOriginal: rows.reduce((s, r) => s + r.original, 0),
    totalBook: rows.reduce((s, r) => s + r.book, 0),
    byType: rows,
  };
}

// Supervisor's read-only "who raised it / who's fixing it / status" matrix
export function oversightMatrix(tickets, users) {
  return tickets.map((t) => {
    const raiser = users.find((u) => u.username === t.raisedByUsername);
    return { ...t, raiserName: raiser ? (raiser.name || raiser.username) : t.raisedByUsername || "Unknown" };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// IT Tech productivity ledger — grouped by the free-typed "accepted by" name.
// Registered technicians always get a row; any other name typed into the
// accept dialog gets its own row too, so nobody's work goes missing.
export function technicianLedger(tickets, users) {
  const names = users.filter((u) => u.role === "IT_TECH").map((u) => u.name);
  tickets.forEach((t) => {
    if (t.acceptedBy && !names.includes(t.acceptedBy)) names.push(t.acceptedBy);
  });
  return names.map((name) => {
    const mine = tickets.filter((t) => t.acceptedBy === name);
    const registered = users.find((u) => u.role === "IT_TECH" && u.name === name);
    return {
      username: registered ? registered.username : name,
      name,
      registered: !!registered,
      assigned: mine.length,
      solved: mine.filter((t) => t.status === "CLOSED").length,
      active: mine.filter((t) => t.status === "SOLVING").length,
    };
  }).sort((a, b) => b.assigned - a.assigned);
}

// Devices currently out at a repair shop — the technician's "device log"
export function repairLog(assets, users) {
  return assets.filter((a) => a.status === "IN_REPAIR").map((a) => {
    const owner = users.find((u) => u.id === a.userId);
    const daysOut = a.sentToRepairAt ? Math.floor((Date.now() - new Date(a.sentToRepairAt).getTime()) / 86400000) : 0;
    return { ...a, ownerName: owner ? (owner.name || owner.username) : "Unassigned", daysOut };
  }).sort((a, b) => new Date(b.sentToRepairAt || 0) - new Date(a.sentToRepairAt || 0));
}

// New-device issues waiting for a supervisor to accept or reject
export function pendingAssignments(assets, users) {
  return assets.filter((a) => a.status === "UNDER_REVIEW" && a.pendingUserId != null).map((a) => {
    const target = users.find((u) => u.id === a.pendingUserId);
    return { ...a, targetName: target ? (target.name || target.username) : `User #${a.pendingUserId}` };
  });
}

// Whole years since the user's first working day
export function yearsOfService(joinedAt) {
  if (!joinedAt) return null;
  return Math.floor((Date.now() - new Date(joinedAt).getTime()) / (365.25 * 86400000));
}

// Per-department device counts + condition (owner's department, falling back to
// the department typed at registration). Pool/scrapped devices have no owner and
// are excluded — this is a "who is holding what" view.
export function departmentAssets(users, assets, departments) {
  const rows = departments.map((d) => ({ department: d, total: 0, underWarranty: 0, expired: 0, inRepair: 0 }));
  const byName = Object.fromEntries(rows.map((r) => [r.department, r]));
  assets.forEach((a) => {
    if (a.serialNumber == null) return; // bulk stock row, not a serialized device
    if (a.status === "SCRAPPED" || a.status === "AVAILABLE_IN_POOL") return;
    const owner = users.find((u) => u.id === a.userId);
    const dept = owner?.department || a.department;
    const row = byName[dept];
    if (!row) return;
    row.total += 1;
    if (a.status === "IN_REPAIR") row.inRepair += 1;
    if (a.warrantyDaysRemaining > 0) row.underWarranty += 1;
    else row.expired += 1;
  });
  return rows;
}

// OPEN tickets that nobody accepted for `days` or more — supervisor alert feed
export function agingTickets(tickets, days) {
  const cutoff = Date.now() - days * 86400000;
  return tickets
    .filter((t) => t.status === "OPEN" && new Date(t.createdAt).getTime() <= cutoff)
    .map((t) => ({ ...t, daysPending: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000) }))
    .sort((a, b) => b.daysPending - a.daysPending);
}

// Month-wise record of solved tickets: who on the IT Team solved whose problem.
// Returns { months: ["2026-07", ...], rows: { "2026-07": [...] } }
export function monthlyRecords(tickets, users) {
  const rows = {};
  tickets
    .filter((t) => t.status === "CLOSED" && t.resolvedAt)
    .forEach((t) => {
      const month = String(t.resolvedAt).slice(0, 7);
      const raiser = users.find((u) => u.username === t.raisedByUsername);
      (rows[month] = rows[month] || []).push({
        id: t.id,
        solver: t.acceptedBy || "—",
        employee: raiser ? (raiser.name || raiser.username) : (t.raisedByUsername || "Unknown"),
        employeeId: raiser?.employeeId || "—",
        problem: t.problemType,
        description: t.description,
        resolvedAt: t.resolvedAt,
      });
    });
  Object.values(rows).forEach((list) => list.sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt)));
  // Always offer the last 12 calendar months, newest first, even when a month is empty
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  return { months, rows };
}

export const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

// Admin's live activity feed — reconstructed from real ticket/asset events, not fabricated
export function activityFeed(tickets, assets, limit = 12) {
  const events = [];
  tickets.forEach((t) => {
    events.push({ id: `to-${t.id}`, at: t.createdAt, kind: "ticket-open", text: `TKT-${String(t.id).padStart(6, "0")} opened — ${t.problemType}` });
    if (t.resolvedAt) {
      events.push({
        id: `tc-${t.id}`, at: t.resolvedAt,
        kind: t.status === "REJECTED" ? "ticket-rejected" : "ticket-resolved",
        text: `TKT-${String(t.id).padStart(6, "0")} ${t.status === "REJECTED" ? "rejected" : "resolved"}`,
      });
    }
  });
  assets.filter((a) => a.serialNumber != null).forEach((a) => {
    if (a.purchaseDate) events.push({ id: `an-${a.id}`, at: a.purchaseDate, kind: "asset-new", text: `${a.serialNumber} registered — ${a.deviceType}` });
    if (a.scrappedAt) events.push({ id: `as-${a.id}`, at: a.scrappedAt, kind: "asset-scrap", text: `${a.serialNumber} scrapped` });
  });
  return events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}
export const FEED_ICON = { "ticket-open": Inbox, "ticket-resolved": CheckCircle2, "ticket-rejected": X, "asset-new": Plus, "asset-scrap": Trash2 };
export const FEED_TONE = { "ticket-open": "brand", "ticket-resolved": "ok", "ticket-rejected": "crit", "asset-new": "info", "asset-scrap": "warn" };
