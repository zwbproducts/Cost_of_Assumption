"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Badge, Button, Card, Qa, Row, Tabs } from "@/components/ui";
import type { ClassificationRequest, DashboardState, WorkflowRun } from "@/lib/bv/types";
import { canExport, loadState, newRun, saveReview } from "@/lib/bv/client";
import { summarize } from "@/lib/bv/workflow";

const STEPS: { id: string; label: string; title: string }[] = [
  { id: "define", label: "1. Define workflow", title: "Define workflow & red-line" },
  { id: "boundary", label: "2. Boundary", title: "Declared boundary (red-line)" },
  { id: "observe", label: "3. Observations", title: "Observations (slots)" },
  { id: "compare", label: "4. Compare", title: "Declared-vs-observed" },
  { id: "risk", label: "5. Risk map", title: "Risk map (3×3)" },
  { id: "heat", label: "6. Heat score", title: "Heat score" },
  { id: "summary", label: "7. Summary", title: "Executive summary" },
  { id: "signoff", label: "8. Sign-off + audit", title: "Sign-off & audit history" },
];

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(() => loadState());
  const run = state?.currentRun ?? null;
  const history = state?.history ?? [];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState("board");
  const [reviewer, setReviewer] = useState("");
  const [verdict, setVerdict] = useState<"approved" | "blocked" | "re-review">("re-review");
  const [reason, setReason] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [alternative, setAlternative] = useState("");
  const runRef = useRef(run);

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
  }, [setState]);

  const handleClassify = useCallback(async () => {
    const current = runRef.current;
    if (!current) return;
    setBusy(true);
    try {
      const req: ClassificationRequest = { verdict, by: reviewer, role: "brand-safety reviewer", reason, uncertainty, alternative };
      const updated = await saveReview(current, req);
      setState((prev) => ({ currentRun: updated, history: [updated, ...prev.history.filter((r) => r.runId !== updated.runId)] }));
      setMsg("Classification recorded. Export is now unlocked.");
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [verdict, reviewer, reason, uncertainty, alternative, setState]);

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
    const empty: DashboardState = { currentRun: null, history: [] };
    if (typeof window !== "undefined") window.localStorage.removeItem("bv-dashboard-state");
    setState(empty);
    setMsg("Local state reset. No real system was touched.");
  }, [setState]);

  useLayoutEffect(() => {
    runRef.current = run ?? null;
  });

  if (!state) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400">Loading…</main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center font-semibold tracking-wide text-amber-200">
        SIMULATED DEMO — no real recommendation engine, no real customers, no real spend. All values are SIMULATED FIXTURES.
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Homepage Brand Choice — Cost of an Unchecked Assumption</h1>
        <p className="text-slate-400 text-sm">
          An AI recommendation workflow that maximizes add-to-cart can satisfy its goal while quietly violating a red-line
          compliance minimum that was stated but never bounded. This dashboard makes that drift visible, step by step.
        </p>
      </header>

      <section className="flex flex-wrap gap-2 items-center">
        <Button onClick={createRun} disabled={busy}>{busy ? "Working…" : "Run deterministic simulation"}</Button>
        <Button onClick={() => handleExport("json")} disabled={!canExport(run) || busy}>Download JSON</Button>
        <Button onClick={() => handleExport("csv")} disabled={!canExport(run) || busy}>Download CSV</Button>
        <button onClick={handleReset} className="rounded-md border border-slate-600 hover:bg-slate-800 disabled:opacity-50 px-3 py-2 font-medium text-sm">Reset local data</button>
      </section>

      {msg && <div className="text-sm text-slate-300">{msg}</div>}

      {!run && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          No simulation yet. Click <span className="text-sky-300">Run deterministic simulation</span> to populate the board.
        </div>
      )}

      {run && (
        <>
          <Card title="Board navigation" action={<select value={view} onChange={(e) => setView(e.target.value)} className="bg-slate-800 rounded p-2 text-sm">
            <option value="board">8-step board</option>
            <option value="history">Run history</option>
            <option value="blockchain">Blockchain evidence</option>
          </select>}>
            <Tabs tabs={STEPS} value={view} onChange={(v) => setView(v)} />
          </Card>

          {view === "board" && renderBoard(run)}
          {view === "history" && renderHistory(history)}
          {view === "blockchain" && renderBlockchain(run)}
        </>
      )}

      {run && renderReviewFooter(run, { reviewer, verdict, reason, uncertainty, alternative, setReviewer, setVerdict, setReason, setUncertainty, setAlternative, handleClassify, busy })}
    </main>
  );
}

