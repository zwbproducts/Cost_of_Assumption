"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { RiskIcon, Avatar, Button, SeverityIcon } from "@/components/ui";
import type { ClassificationRequest, DashboardState, RiskEntry, Verdict, WorkflowRun } from "@/lib/bv/types";
import { canExport, loadState, newRun, saveReview } from "@/lib/bv/client";
import { summarize } from "@/lib/bv/workflow";
import { evidenceCoverage, heatScoreFormula, isRiskRed, riskCellPosition, riskPositionConsistent, reviewStatusPill } from "@/lib/bv/view";

const VIEWS: { id: string; label: string; icon: string }[] = [
  { id: "board", label: "Board", icon: "📋" },
  { id: "risk", label: "Risk map", icon: "🎯" },
  { id: "heatmap", label: "Heatmap", icon: "🔥" },
  { id: "summary", label: "Summary", icon: "📈" },
  { id: "audit", label: "Audit & sign-off", icon: "📜" },
  { id: "blockchain", label: "Blockchain evidence", icon: "⛓" },
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

type Tone = keyof typeof PILL_CLASSES;

const TONE_COLOR: Record<Tone, string> = {
  ok: "rgb(20 166 209)",
  warn: "rgb(180 85 4)",
  bad: "rgb(220 20 60)",
  neutral: "rgb(100 116 139)",
  new: "rgb(79 70 229)",
  blue: "rgb(30 58 138)",
  purple: "rgb(86 20 153)",
};

function ringColor(score: number): string {
  if (score >= 66) return TONE_COLOR.bad;
  if (score >= 33) return TONE_COLOR.warn;
  return TONE_COLOR.ok;
}

function HeatRing({ score, label, size = 58 }: { score: number; label: string; size?: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = (size - 10) / 2;
  const c = Math.PI * r;
  const offset = c * (1 - pct / 100);
  const col = ringColor(score);
  const inside = ((pct * 1.6) | 0);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="ring"
      role="img"
      aria-label={`${label}: ${pct}%`}
      focusable="false"
    >
      <title>{`${label}: ${pct}%`}</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(226 232 240)" strokeWidth={size / 22} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={col}
        strokeWidth={size / 22}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" className="fill-slate-700" fontSize={size / 4.2} fontWeight={700}>
        {inside}
      </text>
    </svg>
  );
}

type ChartItem = { label: ReactNode; value: number; color: string; note?: string };

function BarChart({ items, max, height = 16, gap = 8, barHeight = 10 }: { items: ChartItem[]; max?: number; height?: number; gap?: number; barHeight?: number }) {
  const values = items.map((i) => i.value);
  const ceiling = max ?? Math.max(1, ...values);
  const yStep = barHeight + gap;
  const totalH = Math.max(60, items.length * yStep + gap);
  const labelW = 150;
  const trackW = 220;
  return (
    <svg
      viewBox={`0 0 ${labelW + trackW + 60} ${totalH}`}
      role="img"
      aria-label="bar chart"
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>Bar chart</title>
      {items.map((it, i) => {
        const w = (it.value / ceiling) * trackW;
        const y = i * yStep + gap;
        const txt = it.note ?? String(it.value);
        const lab = typeof it.label === "string" ? it.label : "";
        return (
          <g key={i} transform={`translate(0 ${y})`}>
            <title>{`${lab} — ${txt}`}</title>
            <text x={labelW - 6} y={barHeight / 2 + 3} textAnchor="end" className="fill-slate-500" fontSize={10} fontWeight={500}>
              {lab}
            </text>
            <rect x={labelW} y={0} width={trackW} height={barHeight} rx={barHeight / 2} className="fill-slate-100" />
            <rect x={labelW} y={0} width={w} height={barHeight} rx={barHeight / 2} style={{ fill: it.color }} />
            {it.note !== undefined && (
              <text x={labelW + trackW + 6} y={barHeight / 2 + 3} className="fill-slate-600" fontSize={10} fontWeight={600}>
                {typeof txt === "string" ? txt : ""}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

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
                aria-label={v.label}
                title={v.label}
                className={`board-tab ${view === v.id ? "board-tab-active" : ""}`}
                aria-current={view === v.id ? "page" : undefined}
              >
                <span aria-hidden="true">{v.icon}</span>
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
        {view === "heatmap" && renderHeatmap(run, heat, coverage, summary, within, totals)}
        {view === "summary" && renderSummary(run, summary, heat, within, totals, min, exportOk)}
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
        <MetricRing label="Compliance share" score={Math.round(totals.complianceShare)} outOf={100} tone={within ? "ok" : "bad"} note={`need ≥ ${min}%`} />
        <MetricRing label="Aggregate heat" score={Math.round(heat.aggregate * 100)} outOf={100} tone={within ? "ok" : "warn"} note={`comp ${Math.round(heat.composition * 100)} · max ${Math.round(heat.maximize * 100)}`} />
        <MetricRing label="Add-to-cart (total)" score={totals.totalAdd} outOf={run.config.slots} tone="neutral" note="simulated" />
        <MetricRing label="Open risks" score={risks.length} outOf={run.risks.length} tone={risks.some((r) => r.severity === "bad") ? "bad" : "warn"} note={`${risks.filter((r) => r.severity === "bad").length} red`} />
      </div>

      <ColorKey />

      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Declared boundary (red-line)</h2>
          <span className={`status-pill ${within ? "pill-ok" : "pill-bad"}`}>{within ? "PASS" : "FAIL"}</span>
        </div>
        <p className="text-slate-800 font-medium">{run.config.complianceMinimum.description}</p>
        {!within && <span className="inline-flex items-center gap-1.5 mt-2 text-xs"><span className="h-2 w-2 rounded-full bg-rose-500" />Below the red-line of {min}% — visualised below.</span>}
      </div>

      <div className="board-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-600">Risk board (grouped by status)</h2>
          <span className="text-xs text-slate-400">Click a card to view evidence and decision history.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col.id} className={`rounded-xl border border-slate-200 bg-slate-50 p-3 group-accent-${col.tone}`}>
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

      <SlotCanvas run={run} min={min} within={within} />
    </div>
  );
}

function SlotCanvas({ run, min, within }: { run: WorkflowRun; min: number; within: boolean }) {
  const slots = run.observations.slots;
  const maxAdd = Math.max(1, ...slots.map((s) => s.actualAdd));
  const colFor = (s: (typeof slots)[number]) => {
    if (!s.withinBoundary) return "bad";
    if (s.isCompliance) return "ok";
    return "warn";
  };
  const labelFor = (s: (typeof slots)[number]) => (s.isCompliance ? "organic" : s.category);
  return (
    <div className="board-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-600">Homepage slot grid (9 slots)</h2>
        <span className={`status-pill ${within ? "pill-ok" : "pill-bad"}`}>{within ? "All green" : `${slots.filter((s) => !s.withinBoundary).length} violations`}</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">Color = boundary status. Hover a tile for detail. Green = compliant, red = violated red-line, amber = non-compliance slot.</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-9 gap-2">
        {slots.map((s) => {
          const tone = colFor(s) as Tone;
          const col = TONE_COLOR[tone];
          const full = s.withinBoundary && s.isCompliance;
          return (
            <div
              key={s.slot}
              tabIndex={0}
              role="button"
              aria-label={`Slot ${s.slot}: ${s.category}, ${s.actualAdd} add-to-cart, ${s.shareOfHome.toFixed(1)}% share, ${s.withinBoundary ? "within" : "outside"} boundary`}
              title={`Slot ${s.slot} · ${s.category} · +${s.actualAdd} ATC · ${s.shareOfHome.toFixed(1)}% · ${s.withinBoundary ? "within" : "VIOLATES"} red-line`}
              className={`relative rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-400 ${full ? "bg-emerald-50 border-emerald-200" : !s.withinBoundary ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}
            >
              <div className="flex flex-col items-center justify-center h-16 p-1">
                <span className={`mono-chip text-[10px]`}>S{s.slot}</span>
                <span className={`text-xs font-semibold`} style={{ color: col }}>{s.actualAdd}</span>
              </div>
              {!s.withinBoundary && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 shadow" title="Boundary violation" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <Dot color={TONE_COLOR.ok} label="Compliant organic slot" />
        <Dot color={TONE_COLOR.warn} label="Non-compliance slot (electronics)" />
        <Dot color={TONE_COLOR.bad} label="Boundary violation" />
        <Dot color={TONE_COLOR.neutral} label="Share target ≥ {min}%" note={`${run.observations.totals.complianceShare.toFixed(1)}% actual`} />
      </div>
    </div>
  );
}

function Dot({ color, label, note }: { color: string; label: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
      <span className="text-slate-500">{label}</span>
      {note && <span className="text-slate-400 mono-chip">{note}</span>}
    </span>
  );
}

function MetricRing({ label, score, outOf, tone, note }: { label: string; score: number; outOf: number; tone: Tone; note: string }) {
  const pct = outOf ? Math.round((Math.min(score, outOf) / outOf) * 100) : score;
  const color = TONE_COLOR[tone];
  return (
    <div className="metric-card">
      <HeatRing score={pct} label={label} size={58} />
      <div className={`mt-1 text-xs font-semibold`} style={{ color }}>{label}</div>
      <div className="text-xs text-slate-400">{note}</div>
    </div>
  );
}

function ColorKey() {
  return (
    <div className="board-card">
      <h2 className="text-sm font-semibold text-slate-600 mb-2">At-a-glance — colour coding</h2>
      <p className="text-xs text-slate-400 mb-2">Green = boundary respected · Amber = partial/attention · Red = boundary violated · Purple = new / pending human review.</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <Key color="rgb(20 166 209)" label="Compliant / ok" />
        <Key color="rgb(180 85 4)" label="At risk / warn" />
        <Key color="rgb(220 20 60)" label="Violated / blocked" />
        <Key color="rgb(79 70 225)" label="New / unreviewed" />
        <Key color="rgb(100 116 139)" label="Neutral / informational" />
      </div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border border-slate-200 bg-white">
      <span className="block h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-slate-600">{label}</span>
    </span>
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
          <div className="risk-title font-medium text-sm text-slate-800">{risk.threat}</div>
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
                className={`border rounded-xl p-2 text-xs text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  match ? "border-rose-200 bg-rose-50 hover:scale-105 hover:border-rose-300 hover:shadow-md cursor-pointer" : "border-slate-200 bg-slate-100/60 text-slate-400"
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

function renderHeatmap(run: WorkflowRun, heat: { aggregate: number; withinBoundary: boolean }, coverage: number, summary: { headline: string; bullets: string[]; verdict: Verdict }, within: boolean, totals: { totalAdd: number; complianceShare: number; maximizeMetric: number }) {
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
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-600">Governance heat</span>
          <span className="text-xs text-slate-400">Decision aid · recorded assessment</span>
        </div>
        <BarChart items={areas.map((a) => ({ label: a.name, value: a.score, color: a.rag === "G" ? TONE_COLOR.ok : a.rag === "A" ? TONE_COLOR.warn : TONE_COLOR.bad, note: `${a.score} · ${a.evidence}%` }))} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Dot color={TONE_COLOR.ok} label="Green: healthy" />
          <Dot color={TONE_COLOR.warn} label="Amber: review" />
          <Dot color={TONE_COLOR.bad} label="Red: act" />
        </div>
      </div>

      <div className="board-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-600">Evidence & signals</span>
          <span className="text-xs text-slate-400">coverage {coverage}% · heat {Math.round(heat.aggregate * 100)}/100</span>
        </div>
        <BarChart
          max={100}
          items={[
            { label: "Evidence coverage", value: coverage, color: coverage >= 50 ? TONE_COLOR.ok : coverage >= 25 ? TONE_COLOR.warn : TONE_COLOR.bad, note: `${coverage}%` },
            { label: "Heat (within bounds)", value: heat.withinBoundary ? 0 : 100, color: heat.withinBoundary ? TONE_COLOR.ok : TONE_COLOR.bad, note: heat.withinBoundary ? "ok" : "breach" },
            { label: "Boundary check", value: totals.complianceShare, color: within ? TONE_COLOR.ok : TONE_COLOR.bad, note: `${totals.complianceShare.toFixed(1)}%` },
          ]}
        />
      </div>
    </div>
  );
}

function renderSummary(run: WorkflowRun, summary: { headline: string; bullets: string[]; verdict: Verdict }, heat: { aggregate: number; withinBoundary: boolean }, within: boolean, totals: { totalAdd: number; complianceShare: number; maximizeMetric: number }, min: number, exportOk: boolean) {
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
        <div className="mt-3">
          <BarChart
            max={100}
            items={[
              { label: "Compliance share", value: totals.complianceShare, color: within ? TONE_COLOR.ok : TONE_COLOR.bad, note: `${totals.complianceShare.toFixed(1)}%` },
              { label: "Red-line target", value: min, color: TONE_COLOR.neutral, note: `${min}%` },
              { label: "Heat (within bounds)", value: heat.aggregate * 100, color: heat.withinBoundary ? TONE_COLOR.ok : TONE_COLOR.bad, note: `${Math.round(heat.aggregate * 100)}` },
            ]}
          />
        </div>
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
