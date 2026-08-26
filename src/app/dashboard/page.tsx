"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Avatar, Badge, BoardTabs, Button, Card, EmptyState, LoadingState, Qa, Row, StatusPill } from "@/components/ui";
import type { ClassificationRequest, DashboardState, RiskEntry, SlotObservation, Verdict, WorkflowRun } from "@/lib/bv/types";
import { canExport, loadState, newRun, saveReview } from "@/lib/bv/client";
import { summarize } from "@/lib/bv/workflow";

const VIEWS: { id: string; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "risk", label: "Risk map" },
  { id: "heat", label: "Heatmap" },
  { id: "summary", label: "Executive summary" },
  { id: "audit", label: "Audit history" },
  { id: "blockchain", label: "Blockchain evidence" },
];

const GROUPS: { id: string; label: string; status: string }[] = [
  { id: "new", label: "New", status: "new" },
  { id: "review", label: "In review", status: "warn" },
  { id: "approved", label: "Approved", status: "ok" },
];

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(() => loadState());
  const run = state?.currentRun ?? null;
  const history = state?.history ?? [];
  const runRef = useRef(run);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState("board");
  const [filter, setFilter] = useState("all");
  const [reviewer, setReviewer] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("re-review");
  const [reason, setReason] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [alternative, setAlternative] = useState("");

  useSync(runRef, run);

  const createRun = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { state: s, run: r } = await newRun();
      setState(s);
      setMsg(`New simulation run created: ${r.runId}`);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleClassify = useCallback(async () => {
    const current = runRef.current;
    if (!current) return;
    setBusy(true);
    try {
      const req: ClassificationRequest = { verdict, by: reviewer, role: "brand-safety reviewer", reason, uncertainty, alternative };
      const updated = await saveReview(current, req);
      setState((prev) => ({ currentRun: updated, history: [updated, ...prev.history.filter((r) => r.runId !== updated.runId)] }));
      setMsg("Sign-off recorded. Export is now unlocked.");
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [verdict, reviewer, reason, uncertainty, alternative]);

  const handleExport = useCallback(
    async (format: "json" | "csv") => {
      const current = runRef.current;
      if (!current) return;
      setMsg(null);
      try {
        const res = await fetch("/api/dashboard/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run: current, format }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setMsg(`Export blocked (${res.status}): ${data?.error ?? "unknown"}`);
          return;
        }
        const text = await res.text();
        const blob = new Blob([text], { type: format === "csv" ? "text/csv" : "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `brand-choice-export.${format}`;
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setMsg(`Export downloaded (${format}).`);
      } catch (e) {
        setMsg(`Error: ${(e as Error).message}`);
      }
    },
    [],
  );

  const handleReset = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem("bv-dashboard-state");
    setState({ currentRun: null, history: [] });
    setMsg("Local state reset. No real system was touched.");
  }, []);

  if (!run) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <Banner />
          <header className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Homepage Brand Choice — Cost of an Unchecked Assumption</h1>
            <p className="text-slate-400 text-sm">
              A Monday.com-style workflow board for AI governance. An AI recommendation workflow that maximizes add-to-cart
              can satisfy its goal while quietly violating a stated compliance red-line. This board makes that drift visible, step by step.
            </p>
          </header>
          <EmptyState
            title="No run yet"
            description="Click Run simulation to populate the board with simulated fixtures."
            action={<Button onClick={createRun} disabled={busy}>{busy ? "Working…" : "Run deterministic simulation"}</Button>}
          />
        </div>
      </main>
    );
  }

  const summary = summarize(run);
  const heat = run.heatScore;
  const totals = run.observations.totals;
  const min = run.config.complianceMinimum.value;
  const within = heat.withinBoundary;
  const exportOk = canExport(run);
  const visibleRisks = filter === "all" ? run.risks : run.risks.filter((r) => r.severity === filter);
  const slotRows = filter === "all" ? run.observations.slots : run.observations.slots.filter((s) => (filter === "violated" ? !s.withinBoundary : s.isCompliance));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Banner />
      {/* Board header */}
      <div className="border-b border-slate-800 bg-slate-900/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 overflow-x-auto">
          <h1 className="font-semibold text-lg whitespace-nowrap">Homepage Brand Choice Simulation</h1>
          <span className="text-xs text-slate-500">• {run.runId}</span>
          <BoardTabs tabs={VIEWS} value={view} onChange={setView} />
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200">
            <option value="all">All items</option>
            <option value="bad">Red only</option>
            <option value="warn">Amber only</option>
            <option value="violated">Violated slots</option>
            <option value="compliant">Compliant slots</option>
          </select>
          <Button onClick={() => handleExport("json")} disabled={!exportOk || busy}>Download JSON</Button>
          <Button onClick={() => handleExport("csv")} disabled={!exportOk || busy}>Download CSV</Button>
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-1">Reset</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {msg && <div className={`text-sm mb-3 ${msg?.includes("Error") ? "text-rose-300" : "text-slate-300"}`}>{msg}</div>}
        {!exportOk && (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
            Export is blocked until a human sign-off is recorded (Step 8 → Audit / Sign-off).
          </div>
        )}

        {view === "board" && renderBoard(run, summary, heat, totals, min, within, filter, visibleRisks, slotRows, setView)}
        {view === "risk" && renderRiskMap(filteredRisksForDisplay(run.risks, filter))}
        {view === "heat" && renderHeatmap(run, heat, summary)}
        {view === "summary" && renderSummary(run, summary, heat, within, exportOk)}
        {view === "audit" && renderAudit(run, renderSignoffForm(run, { reviewer, setReviewer, verdict, setVerdict, reason, setReason, uncertainty, setUncertainty, alternative, setAlternative, handleClassify, busy, exportOk }))}
        {view === "blockchain" && renderBlockchain(run)}
      </div>
    </main>
  );
}

