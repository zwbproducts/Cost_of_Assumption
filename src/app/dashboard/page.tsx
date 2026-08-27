"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button, SeverityIcon } from "@/components/ui";
import type { AuditEntry, ClassificationRequest, DashboardState, RiskEntry, Verdict, WorkflowRun } from "@/lib/bv/types";
import { canExport, loadState, newRun, saveReview } from "@/lib/bv/client";
import { summarize } from "@/lib/bv/workflow";
import { evidenceCoverage, heatScoreFormula, isRiskRed, riskCellPosition, riskPositionConsistent, reviewStatusPill } from "@/lib/bv/view";

const VIEWS: { id: string; label: string; short: string; icon: string }[] = [
  { id: "board", icon: "📊", short: "Audit", label: "Compliance audit" },
  { id: "risk", icon: "🎯", short: "Risks", label: "Risk map" },
  { id: "heatmap", icon: "🔥", short: "Heat", label: "Heatmap" },
  { id: "summary", icon: "📈", short: "Summary", label: "Verdict" },
  { id: "audit", icon: "📜", short: "Sign-off", label: "Sign-off" },
  { id: "blockchain", icon: "⛓", short: "Chain", label: "Chain evidence" },
];

function viewFromUrl(): string {
  if (typeof window === "undefined") return "board";
  const v = new URLSearchParams(window.location.search).get("view");
  return VIEWS.some((x) => x.id === v) ? v! : "board";
}

function setViewInUrl(v: string) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.set("view", v);
  window.history.replaceState(null, "", u);
}

const PILL_CLASSES = {
  ok: "pill-ok",
  warn: "pill-warn",
  bad: "pill-bad",
  neutral: "pill-new",
  new: "pill-new",
  blue: "pill-blue",
  purple: "pill-purple",
} as const;

type Tone = keyof typeof PILL_CLASSES;

const TONE_COLOR: Record<Tone, string> = {
  ok: "rgb(20 166 209)",
  warn: "rgb(180 85 4)",
  bad: "rgb(220 20 60)",
  neutral: "rgb(100 116 139)",
  new: "rgb(79 70 225)",
  blue: "rgb(30 58 138)",
  purple: "rgb(86 20 153)",
};

function ringColor(score: number): string {
  if (score >= 66) return TONE_COLOR.bad;
  if (score >= 33) return TONE_COLOR.warn;
  return TONE_COLOR.ok;
}

