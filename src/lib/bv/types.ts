export type Severity = "ok" | "warn" | "bad";

export interface WorkflowConfig {
  id: string;
  name: string;
  goal: string;
  complianceMinimum: {
    metric: string;
    operator: ">=" | "<=";
    value: number;
    description: string;
  };
  maximizeWeight: number;
  compositionWeight: number;
  slots: number;
  redLineOwner: string;
  redLineSetAt: string;
}

export interface SlotObservation {
  slot: number;
  category: string;
  expectedAdd: number;
  actualAdd: number;
  shareOfHome: number;
  isCompliance: boolean;
  withinBoundary: boolean;
  delta: number;
}

export interface ObservationSet {
  runId: string;
  workflowId: string;
  generatedAt: string;
  slots: SlotObservation[];
  totals: {
    totalAdd: number;
    complianceShare: number;
    maximizeMetric: number;
  };
}

export type ControlOutcome = "passed" | "warn" | "failed";
export interface ControlResult {
  id: string;
  name: string;
  expectation: string;
  outcome: ControlOutcome;
  detail: string;
  severity: Severity;
}

export interface RiskEntry {
  id: string;
  threat: string;
  likelihood: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  likelihoodLabel: "low" | "medium" | "high";
  impactLabel: "low" | "medium" | "high";
  rationale: string;
  severity: Severity;
  evidence: string[];
  decisionLog: string[];
  reviewStatus: "unreviewed" | "in-review" | "resolved";
}

export type Verdict = "approved" | "blocked" | "re-review";
export interface Review {
  verdict: Verdict;
  by: string;
  role: string;
  reason: string;
  uncertainty: string;
  alternative: string;
  at: string;
}

export interface AuditEntry {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  hash: string;
  prevHash: string;
}

export interface WorkflowRun {
  runId: string;
  config: WorkflowConfig;
  observations: ObservationSet;
  controls: ControlResult[];
  risks: RiskEntry[];
  heatScore: {
    composition: number;
    maximize: number;
    aggregate: number;
    withinBoundary: boolean;
  };
  review: Review | null;
  audit: AuditEntry[];
  chainOk: boolean;
  claim: string;
  nonClaims: string[];
  mode: "simulation";
  createdAt: string;
}

export interface DashboardState {
  currentRun: WorkflowRun | null;
  history: WorkflowRun[];
}

export interface ClassificationRequest {
  verdict: Verdict;
  by: string;
  role: string;
  reason: string;
  uncertainty: string;
  alternative: string;
}