function Banner() {
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center font-semibold tracking-wide text-amber-200 text-sm">
      SIMULATED FIXTURE — no real recommendation engine, no real customers, no real spend. All values are SIMULATED FIXTURES.
    </div>
  );
}

function useSync(ref: { current: WorkflowRun | null }, value: WorkflowRun | null) {
  ref.current = value;
}

function groupFor(risk: RiskEntry, run: WorkflowRun): "new" | "review" | "approved" {
  const controls = run.controls.find((c) => c.id === "c1");
  if (run.review && run.review.verdict === "approved") return "approved";
  if (run.review && run.review.verdict === "blocked") return "review";
  return risk.severity === "bad" ? "review" : "new";
}

function renderBoard(
  run: WorkflowRun,
  summary: { headline: string; bullets: string[]; verdict: Verdict },
  heat: { aggregate: number; composition: number; maximize: number; withinBoundary: boolean },
  totals: { totalAdd: number; complianceShare: number; maximizeMetric: number },
  min: number,
  within: boolean,
  filter: string,
  risks: RiskEntry[],
  slots: SlotObservation[],
  setView: (v: string) => void,
) {
  const filteredRisks = filter === "all" ? risks : risks.filter((r) => (filter === "violated" ? r.severity === "bad" : r.severity === filter));
  const columns = GROUPS.map((g) => ({
    ...g,
    items: filteredRisks.filter((r) => groupFor(r, run) === g.id),
  }));

  return (
    <div className="space-y-5">
      {/* At-a-glance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <MetricCard label="Compliance share" value={`${totals.complianceShare.toFixed(1)}%`} sub={`required ≥ ${min}%`} tone={within ? "ok" : "bad"} />
        <MetricCard label="Aggregate heat" value={`${Math.round(heat.aggregate * 100)}/100`} sub={`composition ${Math.round(heat.composition * 100)}, maximize ${Math.round(heat.maximize * 100)}`} tone={within ? "ok" : "warn"} />
        <MetricCard label="Add-to-cart (total)" value={String(totals.totalAdd)} sub="simulated" tone="neutral" />
        <MetricCard label="Open risks" value={String(risks.length)} sub={`${risks.filter((r) => r.severity === "bad").length} red`} tone={risks.some((r) => r.severity === "bad") ? "bad" : "warn"} />
      </div>

      <Card title="Compliance boundary (red-line)">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${within ? "text-emerald-300" : "text-rose-300"}`}>{within ? "PASS" : "FAIL"}</div>
          <div className="text-slate-300">{run.config.complianceMinimum.description}</div>
        </div>
        {!within && <div className="mt-2 text-sm text-rose-300">The workflow maximized add-to-cart but let organic-snack share drop to {totals.complianceShare.toFixed(1)}%, below the {min}% red-line.</div>}
      </Card>

      {/* Monday-style group columns */}
      <Card title="Risk board (grouped by status)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {columns.map((col) => (
            <div key={col.id} className="border border-slate-800 rounded-lg p-2 bg-slate-900/30">
              <div className="flex items-center gap-2 mb-2">
                <StatusPill status={col.status} label={col.label} />
                <span className="text-xs text-slate-500">{col.items.length} items</span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {col.items.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">No items</div>
                ) : (
                  col.items.map((r) => (
                    <RiskItem key={r.id} risk={r} run={run} onDetail={() => setView("risk")} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Slot table */}
      <Card title="Slot observations">
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left py-1">#</th>
                <th className="text-left py-1">Category</th>
                <th className="text-right py-1">Add-to-cart</th>
                <th className="text-right py-1">Share</th>
                <th className="text-center py-1">Compliant?</th>
                <th className="text-center py-1">Boundary</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.slot} className="border-t border-slate-800">
                  <td className="py-1">{s.slot}</td>
                  <td className="py-1">{s.category}</td>
                  <td className="text-right py-1">{s.actualAdd}</td>
                  <td className="text-right py-1">{s.shareOfHome.toFixed(1)}%</td>
                  <td className="text-center py-1">{s.isCompliance ? "yes" : "—"}</td>
                  <td className="text-center py-1">
                    <Badge tone={s.withinBoundary ? "ok" : "bad"}>{s.withinBoundary ? "yes" : "no"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Declared vs Observed">
        <ul className="text-sm text-slate-300 space-y-1">
          <li>Intended: compliance share ≥ {min}% · Observed: <span className={within ? "text-emerald-300" : "text-rose-300"}>{totals.complianceShare.toFixed(1)}%</span></li>
          <li>Only <span className="text-rose-300 font-semibold">{run.observations.slots.filter((s) => s.isCompliance).length} of {run.observations.slots.length}</span> slots allocated to compliant products.</li>
          <li>Boundary check: <span className={within ? "text-emerald-300" : "text-rose-300"}>{within ? "PASS" : "FAIL"}</span></li>
        </ul>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "ok" | "bad" | "warn" | "neutral" }) {
  const color = tone === "ok" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-300" : "text-slate-300";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function RiskItem({ risk, run, onDetail }: { risk: RiskEntry; run: WorkflowRun; onDetail: () => void }) {
  const owner = risk.id === "r1" ? run.config.redLineOwner : "Owner TBD";
  return (
    <div
      className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5 hover:border-sky-700/50 cursor-pointer transition-colors"
      onClick={onDetail}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm text-slate-100">{risk.threat}</div>
          <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{risk.rationale}</div>
        </div>
        <Badge tone={risk.severity}>{risk.severity}</Badge>
      </div>
      <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>L: {risk.likelihood} • I: {risk.impact}</span>
            <StatusPill status={risk.severity} label={`${risk.likelihoodLabel}/${risk.impactLabel}`} />
          </div>
        <div className="flex items-center gap-1.5">
          <Avatar name={owner} />
          <span className="text-xs text-slate-500">{owner}</span>
        </div>
      </div>
    </div>
  );
}

function filteredRisksForDisplay(risks: RiskEntry[], filter: string): RiskEntry[] {
  return filter === "all" ? risks : risks.filter((r) => r.severity === filter);
}

function renderRiskMap(risks: RiskEntry[]) {
  const cells = [];
  for (let l = 3; l >= 1; l--) {
    for (let i = 1; i <= 3; i++) cells.push({ x: i, y: l });
  }
  return (
    <div className="grid grid-cols-3 gap-2 aspect-video">
      {cells.map((c) => {
        const match = risks.find((r) => r.likelihood === c.x && r.impact === c.y);
        return (
          <div key={`${c.x}-${c.y}`} className="border border-slate-800 rounded-lg p-2 bg-slate-900/40">
            {match ? (
              <div>
                <div className="text-rose-300 font-medium text-xs line-clamp-2">{match.threat}</div>
                <Badge tone={match.severity} className="mt-1">{`L${match.likelihood}•I${match.impact}`}</Badge>
              </div>
            ) : (
              <span className="text-slate-500 text-xs">empty</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderHeatmap(run: WorkflowRun, heat: { aggregate: number; composition: number; maximize: number; withinBoundary: boolean }, summary: { headline: string; bullets: string[]; verdict: Verdict }) {
  const areas = [
    { name: "Authority & boundaries", score: 25, rag: "R", owner: run.config.redLineOwner, next: "Encode red-line as hard stop" },
    { name: "Evidence quality", score: 92, rag: "G", owner: "Data lead", next: "None" },
    { name: "Failure detection", score: 65, rag: "A", owner: "Platform", next: "Add drift alert" },
    { name: "Recovery & rollback", score: 40, rag: "R", owner: "SRE", next: "Define rollback gate" },
    { name: "Ownership", score: 55, rag: "A", owner: run.config.redLineOwner, next: "Assign compliance monitor" },
    { name: "Safety & business alignment", score: 30, rag: "R", owner: "Brand", next: "Reconcile objective weights" },
  ];
  return (
    <div className="space-y-3">
      <Card title="Heatmap by non-negotiable area">
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left py-1">Area</th>
                <th className="text-center py-1">RAG</th>
                <th className="text-right py-1">Score</th>
                <th className="text-left py-1">Owner</th>
                <th className="text-left py-1">Next action</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => {
                const bg = a.rag === "G" ? "bg-emerald-900/20 text-emerald-300" : a.rag === "A" ? "bg-amber-900/20 text-amber-300" : "bg-rose-900/20 text-rose-300";
                return (
                  <tr key={a.name} className="border-t border-slate-800">
                    <td className="py-1">{a.name}</td>
                    <td className="text-center py-1"><span className={`px-1.5 py-0.5 rounded font-bold ${bg}`}>{a.rag}</span></td>
                    <td className="text-right py-1">{a.score}</td>
                    <td className="py-1">{a.owner}</td>
                    <td className="py-1">{a.next}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Heat score">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><div className="text-2xl font-bold text-sky-300">{Math.round(heat.composition * 100)}</div><div className="text-xs text-slate-400">Composition</div></div>
          <div><div className="text-2xl font-bold text-amber-300">{Math.round(heat.maximize * 100)}</div><div className="text-xs text-slate-400">Maximize</div></div>
          <div><div className="text-2xl font-bold text-rose-300">{Math.round(heat.aggregate * 100)}</div><div className="text-xs text-slate-400">Aggregate</div></div>
        </div>
        <Row label="Boundary respected?" value={heat.withinBoundary ? "YES" : "NO"} tone={heat.withinBoundary ? "ok" : "bad"} />
        <p className="mt-2 text-xs text-slate-400">Score = 0.6·maximize + 0.4·composition, each normalized 0–1. This is a recorded assessment, not objective truth.</p>
      </Card>
    </div>
  );
}

function renderSummary(run: WorkflowRun, summary: { headline: string; bullets: string[]; verdict: Verdict }, heat: { aggregate: number; withinBoundary: boolean }, within: boolean, exportOk: boolean) {
  return (
    <div className="space-y-4">
      <Card title="Executive summary">
        <div className={`text-center font-semibold text-xl p-3 rounded ${within ? "text-emerald-200 bg-emerald-950/20 border border-emerald-900/40" : "text-rose-200 bg-rose-950/20 border border-rose-900/40"}`}>
          {summary.headline}
        </div>
        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          {summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </Card>
      <Card title="Decision recommendation">
        <div className="space-y-2">
          <div className="text-sm"><span className="text-slate-400">Verdict:</span> <span className={`font-bold ${summary.verdict === "approved" ? "text-emerald-300" : summary.verdict === "blocked" ? "text-rose-300" : "text-amber-300"}`}>{summary.verdict.toUpperCase()}</span></div>
          {!within && (
            <div className="text-xs text-rose-200 bg-rose-950/20 border border-rose-900/40 rounded p-2">
              A red-line condition is open. Release is not approved unless the residual risk is explicitly
              accepted and documented by the authorized owner (Compliance Officer).
            </div>
          )}
          <Row label="Export unlocked?" value={exportOk ? "YES (sign-off recorded)" : "NO (sign-off required)"} tone={exportOk ? "ok" : "bad"} />
        </div>
      </Card>
      <Card title="Non-claims (what this does NOT prove)">
        <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
          {run.nonClaims.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </Card>
    </div>
  );
}

function renderAudit(run: WorkflowRun, signoff: ReactNode) {
  return (
    <div className="space-y-4">
      {signoff}
      <Card title="Audit history (hash-chained)">
        <ol className="space-y-2">
          {run.audit.map((a) => (
            <li key={a.seq} className="border-l-2 border-slate-700 pl-3 py-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-slate-500">#{a.seq}</span>
                <Avatar name={a.actor} />
                <span className="text-sky-300 font-medium">{a.action}</span>
                <span className="text-slate-500">{a.ts}</span>
                <span className="font-mono text-slate-500">hash {a.hash.slice(0, 12)}…</span>
                {a.payload && a.payload.verdict ? <Badge tone="ok">signed</Badge> : null}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 pl-9">{JSON.stringify(a.payload)}</div>
            </li>
          ))}
        </ol>
        <div className="mt-3 text-xs text-slate-500">
          Chain integrity: <span className={run.chainOk ? "text-emerald-400" : "text-rose-400"}>{run.chainOk ? "intact" : "BROKEN"}</span>
        </div>
      </Card>
    </div>
  );
}

function renderSignoffForm(
  run: WorkflowRun,
  s: {
    reviewer: string; setReviewer: (v: string) => void; verdict: Verdict; setVerdict: (v: Verdict) => void;
    reason: string; setReason: (v: string) => void; uncertainty: string; setUncertainty: (v: string) => void;
    alternative: string; setAlternative: (v: string) => void;
    handleClassify: () => Promise<void>; busy: boolean; exportOk: boolean;
  },
) {
  if (run.review) {
    return (
      <Card title="Recorded sign-off">
        <Row label="Verdict" value={run.review.verdict} tone={run.review.verdict === "approved" ? "ok" : "bad"} />
        <Row label="Reviewer" value={run.review.by} tone="ok" />
        <Row label="Role" value={run.review.role} tone="ok" />
        <Qa q="Reason" a={run.review.reason} />
        <Qa q="Uncertainty" a={run.review.uncertainty} />
        <Qa q="Alternative explanation" a={run.review.alternative} />
      </Card>
    );
  }
  return (
    <Card title="Step 8 — Human sign-off (unlocks export)">
      <p className="text-xs text-slate-400 mb-2">Record a verdict and reasoning. Export is blocked until this is completed.</p>
      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-xs text-slate-400 mb-1">1) Verdict</label>
          <select value={s.verdict} onChange={(e) => s.setVerdict(e.target.value as Verdict)} className="bg-slate-800 border border-slate-700 rounded p-2 w-full text-slate-100">
            <option value="approved">approved — boundary was respected</option>
            <option value="blocked">blocked — boundary violated, do not ship</option>
            <option value="re-review">re-review — needs deeper investigation</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">2) Your name</label>
          <input value={s.reviewer} onChange={(e) => s.setReviewer(e.target.value)} placeholder="e.g. J. Rivera" className="bg-slate-800 border border-slate-700 rounded p-2 w-full text-slate-100" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">3) Reason</label>
          <input value={s.reason} onChange={(e) => s.setReason(e.target.value)} placeholder="Why this verdict" className="bg-slate-800 border border-slate-700 rounded p-2 w-full text-slate-100" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">4) Uncertainty</label>
            <input value={s.uncertainty} onChange={(e) => s.setUncertainty(e.target.value)} placeholder="What are you unsure about?" className="bg-slate-800 border border-slate-700 rounded p-2 w-full text-slate-100" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">5) Alternative explanation</label>
            <input value={s.alternative} onChange={(e) => s.setAlternative(e.target.value)} placeholder="Another way to read this?" className="bg-slate-800 border border-slate-700 rounded p-2 w-full text-slate-100" />
          </div>
        </div>
        <Button onClick={s.handleClassify} disabled={s.busy || !s.reviewer || !s.reason}>
          {s.busy ? "Recording…" : "Record sign-off (unlocks export)"}
        </Button>
      </div>
    </Card>
  );
}

function renderBlockchain(run: WorkflowRun) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="font-semibold text-sky-300">Optional technical evidence</h2>
        <p className="text-xs text-slate-400 mt-1">
          SIMULATED FIXTURE blockchain view. No real chain is queried, no real transaction is submitted.
          This supports provenance / tamper-evidence only; it does NOT prove a decision was safe or authorized.
        </p>
      </div>
      <Card title="Chain summary">
        <Qa q="Workflow run" a={run.runId} />
        <Qa q="Simulated chain" a="Ethereum (testnet-equivalent, simulated)" />
        <Qa q="Status" a="SIMULATED — not mined" />
        <Qa q="Event root" a={run.audit.length ? run.audit[run.audit.length - 1].hash.slice(0, 32) + "…" : "—"} />
      </Card>
      <Card title="Event log (hash-chained)">
        <ol className="space-y-2">
          {run.audit.map((a) => (
            <li key={a.seq} className="border-l-2 border-slate-700 pl-3 py-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-slate-500">#{a.seq}</span>
                <span className="text-sky-300 font-medium">{a.action}</span>
                <span className="text-slate-500">by {a.actor}</span>
                <span className="font-mono text-slate-500">hash {a.hash.slice(0, 24)}…</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 pl-0.5">{JSON.stringify(a.payload)}</div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
