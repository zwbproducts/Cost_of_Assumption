"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { RiskIcon, Avatar, Button, SeverityIcon } from "@/components/ui";
import type { ClassificationRequest, DashboardState, RiskEntry, Verdict, WorkflowRun } from "@/lib/bv/types";
import { canExport, loadState, newRun, saveReview } from "@/lib/bv/client";
import { summarize } from "@/lib/bv/workflow";
import { evidenceCoverage, heatScoreFormula, isRiskRed, riskCellPosition, riskPositionConsistent, severityToPillClass, reviewStatusPill } from "@/lib/bv/view";

const VIEWS: { id: string; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "risk", label: "Risk map" },
  { id: "heatmap", label: "Heatmap" },
  { id: "summary", label: "Summary" },
  { id: "audit", label: "Audit / sign-off" },
  { id: "blockchain", label: "Blockchain evidence" },
];

const GROUPS: { id: string; label: string; tone: "new" | "warn" | "ok" }[] = [
  { id: "new", label: "New", tone: "new" },
  { id: "review", label: "In review", tone: "warn" },
  { id: "approved", label: "Approved", tone: "ok" },
];

const PILL_CLASSES = {
  ok: "pill-ok",
  warn: "pill-warn",
  bad: "pill-bad",
  neutral: "pill-new",
  new: "pill-new",
  blue: "pill-blue",
  purple: "pill-purple",
} as const;

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(() => loadState());
  const run = state?.currentRun ?? null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState("board");
  const [filter, setFilter] = useState("all");
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("re-review");
  const [reason, setReason] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [alternative, setAlternative] = useState("");
  const runRef = useRef(run);
  runRef.current = run;

  const createRun = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { state: s, run: r } = await newRun();
      setState(s);
      setSelectedRiskId(null);
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
      setSelectedRiskId(null);
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

  const handlePrint = useCallback(() => window.print(), []);

  if (!run) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Banner />
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Homepage Brand Choice — Cost of an Unchecked Assumption</h1>
            <p className="text-slate-500 text-sm">
              A Monday.com-style workflow board for AI governance. An AI recommendation workflow that maximizes add-to-cart
              can quietly violate a stated compliance red-line. Click Run simulation to see the board.
            </p>
          </header>
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <RiskIcon className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 text-lg font-semibold text-slate-700">No run yet</h2>
            <p className="mt-1 text-sm text-slate-500">Click Run simulation to populate the board with simulated fixtures.</p>
            <div className="mt-4">
              <Button onClick={createRun} disabled={busy} className="mx-auto">{busy ? "Working…" : "Run deterministic simulation"}</Button>
            </div>
          </div>
        </div>
        <PrintStyles />
      </main>
    );
  }

  const summary = summarize(run);
  const heat = run.heatScore;
  const totals = run.observations.totals;
  const min = run.config.complianceMinimum.value;
  const within = heat.withinBoundary;
  const exportOk = canExport(run);
  const coverage = evidenceCoverage(run);
  const selectedRisk = selectedRiskId ? run.risks.find((r) => r.id === selectedRiskId) ?? null : null;
  const visibleRisks = filter === "all" ? run.risks : run.risks.filter((r) => (filter === "violated" ? r.severity === "bad" : r.severity === filter));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Banner />

      {/* Board header */}
      <div className="board-header sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-4 py-2.5">
        <div className="flex items-center gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sky-700">Homepage Brand Choice Simulation</span>
            <span className="mono-chip">{run.runId}</span>
          </div>
          <nav className="board-tabpanel flex items-center gap-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`board-tab ${view === v.id ? "board-tab-active" : ""}`}
                aria-current={view === v.id ? "page" : undefined}
              >
                {v.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1 text-sm text-slate-700 bg-white">
            <option value="all">All items</option>
            <option value="bad">Red only</option>
            <option value="warn">Amber only</option>
            <option value="violated">Violated slots</option>
            <option value="compliant">Compliant slots</option>
          </select>
          <div className="w-px h-5 bg-slate-200" />
          <Button onClick={() => handleExport("json")} disabled={!exportOk || busy} className="print:hidden">Download JSON</Button>
          <Button onClick={() => handleExport("csv")} disabled={!exportOk || busy} className="print:hidden">Download CSV</Button>
          <button onClick={handlePrint} className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 print:hidden">Print view</button>
          <button onClick={handleReset} className="text-xs text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg px-2.5 py-1 print:hidden">Reset</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {msg && <div className={`text-sm ${msg?.includes("Error") || msg?.includes("blocked") ? "text-rose-600" : "text-slate-600"}`}>{msg}</div>}

        {!exportOk && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Export is blocked until a human sign-off is recorded. Review status: {run.review ? run.review.verdict : "unreviewed"}.
          </div>
        )}

        {view === "board" && renderBoard(run, heat, totals, min, within, filter, visibleRisks, selectedRisk, setSelectedRiskId)}
        {view === "risk" && renderRiskMap(run, selectedRisk, setSelectedRiskId)}
        {view === "heatmap" && renderHeatmap(run, heat, coverage, summary)}
        {view === "summary" && renderSummary(run, summary, heat, within, exportOk)}
        {view === "audit" && renderAudit(run, selectedRisk, { reviewer, setReviewer, verdict, setVerdict, reason, setReason, uncertainty, setUncertainty, alternative, setAlternative, handleClassify, busy, exportOk })}
        {view === "blockchain" && renderBlockchain(run)}
      </div>
      <PrintStyles />
    </main>
  );
}