const renderBoard = (run: WorkflowRun) => {
  const totals = run.observations.totals;
  const min = run.config.complianceMinimum.value;
  const heat = run.heatScore;
  const within = heat.withinBoundary;
  const compPct = totals.complianceShare.toFixed(1);
  const riskCount = run.risks.length;
  const highRisks = run.risks.filter((r) => r.severity === "bad").length;
  const summary = summarize(run);
  const exportOk = run.review !== null;

  return (
    <div className="space-y-4">
      {/* 30-SECOND SUMMARY */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-sky-300">At a glance</h2>
        <Qa q="What is the workflow deciding?" a="Which homepage slots to allocate to each product, to maximize add-to-cart." />
        <Qa q="What must be true (red-line)?" a={run.config.complianceMinimum.description} />
        <Qa q="What was the observed compliance share?" a={`${compPct}% (required ≥ ${min}%)`} />
        <Qa q="What was the aggregate heat score?" a={`${(heat.aggregate * 100).toFixed(0)}/100 — ${within ? "boundary respected" : "BOUNDARY VIOLATED"}`} />
        <Qa q="Why does it need human review?" a="Goals were met, but a stated compliance minimum was not enforced before execution." />
      </div>

      {/* STEP 1 */}
      <Card title="Step 1 — Define workflow & red-line">
        <p className="text-slate-300">{run.config.goal}</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-2 text-xs text-slate-400">
          <div>Maximize weight: {run.config.maximizeWeight}</div>
          <div>Composition weight: {run.config.compositionWeight}</div>
          <div>Slots assessed: {run.config.slots}</div>
          <div>Red-line set by: {run.config.redLineOwner} at {run.config.redLineSetAt}</div>
        </div>
      </Card>

      {/* STEP 2 */}
      <Card title="Step 2 — Declared boundary (red-line)">
        <p className="text-emerald-300 font-semibold">{run.config.complianceMinimum.description}</p>
        <p className="text-xs text-slate-400 mt-1">This rule was stated but not encoded as a hard stop in the recommendation pipeline.</p>
      </Card>

      {/* STEP 3 */}
      <Card title="Step 3 — Observations (slots)">
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left py-1">Slot</th>
                <th className="text-left py-1">Category</th>
                <th className="text-right py-1">Actual add-to-cart</th>
                <th className="text-right py-1">Share of home</th>
                <th className="text-center py-1">Compliance slot?</th>
                <th className="text-center py-1">Within boundary?</th>
              </tr>
            </thead>
            <tbody>
              {run.observations.slots.map((s) => (
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

      {/* STEP 4 */}
      <Card title="Step 4 — Declared-vs-observed">
        <ul className="text-sm text-slate-300 space-y-1">
          <li>Intended: compliance share ≥ {min}% · Observed: <span className={within ? "text-emerald-300" : "text-rose-300"}>{compPct}%</span></li>
          <li>Only <span className="text-rose-300 font-semibold">{run.observations.slots.filter((s) => s.isCompliance).length} of {run.observations.slots.length}</span> slots allocated to compliant products.</li>
          <li>Expected add-to-cart vs actual: the maximize objective was met ({totals.totalAdd} total).</li>
          <li>Red-line check: <span className={within ? "text-emerald-300" : "text-rose-300"}>{within ? "PASS" : "FAIL"}</span></li>
        </ul>
      </Card>

      {/* STEP 5 */}
      <Card title="Step 5 — Risk map (3×3)">
        <p className="text-xs text-slate-400 mb-2">Likelihood × Impact. Cells auto-populated by the risk model.</p>
        {renderRiskGrid(run.risks)}
        <p className="text-xs text-slate-400 mt-2">{highRisks} high-severity risks identified across {riskCount} total risks.</p>
      </Card>

      {/* STEP 6 */}
      <Card title="Step 6 — Heat score">
        <div className="grid sm:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-sky-300">{Math.round(heat.composition * 100)}</div>
            <div className="text-xs text-slate-400">Composition score (0–100)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-300">{Math.round(heat.maximize * 100)}</div>
            <div className="text-xs text-slate-400">Maximize score (0–100)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-300">{Math.round(heat.aggregate * 100)}</div>
            <div className="text-xs text-slate-400">Aggregate heat score</div>
          </div>
        </div>
        <div className="mt-2">
          <Row label="Boundary respected?" value={within ? "YES" : "NO"} tone={within ? "ok" : "bad"} />
          <Row label="Verdict (auto)" value={summary.verdict} tone={summary.verdict === "approved" ? "ok" : summary.verdict === "blocked" ? "bad" : "warn"} />
        </div>
      </Card>

      {/* STEP 7 */}
      <Card title="Step 7 — Executive summary">
        <div className={`text-center font-semibold text-xl p-3 rounded ${within ? "text-emerald-200 bg-emerald-950/20 border border-emerald-900/40" : "text-rose-200 bg-rose-950/20 border border-rose-900/40"}`}>
          {summary.headline}
        </div>
        <ul className="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          {summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </Card>

      {/* Export status */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sky-300">Export</h3>
          <Badge tone={exportOk ? "ok" : "bad"}>{exportOk ? "unlocked" : "blocked — sign-off required"}</Badge>
        </div>
        {!exportOk && <p className="text-xs text-slate-400 mt-1">Record a human review in Step 8 to unlock export.</p>}
      </div>
    </div>
  );
};

const renderRiskGrid = (risks: WorkflowRun["risks"]) => {
  const cells: { x: number; y: number }[] = [];
  for (let l = 3; l >= 1; l--) {
    for (let i = 1; i <= 3; i++) {
      cells.push({ x: i, y: l });
    }
  }
  return (
    <div className="grid grid-cols-3 gap-1 aspect-video">
      {cells.map((c) => {
        const match = risks.find((r) => r.likelihood === c.x && r.impact === c.y);
        return (
          <div key={`${c.x}-${c.y}`} className="border border-slate-800 rounded p-2 text-xs">
            {match ? (
              <div>
                <div className="text-rose-300 font-semibold">{match.threat}</div>
                <Badge tone={match.severity}>{match.severity}</Badge>
              </div>
            ) : (
              <span className="text-slate-500">empty</span>
            )}
          </div>
        );
      })}
      <div className="text-xs text-slate-500 text-center mt-auto pt-1">Likelihood →</div>
    </div>
  );
};

const renderHistory = (history: WorkflowRun[]) => (
  <div className="space-y-2">
    {history.length === 0 ? (
      <p className="text-slate-400">No prior runs in local storage.</p>
    ) : (
      history.map((r) => (
        <div key={r.runId} className="border border-slate-800 rounded p-3 text-sm">
          <span className="font-mono text-sky-300">{r.runId}</span> — aggregate {(r.heatScore.aggregate * 100).toFixed(0)} — review: {r.review?.verdict ?? "unreviewed"}
        </div>
      ))
    )}
  </div>
);

const renderBlockchain = (run: WorkflowRun) => {
  const { packetHash } = { packetHash: "bv-" + run.runId.slice(-6) };
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="font-semibold text-sky-300">Blockchain evidence view</h2>
        <p className="text-xs text-slate-400">
          This is a SIMULATED FIXTURE blockchain view. No real chain is queried and no real transaction is submitted.
        </p>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-2 text-sm">
        <Qa q="Simulated block / slot" a={`${run.createdAt}`} />
        <Qa q="Simulated tx id" a={packetHash} />
        <Qa q="Event root" a={run.audit.length ? run.audit[run.audit.length - 1].hash.slice(0, 32) + "…" : "—"} />
        <Qa q="Chain" a="Ethereum (testnet-equivalent, simulated)" />
        <Qa q="Status" a="SIMULATED — not mined" />
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="font-semibold text-sky-300">Event log (hash-chained)</h2>
        <ol className="space-y-1 text-xs">
          {run.audit.map((a) => (
            <li key={a.seq} className="border-l-2 border-slate-700 pl-2">
              <span className="font-mono text-slate-500">#{a.seq} </span>
              <span className="text-sky-300">{a.action}</span> — <span className="text-slate-400">{a.actor}</span>
              <div className="font-mono text-slate-500">hash: {a.hash.slice(0, 24)}…</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

const renderReviewFooter = (
  run: WorkflowRun,
  s: {
    reviewer: string; verdict: "approved" | "blocked" | "re-review"; reason: string; uncertainty: string; alternative: string;
    setReviewer: (v: string) => void; setVerdict: (v: "approved" | "blocked" | "re-review") => void; setReason: (v: string) => void; setUncertainty: (v: string) => void; setAlternative: (v: string) => void;
    handleClassify: () => Promise<void>; busy: boolean;
  },
) => {
  if (run.review) {
    return (
      <div className="rounded-lg border border-sky-800/50 bg-sky-950/20 p-4 space-y-2">
        <h2 className="font-semibold">Recorded sign-off</h2>
        <Row label="Verdict" value={run.review.verdict} tone={run.review.verdict === "approved" ? "ok" : "bad"} />
        <Row label="Reviewer" value={run.review.by} tone="ok" />
        <Row label="Role" value={run.review.role} tone="ok" />
        <Qa q="Reason" a={run.review.reason} />
        <Qa q="Uncertainty" a={run.review.uncertainty} />
        <Qa q="Alternative explanation" a={run.review.alternative} />
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-sky-800/50 bg-sky-950/20 p-4 space-y-3">
      <h2 className="font-semibold">Step 8 — Human sign-off (unlocks export)</h2>
      <p className="text-xs text-slate-400">Pick a verdict and explain it. Export is blocked until you record a classification.</p>
      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-xs text-slate-400 mb-1">1) Verdict</label>
          <select value={s.verdict} onChange={(e) => s.setVerdict(e.target.value as "approved" | "blocked" | "re-review")} className="bg-slate-800 rounded p-2 w-full">
            <option value="approved">approved — boundary was respected</option>
            <option value="blocked">blocked — boundary violated, do not ship</option>
            <option value="re-review">re-review — needs deeper investigation</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">2) Your name / classifier identity</label>
          <input value={s.reviewer} onChange={(e) => s.setReviewer(e.target.value)} placeholder="e.g. J. Rivera" className="bg-slate-800 rounded p-2 w-full" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">3) Reason</label>
          <input value={s.reason} onChange={(e) => s.setReason(e.target.value)} placeholder="Why this verdict" className="bg-slate-800 rounded p-2 w-full" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">4) Uncertainty</label>
            <input value={s.uncertainty} onChange={(e) => s.setUncertainty(e.target.value)} placeholder="What are you unsure about?" className="bg-slate-800 rounded p-2 w-full" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">5) Alternative explanation</label>
            <input value={s.alternative} onChange={(e) => s.setAlternative(e.target.value)} placeholder="Another way to read this?" className="bg-slate-800 rounded p-2 w-full" />
          </div>
        </div>
        <Button onClick={s.handleClassify} disabled={s.busy || !s.reviewer || !s.reason}>
          {s.busy ? "Recording…" : "Record sign-off (unlocks export)"}
        </Button>
      </div>
    </div>
  );
};
