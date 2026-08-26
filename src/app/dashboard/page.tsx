"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Avatar, Badge, BoardTabs, Button, Card, Qa, Row, SeverityIcon, StatusPill } from "@/components/ui";
import type { ClassificationRequest, DashboardState, RiskEntry, SlotObservation, Verdict, WorkflowRun } from "@/lib/bv/types";
import { canExport, loadState, newRun, saveReview } from "@/lib/bv/client";
import { summarize } from "@/lib/bv/workflow";
import {
  evidenceCoverage,
  heatScoreFormula,
  isRiskRed,
  reviewStatusPill,
  riskCellPosition,
} from "@/lib/bv/view";

const VIEWS: { id: string; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "risk", label: "Risk map" },
  { id: "heatmap", label: "Heatmap" },
  { id: "summary", label: "Executive summary" },
  { id: "audit", label: "Audit / sign-off" },
  { id: "blockchain", label: "Blockchain evidence" },
];

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

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!run) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <Banner />
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Homepage Brand Choice — Cost of an Unchecked Assumption</h1>
            <p className="text-slate-400 text-sm">
              A Monday.com-style workflow board for AI governance. An AI recommendation workflow that maximizes add-to-cart
              can satisfy its goal while quietly violating a stated compliance red-line. Click Run simulation to see the board.
            </p>
          </header>
          <EmptyState
            title="No run yet"
            description="Click Run simulation to populate the board with simulated fixtures."
            action={<Button onClick={createRun} disabled={busy}>{busy ? "Working…" : "Run deterministic simulation"}</Button>}
          />
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Banner />
      <div className="border-b border-slate-800 bg-slate-900/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 overflow-x-auto">
          <h2 className="font-semibold whitespace-nowrap">Homepage Brand Choice Simulation</h2>
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
          <button onClick={handlePrint} className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-1 no-print">Print view</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {msg && <div className={`text-sm mb-3 ${msg?.includes("Error") || msg?.includes("blocked") ? "text-rose-300" : "text-slate-300"}`}>{msg}</div>}

        {!exportOk && (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
            Export is blocked until a human sign-off is recorded. Review status: {run.review ? run.review.verdict : "unreviewed"}.
          </div>
        )}

        {view === "board" && renderBoard(run, heat, totals, min, within, filter, selectedRisk, setSelectedRiskId)}
        {view === "risk" && renderRiskMap(run, selectedRisk, setSelectedRiskId)}
        {view === "heatmap" && renderHeatmap(run, heat, coverage, summary)}
        {view === "summary" && renderSummary(run, summary, heat, within, exportOk)}
        {view === "audit" && renderAudit(run, selectedRisk, { reviewer, setReviewer, verdict, setVerdict, reason, setReason, uncertainty, setUncertainty, alternative, setAlternative, handleClassify, busy, exportOk })}
        {view === "blockchain" && renderBlockchain(run)}

        <DecisionAidNote run={run} />
      </div>
      <PrintStyles />
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