type ChartItem = { label: string; value: number; color: string; note?: string };

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(() => loadState());
  const run = state?.currentRun ?? null;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setViewRaw] = useState<string>(viewFromUrl);
  const switchView = (v: string) => { setViewRaw(v); setViewInUrl(v); };
  const [reviewer, setReviewer] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("re-review");
  const [reason, setReason] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [alternative, setAlternative] = useState("");
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const createRun = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { state: s, run: r } = await newRun();
      setState(s);
      setSelectedRiskId(null);
      setMsg(`Run ${r.runId} created.`);
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
      setMsg("Sign-off recorded. Export unlocked.");
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
        const res = await fetch("/api/dashboard/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run: current, format }) });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setMsg(`Export blocked (${res.status}).`);
          return;
        }
        const text = await res.text();
        const blob = new Blob([text], { type: format === "csv" ? "text/csv" : "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `export.${format}`;
        a.click();
        a.remove();
        setMsg(`Downloaded (${format}).`);
      } catch (e) {
        setMsg(`Error: ${(e as Error).message}`);
      }
    },
    [],
  );

  const handleReset = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem("bv-dashboard-state");
    setState({ currentRun: null, history: [] });
    setMsg("State reset.");
  }, []);

  if (!run) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Banner />
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold leading-tight">Homepage Brand Choice — Cost of an Unchecked Assumption</h1>
            <p className="text-slate-500 text-sm">AI recommender optimising add-to-cart vs a compliance red-line (&gt;=12% organic snacks).</p>
            <Button onClick={createRun} disabled={busy}>{busy ? "Running…" : "Run simulation"}</Button>
          </div>
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
  const coverage = evidenceCoverage(run);
  const redCount = run.risks.filter((r) => r.severity === "bad").length;
  const selectedRisk = selectedRiskId ? run.risks.find((r) => r.id === selectedRiskId) ?? null : null;
  const boardTone = within ? "ok" : "bad";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Banner />
      <header className="board-header">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-semibold text-sky-700">Audit trail — compliance</span>
          <span className="mono-chip">{run.runId}</span>
          <nav className="board-tabpanel">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => switchView(v.id)} aria-label={v.label} title={v.label} aria-current={view === v.id ? "page" : undefined} className={`board-tab ${view === v.id ? "board-tab-active" : ""}`}>
                <span aria-hidden="true">{v.icon}</span>
                <span className="ml-1 text-xs font-medium">{v.short}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button onClick={() => handleExport("json")} disabled={!exportOk || busy}>JSON</Button>
          <Button onClick={() => handleExport("csv")} disabled={!exportOk || busy}>CSV</Button>
          <button onClick={() => window.print()} className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1">Print</button>
          <button onClick={handleReset} className="text-xs text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg px-2.5 py-1">Reset</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {msg && <div className={`text-xs ${msg?.includes("Error") || msg?.includes("blocked") ? "text-rose-600" : "text-slate-600"}`}>{msg}</div>}
        {!exportOk && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Export blocked until sign-off.</div>}

        {view === "board" && <BoardView run={run} heat={heat} totals={totals} min={min} within={within} selectedRisk={selectedRisk} setSelectedRiskId={setSelectedRiskId} />}
        {view === "risk" && <RiskMapView run={run} selectedRisk={selectedRisk} setSelectedRiskId={setSelectedRiskId} />}
        {view === "heatmap" && <HeatView run={run} heat={heat} coverage={coverage} totals={totals} within={within} min={min} />}
        {view === "summary" && <SummaryView run={run} summary={summary} heat={heat} within={within} totals={totals} min={min} exportOk={exportOk} />}
        {view === "audit" && <AuditView run={run} selectedRisk={selectedRisk} signoff={{ reviewer, setReviewer, verdict, setVerdict, reason, setReason, uncertainty, setUncertainty, alternative, setAlternative, onSubmit: handleClassify, busy, exportOk }} />}
        {view === "blockchain" && <BlockchainView run={run} />}
      </div>
    </main>
  );
}

function Banner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center font-semibold tracking-wide text-amber-800 text-[11px] print:hidden">
       SIMULATED FIXTURE · no real spend · sample data only
    </div>
  );
}

