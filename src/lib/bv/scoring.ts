import type { ControlOutcome, RiskEntry, Severity, Verdict } from "./types";
import { WORKFLOW_CONFIG, SIMULATED_SLOTS } from "./data";

export function computeTotals() {
  const totalAdd = SIMULATED_SLOTS.reduce((s, o) => s + o.actualAdd, 0);
  const compSlots = SIMULATED_SLOTS.filter((o) => o.isCompliance).length;
  const complianceShare = (compSlots / SIMULATED_SLOTS.length) * 100;
  return { totalAdd, complianceShare, maximizeMetric: totalAdd };
}

export function boundaryCheck(share: number, min: number): boolean {
  return share >= min;
}

export function computeHeatScore() {
  const totals = computeTotals();
  const min = WORKFLOW_CONFIG.complianceMinimum.value;
  const withinBoundary = boundaryCheck(totals.complianceShare, min);
  const normalize = (v: number, max: number) => Math.min(v / max, 1);
  const compScore = normalize(totals.complianceShare, 100);
  const maxSum = SIMULATED_SLOTS.reduce((s, o) => s + o.expectedAdd, 0);
  const maxScore = normalize(totals.totalAdd, maxSum);
  const aggregate = WORKFLOW_CONFIG.maximizeWeight * maxScore + WORKFLOW_CONFIG.compositionWeight * compScore;
  return { compScore, maxScore, aggregate, withinBoundary };
}

export function severityFromBoolean(ok: boolean, warnOk = false): Severity {
  if (ok) return "ok";
  if (warnOk) return "warn";
  return "bad";
}

export function outcomeFromSeverity(sev: Severity): ControlOutcome {
  if (sev === "ok") return "passed";
  if (sev === "warn") return "warn";
  return "failed";
}

export const RISK_ENTRIES: RiskEntry[] = [
  {
    id: "r1",
    threat: "Compliance share drifts below 12% at scale",
    likelihood: 3,
    likelihoodLabel: "high",
    impact: 3,
    impactLabel: "high",
    rationale: "Organic snack slot is already at 1.6% vs 12% required.",
    severity: "bad",
  },
  {
    id: "r2",
    threat: "Rule never re-checked before daily deploy",
    likelihood: 2,
    likelihoodLabel: "medium",
    impact: 2,
    impactLabel: "medium",
    rationale: "No sign-off gate is enforced by the pipeline today.",
    severity: "warn",
  },
  {
    id: "r3",
    threat: "Red-line rule is silently overridden",
    likelihood: 1,
    likelihoodLabel: "low",
    impact: 3,
    impactLabel: "high",
    rationale: "Operator override path exists but is un-audited.",
    severity: "warn",
  },
  {
    id: "r4",
    threat: "Maximization objective dominates compliance",
    likelihood: 3,
    likelihoodLabel: "high",
    impact: 1,
    impactLabel: "low",
    rationale: "Weights (0.6/0.4) still favour add-to-cart.",
    severity: "warn",
  },
  {
    id: "r5",
    threat: "Observation data source is spoofed",
    likelihood: 2,
    likelihoodLabel: "medium",
    impact: 2,
    impactLabel: "medium",
    rationale: "Upstream ingestion has no signature verification.",
    severity: "warn",
  },
];

export function riskSeverity(l: number, i: number): Severity {
  const score = l * i;
  if (score >= 6) return "bad";
  if (score >= 3) return "warn";
  return "ok";
}

export function deriveVerdict(withinBoundary: boolean): Verdict {
  const scores = computeHeatScore();
  if (!withinBoundary || scores.aggregate < 0.5) return "blocked";
  return "re-review";
}