function DecisionAidNote({ run }: { run: WorkflowRun }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2 text-xs text-slate-300">
      <span className="text-slate-400">Visualisation policy:</span> These graphics are <strong>decision aids</strong> generated from
      recorded assessments — <strong>not proof</strong>. They show uncertainty and human review status only.
      Human review status:{" "}
      <Badge tone={reviewStatusPill(run.review ? "resolved" : "unreviewed")}>{run.review ? "signed-off" : "unreviewed"}</Badge>
      {" · "}Last reviewed: {run.review?.at ?? "not yet"}.
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
  selectedRisk: RiskEntry | null,
  setSelectedRiskId: (id: string | null) => void,
) {
  const risks = filter === "all" ? run.risks : run.risks.filter((r) => filter === "bad" ? r.severity === "bad" : filter === "warn" ? r.severity === "warn" : r.severity === filter);
  const columns = GROUPS.map((g) => ({
    ...g,
    items: risks.filter((r) => groupFor(r, run) === g.id),
  }));

  return (
    <div className="space-y-5">
      <Card title="At a glance">
        <Qa q="Workflow" a="Homepage product recommendation (maximize add-to-cart)." />
        <Qa q="Red-line" a={`Organic snack share ≥ ${min}% (compliance minimum).`} />
        <Qa q="Observed share" a={`${totals.complianceShare.toFixed(1)}%`} />
        <Qa q="Goal met?" a={`Yes — total add-to-cart ${totals.totalAdd}`} />
        <Qa q="Within boundary?" a={within ? "YES" : "NO"} />
      </Card>

      <Card title="Declared boundary (red-line)">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${within ? "text-emerald-300" : "text-rose-300"}`}>{within ? "PASS" : "FAIL"}</div>
          <div className="text-slate-200">{run.config.complianceMinimum.description}</div>
          <SeverityIcon severity={within ? "ok" : "bad"} />
        </div>
        {!within && <div className="mt-2 text-sm text-rose-300">Share dropped to {totals.complianceShare.toFixed(1)}%.</div>}
      </Card>

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
                    <RiskItem key={r.id} risk={r} onSelect={() => setSelectedRiskId(r.id)} selected={selectedRisk?.id === r.id} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
        {selectedRisk && <RiskDetail risk={selectedRisk} run={run} />}
      </Card>

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
              {run.observations.slots.filter((s) => filter === "all" || (filter === "violated" ? !s.withinBoundary : filter === "compliant" ? s.isCompliance : true)).map((s) => (
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
          <li>Compliant slots: <span className="text-rose-300 font-semibold">{run.observations.slots.filter((s) => s.isCompliance).length} / {run.observations.slots.length}</span></li>
          <li>Boundary check: <span className={within ? "text-emerald-300" : "text-rose-300"}>{within ? "PASS" : "FAIL"}</span></li>
        </ul>
      </Card>
    </div>
  );
}

const GROUPS: { id: string; label: string; status: string }[] = [
  { id: "new", label: "New", status: "new" },
  { id: "review", label: "In review", status: "warn" },
  { id: "approved", label: "Approved", status: "ok" },
];

function groupFor(risk: RiskEntry, run: WorkflowRun): "new" | "review" | "approved" {
  if (run.review && run.review.verdict === "approved" && !isRiskRed(risk)) return "approved";
  if (risk.severity === "bad" || risk.reviewStatus === "unreviewed") return "review";
  return "new";
}

function RiskItem({ risk, onSelect, selected }: { risk: RiskEntry; onSelect: () => void; selected: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${risk.threat}, severity ${risk.severity}, click to view evidence`}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={`rounded-md border p-2.5 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
        selected ? "border-sky-500 bg-sky-950/20" : "border-slate-800 bg-slate-900/40 hover:border-sky-700/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm text-slate-100">{risk.threat}</div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <SeverityIcon severity={risk.severity} />
            <span>severity: {risk.severity}</span>
            <span>L:{risk.likelihood} • I:{risk.impact}</span>
            <span>review: {risk.reviewStatus}</span>
          </div>
        </div>
        <Badge tone={risk.severity}>{risk.severity}</Badge>
      </div>
    </div>
  );
}

function RiskDetail({ risk, run }: { risk: RiskEntry; run: WorkflowRun }) {
  const pos = riskCellPosition(risk);
  return (
    <div className="mt-4 rounded-lg border border-sky-800/50 bg-sky-950/10 p-4" aria-label={`Detail for ${risk.threat}`}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold text-sky-300">Risk detail: {risk.threat}</h3>
        <SeverityIcon severity={risk.severity} />
      </div>
      <div className="grid sm:grid-cols-3 gap-4 text-xs">
        <div><span className="text-slate-400">Matrix cell </span><span className="text-slate-100">({pos.likelihood}, {pos.impact})</span></div>
        <div><span className="text-slate-400">Likelihood </span><span className="text-slate-100">{risk.likelihoodLabel} ({risk.likelihood})</span></div>
        <div><span className="text-slate-400">Impact </span><span className="text-slate-100">{risk.impactLabel} ({risk.impact})</span></div>
      </div>
      <div className="mt-2"><span className="text-slate-400">Rationale: </span><span className="text-slate-200">{risk.rationale}</span></div>
      <div className="mt-2">
        <span className="text-slate-400">Evidence:</span>
        <ul className="list-disc list-inside text-slate-200 mt-1 space-y-0.5">
          {risk.evidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
      {risk.decisionLog.length > 0 && (
        <div className="mt-2">
          <span className="text-slate-400">Decision history:</span>
          <ul className="list-disc list-inside text-slate-200 mt-1 space-y-0.5">
            {risk.decisionLog.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-slate-400">Human review status:</span>
        <Badge tone={reviewStatusPill(risk.reviewStatus)}>{risk.reviewStatus}</Badge>
        <span className="text-xs text-slate-500">Run review: {run.review?.verdict ?? "unreviewed"}</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Audit trail entries: {run.audit.length} · chain integrity: {run.chainOk ? "intact" : "BROKEN"}
      </div>
    </div>
  );
}

function renderRiskMap(run: WorkflowRun, selectedRisk: RiskEntry | null, setSelectedRiskId: (id: string | null) => void) {
  const cells = [];
  for (let l = 3; l >= 1; l--) {
    for (let i = 1; i <= 3; i++) cells.push({ likelihood: i, impact: l });
  }
  return (
    <div className="space-y-3">
      <Card title="Risk map — likelihood × impact (3×3)">
        <p className="text-xs text-slate-400 mb-2">
          Position = (likelihood, impact). Click or arrow-key a marker to open its evidence and decision history.
          This is a decision aid, not proof.
        </p>
        <div className="grid grid-cols-3 gap-2 aspect-video">
          {cells.map((c) => {
            const match = run.risks.find((r) => r.likelihood === c.likelihood && r.impact === c.impact);
            return (
              <button
                key={`${c.likelihood}-${c.impact}`}
                type="button"
                aria-label={`cell likelihood ${c.likelihood} impact ${c.impact}${match ? `: ${match.threat}` : ""}`}
                onClick={() => match && setSelectedRiskId(match.id)}
                className={`border rounded-lg p-2 text-xs text-left transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  match ? "border-rose-800/50 bg-rose-950/10 hover:border-rose-600 cursor-pointer" : "border-slate-800 bg-slate-900/30 text-slate-500"
                }`}
              >
                {match ? (
                  <div>
                    <div className="text-rose-300 font-medium line-clamp-2">{match.threat}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge tone={match.severity}>{match.severity}</Badge>
                      <span className="text-slate-500">L{match.likelihood}•I{match.impact}</span>
                    </div>
                    <div className="text-slate-500 mt-1 line-clamp-1">{match.rationale}</div>
                  </div>
                ) : (
                  <span>empty</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
      {selectedRisk && <RiskDetail risk={selectedRisk} run={run} />}
      {!selectedRisk && (
        <div className="text-xs text-slate-400">Select a risk marker on the map (or a card in the Board view) to inspect its evidence and decision history.</div>
      )}
    </div>
  );
}

function renderHeatmap(run: WorkflowRun, heat: { aggregate: number }, coverage: number, summary: { headline: string; bullets: string[]; verdict: Verdict }) {
  const areas = [
    { name: "Authority & decision boundaries", score: 25, rag: "R", owner: run.config.redLineOwner, next: "Encode red-line as hard stop", evidence: 40 },
    { name: "Evidence quality & provenance", score: 92, rag: "G", owner: "Data lead", next: "None", evidence: 95 },
    { name: "Failure detection", score: 65, rag: "A", owner: "Platform", next: "Add drift alert", evidence: 60 },
    { name: "Recovery & rollback", score: 40, rag: "R", owner: "SRE", next: "Define rollback gate", evidence: 30 },
    { name: "Ownership & accountability", score: 55, rag: "A", owner: run.config.redLineOwner, next: "Assign compliance monitor", evidence: 50 },
    { name: "Safety & business alignment", score: 30, rag: "R", owner: "Brand", next: "Reconcile objective weights", evidence: 25 },
  ];
  return (
    <div className="space-y-3">
      <Card title="Heatmap — governance areas">
        <p className="text-xs text-slate-400 mb-2">RAG status from recorded assessment. Scores are decision aids, not objective truth.</p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left py-1">Area</th>
                <th className="center py-1">RAG</th>
                <th className="text-right py-1">Score</th>
                <th className="text-right py-1">Evidence</th>
                <th className="text-left py-1">Open risks</th>
                <th className="text-left py-1">Owner</th>
                <th className="text-left py-1">Next action</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => {
                const ragTone = a.rag === "G" ? "ok" as const : a.rag === "A" ? "warn" as const : "bad" as const;
                return (
                  <tr key={a.name} className="border-t border-slate-800">
                    <td className="py-1">{a.name}</td>
                    <td className="text-center py-1">
                      <StatusPill status={a.rag === "G" ? "ok" : a.rag === "A" ? "warn" : "bad"} label={a.rag} />
                    </td>
                    <td className="text-right py-1">{a.score}</td>
                    <td className="text-right py-1">{a.evidence}%</td>
                    <td className="py-1">{a.rag === "R" ? "1+" : a.rag === "A" ? "1" : "0"}</td>
                    <td className="py-1">{a.owner}</td>
                    <td className="py-1">{a.next}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Overall evidence coverage: {coverage}% · Heat score: {Math.round(heat.aggregate * 100)}/100 · Formula: {heatScoreFormula()}
        </div>
      </Card>
    </div>
  );
}

function renderSummary(run: WorkflowRun, summary: { headline: string; bullets: string[]; verdict: Verdict }, heat: { aggregate: number; withinBoundary: boolean }, within: boolean, exportOk: boolean) {
  return (
    <div className="space-y-4 printable">
      <Card title="Executive summary (printable)">
        <div className={`text-center font-semibold text-xl p-3 rounded ${within ? "text-emerald-200 bg-emerald-950/20 border border-emerald-900/40" : "text-rose-200 bg-rose-950/20 border border-rose-900/40"}`}>
          {summary.headline}
        </div>
        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          {summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <div className="mt-3 text-xs text-slate-500">
          Decision recommendation: <span className={`font-semibold ${summary.verdict === "approved" ? "text-emerald-300" : summary.verdict === "blocked" ? "text-rose-300" : "text-amber-300"}`}>{summary.verdict.toUpperCase()}</span>
          {" · "}This is a recorded assessment and a decision aid, not a proof of safety.
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
              <div className="text-xs text-slate-500 mt-0.5 pl-0.5">{JSON.stringify(a.payload)}</div>
            </li>
          ))}
        </ol>
        <div className="mt-3 text-xs text-slate-500">Chain integrity: {run.chainOk ? "intact" : "BROKEN"} · Review status: {run.review?.verdict ?? "unreviewed"}</div>
      </Card>
      {selectedRisk && <RiskDetail risk={selectedRisk} run={run} />}
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
    <Card title="Sign-off (unlocks export)">
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
      <Card title="Optional technical evidence — Blockchain view">
        <p className="text-xs text-slate-400">
          SIMULATED FIXTURE blockchain view. No real chain is queried and no real transaction is submitted.
          This supports provenance/tamper-evidence only; it does NOT prove a decision was safe or authorized.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mt-2 text-xs">
          <Qa q="Workflow run" a={run.runId} />
          <Qa q="Simulated chain" a="Ethereum (testnet-equivalent, simulated)" />
          <Qa q="Status" a="SIMULATED — not mined" />
          <Qa q="Event root" a={run.audit.length ? run.audit[run.audit.length - 1].hash.slice(0, 32) + "…" : "—"} />
        </div>
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
            </ol>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        header, .no-print, .border-b, [class*="bg-amber"] { display: none !important; }
        body { background: #0f172a; color: #e2e8f0; }
        .printable section { page-break-inside: avoid; }
      }
    `}</style>
  );
}
