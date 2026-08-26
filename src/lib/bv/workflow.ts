import type {
  AuditEntry,
  ControlResult,
  Review,
  SlotObservation,
  Verdict,
  WorkflowConfig,
  WorkflowRun,
} from "./types";
import { WORKFLOW_CONFIG, SIMULATED_SLOTS, isTodayISO } from "./data";
import {
  boundaryCheck,
  computeHeatScore,
  computeTotals,
  outcomeFromSeverity,
  RISK_ENTRIES,
  severityFromBoolean,
} from "./scoring";
import { genesis, makeHash } from "./hash";

export async function buildObservationSet(runId: string): Promise<{ observations: SlotObservation[]; totals: ReturnType<typeof computeTotals> }> {
  const totals = computeTotals();
  const observations = SIMULATED_SLOTS.map((o) => ({ ...o }));
  return { observations, totals };
}

export function buildControls(totals: ReturnType<typeof computeTotals>): ControlResult[] {
  const min = WORKFLOW_CONFIG.complianceMinimum.value;
  const within = boundaryCheck(totals.complianceShare, min);
  return [
    {
      id: "c1",
      name: "Compliance minimum enforced",
      expectation: `>= ${min}% organic snack share`,
      outcome: outcomeFromSeverity(severityFromBoolean(within)),
      detail: `${totals.complianceShare.toFixed(1)}% is ${within ? "≥" : "<"} ${min}%`,
      severity: severityFromBoolean(within),
    },
    {
      id: "c2",
      name: "Maximize objective within bounds",
      expectation: "add-to-cart increased",
      outcome: "warn",
      detail: `total add-to-cart ${totals.totalAdd}, but composition violated`,
      severity: "warn",
    },
    {
      id: "c3",
      name: "No live credentials",
      expectation: "no real signing backend",
      outcome: "passed",
      detail: "All values are SIMULATED FIXTURES",
      severity: "ok",
    },
  ];
}

export async function buildRun(runId: string): Promise<WorkflowRun> {
  const { observations, totals } = await buildObservationSet(runId);
  const controls = buildControls(totals);
  const heat = computeHeatScore();
  const run: WorkflowRun = {
    runId,
    config: { ...WORKFLOW_CONFIG },
    observations: { runId, workflowId: WORKFLOW_CONFIG.id, generatedAt: isTodayISO(), slots: observations, totals },
    controls,
    risks: RISK_ENTRIES,
    heatScore: {
      composition: heat.compScore,
      maximize: heat.maxScore,
      aggregate: heat.aggregate,
      withinBoundary: heat.withinBoundary,
    },
    review: null,
    audit: [],
    chainOk: true,
    claim: "The red-line compliance minimum was respected by the recommendation run.",
    nonClaims: [
      "This simulation does not predict real customer behaviour.",
      "This does not replace merchandising, legal, compliance, or human approval.",
      "All metrics are SIMULATED FIXTURES derived from a static seed.",
    ],
    mode: "simulation",
    createdAt: isTodayISO(),
  };
  const genesisHash = genesis();
  const audit: AuditEntry[] = [];
  let prev = genesisHash;
  const entries: Array<{ actor: string; action: string; payload: Record<string, unknown> }> = [
    { actor: "system", action: "run_defined", payload: { runId, workflowId: run.config.id, name: run.config.name } },
    { actor: "system", action: "observations_recorded", payload: { slots: run.observations.slots.length, totals } },
    { actor: "system", action: "controls_evaluated", payload: { results: run.controls.length } },
    { actor: "system", action: "risk_mapped", payload: { risks: run.risks.length } },
    { actor: "system", action: "heat_scored", payload: { aggregate: run.heatScore.aggregate, withinBoundary: run.heatScore.withinBoundary } },
    {
      actor: "system",
      action: "claim_stated",
      payload: { claim: run.claim, redLineOwner: run.config.redLineOwner, redLineSetAt: run.config.redLineSetAt },
    },
  ];
  for (const e of entries) {
    const entry = { seq: audit.length + 1, ts: run.createdAt, actor: e.actor, action: e.action, payload: e.payload };
    const thisHash = await makeHash(prev, entry);
    audit.push({ ...entry, hash: thisHash, prevHash: prev });
    prev = thisHash;
  }
  run.audit = audit;
  return run;
}

export async function applyReview(run: WorkflowRun, review: Review): Promise<WorkflowRun> {
  const next = { ...run, review };
  const prev = run.audit.length ? run.audit[run.audit.length - 1].hash : genesis();
  const entry = { seq: run.audit.length + 1, ts: review.at, actor: review.by, action: "review_recorded", payload: { verdict: review.verdict } };
  const hash = await makeHash(prev, entry);
  return { ...next, audit: [...run.audit, { ...entry, hash, prevHash: prev }] };
}

export function exportUnlocked(run: WorkflowRun): boolean {
  return run.review !== null;
}

export function summarize(run: WorkflowRun): { headline: string; bullets: string[]; verdict: Verdict } {
  const heat = run.heatScore;
  const headline = heat.withinBoundary
    ? "Compliance boundary respected"
    : "Compliance boundary VIOLATED";
  const bullets = [
    `Goal: ${run.config.goal}`,
    `Red-line: ${run.config.complianceMinimum.description}`,
    `Compliance share: ${run.observations.totals.complianceShare.toFixed(1)}% (required ≥ ${run.config.complianceMinimum.value}%)`,
    `Aggregate heat score: ${(heat.aggregate * 100).toFixed(0)}/100`,
    `Within boundary: ${heat.withinBoundary ? "yes" : "no"}`,
  ];
  const verdict: Verdict = run.review ? run.review.verdict : heat.withinBoundary ? "approved" : "blocked";
  return { headline, bullets, verdict };
}

export const CONFIG: WorkflowConfig = WORKFLOW_CONFIG;
export { isTodayISO };