function BoardView({
  run,
  heat,
  totals,
  min,
  within,
  selectedRisk,
  setSelectedRiskId,
}: {
  run: WorkflowRun;
  heat: { aggregate: number; withinBoundary: boolean };
  totals: { totalAdd: number; complianceShare: number; maximizeMetric: number };
  min: number;
  within: boolean;
  selectedRisk: RiskEntry | null;
  setSelectedRiskId: (id: string | null) => void;
}) {
  const columns = GROUPS.map((g) => ({ ...g, items: run.risks.filter((r) => groupFor(r, run) === g.id) }));
  return (
    <div className="space-y-5">
      <HeroCompliance run={run} within={within} totals={totals} min={min} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="board-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">Issue board</span>
              <span className="text-xs text-slate-400">select for evidence</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columns.map((col) => (
                <div key={col.id} className={`rounded-xl border bg-white p-3 group-accent-${col.tone}`}>
                  <div className="group-header mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className={`dot dot-${col.tone}`} />
                      <span className="text-xs text-slate-500">{col.label}</span>
                      <span className="pill-count">{col.items.length}</span>
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[60px]">
                    {col.items.length === 0 ? (
                      <div className="h-10 border-2 border-dashed border-slate-200 rounded-lg" />
                    ) : (
                      col.items.map((r) => <RiskItem key={r.id} risk={r} onSelect={() => setSelectedRiskId(r.id)} selected={selectedRisk?.id === r.id} />)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <SlotCanvas run={run} within={within} />
        </div>
      </div>
      {selectedRisk && <RiskDetail risk={selectedRisk} run={run} />}
    </div>
  );
}

function HeroCompliance({ run, within, totals, min }: { run: WorkflowRun; within: boolean; totals: { complianceShare: number; totalAdd: number }; min: number }) {
  const share = Math.round(totals.complianceShare);
  return (
    <div className={`board-card flex items-center gap-4 ${within ? "bg-emerald-50/40" : "bg-rose-50/40"}`}>
      <HeatRing score={share} label="Compliance share" size={72} />
      <div className="flex-1">
        <div className={`text-2xl font-extrabold ${within ? "text-emerald-700" : "text-rose-700"}`}>{within ? "COMPLIANT" : "VIOLATION"}</div>
         <div className="text-xs text-slate-500 mt-0.5">Target ≥{min}% · Observed {totals.complianceShare.toFixed(1)}% · +{totals.totalAdd} ATC</div>
      </div>
      <div className="text-3xl" aria-hidden="true">{within ? "✅" : "🚨"}</div>
    </div>
  );
}

const GROUPS: { id: string; label: string; tone: Tone }[] = [
  { id: "new", label: "New", tone: "new" },
  { id: "review", label: "Review", tone: "warn" },
  { id: "approved", label: "Approved", tone: "ok" },
];

function groupFor(risk: RiskEntry, run: WorkflowRun): "new" | "review" | "approved" {
  if (run.review && run.review.verdict === "approved" && !isRiskRed(risk)) return "approved";
  if (risk.severity === "bad" || risk.reviewStatus === "unreviewed") return "review";
  return "new";
}

function SlotCanvas({ run, within }: { run: WorkflowRun; within: boolean }) {
  const slots = run.observations.slots;
  const colFor = (s: (typeof slots)[number]): Tone => (!s.withinBoundary ? "bad" : s.isCompliance ? "ok" : "warn");
  return (
    <div className="board-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">Slot grid</span>
        <span className={`status-pill ${within ? "pill-ok" : "pill-bad"}`}>{within ? "All green" : `${slots.filter((s) => !s.withinBoundary).length} violations`}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-9 gap-2">
        {slots.map((s) => {
          const tone = colFor(s);
          const full = s.withinBoundary && s.isCompliance;
          return (
            <button
              key={s.slot}
              type="button"
              aria-label={`S${s.slot} ${s.category} +${s.actualAdd} ${s.shareOfHome.toFixed(1)}% ${s.withinBoundary ? "ok" : "violates"}`}
              title={`S${s.slot} · ${s.category} · +${s.actualAdd} · ${s.shareOfHome.toFixed(1)}% · ${s.withinBoundary ? "ok" : "violated"}`}
              className={`relative rounded-xl border-2 text-center transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400 ${full ? "bg-emerald-50 border-emerald-200" : !s.withinBoundary ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}
            >
              <div className="flex flex-col items-center justify-center h-14">
                <span className="mono-chip text-[9px]">S{s.slot}</span>
                <span className={`text-xs font-semibold`} style={{ color: TONE_COLOR[tone] }}>{s.actualAdd}</span>
              </div>
              {!s.withinBoundary && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 shadow" title="violation" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <Dot color={TONE_COLOR.ok} label="Compliant" />
        <Dot color={TONE_COLOR.warn} label="Attention" />
        <Dot color={TONE_COLOR.bad} label="Violated" />
      </div>
    </div>
  );
}

function RiskItem({ risk, onSelect, selected }: { risk: RiskEntry; onSelect: () => void; selected: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${risk.threat} · ${risk.severity} · select for evidence`}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={`item-card ${selected ? "selected" : ""} ${selected ? "" : risk.severity}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`dot dot-${risk.severity}`} />
          <span className="risk-title font-medium text-sm text-slate-800 truncate">{risk.threat}</span>
        </div>
        <Badge tone={risk.severity}>{risk.severity}</Badge>
      </div>
      <div className="flex items-center justify-between mt-2">
        <StatusPill tone={reviewStatusPill(risk.reviewStatus)} label={risk.reviewStatus} />
        <HeatRing score={Math.round((risk.likelihood * risk.impact) / 9 * 100)} label={risk.threat} size={34} />
      </div>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
      <span className="text-slate-500">{label}</span>
    </span>
  );
}

function RiskDetail({ risk, run }: { risk: RiskEntry; run: WorkflowRun }) {
  const pos = riskCellPosition(risk);
  const consistent = riskPositionConsistent(risk);
  return (
    <div className="mt-4 board-card" aria-label={`Detail for ${risk.threat}`}>
      <div className="flex items-center gap-2 mb-2">
        <HeatRing score={Math.round((risk.likelihood * risk.impact) / 9 * 100)} label={risk.threat} size={60} />
        <div>
          <div className="font-semibold text-slate-800">{risk.threat}</div>
          <div className="text-xs text-slate-500">L{risk.likelihood} × I{risk.impact} · {risk.severity} · {consistent ? "consistent" : "INCONSISTENT"}</div>
        </div>
        <SeverityIcon severity={risk.severity} />
      </div>
      <p className="text-xs text-slate-500">Decision aid · review: {risk.reviewStatus}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div><span className="text-slate-400">Cell:</span> <span className="text-slate-700">({pos.likelihood},{pos.impact})</span></div>
        <div><span className="text-slate-400">Likelihood:</span> <span className="text-slate-700">{risk.likelihoodLabel}</span></div>
        <div><span className="text-slate-400">Impact:</span> <span className="text-slate-700">{risk.impactLabel}</span></div>
      </div>
      <div className="mt-2"><span className="text-slate-400">Evidence:</span><ul className="list-disc list-inside text-slate-600 ml-4 text-xs"><li>{risk.rationale}</li>{risk.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
      {risk.decisionLog.length > 0 && (
        <div className="mt-2"><span className="text-slate-400">History:</span><ul className="list-disc list-inside text-slate-600 ml-4 text-xs">{risk.decisionLog.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
      )}
    </div>
  );
}

function RiskMapView({ run, selectedRisk, setSelectedRiskId }: { run: WorkflowRun; selectedRisk: RiskEntry | null; setSelectedRiskId: (id: string | null) => void }) {
  const cells = [];
  for (let impact = 3; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 3; likelihood++) cells.push({ likelihood, impact });
  }
  const riskScore = (r: RiskEntry) => Math.round((r.likelihood * r.impact) / 9 * 100);
  return (
    <div className="space-y-4">
      <div className="board-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Risk matrix</span>
          <span className="text-xs text-slate-400" title="Decision aid, not proof">L × I · hover, click</span>
        </div>
        <div className="grid grid-cols-3 gap-2" style={{ aspectRatio: "1 / 1" }}>
          {cells.map((c) => {
            const match = run.risks.find((r) => r.likelihood === c.likelihood && r.impact === c.impact) ?? null;
            const selected = selectedRisk?.id === match?.id;
            return (
              <MatrixCell key={`${c.likelihood}-${c.impact}`} match={match} score={match ? riskScore(match) : 0} selected={selected} onSelect={() => match && setSelectedRiskId(match.id)} />
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
          <span>Likelihood: L / M / H (left to right)</span><span>Impact: H (top) to L (bottom)</span>
        </div>
      </div>
      {selectedRisk ? <RiskDetail risk={selectedRisk} run={run} /> : <p className="text-xs text-slate-400">Tap/click a marker for evidence.</p>}
    </div>
  );
}

function MatrixCell({ match, score, selected, onSelect }: { match: RiskEntry | null; score: number; selected: boolean; onSelect: () => void }) {
  const bg = !match ? "bg-slate-100/60" : match.severity === "bad" ? "bg-rose-50 border-rose-200" : match.severity === "warn" ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200";
  const glows: Record<string, string> = { ok: TONE_COLOR.ok, warn: TONE_COLOR.warn, bad: TONE_COLOR.bad };
  return (
    <div
      className={`relative rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${bg} ${selected ? "ring-2 ring-sky-400 scale-105" : "hover:scale-105 hover:shadow-md"} ${match ? "cursor-pointer" : "cursor-default"}`}
      onClick={match ? onSelect : undefined}
      role={match ? "button" : undefined}
      tabIndex={match ? 0 : undefined}
      aria-label={match ? `${match.threat} L${match.likelihood} I${match.impact} ${match.severity}` : "empty"}
      onKeyDown={match ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined}
      style={selected && match ? { boxShadow: `0 0 0 4px ${glows[match.severity]}` } : undefined}
    >
      {match ? <HeatRing score={score} label={match.threat} size={46} /> : <span className="text-slate-300 text-xl">·</span>}
    </div>
  );
}

function HeatView({ run, heat, coverage, totals, within, min }: { run: WorkflowRun; heat: { aggregate: number; withinBoundary: boolean }; coverage: number; totals: { complianceShare: number; totalAdd: number }; within: boolean; min: number }) {
  const items: ChartItem[] = [
    { label: "Authority", value: 25, color: TONE_COLOR.bad, note: "R" },
    { label: "Evidence", value: 92, color: TONE_COLOR.ok, note: "G" },
    { label: "Failure detect", value: 65, color: TONE_COLOR.warn, note: "A" },
    { label: "Recovery", value: 40, color: TONE_COLOR.bad, note: "R" },
    { label: "Ownership", value: 55, color: TONE_COLOR.warn, note: "A" },
    { label: "Business align", value: 30, color: TONE_COLOR.bad, note: "R" },
  ];
  return (
    <div className="space-y-4">
      <div className="board-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Governance heat</span>
          <span className="text-xs text-slate-400">evidence {coverage}% · heat {Math.round(heat.aggregate * 100)}/100</span>
        </div>
        <BarChart items={items} />
        <div className="mt-3 flex gap-3 text-[10px]">
          <Dot color={TONE_COLOR.ok} label="Green: healthy" />
          <Dot color={TONE_COLOR.warn} label="Amber: review" />
          <Dot color={TONE_COLOR.bad} label="Red: act" />
        </div>
      </div>
      <div className="board-card">
        <span className="text-sm font-semibold text-slate-700 block mb-2">Signals at a glance</span>
        <BarChart
          max={100}
          items={[
            { label: "Evidence coverage", value: coverage, color: coverage >= 50 ? TONE_COLOR.ok : coverage >= 25 ? TONE_COLOR.warn : TONE_COLOR.bad, note: `${coverage}%` },
            { label: "Compliance share", value: totals.complianceShare, color: within ? TONE_COLOR.ok : TONE_COLOR.bad, note: `${totals.complianceShare.toFixed(1)}%` },
            { label: "Red-line", value: min, color: TONE_COLOR.neutral, note: `${min}%` },
          ]}
        />
      </div>
    </div>
  );
}

function SummaryView({ run, summary, heat, within, totals, min, exportOk }: { run: WorkflowRun; summary: { headline: string; bullets: string[]; verdict: Verdict }; heat: { aggregate: number; withinBoundary: boolean }; within: boolean; totals: { totalAdd: number; complianceShare: number }; min: number; exportOk: boolean }) {
  return (
    <div className="space-y-4 printable">
      <div className="board-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Verdict</span>
          <StatusPill tone={run.review ? "ok" : "bad"} label={run.review ? "Signed off" : "Pending"} />
        </div>
        <div className={`text-center font-extrabold text-xl p-4 rounded-xl ${within ? "text-emerald-800 bg-emerald-50 border border-emerald-200" : "text-rose-800 bg-rose-50 border border-rose-200"}`}>{summary.headline}</div>
        <div className="mt-3">
          <BarChart max={100} items={[
            { label: "Compliance share", value: totals.complianceShare, color: within ? TONE_COLOR.ok : TONE_COLOR.bad, note: `${totals.complianceShare.toFixed(1)}%` },
            { label: "Red-line target", value: min, color: TONE_COLOR.neutral, note: `${min}%` },
            { label: "Heat", value: heat.aggregate * 100, color: heat.withinBoundary ? TONE_COLOR.ok : TONE_COLOR.bad, note: `${Math.round(heat.aggregate * 100)}` },
          ]} />
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Recommendation: <span className={`font-semibold ${summary.verdict === "approved" ? "text-emerald-700" : summary.verdict === "blocked" ? "text-rose-700" : "text-amber-700"}`}>{summary.verdict.toUpperCase()}</span> · decision aid, not proof
        </div>
      </div>

      <div className="board-card">
        <span className="text-sm font-semibold text-slate-700 block mb-2">Limits</span>
        <ul className="list-disc list-inside text-slate-500 text-xs space-y-0.5">
          {run.nonClaims.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>

      {!within && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 flex items-center gap-2">
          <span>🚨</span>Red-line open · release needs owner acceptance ({run.config.redLineOwner}).
        </div>
      )}
      <div className="text-xs text-slate-500">Export: {exportOk ? "unlocked" : "blocked · sign-off"}</div>
    </div>
  );
}

function AuditView({ run, selectedRisk, signoff }: { run: WorkflowRun; selectedRisk: RiskEntry | null; signoff: { reviewer: string; setReviewer: (v: string) => void; verdict: Verdict; setVerdict: (v: Verdict) => void; reason: string; setReason: (v: string) => void; uncertainty: string; setUncertainty: (v: string) => void; alternative: string; setAlternative: (v: string) => void; onSubmit: () => Promise<void>; busy: boolean; exportOk: boolean } }) {
  return (
    <div className="space-y-4 printable">
      <SignoffForm run={run} s={signoff} />
      <div className="board-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Audit trail</span>
          <span className="text-xs text-slate-400">chain: {run.chainOk ? "intact" : "BROKEN"} - review: {run.review?.verdict ?? "unreviewed"}</span>
        </div>
        <ChainGraph entries={run.audit} />
      </div>
      {selectedRisk && (
        <div className="board-card">
          <span className="text-sm font-semibold text-slate-700 block mb-2">Evidence — {selectedRisk.threat}</span>
          <ul className="list-disc list-inside text-xs text-slate-600 ml-3">
            <li>{selectedRisk.rationale}</li>
            {selectedRisk.evidence.map((e, i) => <li key={i}>{e}</li>)}
            {selectedRisk.decisionLog.map((d, i) => <li key={`d${i}`}>{d}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function SignoffForm({ run, s }: { run: WorkflowRun; s: { reviewer: string; setReviewer: (v: string) => void; verdict: Verdict; setVerdict: (v: Verdict) => void; reason: string; setReason: (v: string) => void; uncertainty: string; setUncertainty: (v: string) => void; alternative: string; setAlternative: (v: string) => void; onSubmit: () => Promise<void>; busy: boolean; exportOk: boolean } }) {
  if (run.review) {
    return (
      <div className="board-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Sign-off recorded</span>
          <span className="mono-chip">{run.review.by} ({run.review.role})</span>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div><dt className="text-slate-400">Verdict</dt><dd className={run.review.verdict === "approved" ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold"}>{run.review.verdict}</dd></div>
          <div><dt className="text-slate-400">At</dt><dd className="text-slate-700">{run.review.at}</dd></div>
          <div className="col-span-2"><dt className="text-slate-400">Why</dt><dd className="text-slate-700">{run.review.reason}</dd></div>
          <div><dt className="text-slate-400">Uncertainty</dt><dd className="text-slate-700">{run.review.uncertainty}</dd></div>
          <div><dt className="text-slate-400">Alternative</dt><dd className="text-slate-700">{run.review.alternative}</dd></div>
        </dl>
      </div>
    );
  }
  return (
    <div className="board-card">
      <span className="text-sm font-semibold text-slate-700 block mb-1">Sign-off unlocks export</span>
      <p className="text-[10px] text-slate-400 mb-2">Record verdict + reason.</p>
      <div className="space-y-2 text-sm">
        <select value={s.verdict} onChange={(e) => s.setVerdict(e.target.value as Verdict)} className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white text-sm">
          <option value="approved">approved — in bounds</option>
          <option value="blocked">blocked — out of bounds</option>
          <option value="re-review">re-review — investigate</option>
        </select>
        <input value={s.reviewer} onChange={(e) => s.setReviewer(e.target.value)} placeholder="Your name" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white text-sm" />
        <input value={s.reason} onChange={(e) => s.setReason(e.target.value)} placeholder="Reason" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white text-sm" />
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={s.uncertainty} onChange={(e) => s.setUncertainty(e.target.value)} placeholder="Uncertainty" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white text-sm" />
          <input value={s.alternative} onChange={(e) => s.setAlternative(e.target.value)} placeholder="Alternative explanation" className="border border-slate-200 rounded-lg p-2 w-full text-slate-800 bg-white text-sm" />
        </div>
        <Button onClick={s.onSubmit} disabled={s.busy || !s.reviewer || !s.reason}>{s.busy ? "Recording…" : "Record sign-off"}</Button>
      </div>
    </div>
  );
}

function BlockchainView({ run }: { run: WorkflowRun }) {
  return (
    <div className="space-y-4">
      <div className="board-card">
        <span className="text-sm font-semibold text-slate-700 block mb-1">Chain evidence</span>
        <p className="text-[10px] text-slate-400">Simulated · tamper-evidence only · no real chain</p>
        <div className="grid grid-cols-2 gap-3 mt-2 text-[11px]">
          <QaInline q="Run" a={run.runId} />
          <QaInline q="Chain" a="Ethereum (sim testnet)" />
          <QaInline q="Status" a="SIMULATED" />
          <QaInline q="Root" a={run.audit.length ? run.audit[run.audit.length - 1].hash.slice(0, 24) + "…" : "—"} />
        </div>
      </div>
      <div className="board-card">
        <span className="text-sm font-semibold text-slate-700 block mb-2">Event log</span>
        <ChainGraph entries={run.audit} />
      </div>
    </div>
  );
}

function ChainGraph({ entries }: { entries: AuditEntry[] }) {
  const n = entries.length;
  if (!n) return <span className="text-xs text-slate-400">No audit entries.</span>;
  const bw = 116;
  const bh = 46;
  const gap = 10;
  const pad = 14;
  const totalW = pad * 2 + n * bw + (n - 1) * gap;
  return (
    <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${totalW} 80`} role="img" aria-label="Audit chain" className="w-full h-auto">
        <title>Audit chain</title>
        {entries.map((a, i) => {
          const x = pad + i * (bw + gap);
          const filled = !!a.payload?.verdict;
          const col = filled ? TONE_COLOR.ok : a.action.includes("sign") ? TONE_COLOR.bad : a.action.includes("sim") ? TONE_COLOR.blue : TONE_COLOR.neutral;
          return (
            <g key={a.seq} transform={`translate(${x} 0)`} className="chain-node">
              <rect x={0} y={8} width={bw} height={bh} rx={8} fill="#ffffff" stroke={col} strokeWidth={2} />
              <rect x={0} y={8} width={bw} height={15} rx="8 8 0 0" fill={col} opacity={0.12} />
              <text x={10} y={23} className="fill-slate-700" fontSize={11} fontWeight={600}>#{a.seq}</text>
              <text x={10} y={38} className="fill-slate-500" fontSize={10}>{a.action}</text>
              {i < n - 1 && (
                <>
                  <line x1={bw} y1={30} x2={bw + gap} y2={30} stroke={col} strokeWidth={2} strokeLinecap="round" />
                  <polygon points={`${bw + gap - 1} 27 ${bw + gap + 3} 30 ${bw + gap - 1} 33`} fill={col} />
                </>
              )}
              <title>{`#${a.seq} ${a.action} · ${a.actor} @ ${a.ts} · ${a.hash.slice(0, 10)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HeatRing({ score, label, size = 58 }: { score: number; label: string; size?: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = (size - 10) / 2;
  const c = Math.PI * r;
  const offset = c * (1 - pct / 100);
  const col = ringColor(score);
  const inside = ((pct * 1.6) | 0);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="ring" role="img" aria-label={`${label}: ${pct}%`} focusable="false">
      <title>{`${label}: ${pct}%`}</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(226 232 240)" strokeWidth={size / 22} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={size / 22} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" className="fill-slate-700" fontSize={size / 4.2} fontWeight={700}>{inside}</text>
    </svg>
  );
}

function BarChart({ items, max }: { items: ChartItem[]; max?: number }) {
  const values = items.map((i) => i.value);
  const ceiling = max ?? Math.max(1, ...values);
  const gap = 8;
  const barHeight = 10;
  const yStep = barHeight + gap;
  const totalH = Math.max(80, items.length * yStep + gap);
  const labelW = 120;
  const trackW = 220;
  return (
    <svg viewBox={`0 0 ${labelW + trackW + 60} ${totalH}`} role="img" aria-label="bar chart" className="w-full" preserveAspectRatio="xMidYMid meet">
      <title>Bar chart</title>
      {items.map((it, i) => {
        const w = (it.value / ceiling) * trackW;
        const y = i * yStep + gap;
        const lab = it.label;
        return (
          <g key={i} transform={`translate(0 ${y})`}>
            <title>{`${lab} - ${it.note ?? it.value}`}</title>
            <text x={labelW - 6} y={barHeight / 2 + 3} textAnchor="end" className="fill-slate-500" fontSize={10} fontWeight={500}>{lab}</text>
            <rect x={labelW} y={0} width={trackW} height={barHeight} rx={barHeight / 2} className="fill-slate-100" />
            <rect x={labelW} y={0} width={w} height={barHeight} rx={barHeight / 2} style={{ fill: it.color }} />
            {it.note !== undefined && <text x={labelW + trackW + 6} y={barHeight / 2 + 3} className="fill-slate-600" fontSize={10} fontWeight={600}>{typeof it.note === "string" ? it.note : ""}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`status-pill ${PILL_CLASSES[tone] ?? PILL_CLASSES.neutral}`}>{children}</span>;
}

function StatusPill({ tone, label }: { tone: Tone; label: ReactNode }) {
  return <span className={`status-pill ${PILL_CLASSES[tone] ?? PILL_CLASSES.neutral}`}>{label}</span>;
}

function QaInline({ q, a }: { q: string; a: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-400">{q}</dt>
      <dd className="text-slate-800 font-medium break-all">{a}</dd>
    </div>
  );
}
