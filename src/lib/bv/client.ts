import type { ClassificationRequest, DashboardState, Review, Verdict, WorkflowRun } from "@/lib/bv/types";
import { applyReview, buildRun, exportUnlocked, summarize } from "@/lib/bv/workflow";
import { genesis } from "@/lib/bv/hash";

const STORE_KEY = "bv-dashboard-state";

export async function simulate(): Promise<WorkflowRun> {
  const runId = `run_${Date.now()}`;
  return buildRun(runId);
}

export async function classify(run: WorkflowRun, req: ClassificationRequest): Promise<WorkflowRun> {
  if (!run) throw new Error("No run to classify");
  const review: Review = {
    verdict: req.verdict,
    by: req.by,
    role: req.role,
    reason: req.reason,
    uncertainty: req.uncertainty,
    alternative: req.alternative,
    at: new Date().toISOString(),
  };
  return applyReview(run, review);
}

export function canExport(run: WorkflowRun | null): boolean {
  return run !== null && exportUnlocked(run);
}

export function resetState(): DashboardState {
  return { currentRun: null, history: [] };
}

export function loadState(): DashboardState {
  if (typeof window === "undefined") return resetState();
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return resetState();
  try {
    const parsed = JSON.parse(raw) as DashboardState;
    return parsed;
  } catch {
    return resetState();
  }
}

export function saveState(state: DashboardState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export async function newRun(): Promise<{ state: DashboardState; run: WorkflowRun }> {
  const run = await simulate();
  const state: DashboardState = { currentRun: run, history: [run] };
  saveState(state);
  return { state, run };
}

export async function saveReview(currentRun: WorkflowRun, req: ClassificationRequest): Promise<WorkflowRun> {
  if (!currentRun) throw new Error("No current run");
  const run = await classify(currentRun, req);
  const existing = loadState();
  const history = existing.history.filter((r: WorkflowRun) => r.runId !== run.runId);
  saveState({ currentRun: run, history: [run, ...history] });
  return run;
}

export { summarize, genesis };
export type { Verdict };
