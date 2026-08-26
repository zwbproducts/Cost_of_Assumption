import type { RiskEntry, Severity, WorkflowRun } from "./types";

export interface MatrixCell {
  likelihood: number;
  impact: number;
}

export function riskCellPosition(risk: RiskEntry): MatrixCell {
  return { likelihood: risk.likelihood, impact: risk.impact };
}

export function severityToPillClass(sev: Severity): string {
  if (sev === "ok") return "ok";
  if (sev === "warn") return "warn";
  return "bad";
}

export function reviewStatusPill(status: RiskEntry["reviewStatus"]): Severity {
  if (status === "resolved") return "ok";
  if (status === "in-review") return "warn";
  return "bad";
}

export function likelihoodWord(n: number): "low" | "medium" | "high" {
  if (n <= 1) return "low";
  if (n <= 2) return "medium";
  return "high";
}

export function riskSeverityLabel(likelihood: number, impact: number): "low" | "medium" | "high" {
  const score = likelihood * impact;
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function riskPositionConsistent(risk: RiskEntry): boolean {
  return (
    risk.likelihood >= 1 &&
    risk.likelihood <= 3 &&
    risk.impact >= 1 &&
    risk.impact <= 3 &&
    risk.likelihoodLabel === likelihoodWord(risk.likelihood) &&
    risk.impactLabel === likelihoodWord(risk.impact)
  );
}

export function evidenceCoverage(run: WorkflowRun): number {
  const total = run.controls.length || 1;
  const passed = run.controls.filter((c) => c.outcome === "passed").length;
  const warns = run.controls.filter((c) => c.outcome === "warn").length;
  return Math.round(((passed + warns / 2) / total) * 100);
}

export function heatScoreFormula(): string {
  return "aggregate = 0.6·normalize(totalAdd/MaxAdd) + 0.4·normalize(complianceShare/100)";
}

export function isRiskRed(risk: RiskEntry): boolean {
  return risk.severity === "bad";
}
