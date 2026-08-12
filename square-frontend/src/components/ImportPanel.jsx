import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Sparkles, Check, X, ArrowRight, Copy, Download, Bot, SendHorizonal, History, ChevronRight, KeyRound, User } from "lucide-react";
import { DESIGNATIONS, UNIQUE_DESIGNATIONS, DEVICE_KINDS, HR_ADMIN_DEPT, HR_ADMIN_UNITS, deviceKindOf } from "../data/constants";
import { Section } from "./Shell";
import { Btn, Badge, Empty } from "./primitives";

/* ================================================================================= */
/*  Import data — Automated Data Extraction & Mapping with an interactive            */
/*  AI troubleshooter and a full import history / audit log.                         */
/*                                                                                   */
/*  Every sheet and every row is parsed. Zero problems -> instant deploy into the    */
/*  right departments. Problems -> the assistant opens a chat, explains each issue,  */
/*  and understands plain-language replies like "put John Doe in Marketing".         */
/*  Optionally connect an Anthropic API key for smarter language understanding —     */
/*  without a key, a built-in offline parser handles the common phrasings.           */
/* ================================================================================= */

const AI_KEY_STORAGE = "sq-ai-key";

const DEVICE_FIELDS = [
  { field: "serialNumber", label: "Serial number", patterns: [/serial/i, /^s\/?n\.?$/i] },
  { field: "deviceName", label: "Device name", patterns: [/device\s*(name)?$/i, /model/i, /^item/i, /product/i, /equipment/i] },
  { field: "deviceKind", label: "Device type", patterns: [/device\s*type/i, /^type$/i, /kind/i] },
  { field: "originalValue", label: "Price", patterns: [/price/i, /value/i, /cost/i, /amount/i] },
  { field: "supplierName", label: "Supplier", patterns: [/supplier/i, /vendor/i, /seller/i] },
  { field: "prNumber", label: "PR number", patterns: [/\bpr\b/i, /requisition/i] },
  { field: "assetNumber", label: "Asset number", patterns: [/asset\s*(no|num|number|id|#)/i, /^ast/i] },
  { field: "assetCategory", label: "Category", patterns: [/categor/i] },
  { field: "warrantyExpiry", label: "Warranty expiry", patterns: [/warranty/i, /expir/i] },
  { field: "department", label: "Department", patterns: [/depart|dept/i] },
  { field: "owner", label: "Assigned to", patterns: [/owner/i, /assigned/i, /holder/i, /issued\s*to/i, /^user$/i] },
  { field: "ownerEmployeeId", label: "Employee ID", patterns: [/emp(loyee)?\.?\s*id/i] },
  { field: "ipAddress", label: "IP address", patterns: [/\bip\b/i] },
  { field: "specifications", label: "Specifications", patterns: [/spec/i, /config/i, /description/i, /details/i] },
];
const EMPLOYEE_FIELDS = [
  { field: "name", label: "Name", patterns: [/^(full\s*)?name$/i, /employee\s*name/i, /^emp\.?\s*name/i] },
  { field: "email", label: "E-Mail", patterns: [/mail/i] },
  { field: "employeeId", label: "Employee ID", patterns: [/emp(loyee)?\.?\s*id/i, /^id$/i, /unique\s*id/i] },
  { field: "designation", label: "Designation", patterns: [/designation/i, /position/i, /job\s*title/i, /^title$/i] },
  { field: "department", label: "Department", patterns: [/depart|dept/i] },
  { field: "unit", label: "Unit (HR and Admin)", patterns: [/unit/i, /sub.?depart/i] },
  { field: "mobile", label: "Mobile", patterns: [/mobile/i, /cell/i] },
  { field: "phone", label: "Emergency contact", patterns: [/phone/i, /emergency/i, /contact/i] },
  { field: "location", label: "Office", patterns: [/location/i, /office/i, /branch/i] },
  { field: "floor", label: "Floor", patterns: [/floor/i] },
];

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
const looksLikeIp = (v) => /^\d{1,3}(\.\d{1,3}){3}$/.test(String(v).trim());

const norm = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

// Edit distance so typos ("Commarcial" -> "Commercial") are repaired automatically.
function levDist(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
const isTypoOf = (a, b) => {
  if (Math.abs(a.length - b.length) > 3) return false;
  return levDist(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.3));
};

function bestMatch(value, list) {
  const nv = norm(value);
  if (!nv) return null;
  let best = null, bestScore = 0;
  for (const item of list) {
    const ni = norm(item);
    let s = 0;
    if (ni === nv) s = 4;
    else if (ni.includes(nv) || nv.includes(ni)) s = 3;
    else if (isTypoOf(nv, ni)) s = 2.5;
    else {
      const words = nv.split(" ");
      const niWords = ni.split(" ");
      const shared = words.filter((w) => w.length > 2 && (ni.includes(w) || niWords.some((x) => isTypoOf(w, x)))).length;
      if (shared >= 2) s = 2; else if (shared === 1) s = 1;
    }
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return bestScore >= 1 ? best : null;
}
// Which option is being talked about inside a free-text sentence?
function optionInText(text, options) {
  const nt = ` ${norm(text)} `;
  let best = null, bestScore = 0;
  for (const o of options) {
    let score = 0;
    if (nt.includes(` ${norm(o)} `)) score = 2; // exact phrase, works for short options like "IT"
    else {
      const words = norm(o).split(" ").filter((w) => w.length > 2);
      if (words.length) {
        const hit = words.filter((w) => nt.includes(` ${w}`)).length / words.length;
        if (hit >= 0.5) score = 1 + hit;
      }
    }
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return bestScore > 0 ? best : null;
}

function toIsoDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 60000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const d = new Date(String(v));
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

const normKind = (v) => {
  const t = String(v || "").toLowerCase();
  return DEVICE_KINDS.find((k) => t.includes(k.toLowerCase()))
    || (t.includes("phone") || t.includes("tab") ? "Mobile" : t.includes("pc") || t.includes("workstation") ? "Desktop" : null);
};
const normCategory = (v) => {
  const t = String(v || "").toLowerCase();
  if (!t) return null;
  return t.includes("non") ? "Non-Asset" : t.includes("asset") ? "Asset" : null;
};

export function ImportPanel({ ds, notify, user }) {
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState("both"); // both | employees | devices
  const [batches, setBatches] = useState(null);
  const [issues, setIssues] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  // AI chat
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiKey, setAiKey] = useState(() => { try { return localStorage.getItem(AI_KEY_STORAGE) || ""; } catch { return ""; } });
  const [keyOpen, setKeyOpen] = useState(false);
  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);

  const deptNames = ds.departments.map((d) => d.name);
  const employeeNames = ds.users.filter((u) => !u.offboarded).map((u) => u.name);

  const say = (who, text) => setChat((c) => [...c, { who, text }]);
  const scrollChat = () => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

  // ------------------------------------------------------------------ scanning ---
  const analyze = async (file) => {
    setBusy(true); setResult(null); setBatches(null); setIssues([]); setChat([]); setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const found = [];

      for (const sheetName of wb.SheetNames) {
        const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
        const headerIdx = grid.findIndex((row) =>
          row.filter((c) => typeof c === "string" && c.trim() && c.trim().length < 40).length >= 2);
        if (headerIdx === -1) continue;
        const headers = grid[headerIdx].map((h) => String(h || "").trim());
        const dataRows = grid.slice(headerIdx + 1).filter((r) => r.some((c) => String(c).trim() !== ""));
        if (!dataRows.length) continue;

        const mapCols = (fields) => {
          const used = new Set();
          return headers.map((h, col) => {
            if (!h) return null;
            const samples = dataRows.slice(0, 10).map((r) => r[col]).filter((v) => String(v).trim() !== "");
            let best = null, bestScore = 0;
            for (const f of fields) {
              if (used.has(f.field)) continue;
              let score = f.patterns.some((p) => p.test(h)) ? 3 : 0;
              if (samples.length) {
                const frac = (fn) => samples.filter(fn).length / samples.length;
                if (f.field === "email" && frac(looksLikeEmail) > 0.7) score += 4;
                if (f.field === "ipAddress" && frac(looksLikeIp) > 0.7) score += 4;
                if (f.field === "designation" && frac((v) => !!bestMatch(v, DESIGNATIONS)) > 0.6) score += 2;
                if (f.field === "deviceKind" && frac((v) => !!normKind(v)) > 0.6) score += 2;
                if (f.field === "department" && frac((v) => !!bestMatch(v, deptNames)) > 0.6) score += 2;
              }
              if (score > bestScore) { bestScore = score; best = f; }
            }
            if (best && bestScore >= 3) { used.add(best.field); return { col, header: h, field: best.field, label: best.label }; }
            return null;
          }).filter(Boolean);
        };
        const devMap = mapCols(DEVICE_FIELDS);
        const empMap = mapCols(EMPLOYEE_FIELDS);
        const devScore = devMap.reduce((s, m) => s + (m.field === "serialNumber" ? 3 : 1), 0);
        const empScore = empMap.reduce((s, m) => s + (m.field === "email" || m.field === "designation" ? 3 : 1), 0);
        const entity = devScore >= empScore ? "devices" : "employees";
        const mapping = entity === "devices" ? devMap : empMap;
        if (mapping.length < 2) continue;

        const rows = dataRows.map((r, i) => {
          const rec = { __row: headerIdx + i + 2, __sheet: sheetName };
          mapping.forEach((m) => { rec[m.field] = r[m.col]; });
          if (entity === "devices") {
            rec.serialNumber = String(rec.serialNumber || rec.assetNumber || "").trim();
            rec.deviceName = String(rec.deviceName || "").trim();
            rec.deviceKind = normKind(rec.deviceKind) || deviceKindOf({ deviceType: rec.deviceName }) || "Other";
            rec.assetCategory = normCategory(rec.assetCategory) || (rec.assetNumber ? "Asset" : null);
            rec.originalValue = rec.originalValue != null ? parseFloat(String(rec.originalValue).replace(/[$,৳\s]/g, "")) || 0 : 0;
            rec.warrantyExpiry = toIsoDate(rec.warrantyExpiry);
            // Employee ID is the reliable link (exact match); "Assigned To" (name/
            // e-mail/username) is the fallback for sheets that don't have it yet.
            rec.ownerEmployeeId = String(rec.ownerEmployeeId || "").trim();
            const ownerKey = String(rec.owner || "").trim();
            rec.ownerUser = rec.ownerEmployeeId
              ? ds.users.find((u) => !u.offboarded && (u.employeeId || "").toLowerCase() === rec.ownerEmployeeId.toLowerCase()) || null
              : null;
            if (!rec.ownerUser && ownerKey) {
              rec.ownerUser = ds.users.find((u) => !u.offboarded && (
                norm(u.name) === norm(ownerKey) || (u.email || "").toLowerCase() === ownerKey.toLowerCase()
                || (u.employeeId || "").toLowerCase() === ownerKey.toLowerCase() || u.username.toLowerCase() === ownerKey.toLowerCase())) || null;
            }
            rec.department = rec.department ? bestMatch(rec.department, deptNames) : null;
          } else {
            rec.name = String(rec.name || "").trim();
            rec.email = String(rec.email || "").trim().toLowerCase();
            rec.employeeId = String(rec.employeeId || "").trim();
            rec.rawDesignation = String(rec.designation || "").trim();
            rec.designation = bestMatch(rec.rawDesignation, DESIGNATIONS);
            rec.rawDepartment = String(rec.department || "").trim();
            rec.department = bestMatch(rec.rawDepartment, deptNames);
            rec.unit = rec.unit ? bestMatch(rec.unit, HR_ADMIN_UNITS) : null;
            rec.location = rec.location ? bestMatch(rec.location, ds.locations.map((l) => l.name)) : null;
            rec.floor = rec.floor != null && String(rec.floor).trim() !== "" ? parseInt(rec.floor, 10) || null : null;
            rec.mobile = String(rec.mobile || "").trim();
            rec.phone = String(rec.phone || "").trim();
          }
          return rec;
        });
        found.push({ sheetName, entity, mapping, rows, unmapped: headers.filter((h, c) => h && !mapping.some((m) => m.col === c)) });
      }

      if (!found.length) { notify("Couldn't recognize any importable sheet — download the template to see the expected format.", "crit"); setBusy(false); return; }

      const wantEntity = importMode === "employees" ? "employees" : importMode === "devices" ? "devices" : null;
      const kept = wantEntity ? found.filter((b) => b.entity === wantEntity) : found;
      const ignored = wantEntity ? found.filter((b) => b.entity !== wantEntity) : [];
      if (!kept.length) {
        notify(`No ${wantEntity} sheet found — the file only had ${ignored.map((b) => b.entity).join(", ") || "unrecognized sheets"}. Switch the import mode or check the file.`, "crit");
        setBusy(false);
        return;
      }

      const probs = collectIssues(kept);
      setBatches(kept);
      setIssues(probs);
      setBusy(false);
      if (probs.length === 0) {
        await runImport(kept, [], file.name, false);
        if (ignored.length) say("ai", `Heads up — I ignored ${ignored.map((b) => `sheet "${b.sheetName}"`).join(", ")} since you chose a ${wantEntity}-only import.`);
      } else {
        const first = probs[0];
        const totalRows = kept.reduce((s, b) => s + b.rows.length, 0);
        if (ignored.length) say("ai", `Note: I'm ignoring ${ignored.map((b) => `sheet "${b.sheetName}"`).join(", ")} since you chose a ${wantEntity}-only import.`);
        say("ai", `Hey! I scanned "${file.name}" — ${totalRows} row${totalRows === 1 ? "" : "s"} across ${kept.length} sheet${kept.length === 1 ? "" : "s"} — and I found ${probs.length} issue${probs.length === 1 ? "" : "s"} to sort out before I can deploy everyone.`);
        say("ai", `For example: ${first.message}`);
        say("ai", `You can answer me right here — try things like "put ${first.who || "them"} in the Marketing department", "make row ${first.rowNum} an Officer", "skip row ${first.rowNum}", or fix them with the controls below. Once everything's resolved, say "import" and I'll place everyone.`);
        scrollChat();
      }
    } catch (err) {
      notify("Couldn't read that file — is it a valid Excel/CSV?", "crit");
      setBusy(false);
    }
  };

  // ------------------------------------------------------- issue detection -------
  const collectIssues = (found) => {
    const probs = [];
    const seenEmails = new Set();
    const seenSerials = new Set();
    const claimed = new Set(ds.users.filter((u) => !u.offboarded && UNIQUE_DESIGNATIONS.includes(u.jobTitle))
      .map((u) => `${u.department}|${u.jobTitle}`));

    found.forEach((batch, bi) => {
      batch.rows.forEach((rec, ri) => {
        const add = (field, message, kind, options, suggestion) =>
          probs.push({ id: `${bi}-${ri}-${field}`, bi, ri, rowNum: rec.__row, who: rec.name || rec.serialNumber || rec.deviceName || "", sheet: rec.__sheet, field, message, kind, options, value: suggestion ?? "", skipped: false });
        if (batch.entity === "employees") {
          if (!rec.name) add("name", `Row ${rec.__row}: this employee has no name. Type it in, or skip the row.`, "text");
          if (!rec.email || !looksLikeEmail(rec.email)) {
            add("email", `Row ${rec.__row}${rec.name ? ` (${rec.name})` : ""}: ${rec.email ? `"${rec.email}" doesn't look like a valid e-mail` : "no e-mail found"} — the e-mail becomes their username.`, "text", null, rec.email || "");
          } else if (ds.users.some((u) => u.username === rec.email || u.email === rec.email) || seenEmails.has(rec.email)) {
            add("email", `Row ${rec.__row} (${rec.name || rec.email}): an account with ${rec.email} already exists. Give me a different e-mail, or skip the row.`, "text", null, rec.email);
          } else seenEmails.add(rec.email);
          if (!rec.department) {
            add("department", `Row ${rec.__row}${rec.name ? ` (${rec.name})` : ""}: I couldn't match ${rec.rawDepartment ? `"${rec.rawDepartment}"` : "an empty value"} to any department. Which one should it be?`, "select", deptNames, rec.rawDepartment ? bestMatch(rec.rawDepartment, deptNames) || "" : "");
          }
          if (!rec.designation) {
            add("designation", `Row ${rec.__row}${rec.name ? ` (${rec.name})` : ""}: ${rec.rawDesignation ? `"${rec.rawDesignation}" isn't one of the SQUARE designations` : "no designation given"}. Which should it be?`, "select", DESIGNATIONS, "");
          } else if (UNIQUE_DESIGNATIONS.includes(rec.designation) && rec.department) {
            const key = `${rec.department}|${rec.designation}`;
            if (claimed.has(key)) {
              const holder = ds.users.find((u) => !u.offboarded && u.department === rec.department && u.jobTitle === rec.designation);
              add("designation", `Row ${rec.__row} (${rec.name || "?"}): ${rec.department} already has a ${rec.designation}${holder ? ` (${holder.name})` : ""} — only one is allowed. Pick a different designation.`, "select", DESIGNATIONS.filter((d) => !UNIQUE_DESIGNATIONS.includes(d) || !claimed.has(`${rec.department}|${d}`)), "");
            } else claimed.add(key);
          }
          if (rec.department === HR_ADMIN_DEPT && !rec.unit) {
            add("unit", `Row ${rec.__row}${rec.name ? ` (${rec.name})` : ""}: HR and Admin is split into HR, Admin and IT — which unit? (IT joins the IT Team.)`, "select", HR_ADMIN_UNITS, "");
          }
        } else {
          if (!rec.serialNumber) add("serialNumber", `Row ${rec.__row}${rec.deviceName ? ` (${rec.deviceName})` : ""}: no serial or asset number — every device needs one.`, "text");
          else if (ds.assets.some((a) => a.serialNumber === rec.serialNumber) || seenSerials.has(rec.serialNumber)) {
            add("serialNumber", `Row ${rec.__row}: a device with serial ${rec.serialNumber} already exists. Give me a different serial, or skip the row.`, "text", null, rec.serialNumber);
          } else seenSerials.add(rec.serialNumber);
          if (!rec.deviceName) add("deviceName", `Row ${rec.__row}: no device name/model. Type it in, or skip the row.`, "text");
          const ownerGiven = rec.ownerEmployeeId || (rec.owner && String(rec.owner).trim());
          if (ownerGiven && !rec.ownerUser) {
            const who = rec.ownerEmployeeId ? `with Employee ID "${rec.ownerEmployeeId}"` : `called "${String(rec.owner).trim()}"`;
            add("owner", `Row ${rec.__row} (${rec.serialNumber || rec.deviceName}): I couldn't find an employee ${who}. Who should get this device?`, "select", ["— keep in inventory —", ...employeeNames], bestMatch(rec.owner, employeeNames) || "— keep in inventory —");
          }
        }
      });
    });
    return probs;
  };

  const unresolvedOf = (list) => list.filter((i) => !i.skipped && !String(i.value).trim());
  const unresolved = unresolvedOf(issues);

  const setIssueValue = (id, value) => setIssues((list) => list.map((i) => (i.id === id ? { ...i, value, skipped: false } : i)));
  const toggleSkip = (id) => setIssues((list) => list.map((i) => (i.id === id ? { ...i, skipped: !i.skipped } : i)));

  // ---------------------------------------------------------- chat assistant -----
  // Applies actions and returns the updated issue list + confirmations.
  const applyActions = (actions) => {
    let next = [...issues];
    const confirms = [];
    for (const a of actions) {
      const idx = next.findIndex((i) => i.id === a.id);
      if (idx === -1) continue;
      const iss = next[idx];
      if (a.skip) {
        next = next.map((i) => (i.rowNum === iss.rowNum && i.sheet === iss.sheet ? { ...i, skipped: true } : i));
        confirms.push(`Row ${iss.rowNum}${iss.who ? ` (${iss.who})` : ""} will be skipped.`);
      } else if (a.value) {
        next[idx] = { ...iss, value: a.value, skipped: false };
        confirms.push(`Row ${iss.rowNum}${iss.who ? ` (${iss.who})` : ""}: ${iss.field} → ${a.value}.`);
      }
    }
    setIssues(next);
    return { next, confirms };
  };

  // Built-in offline language parser — no API key needed.
  const localResolve = (text) => {
    const t = ` ${text.toLowerCase()} `;
    const open = unresolvedOf(issues);

    if (/\b(import|deploy|proceed|go ahead|confirm|place them|do it)\b/.test(t)) {
      return { command: "import", reply: null, actions: [] };
    }
    if (/skip (all|everything|the rest)/.test(t)) {
      return { reply: "Okay — skipping every remaining problem row.", actions: open.map((i) => ({ id: i.id, skip: true })) };
    }

    // Which rows is the user talking about? Row number, full name, or any name word.
    let targets = open;
    const rowM = t.match(/row\s*#?\s*(\d+)/);
    if (rowM) targets = issues.filter((i) => i.rowNum === Number(rowM[1]));
    else {
      const mentions = (who) => {
        if (!who) return false;
        const w = who.toLowerCase();
        if (t.includes(w)) return true;
        return w.split(/\s+/).some((part) => part.length > 2 && t.includes(` ${part}`));
      };
      const byName = issues.filter((i) => mentions(i.who));
      if (byName.length) targets = byName;
    }
    if (!targets.length) return { reply: "I couldn't tell which row you mean — mention the row number (e.g. \"row 4\") or the person's name.", actions: [] };

    if (/\bskip\b/.test(t)) return { reply: null, actions: [{ id: targets[0].id, skip: true }], confirmsOnly: true };

    // Which field?
    let fieldHint = null;
    if (/depart|dept/.test(t)) fieldHint = "department";
    else if (/designation|position|job title|make (him|her|them|it) an? /.test(t)) fieldHint = "designation";
    else if (/\bunit\b/.test(t)) fieldHint = "unit";
    else if (/mail/.test(t)) fieldHint = "email";
    else if (/serial/.test(t)) fieldHint = "serialNumber";
    else if (/owner|assign|give (it|the device)/.test(t)) fieldHint = "owner";
    else if (/name/.test(t)) fieldHint = "name";

    let candidates = fieldHint ? targets.filter((i) => i.field === fieldHint) : targets;
    if (!candidates.length) candidates = targets;
    const actions = [];

    for (const iss of candidates) {
      if (iss.kind === "select") {
        const picked = optionInText(text, iss.options);
        if (picked) { actions.push({ id: iss.id, value: picked }); if (!fieldHint) break; continue; }
      } else {
        if (iss.field === "email") {
          const em = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
          if (em) { actions.push({ id: iss.id, value: em[0].toLowerCase() }); break; }
        } else {
          const tail = text.match(/(?:\bto\b|\bis\b|=|:)\s+"?([^"]+?)"?\s*$/i);
          if (tail) { actions.push({ id: iss.id, value: tail[1].trim() }); break; }
        }
      }
    }
    if (!actions.length) {
      const iss = candidates[0];
      const hint = iss.kind === "select" ? `one of: ${iss.options.slice(0, 6).join(", ")}${iss.options.length > 6 ? ", …" : ""}` : "the value you want";
      return { reply: `I understood you mean row ${iss.rowNum}${iss.who ? ` (${iss.who})` : ""}, but I couldn't pick out ${hint}. Try e.g. "row ${iss.rowNum} ${iss.field} to <value>".`, actions: [] };
    }
    return { reply: null, actions };
  };

  // Optional: real AI via the Anthropic API (key stored locally in the browser).
  const apiResolve = async (text) => {
    const openIssues = unresolvedOf(issues).map((i) => ({ id: i.id, row: i.rowNum, who: i.who, field: i.field, question: i.message, options: i.options || null }));
    const sys = `You resolve spreadsheet-import problems for an IT portal. Open issues (JSON): ${JSON.stringify(openIssues)}. Valid departments: ${deptNames.join("; ")}. Valid designations: ${DESIGNATIONS.join("; ")}. Valid units: ${HR_ADMIN_UNITS.join("; ")}. Respond with ONLY minified JSON, no prose: {"reply":"short friendly confirmation","actions":[{"id":"<issue id>","value":"<exact option or text>"} or {"id":"<issue id>","skip":true} or {"command":"import"}]}. Values for select-type issues MUST exactly match one of that issue's options.`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": aiKey, "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5", max_tokens: 600, system: sys,
        messages: [...chat.slice(-8).map((m) => ({ role: m.who === "ai" ? "assistant" : "user", content: m.text })), { role: "user", content: text }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const raw = (data.content?.[0]?.text || "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    const cmd = (parsed.actions || []).find((a) => a.command === "import");
    return { reply: parsed.reply || null, actions: (parsed.actions || []).filter((a) => a.id), command: cmd ? "import" : null };
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || busy) return;
    setChatInput("");
    say("user", text);
    scrollChat();
    setAiThinking(true);
    let out;
    if (aiKey) {
      try { out = await apiResolve(text); }
      catch { out = { ...localResolve(text), note: "(the API call failed, so I used my built-in understanding)" }; }
    } else out = localResolve(text);
    setAiThinking(false);

    if (out.command === "import") {
      if (unresolved.length > 0) {
        say("ai", `Not yet — ${unresolved.length} issue${unresolved.length === 1 ? "" : "s"} still need${unresolved.length === 1 ? "s" : ""} an answer: ${unresolved.slice(0, 3).map((i) => `row ${i.rowNum} (${i.field})`).join(", ")}${unresolved.length > 3 ? ", …" : ""}.`);
        scrollChat();
      } else {
        say("ai", "On it — deploying everyone now…");
        scrollChat();
        await runImport(batches, issues, fileName, true);
      }
      return;
    }

    const { next, confirms } = applyActions(out.actions || []);
    const left = unresolvedOf(next).length;
    const parts = [];
    if (out.reply) parts.push(out.reply);
    if (confirms.length) parts.push(confirms.join(" "));
    if (out.note) parts.push(out.note);
    if (confirms.length) parts.push(left === 0 ? "That was the last one — say \"import\" (or press the button) and I'll place everyone. 🎉" : `${left} issue${left === 1 ? "" : "s"} left.`);
    say("ai", parts.join(" ") || "Hmm, nothing to change there.");
    scrollChat();
  };

  // ------------------------------------------------------------------ import -----
  const runImport = async (foundArg, issuesArg, fname, viaChat) => {
    const found = foundArg || batches;
    const fixes = issuesArg || issues;
    if (!found) return;
    setBusy(true);
    const ok = [], skipped = [], creds = [];

    const skipSet = new Set();
    fixes.forEach((f) => {
      const rec = found[f.bi].rows[f.ri];
      if (f.skipped) { skipSet.add(`${f.bi}-${f.ri}`); return; }
      const v = String(f.value).trim();
      if (!v) return;
      if (f.field === "owner") {
        rec.ownerUser = v === "— keep in inventory —" ? null : ds.users.find((u) => u.name === v) || null;
      } else rec[f.field] = f.field === "email" ? v.toLowerCase() : v;
    });

    const total = found.reduce((s, b) => s + b.rows.length, 0);
    let done = 0;
    for (let bi = 0; bi < found.length; bi++) {
      const batch = found[bi];
      for (let ri = 0; ri < batch.rows.length; ri++) {
        const rec = batch.rows[ri];
        setProgress({ done: done++, total });
        if (skipSet.has(`${bi}-${ri}`)) { skipped.push({ row: rec.__row, sheet: rec.__sheet, reason: "Skipped by you" }); continue; }
        if (batch.entity === "employees") {
          if (!rec.name || !rec.email || !looksLikeEmail(rec.email)) { skipped.push({ row: rec.__row, sheet: rec.__sheet, reason: "Missing name or valid e-mail" }); continue; }
          if (ds.users.some((u) => u.username === rec.email) || ok.some((o) => o.key === rec.email)) { skipped.push({ row: rec.__row, sheet: rec.__sheet, reason: `${rec.email} already exists` }); continue; }
          const r = await ds.onboardEmployee({
            name: rec.name, email: rec.email, employeeId: rec.employeeId || null,
            designation: rec.designation, department: rec.department || deptNames[0],
            unit: rec.department === HR_ADMIN_DEPT ? rec.unit || "HR" : null,
            mobile: rec.mobile, phone: rec.phone,
            location: rec.location, floor: rec.floor, managerUsername: user?.username || null,
          });
          if (r.ok) { ok.push({ key: rec.email, text: `${rec.name} → ${rec.department || deptNames[0]}${rec.unit ? ` (${rec.unit} unit)` : ""} as ${rec.designation || "—"}` }); creds.push({ user: rec.email, pass: r.tempPassword }); }
          else skipped.push({ row: rec.__row, sheet: rec.__sheet, reason: r.error || "Server rejected the record" });
        } else {
          if (!rec.serialNumber || !rec.deviceName) { skipped.push({ row: rec.__row, sheet: rec.__sheet, reason: "Missing serial or device name" }); continue; }
          if (ds.assets.some((a) => a.serialNumber === rec.serialNumber) || ok.some((o) => o.key === rec.serialNumber)) { skipped.push({ row: rec.__row, sheet: rec.__sheet, reason: `Serial ${rec.serialNumber} already exists` }); continue; }
          const r = await ds.registerDevice({
            serialNumber: rec.serialNumber, deviceType: rec.deviceName, deviceKind: rec.deviceKind,
            prNumber: rec.prNumber ? String(rec.prNumber).trim() : null,
            assetCategory: rec.assetCategory, assetNumber: rec.assetNumber ? String(rec.assetNumber).trim() : null,
            supplierName: rec.supplierName ? String(rec.supplierName).trim() : null,
            department: rec.ownerUser?.department || rec.department,
            ipAddress: rec.ipAddress ? String(rec.ipAddress).trim() : null,
            specifications: rec.specifications ? String(rec.specifications).trim() : "",
            originalValue: rec.originalValue, warrantyExpiry: rec.warrantyExpiry,
            userId: rec.ownerUser?.id ?? null,
          });
          if (r.ok) ok.push({ key: rec.serialNumber, text: `${rec.serialNumber} · ${rec.deviceName}${rec.ownerUser ? ` → ${rec.ownerUser.name}` : " → inventory (New)"}` });
          else skipped.push({ row: rec.__row, sheet: rec.__sheet, reason: "Server rejected the record" });
        }
      }
    }
    setProgress(null);

    // History / audit entry
    const hadIssues = fixes.length > 0;
    const status = ok.length === 0 ? "Failed" : hadIssues ? "Resolved via AI Chat" : "Success";
    await ds.addImportLog({
      fileName: fname || fileName || "unknown", status,
      recordsAdded: ok.length, recordsSkipped: skipped.length,
      details: [...ok.map((o) => o.text), ...skipped.map((s) => `Skipped row ${s.row} (${s.sheet}): ${s.reason}`)],
    });

    setResult({ ok, skipped, creds, status });
    setBatches(null); setIssues([]);
    if (viaChat) say("ai", `Done! ${ok.length} record${ok.length === 1 ? "" : "s"} imported${skipped.length ? `, ${skipped.length} skipped` : ""} — everything is placed and logged in the import history.`);
    setBusy(false);
    notify(`Import complete — ${ok.length} imported, ${skipped.length} skipped.`, ok.length ? "ok" : "crit");
  };

  const saveKey = (v) => {
    setAiKey(v);
    try { v ? localStorage.setItem(AI_KEY_STORAGE, v) : localStorage.removeItem(AI_KEY_STORAGE); } catch { /* private mode */ }
  };

  const copyCreds = () => {
    navigator.clipboard?.writeText(result.creds.map((c) => `${c.user}  ->  ${c.pass}`).join("\n"));
    notify("All credentials copied to clipboard.", "ok");
  };

  const reset = () => { setBatches(null); setIssues([]); setResult(null); setFileName(""); setChat([]); if (fileRef.current) fileRef.current.value = ""; };

  const statusTone = (s) => (s === "Success" ? "ok" : s === "Failed" ? "crit" : "brand");

  return (
    <Section eyebrow="Automated data extraction & mapping · AI troubleshooter · audit log" title="Import data">
      <div className="sq-card" style={{ maxWidth: 940 }}>
        <div className="sq-pool-head"><Sparkles size={16} /> Smart Excel import</div>
        <p className="sq-cell-desc" style={{ marginBottom: 14 }}>
          Upload any Excel or CSV — every sheet and every row is parsed and validated. If everything
          checks out, the data is <strong>deployed instantly</strong> into the right departments.
          If anything is unclear, the assistant opens a chat and you fix it in plain language — no re-upload.
        </p>
        <div className="sq-comp" style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <span className="sq-eyebrow">Import</span>
          <div className="sq-segment">
            <button className={importMode === "both" ? "is-on" : ""} onClick={() => setImportMode("both")} disabled={busy}>Employees & devices</button>
            <button className={importMode === "employees" ? "is-on" : ""} onClick={() => setImportMode("employees")} disabled={busy}>Employees only</button>
            <button className={importMode === "devices" ? "is-on" : ""} onClick={() => setImportMode("devices")} disabled={busy}>Devices only</button>
          </div>
        </div>
        <div className="sq-warranty-actions" style={{ flexWrap: "wrap" }}>
          <Btn variant="primary" icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy && !progress ? "Scanning…" : "Upload Excel / CSV"}
          </Btn>
          <a href="/import-template.xlsx" download><Btn icon={Download}>Download template</Btn></a>
          <Btn icon={History} onClick={() => setHistoryOpen(!historyOpen)}>Import history{ds.importLogs?.length ? ` (${ds.importLogs.length})` : ""}</Btn>
          <Btn icon={KeyRound} onClick={() => setKeyOpen(!keyOpen)}>{aiKey ? "AI: connected" : "Connect AI (optional)"}</Btn>
          {fileName && <span className="sq-comp"><FileSpreadsheet size={14} />{fileName}</span>}
          {(batches || result) && <Btn onClick={reset}>Start over</Btn>}
        </div>
        {keyOpen && (
          <div className="sq-form" style={{ marginTop: 12, maxWidth: 560 }}>
            <label className="sq-field"><span className="sq-label">Anthropic API key (stored only in this browser)</span>
              <input className="sq-input" type="password" value={aiKey} onChange={(e) => saveKey(e.target.value)} placeholder="sk-ant-…  (leave empty to use the built-in offline assistant)" />
            </label>
            <p className="sq-cell-desc">With a key, the chat uses Claude to understand anything you type. Without one, a built-in parser handles common phrasings like "put NAME in DEPARTMENT" — the feature works either way.</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); }} />
      </div>

      {/* ------------------------------ Import history / audit log ------------- */}
      {historyOpen && (
        <div className="sq-card" style={{ marginTop: 16, maxWidth: 940 }}>
          <div className="sq-pool-head"><History size={16} /> Import history</div>
          {!ds.importLogs?.length ? (
            <Empty icon={History} title="No imports yet" hint="Every import run will be logged here with its full details." />
          ) : (
            <div className="sq-stack" style={{ gap: 8 }}>
              {ds.importLogs.map((l) => (
                <div key={l.id} className="sq-card sq-roster-card">
                  <button type="button" className="sq-roster-toggle" onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)}>
                    <FileSpreadsheet size={17} style={{ flex: "none", color: "var(--brand)" }} />
                    <span className="sq-roster-toggle-text">
                      <span className="sq-cell-strong">{l.fileName}</span>
                      <span className="sq-cell-desc">{new Date(l.createdAt).toLocaleString()} · {l.recordsAdded} record{l.recordsAdded === 1 ? "" : "s"} imported{l.recordsSkipped ? ` · ${l.recordsSkipped} skipped` : ""}</span>
                    </span>
                    <Badge tone={statusTone(l.status)} dot={false}>{l.status}</Badge>
                    <ChevronRight size={16} className={`sq-chev${expandedLog === l.id ? " is-open" : ""}`} />
                  </button>
                  {expandedLog === l.id && (
                    <div className="sq-roster-body">
                      {(l.details || []).length === 0 ? <div className="sq-cell-desc">No detail lines recorded.</div>
                        : (l.details || []).map((d, i) => (
                          <div key={i} className="sq-comp">
                            {d.startsWith("Skipped") ? <X size={13} color="var(--crit)" /> : <Check size={13} color="var(--brand)" />}
                            <span style={{ fontSize: 12.5 }}>{d}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------ Scan result + issues + AI chat ---------- */}
      {(batches || chat.length > 0) && (
        <div className="sq-grid cols-2" style={{ marginTop: 16, maxWidth: 1200, alignItems: "start" }}>
          {batches ? (
          <div className="sq-card">
            <div className="sq-pool-head"><Check size={16} /> Scanned {batches.length} sheet{batches.length === 1 ? "" : "s"}</div>
            {batches.map((b, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div className="sq-cell-strong" style={{ marginBottom: 6 }}>
                  Sheet “{b.sheetName}” — {b.entity === "devices" ? "Device list" : "Employee list"} <Badge tone="brand" dot={false}>{b.rows.length} row{b.rows.length === 1 ? "" : "s"}</Badge>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {b.mapping.map((m) => (
                    <span key={m.col} className="sq-badge ok" style={{ fontFamily: "inherit" }}>
                      {m.header} <ArrowRight size={11} style={{ margin: "0 2px" }} /> {m.label}
                    </span>
                  ))}
                  {b.unmapped.map((h) => <span key={h} className="sq-badge neutral" style={{ fontFamily: "inherit" }}>{h} · ignored</span>)}
                </div>
              </div>
            ))}
            {issues.length > 0 && (
              <>
                <div className="sq-pool-head" style={{ marginTop: 6 }}><Bot size={16} /> Open issues</div>
                <div className="sq-stack" style={{ gap: 10 }}>
                  {issues.map((iss) => (
                    <div key={iss.id} className="sq-card" style={{ padding: 12, opacity: iss.skipped ? 0.55 : 1 }}>
                      <div className="sq-comp" style={{ alignItems: "flex-start", marginBottom: 8 }}>
                        <Bot size={14} style={{ flex: "none", marginTop: 2, color: "var(--brand)" }} />
                        <span style={{ fontSize: 12.5 }}>{iss.message}</span>
                      </div>
                      <div className="sq-warranty-actions">
                        {iss.kind === "select" ? (
                          <select className="sq-input" style={{ width: "auto", minWidth: 200 }} value={iss.value} disabled={iss.skipped}
                            onChange={(e) => setIssueValue(iss.id, e.target.value)}>
                            <option value="">Choose…</option>
                            {iss.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input className="sq-input" style={{ width: 230 }} value={iss.value} disabled={iss.skipped}
                            onChange={(e) => setIssueValue(iss.id, e.target.value)} placeholder="Type the correct value…" />
                        )}
                        <Btn size="sm" variant={iss.skipped ? "primary" : "ghost"} onClick={() => toggleSkip(iss.id)}>
                          {iss.skipped ? "Un-skip" : "Skip row"}
                        </Btn>
                        {!iss.skipped && String(iss.value).trim() && <Badge tone="ok"><Check size={11} style={{ marginRight: 2 }} />resolved</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sq-form-actions" style={{ marginTop: 12 }}>
                  <Btn variant="primary" icon={Check} onClick={() => runImport(null, null, fileName, false)} disabled={busy || unresolved.length > 0}>
                    {progress ? `Importing ${progress.done + 1}/${progress.total}…`
                      : unresolved.length > 0 ? `Answer ${unresolved.length} more to import` : "Apply fixes & import"}
                  </Btn>
                </div>
              </>
            )}
          </div>
          ) : <span />}

          {/* AI chat side panel */}
          <div className="sq-card sq-chat">
            <div className="sq-pool-head"><Bot size={16} /> Import assistant {aiKey ? <Badge tone="brand" dot={false}>Claude API</Badge> : <Badge tone="neutral" dot={false}>built-in</Badge>}</div>
            <div className="sq-chat-log">
              {chat.map((m, i) => (
                <div key={i} className={`sq-chat-msg ${m.who}`}>
                  <span className="sq-chat-ic">{m.who === "ai" ? <Bot size={14} /> : <User size={14} />}</span>
                  <span className="sq-chat-bubble">{m.text}</span>
                </div>
              ))}
              {aiThinking && <div className="sq-chat-msg ai"><span className="sq-chat-ic"><Bot size={14} /></span><span className="sq-chat-bubble sq-dim">thinking…</span></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="sq-chat-inputrow">
              <input className="sq-input" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder='e.g. "put Nadim in the Marketing department"' />
              <Btn variant="primary" icon={SendHorizonal} onClick={sendChat} disabled={busy || aiThinking || !chatInput.trim()}>Send</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ Result ---------------------------------- */}
      {result && (
        <div className="sq-card" style={{ marginTop: 16, maxWidth: 940 }}>
          <div className="sq-pool-head"><Check size={16} /> Import finished <Badge tone={statusTone(result.status)} dot={false}>{result.status}</Badge></div>
          <div className="sq-stack" style={{ gap: 6 }}>
            {result.ok.map((o) => <div key={o.key} className="sq-comp"><Check size={13} color="var(--brand)" />{o.text}</div>)}
            {result.skipped.map((s, i) => <div key={i} className="sq-comp"><X size={13} color="var(--crit)" />Row {s.row} ({s.sheet}): {s.reason}</div>)}
            {result.ok.length === 0 && result.skipped.length === 0 && <Empty icon={FileSpreadsheet} title="Nothing to import" />}
          </div>
          {result.creds.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="sq-cell-desc" style={{ marginBottom: 8 }}>Login credentials for the new employees — copy and share; each person changes their password from My Account:</div>
              <div className="sq-stack" style={{ gap: 4 }}>
                {result.creds.map((c) => <div key={c.user} className="sq-mono sq-cell-desc">{c.user} → {c.pass}</div>)}
              </div>
              <div className="sq-form-actions" style={{ marginTop: 10 }}>
                <Btn icon={Copy} onClick={copyCreds}>Copy all credentials</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
