import { useState, useEffect, useMemo } from "react";
import { Home, DollarSign, BarChart3, Server, FileText, Layers, Users, Activity, ShieldAlert, Radio, Clock, Zap, CheckCircle2, UserRound, LogOut, Search } from "lucide-react";
import { API_BASE, money } from "../data/constants";
import { authFetch, REQUEST_TIMEOUT_MS } from "../data/useDataSource";
import { assetValuation, assetValuationByDepartment, activityFeed, FEED_ICON, FEED_TONE } from "../data/derived";
import { Shell, Section } from "../components/Shell";
import { Stat, Empty, Bar, Badge, Donut, DonutLegend } from "../components/primitives";
import { AccountPanel, SignOutModal } from "../components/Account";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PROBLEM_TONE = { "Hardware Malfunction": "crit", "Network/Wi-Fi Outage": "warn", "Software Crash": "info", "Printer Error": "neutral", "Other": "brand" };
const actionLabel = (a) => (a || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ----------------------------------- Admin --------------------------------------- */
export default function AdminDashboard({ ds, user, notify, onSignOut, homeTick }) {
  const [view, setView] = useState("overview");
  const [signOutOpen, setSignOutOpen] = useState(false);

  // The SQUARE logo in the top bar jumps back to Home
  useEffect(() => { if (homeTick) setView("overview"); }, [homeTick]);
  const t = ds.tickets;

  const metrics = useMemo(() => {
    const open = t.filter((x) => x.status === "OPEN").length;
    const solving = t.filter((x) => x.status === "SOLVING").length;
    const resolved = t.filter((x) => x.status === "CLOSED").length;
    const byProblem = {};
    const byProblemResolved = {};
    t.forEach((x) => {
      byProblem[x.problemType] = (byProblem[x.problemType] || 0) + 1;
      if (x.status === "CLOSED") byProblemResolved[x.problemType] = (byProblemResolved[x.problemType] || 0) + 1;
    });
    const problems = Object.entries(byProblem)
      .map(([k, v]) => ({ k, v, resolved: byProblemResolved[k] || 0, rate: v ? Math.round(((byProblemResolved[k] || 0) / v) * 100) : 0 }))
      .sort((a, b) => b.v - a.v);
    const problemMax = problems.reduce((m, c) => Math.max(m, c.v), 0);
    const resolveRate = t.length ? Math.round((resolved / t.length) * 100) : 0;
    return { open, solving, resolved, problems, problemMax, resolveRate, count: t.length };
  }, [t]);

  const expiredAssets = useMemo(() => ds.assets.filter((a) => a.serialNumber != null && a.status !== "SCRAPPED" && a.warrantyDaysRemaining <= 0).length, [ds.assets]);
  const [valueGroupBy, setValueGroupBy] = useState("type"); // type | department
  const valuation = useMemo(
    () => (valueGroupBy === "department" ? assetValuationByDepartment(ds.users, ds.assets) : assetValuation(ds.assets)),
    [valueGroupBy, ds.users, ds.assets]);
  const feed = useMemo(() => activityFeed(ds.tickets, ds.assets), [ds.tickets, ds.assets]);

  // Audit log — real privileged-action events, filterable by year/month/action/search
  const [auditYear, setAuditYear] = useState("ALL");
  const [auditMonth, setAuditMonth] = useState("ALL");
  const [auditAction, setAuditAction] = useState("ALL");
  const [auditSearch, setAuditSearch] = useState("");
  const auditYears = useMemo(() => Array.from(new Set(ds.auditEvents.map((e) => new Date(e.at).getFullYear()))).sort((a, b) => b - a), [ds.auditEvents]);
  const auditActions = useMemo(() => Array.from(new Set(ds.auditEvents.map((e) => e.action))).sort(), [ds.auditEvents]);
  const auditFiltered = useMemo(() => ds.auditEvents.filter((e) => {
    const d = new Date(e.at);
    if (auditYear !== "ALL" && d.getFullYear() !== Number(auditYear)) return false;
    if (auditMonth !== "ALL" && d.getMonth() + 1 !== Number(auditMonth)) return false;
    if (auditAction !== "ALL" && e.action !== auditAction) return false;
    const q = auditSearch.trim().toLowerCase();
    if (!q) return true;
    return (e.actorUsername || "").toLowerCase().includes(q) || (e.action || "").toLowerCase().includes(q)
      || (e.target || "").toLowerCase().includes(q) || (e.detail || "").toLowerCase().includes(q);
  }), [ds.auditEvents, auditYear, auditMonth, auditAction, auditSearch]);

  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(false);
  useEffect(() => {
    if (view !== "health") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/admin/health`, { signal: AbortSignal.timeout?.(REQUEST_TIMEOUT_MS) });
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        if (!cancelled) { setHealth(data); setHealthError(false); }
      } catch {
        if (!cancelled) setHealthError(true);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [view]);

  const items = [
    { key: "overview", label: "Home", icon: Home },
    { key: "valuation", label: "Asset valuation", icon: DollarSign },
    { key: "components", label: "Problem breakdown", icon: BarChart3 },
    { key: "health", label: "System health", icon: Server },
    { key: "audit", label: "Audit log", icon: FileText },
    { key: "account", label: "My Account", icon: UserRound },
    { key: "signout", label: "Sign Out", icon: LogOut },
  ];

  const handleSelect = (k) => { if (k === "signout") setSignOutOpen(true); else setView(k); };

  return (
    <Shell items={items} active={view} onSelect={handleSelect}>
        {view === "account" && <AccountPanel ds={ds} user={user} notify={notify} onDone={() => setView("overview")} />}
        {view === "overview" && (
          <Section eyebrow="Computed from live assets & tickets" title="Operations overview">
            <div className="sq-grid cols-3">
              <Stat label="Capitalized value" value={money(valuation.totalOriginal)} sub="original asset value" tone="brand" icon={DollarSign} />
              <Stat label="Book value" value={money(valuation.totalBook)} sub="after depreciation" tone="info" icon={Layers} />
              <Stat label="Active users" value={ds.users.length} sub="across all roles" tone="neutral" icon={Users} />
              <Stat label="Live open tickets" value={metrics.open + metrics.solving} sub={`${metrics.solving} being solved`} tone={metrics.open ? "warn" : "neutral"} icon={Activity} />
              <Stat label="Out of warranty" value={expiredAssets} sub="assets need review" tone={expiredAssets ? "warn" : "neutral"} icon={ShieldAlert} />
              <Stat label="System status" value={ds.mode === "live" ? "Live" : "Demo"} sub={ds.mode === "live" ? "Postgres connected" : "backend offline"} tone={ds.mode === "live" ? "ok" : "warn"} icon={Radio} />
            </div>
            <div className="sq-grid cols-2" style={{ marginTop: 16 }}>
              <div className="sq-card sq-health">
                <div className="sq-health-head"><Server size={15} /> Platform</div>
                <div className="sq-health-grid">
                  <div><span className="sq-eyebrow">Datasource</span><div className={`sq-mono ${ds.mode === "live" ? "sq-pos" : "sq-warnt"}`}>{ds.mode === "live" ? "PostgreSQL · connected" : "Demo · backend offline"}</div></div>
                  <div><span className="sq-eyebrow">Assets tracked</span><div className="sq-mono">{ds.assets.filter((a) => a.serialNumber != null).length}</div></div>
                  <div><span className="sq-eyebrow">Resolve rate</span><div className="sq-mono">{metrics.resolveRate}%</div></div>
                </div>
              </div>
              <div className="sq-card sq-feed">
                <div className="sq-health-head"><Radio size={15} /> Live activity</div>
                <div className="sq-feed-list">
                  {feed.length === 0 ? <div className="sq-cell-desc">No activity yet.</div> : feed.map((e) => {
                    const Ic = FEED_ICON[e.kind] || Activity;
                    return (
                      <div key={e.id} className="sq-feed-row">
                        <span className={`sq-feed-ic ${FEED_TONE[e.kind]}`}><Ic size={13} strokeWidth={2.2} /></span>
                        <span className="sq-feed-text">{e.text}</span>
                        <span className="sq-mono sq-dim sq-feed-time">{new Date(e.at).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>
        )}

        {view === "valuation" && (
          <Section eyebrow="Straight-line depreciation" title="Asset valuation"
            action={
              <div className="sq-segment">
                <button className={valueGroupBy === "type" ? "is-on" : ""} onClick={() => setValueGroupBy("type")}>By device type</button>
                <button className={valueGroupBy === "department" ? "is-on" : ""} onClick={() => setValueGroupBy("department")}>By department</button>
              </div>
            }>
            {valuation.byType.length > 0 && (
              <div className="sq-card" style={{ marginBottom: 16 }}>
                <div className="sq-pool-head"><DollarSign size={16} /> Book value composition</div>
                <div className="sq-donut-row">
                  <Donut data={valuation.byType.map((row, i) => ({ label: row.type, value: row.book, tone: ["brand", "info", "warn", "crit", "neutral"][i % 5] }))}
                    centerValue={money(valuation.totalBook)} centerLabel="book value" />
                  <DonutLegend data={valuation.byType.map((row, i) => ({ label: row.type, value: row.book, tone: ["brand", "info", "warn", "crit", "neutral"][i % 5] }))} />
                </div>
              </div>
            )}
            <div className="sq-card">
              <div className="sq-eyebrow" style={{ marginBottom: 14 }}>Original vs. book value · by {valueGroupBy === "department" ? "department" : "device type"}</div>
              {valuation.byType.length === 0 ? <Empty icon={DollarSign} title="No assets yet" /> : valuation.byType.map((row) => (
                <div key={row.type} className="sq-val-row">
                  <Bar label={`${row.type} · original`} value={row.original} max={valuation.byType[0].original} sub={money(row.original)} tone="brand" />
                  <Bar label={`${row.type} · book value`} value={row.book} max={valuation.byType[0].original} sub={money(row.book)} tone="info" />
                </div>
              ))}
            </div>
          </Section>
        )}

        {view === "health" && (
          <Section eyebrow="Live · polled every 5s" title="System health">
            {!health && healthError ? (
              <Empty icon={Server} title="Unavailable — backend offline" hint="Live HikariCP and async executor metrics need a reachable backend." />
            ) : !health ? (
              <Empty icon={Server} title="Connecting…" />
            ) : (
              <div className="sq-grid cols-4">
                <Stat label="DB active connections" value={health.database?.activeConnections ?? "—"} sub={`of ${health.database?.maxPoolSize ?? "—"} max`} tone="brand" icon={Server} />
                <Stat label="DB idle connections" value={health.database?.idleConnections ?? "—"} sub={health.database?.poolName || "HikariCP"} tone="ok" icon={Server} />
                <Stat label="Threads awaiting" value={health.database?.threadsAwaitingConnection ?? "—"} sub="connection pool" tone={health.database?.threadsAwaitingConnection ? "warn" : "neutral"} icon={Clock} />
                <Stat label="Async active tasks" value={health.async?.activeCount ?? "—"} sub={`pool ${health.async?.poolSize ?? "—"}/${health.async?.maxPoolSize ?? "—"}`} tone="info" icon={Zap} />
                <Stat label="Async queue depth" value={health.async?.queueSize ?? "—"} sub={`capacity ${health.async?.queueCapacity ?? "—"}`} tone={health.async?.queueSize ? "warn" : "neutral"} icon={Layers} />
                <Stat label="Completed async tasks" value={health.async?.completedTaskCount ?? "—"} sub="since startup" tone="neutral" icon={CheckCircle2} />
              </div>
            )}
          </Section>
        )}

        {view === "components" && (
          <Section eyebrow="Where problems cluster" title="Problem breakdown">
            {metrics.problems.length > 0 && (
              <div className="sq-card" style={{ marginBottom: 16 }}>
                <div className="sq-pool-head"><BarChart3 size={16} /> Share of tickets by problem type</div>
                <div className="sq-donut-row">
                  <Donut data={metrics.problems.map((c) => ({ label: c.k, value: c.v, tone: PROBLEM_TONE[c.k] || "neutral" }))}
                    centerValue={metrics.count} centerLabel="tickets" />
                  <DonutLegend data={metrics.problems.map((c) => ({ label: c.k, value: c.v, tone: PROBLEM_TONE[c.k] || "neutral" }))} />
                </div>
              </div>
            )}
            <div className="sq-card">
              <div className="sq-eyebrow" style={{ marginBottom: 14 }}>By problem type · {metrics.count} tickets</div>
              {metrics.problems.length === 0 ? <Empty icon={BarChart3} title="No data yet" /> :
                metrics.problems.map((c) => (
                  <Bar key={c.k} label={c.k} value={c.v} max={metrics.problemMax}
                    sub={`${c.v} · ${Math.round((c.v / metrics.count) * 100)}% of tickets · ${c.rate}% resolved`}
                    tone={PROBLEM_TONE[c.k] || "brand"} />
                ))}
            </div>
          </Section>
        )}

        {view === "audit" && (
          <Section eyebrow={`${ds.auditEvents.length} recent record${ds.auditEvents.length === 1 ? "" : "s"}`} title="Audit log"
            action={
              <div className="sq-warranty-actions">
                <div className="sq-search sq-search-sm">
                  <Search size={14} />
                  <input className="sq-input sq-search-input" placeholder="Search actor, action, target…" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
                </div>
                <select className="sq-input" style={{ width: "auto" }} value={auditYear} onChange={(e) => setAuditYear(e.target.value)}>
                  <option value="ALL">All years</option>
                  {auditYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select className="sq-input" style={{ width: "auto" }} value={auditMonth} onChange={(e) => setAuditMonth(e.target.value)}>
                  <option value="ALL">All months</option>
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select className="sq-input" style={{ width: "auto" }} value={auditAction} onChange={(e) => setAuditAction(e.target.value)}>
                  <option value="ALL">All actions</option>
                  {auditActions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
                </select>
              </div>
            }>
            <div className="sq-card sq-table-card">
              {auditFiltered.length === 0 ? <Empty icon={FileText} title="No matching audit records" /> : (
                <table className="sq-table">
                  <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
                  <tbody>
                    {auditFiltered.map((e) => (
                      <tr key={e.id}>
                        <td className="sq-mono sq-dim">{new Date(e.at).toLocaleString()}</td>
                        <td className="sq-cell-strong">{e.actorUsername}{e.actorRole && <span className="sq-dim"> · {e.actorRole}</span>}</td>
                        <td><Badge tone="brand" dot={false}>{actionLabel(e.action)}</Badge></td>
                        <td className="sq-mono sq-dim">{e.target || "—"}</td>
                        <td className="sq-cell-desc">{e.detail || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Section>
        )}

      <SignOutModal open={signOutOpen} onCancel={() => setSignOutOpen(false)} onConfirm={onSignOut} />
    </Shell>
  );
}
