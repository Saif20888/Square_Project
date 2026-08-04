import { useState, useEffect, useMemo } from "react";
import { Home, DollarSign, BarChart3, Server, FileText, Layers, Users, Activity, ShieldAlert, Radio, Clock, Zap, CheckCircle2, UserRound, LogOut } from "lucide-react";
import { API_BASE, money } from "../data/constants";
import { authFetch } from "../data/useDataSource";
import { assetValuation, activityFeed, FEED_ICON, FEED_TONE } from "../data/derived";
import { Shell, Section } from "../components/Shell";
import { Stat, Empty, Bar, StatusBadge } from "../components/primitives";
import { AccountPanel, SignOutModal } from "../components/Account";

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
    t.forEach((x) => { byProblem[x.problemType] = (byProblem[x.problemType] || 0) + 1; });
    const problems = Object.entries(byProblem).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    const problemMax = problems.reduce((m, c) => Math.max(m, c.v), 0);
    const resolveRate = t.length ? Math.round((resolved / t.length) * 100) : 0;
    return { open, solving, resolved, problems, problemMax, resolveRate, count: t.length };
  }, [t]);

  const expiredAssets = useMemo(() => ds.assets.filter((a) => a.status !== "SCRAPPED" && a.warrantyDaysRemaining <= 0).length, [ds.assets]);
  const valuation = useMemo(() => assetValuation(ds.assets), [ds.assets]);
  const feed = useMemo(() => activityFeed(ds.tickets, ds.assets), [ds.tickets, ds.assets]);

  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(false);
  useEffect(() => {
    if (view !== "health") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await authFetch(`${API_BASE}/api/admin/health`, { signal: AbortSignal.timeout?.(3000) });
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
                  <div><span className="sq-eyebrow">Assets tracked</span><div className="sq-mono">{ds.assets.length}</div></div>
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
          <Section eyebrow="Straight-line depreciation" title="Asset valuation">
            <div className="sq-card">
              <div className="sq-eyebrow" style={{ marginBottom: 14 }}>Original vs. book value · by device type</div>
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
            <div className="sq-card">
              <div className="sq-eyebrow" style={{ marginBottom: 14 }}>By problem type · {metrics.count} tickets</div>
              {metrics.problems.length === 0 ? <Empty icon={BarChart3} title="No data yet" /> :
                metrics.problems.map((c) => (
                  <Bar key={c.k} label={c.k} value={c.v} max={metrics.problemMax}
                    sub={`${c.v} · ${Math.round((c.v / metrics.count) * 100)}%`}
                    tone={c.k === "Hardware Malfunction" ? "crit" : c.k === "Network/Wi-Fi Outage" ? "warn" : "brand"} />
                ))}
            </div>
          </Section>
        )}

        {view === "audit" && (
          <Section eyebrow="Every record" title="Audit log">
            <div className="sq-card sq-table-card">
              <table className="sq-table">
                <thead><tr><th>Ticket</th><th>Raised by</th><th>Location</th><th>Problem</th><th>State</th></tr></thead>
                <tbody>
                  {t.map((x) => (
                    <tr key={x.id}>
                      <td className="sq-mono sq-dim">TKT-{String(x.id).padStart(6, "0")}</td>
                      <td className="sq-cell-strong">{x.raisedByUsername}</td>
                      <td className="sq-cell-desc">{x.location} · Floor {x.floor}</td>
                      <td>{x.problemType}</td>
                      <td><StatusBadge status={x.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

      <SignOutModal open={signOutOpen} onCancel={() => setSignOutOpen(false)} onConfirm={onSignOut} />
    </Shell>
  );
}