function Banner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center font-semibold tracking-wide text-amber-800 text-sm print:hidden">
      SIMULATED FIXTURE — no real recommendation engine, no real customers, no real spend. All values are SIMULATED FIXTURES.
    </div>
  );
}

function renderBoard(
  run: WorkflowRun,
  heat: { aggregate: number; composition: number; maximize: number; withinBoundary: boolean },
  totals: { totalAdd: number; complianceShare: number; maximizeMetric: number },
  min: number,
  within: boolean,
  filter: string,
  risks: RiskEntry[],
  selectedRisk: RiskEntry | null,
  setSelectedRiskId: (id: string | null) => void,
) {
  const columns = GROUPS.map((g) => ({
    ...g,
    items: risks.filter((r) => groupFor(r, run) === g.id),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard label="Compliance share" value={`${totals.complianceShare.toFixed(1)}%`} sub={`required ≥ ${min}%`} tone={within ? "ok" : "bad"} />
        <MetricCard label="Aggregate heat" value={`${Math.round(heat.aggregate * 100)}/100`} sub={`composition ${Math.round(heat.composition * 100)} · maximize ${Math.round(heat.maximize * 100)}`} tone={within ? "ok" : "warn"} />
        <MetricCard label="Add-to-cart (total)" value={String(totals.totalAdd)} sub="simulated" tone="neutral" />
        <MetricCard label="Open risks" value={String(risks.length)} sub={`${risks.filter((r) => r.severity === "bad").length} red`} tone={risks.some((r) => r.severity === "bad") ? "bad" : "warn"} />
      </div>

      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Declared boundary (red-line)</h2>
          <span className={`status-pill ${within ? "pill-ok" : "pill-bad"}`}>{within ? "PASS" : "FAIL"}</span>
        </div>
        <p className="text-slate-800 font-medium">{run.config.complianceMinimum.description}</p>
        {!within && <p className="mt-2 text-sm text-rose-700">The workflow maximized add-to-cart but let organic-snack share drop to {totals.complianceShare.toFixed(1)}%, below the {min}% red-line.</p>}
      </div>

      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Risk board (grouped by status)</h2>
          <span className="text-xs text-slate-400">Click a card to view evidence and decision history.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="group-header mb-2">
                    <span className="flex items-center gap-2">
                      <span className={`dot dot-${col.tone}`} />
                      <span className="ml-1 text-xs text-slate-500">{col.label}</span>
                      <span className="pill-count">{col.items.length}</span>
                    </span>
                  </div>
              <div className="space-y-2 min-h-[80px]">
                {col.items.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No items</p>
                ) : (
                  col.items.map((r) => <RiskItem key={r.id} risk={r} onSelect={() => setSelectedRiskId(r.id)} selected={selectedRisk?.id === r.id} />)
                )}
              </div>
            </div>
          ))}
        </div>
        {selectedRisk && <RiskDetail risk={selectedRisk} run={run} />}
      </div>

      <div className="board-card">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Slot observations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs font-medium">
                <th className="text-left py-2">Slot</th>
                <th className="text-left py-2">Category</th>
                <th className="text-right py-2">Add-to-cart</th>
                <th className="text-right py-2">Share</th>
                <th className="text-center py-2">Compliant?</th>
                <th className="text-center py-2">Boundary</th>
              </tr>
            </thead>
            <tbody>
              {run.observations.slots
                .filter((s) => filter === "all" || (filter === "violated" ? !s.withinBoundary : filter === "compliant" ? s.isCompliance : true))
                .map((s) => (
                  <tr key={s.slot} className="border-t border-slate-200">
                    <td className="py-2">{s.slot}</td>
                    <td className="py-2">{s.category}</td>
                    <td className="text-right py-2">{s.actualAdd}</td>
                    <td className="text-right py-2">{s.shareOfHome.toFixed(1)}%</td>
                    <td className="text-center py-2">{s.isCompliance ? "yes" : "—"}</td>
                    <td className="text-center py-2">
                      <Badge tone={s.withinBoundary ? "ok" : "bad"}>{s.withinBoundary ? "yes" : "no"}</Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="board-card">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Declared vs Observed</h2>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>Intended: compliance share ≥ {min}% · Observed: <span className={within ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}>{totals.complianceShare.toFixed(1)}%</span></li>
          <li>Compliant slots: <span className="text-rose-700 font-semibold">{run.observations.slots.filter((s) => s.isCompliance).length} / {run.observations.slots.length}</span></li>
          <li>Boundary check: <span className={within ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}>{within ? "PASS" : "FAIL"}</span></li>
        </ul>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "ok" | "bad" | "warn" | "neutral" }) {
  const color = tone === "ok" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-slate-600";
  return (
    <div className="metric-card">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

function groupFor(risk: RiskEntry, run: WorkflowRun): "new" | "review" | "approved" {
  if (run.review && run.review.verdict === "approved" && !isRiskRed(risk)) return "approved";
  if (risk.severity === "bad" || risk.reviewStatus === "unreviewed") return "review";
  return "new";
}

function RiskItem({ risk, onSelect, selected }: { risk: RiskEntry; onSelect: () => void; selected: boolean }) {
  const own = groupFor(risk, { review: null } as unknown as WorkflowRun) === "review";
  return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`${risk.threat}, severity ${risk.severity}, click to view evidence`}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
        className={`item-card ${selected ? "selected" : ""} ${selected ? "" : risk.severity}`}
      >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm text-slate-800">{risk.threat}</div>
          <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{risk.rationale}</p>
        </div>
        <Badge tone={risk.severity}>{risk.severity}</Badge>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>L: {risk.likelihood}</span>
          <span>I: {risk.impact}</span>
          <StatusPill tone={reviewStatusPill(risk.reviewStatus)} label={risk.reviewStatus} />
        </div>
        <Avatar name={risk.id === "r1" ? "Compliance Officer" : "Owner TBD"} />
      </div>
      <div className={own ? "visible" : "hidden"} />
    </div>
  );
}

function RiskDetail({ risk, run }: { risk: RiskEntry; run: WorkflowRun }) {
  const pos = riskCellPosition(risk);
  const consistent = riskPositionConsistent(risk);
  return (
    <div className="mt-4 board-card" aria-label={`Detail for ${risk.threat}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold text-slate-800">Risk detail — {risk.threat}</h3>
        <SeverityIcon severity={risk.severity} />
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Decision aid — not proof. Position ({pos.likelihood}, {pos.impact}) is {consistent ? "consistent" : "INCONSISTENT"} with labels.
        Human review status: <Badge tone={reviewStatusPill(risk.reviewStatus)}>{risk.reviewStatus}</Badge>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div><span className="text-slate-400">Matrix cell </span><span className="text-slate-800 font-medium">({pos.likelihood}, {pos.impact})</span></div>
        <div><span className="text-slate-400">Likelihood </span><span className="text-slate-800">{risk.likelihoodLabel} ({risk.likelihood})</span></div>
        <div><span className="text-slate-400">Impact </span><span className="text-slate-800">{risk.impactLabel} ({risk.impact})</span></div>
      </div>
      <div className="mt-2"><span className="text-slate-400">Rationale: </span><span className="text-slate-700">{risk.rationale}</span></div>
      <div className="mt-2">
        <span className="text-slate-400">Evidence (direct quotes / artefacts):</span>
        <ul className="list-disc list-inside text-slate-700 mt-1 space-y-0.5">
          {risk.evidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
      {risk.decisionLog.length > 0 && (
        <div className="mt-2">
          <span className="text-slate-400">Decision history:</span>
          <ul className="list-disc list-inside text-slate-700 mt-1 space-y-0.5">
            {risk.decisionLog.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-slate-400">Run review:</span>
        <Badge tone={run.review ? "ok" : "bad"}>{run.review?.verdict ?? "unreviewed"}</Badge>
        <span className="text-slate-500">Audit entries: {run.audit.length} · chain: {run.chainOk ? "intact" : "BROKEN"}</span>
      </div>
    </div>
  );
}

function renderRiskMap(run: WorkflowRun, selectedRisk: RiskEntry | null, setSelectedRiskId: (id: string | null) => void) {
  const grid = [];
  for (let impact = 3; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 3; likelihood++) grid.push({ likelihood, impact });
  }
  return (
    <div className="space-y-4">
      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Risk map — likelihood × impact (3×3)</h2>
          <span className="text-xs text-slate-400">Decision aid, not proof. Click or arrow-key a marker to open evidence.</span>
        </div>
        <div className="grid grid-cols-3 gap-2 aspect-video">
          {grid.map((c) => {
            const match = run.risks.find((r) => r.likelihood === c.likelihood && r.impact === c.impact);
            return (
              <button
                key={`${c.likelihood}-${c.impact}`}
                type="button"
                aria-label={`cell likelihood ${c.likelihood} impact ${c.impact}${match ? `: ${match.threat}` : ""}`}
                onClick={() => match && setSelectedRiskId(match.id)}
                className={`border rounded-xl p-2 text-xs text-left transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  match ? "border-rose-200 bg-rose-50 hover:border-rose-300 cursor-pointer" : "border-slate-200 bg-slate-100/60 text-slate-400"
                }`}
              >
                {match ? (
                  <div>
                    <div className="text-rose-700 font-medium line-clamp-2">{match.threat}</div>
                    <div className="mt-1"><Badge tone={match.severity}>{`L${match.likelihood}•I${match.impact} ${match.severity}`}</Badge></div>
                  </div>
                ) : (
                  "empty"
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-400">
          <div className="text-center">Low likelihood</div>
          <div className="text-center">Medium likelihood</div>
          <div className="text-center">High likelihood</div>
          <div className="text-center">Low impact</div>
          <div className="text-center">Medium impact</div>
          <div className="text-center">High impact</div>
        </div>
      </div>
      {selectedRisk && <RiskDetail risk={selectedRisk} run={run} />}
      {!selectedRisk && <p className="text-xs text-slate-400">Select a risk marker to inspect its evidence and decision history.</p>}
    </div>
  );
}

function renderHeatmap(run: WorkflowRun, heat: { aggregate: number }, coverage: number, summary: { headline: string; bullets: string[]; verdict: Verdict }) {
  const areas = [
    { name: "Authority & decision boundaries", score: 25, rag: "R", owner: run.config.redLineOwner, next: "Encode red-line as hard stop", evidence: 40, open: 1 },
    { name: "Evidence quality & provenance", score: 92, rag: "G", owner: "Data lead", next: "None", evidence: 95, open: 0 },
    { name: "Failure detection", score: 65, rag: "A", owner: "Platform", next: "Add drift alert", evidence: 60, open: 1 },
    { name: "Recovery & rollback", score: 40, rag: "R", owner: "SRE", next: "Define rollback gate", evidence: 30, open: 1 },
    { name: "Ownership & accountability", score: 55, rag: "A", owner: run.config.redLineOwner, next: "Assign compliance monitor", evidence: 50, open: 1 },
    { name: "Safety & business alignment", score: 30, rag: "R", owner: "Brand", next: "Reconcile objective weights", evidence: 25, open: 1 },
  ];
  return (
    <div className="space-y-4">
      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Heatmap — governance areas</h2>
          <span className="text-xs text-slate-400">Decision aid, not proof. Scores are recorded assessments.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs font-medium">
                <th className="text-left py-2">Area</th>
                <th className="text-center py-2">RAG</th>
                <th className="text-right py-2">Score</th>
                <th className="text-right py-2">Evidence</th>
                <th className="text-left py-2">Open risks</th>
                <th className="text-left py-2">Owner</th>
                <th className="text-left py-2">Next action</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.name} className="border-t border-slate-200">
                  <td className="py-2">{a.name}</td>
                  <td className="text-center py-2"><StatusPill tone={a.rag.toLowerCase() as "ok" | "warn" | "bad"} label={a.rag} /></td>
                  <td className="text-right py-2 font-medium">{a.score}</td>
                  <td className="text-right py-2">{a.evidence}%</td>
                  <td className="py-2">{a.open}</td>
                  <td className="py-2">{a.owner}</td>
                  <td className="py-2">{a.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Overall evidence coverage: {coverage}% · Heat score: {Math.round(heat.aggregate * 100)}/100 · Formula: {heatScoreFormula()}
        </div>
      </div>
    </div>
  );
}

function renderSummary(run: WorkflowRun, summary: { headline: string; bullets: string[]; verdict: Verdict }, heat: { aggregate: number; withinBoundary: boolean }, within: boolean, exportOk: boolean) {
  const reviewTone = reviewStatusPill(run.review ? "resolved" : "unreviewed");
  return (
    <div className="space-y-4 printable">
      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Executive summary</h2>
          <StatusPill tone={reviewTone} label={run.review ? "Signed-off" : "Pending review"} />
        </div>
        <div className={`text-center font-semibold text-xl p-4 rounded-xl ${within ? "text-emerald-800 bg-emerald-50 border border-emerald-200" : "text-rose-800 bg-rose-50 border border-rose-200"}`}>
          {summary.headline}
        </div>
        <ul className="list-disc list-inside text-slate-600 space-y-1 mt-3">
          {summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <div className="mt-3 text-xs text-slate-500">
          Decision recommendation: <span className={`font-semibold ${summary.verdict === "approved" ? "text-emerald-700" : summary.verdict === "blocked" ? "text-rose-700" : "text-amber-700"}`}>{summary.verdict.toUpperCase()}</span>
          {" · "}This is a recorded assessment and a decision aid, not proof of safety or authorization.
        </div>
      </div>

      <div className="board-card">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Non-claims (what this does NOT prove)</h2>
        <ul className="list-disc list-inside text-sm text-slate-500 space-y-1">
          {run.nonClaims.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>

      {!within && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          A red-line condition is open. Release is not approved unless the residual risk is explicitly accepted and documented by the authorized owner ({run.config.redLineOwner}).
        </div>
      )}
      <div className="text-xs text-slate-500">Export: {exportOk ? "unlocked (sign-off recorded)" : "blocked until sign-off"}</div>
    </div>
  );
}

function renderAudit(
  run: WorkflowRun,
  selectedRisk: RiskEntry | null,
  s: {
    reviewer: string; setReviewer: (v: string) => void; verdict: Verdict; setVerdict: (v: Verdict) => void;
    reason: string; setReason: (v: string) => void; uncertainty: string; setUncertainty: (v: string) => void;
    alternative: string; setAlternative: (v: string) => void;
    handleClassify: () => Promise<void>; busy: boolean; exportOk: boolean;
  },
) {
  return (
    <div className="space-y-4">
      {renderSignoffForm(run, s)}
      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Audit history (hash-chained)</h2>
          <span className="text-xs text-slate-400">Chain integrity: {run.chainOk ? "intact" : "BROKEN"} · Review: {run.review?.verdict ?? "unreviewed"}</span>
        </div>
        <ol className="space-y-2">
          {run.audit.map((a) => (
            <li key={a.seq} className="border-l-2 border-slate-300 pl-3 py-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="mono-chip">#{a.seq}</span>
                <Avatar name={a.actor} />
                <span className="text-sky-700 font-medium">{a.action}</span>
                <span className="text-slate-500">{a.ts}</span>
                <span className="mono-chip">hash {a.hash.slice(0, 10)}…</span>
                {a.payload?.verdict ? <Badge tone="ok">signed</Badge> : null}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 pl-0.5">{JSON.stringify(a.payload)}</div>
            </li>
          ))}
        </ol>
      </div>
      {selectedRisk && (
        <div className="board-card">
          <h3 className="text-sm font-semibold text-slate-600 mb-2">Evidence for {selectedRisk.threat}</h3>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-0.5">
            {selectedRisk.evidence.map((e, i) => <li key={i}>{e}</li>)}
            {selectedRisk.decisionLog.map((d, i) => <li key={`d${i}`}>{d}</li>)}
          </ul>
        </div>
      )}
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
      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Recorded sign-off</h2>
          <span className="mono-chip">{run.review.by} ({run.review.role})</span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div><dt className="text-slate-400">Verdict</dt><dd className={run.review.verdict === "approved" ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>{run.review.verdict}</dd></div>
          <div><dt className="text-slate-400">Signed at</dt><dd className="text-slate-700">{run.review.at}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-400">Reason</dt><dd className="text-slate-700">{run.review.reason}</dd></div>
          <div><dt className="text-slate-400">Uncertainty</dt><dd className="text-slate-700">{run.review.uncertainty}</dd></div>
          <div><dt className="text-slate-400">Alternative explanation</dt><dd className="text-slate-700">{run.review.alternative}</dd></div>
        </dl>
      </div>
    );
  }
  return (
    <div className="board-card">
      <h2 className="text-sm font-semibold text-slate-600 mb-2">Sign-off — required to unlock export</h2>
      <p className="text-xs text-slate-400 mb-3">Record a verdict and reasoning. Export is blocked (HTTP 409) until this is completed.</p>
      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-xs text-slate-500 mb-1">1) Verdict</label>
          <select value={s.verdict} onChange={(e) => s.setVerdict(e.target.value as Verdict)} className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white">
            <option value="approved">approved — boundary was respected</option>
            <option value="blocked">blocked — boundary violated, do not ship</option>
            <option value="re-review">re-review — needs deeper investigation</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">2) Your name</label>
          <input value={s.reviewer} onChange={(e) => s.setReviewer(e.target.value)} placeholder="e.g. J. Rivera" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">3) Reason</label>
          <input value={s.reason} onChange={(e) => s.setReason(e.target.value)} placeholder="Why this verdict" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">4) Uncertainty</label>
            <input value={s.uncertainty} onChange={(e) => s.setUncertainty(e.target.value)} placeholder="What are you unsure about?" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">5) Alternative explanation</label>
            <input value={s.alternative} onChange={(e) => s.setAlternative(e.target.value)} placeholder="Another way to read this?" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white" />
          </div>
        </div>
        <Button onClick={s.handleClassify} disabled={s.busy || !s.reviewer || !s.reason}>
          {s.busy ? "Recording…" : "Record sign-off (unlocks export)"}
        </Button>
      </div>
    </div>
  );
}

function renderBlockchain(run: WorkflowRun) {
  return (
    <div className="space-y-4">
      <div className="board-card">
        <h2 className="text-sm font-semibold text-slate-600">Optional technical evidence — Blockchain view</h2>
        <p className="text-xs text-slate-400 mt-1">
          SIMULATED FIXTURE blockchain view. No real chain is queried and no real transaction is submitted. This supports
          provenance/tamper-evidence only; it does NOT prove a decision was safe or authorized.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
          <QaInline q="Workflow run" a={run.runId} />
          <QaInline q="Simulated chain" a="Ethereum (testnet-equivalent, simulated)" />
          <QaInline q="Status" a="SIMULATED — not mined" />
          <QaInline q="Event root" a={run.audit.length ? run.audit[run.audit.length - 1].hash.slice(0, 32) + "…" : "—"} />
        </div>
      </div>
      <div className="board-card">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Event log (hash-chained)</h2>
        <ol className="space-y-2">
          {run.audit.map((a) => (
            <li key={a.seq} className="border-l-2 border-slate-300 pl-3 py-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="mono-chip">#{a.seq}</span>
                <span className="text-sky-700 font-medium">{a.action}</span>
                <span className="text-slate-500">by {a.actor}</span>
                <span className="mono-chip">hash {a.hash.slice(0, 24)}…</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 pl-0.5">{JSON.stringify(a.payload)}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function QaInline({ q, a }: { q: string; a: string | ReactNode }) {
  return (
    <div>
      <dt className="text-slate-400">{q}</dt>
      <dd className="text-slate-800 font-medium break-all">{a}</dd>
    </div>
  );
}

function Badge({ tone, children, className }: { tone: "ok" | "warn" | "bad" | "new" | "neutral"; children: ReactNode; className?: string }) {
  const cls = PILL_CLASSES[tone] ?? PILL_CLASSES.neutral;
  return <span className={`status-pill ${cls} ${className ?? ""}`}>{children}</span>;
}

function StatusPill({ tone, label }: { tone: "ok" | "warn" | "bad" | "new" | "neutral" | "blue" | "purple"; label: ReactNode }) {
  const cls = PILL_CLASSES[tone] ?? PILL_CLASSES.neutral;
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        .no-print, .board-header, .mono-chip { display: none !important; }
        .printable { display: block !important; }
        body { background: #fff; color: #1e293b; }
      }
    `}</style>
  );
}
