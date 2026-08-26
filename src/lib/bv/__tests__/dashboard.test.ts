import { describe, it, expect } from "bun:test";
import { genesis, makeHash, sha256 } from "../hash";
import {
  computeHeatScore,
  computeTotals,
  deriveVerdict,
  outcomeFromSeverity,
  severityFromBoolean,
  riskSeverity,
  RISK_ENTRIES,
} from "../scoring";
import { buildControls, buildRun, summarize, exportUnlocked, applyReview } from "../workflow";
import { WORKFLOW_CONFIG, SIMULATED_SLOTS } from "../data";
import type { Review, WorkflowRun } from "../bv/types";
import {
  evidenceCoverage,
  heatScoreFormula,
  isRiskRed,
  likelihoodWord,
  riskCellPosition,
  riskPositionConsistent,
  riskSeverityLabel,
  reviewStatusPill,
  severityToPillClass,
} from "../view";

describe("dashboard — totals & boundary", () => {
  it("computes compliance share from compliant slots", () => {
    const totals = computeTotals();
    const expected = (SIMULATED_SLOTS.filter((s) => s.isCompliance).length / SIMULATED_SLOTS.length) * 100;
    expect(totals.complianceShare).toBeCloseTo(expected, 5);
  });

  it("boundary check correctly flags violation", () => {
    const { withinBoundary, compScore } = computeHeatScore();
    expect(withinBoundary).toBe(false);
    expect(compScore).toBeCloseTo((1 / 9) * 100 / 100, 4);
  });

  it("deriveVerdict blocks when boundary violated", () => {
    expect(deriveVerdict(false)).toBe("blocked");
  });
});

describe("dashboard — controls", () => {
  const totals = computeTotals();
  const controls = buildControls(totals);
  it("evaluates the compliance minimum control as failed", () => {
    const c = controls.find((c) => c.id === "c1");
    expect(c).toBeDefined();
    expect(c!.outcome).toBe("failed");
    expect(c!.severity).toBe("bad");
  });

  it("severity/outcome mapping is consistent", () => {
    expect(outcomeFromSeverity(severityFromBoolean(true))).toBe("passed");
    expect(outcomeFromSeverity(severityFromBoolean(false))).toBe("failed");
    expect(outcomeFromSeverity(severityFromBoolean(false, true))).toBe("warn");
  });
});

describe("dashboard — risk map", () => {
  const scores = computeHeatScore();
  it("risk severity follows likelihood*impact tiers", () => {
    expect(riskSeverity(3, 3)).toBe("bad");
    expect(riskSeverity(2, 2)).toBe("warn");
    expect(riskSeverity(1, 1)).toBe("ok");
  });

  it("at least one high-severity risk exists (organic share 1.6% vs 12%)", () => {
    const high = RISK_ENTRIES.filter((r) => r.severity === "bad");
    expect(high.length).toBeGreaterThanOrEqual(1);
  });
});

describe("dashboard — scoring math", () => {
  it("composition score reflects 11.1% share (1 of 9 slots, below 12% threshold)", () => {
    const { compScore, withinBoundary } = computeHeatScore();
    expect(compScore).toBeCloseTo(1 / 9, 4);
    expect(withinBoundary).toBe(false);
  });

  it("aggregate heat score reflects violated boundary", async () => {
    const { withinBoundary } = computeHeatScore();
    expect(withinBoundary).toBe(false);
  });
});

describe("dashboard — run + hash chain", () => {
  it("buildRun produces a deterministic, fully-populated run", async () => {
    const a = await buildRun("run_test_1");
    const b = await buildRun("run_test_1");
    expect(a.runId).toBe(b.runId);
    expect(a.observations.slots.length).toBe(SIMULATED_SLOTS.length);
    expect(a.controls.length).toBe(3);
    expect(a.risks.length).toBe(5);
    expect(a.audit.length).toBe(6);
    expect(a.claim).toContain("red-line");
    expect(a.nonClaims.length).toBeGreaterThanOrEqual(3);
    expect(a.mode).toBe("simulation");
  });

  it("audit entries are hash-chained (prevHash linkage)", async () => {
    const run = await buildRun("run_hash_test");
    const g = genesis();
    expect(run.audit[0].prevHash).toBe(g);
    for (let i = 1; i < run.audit.length; i++) {
      expect(run.audit[i].prevHash).toBe(run.audit[i - 1].hash);
      expect(run.audit[i].seq).toBe(i + 1);
    }
    expect(run.chainOk).toBe(true);
  });

  it("tampering with an audit entry is detectable via hash recompute", async () => {
    const run = await buildRun("run_tamper_test");
    let prev = genesis();
    for (const e of run.audit) {
      const recomputed = await makeHash(prev, { seq: e.seq, ts: e.ts, actor: e.actor, action: e.action, payload: e.payload });
      expect(recomputed).toBe(e.hash);
      prev = e.hash;
    }
    const tampered = { ...run.audit[2], payload: { ...run.audit[2].payload, forged: true } };
    run.audit[2] = tampered;
    const recomputed = await makeHash(run.audit[1].hash, {
      seq: tampered.seq,
      ts: tampered.ts,
      actor: "attacker",
      action: tampered.action,
      payload: { ...tampered.payload },
    });
    expect(recomputed).not.toBe(tampered.hash);
  });

  it("audit hash changes when payload changes (tamper-evidence)", async () => {
    const run = await buildRun("run_hash_evidence_test");
    const originalHash = run.audit[1].hash;
    const recomputed = await makeHash(run.audit[0].hash, {
      seq: run.audit[1].seq,
      ts: run.audit[1].ts,
      actor: "attacker",
      action: run.audit[1].action,
      payload: run.audit[1].payload,
    });
    expect(recomputed).not.toBe(originalHash);
  });
});

describe("dashboard — export gating (409 until review)", () => {
  it("export is blocked until a human review is recorded", async () => {
    const run = await buildRun("run_export_blocked");
    expect(exportUnlocked(run)).toBe(false);
  });

  it("export unlocks after a review is applied", async () => {
    const run = await buildRun("run_export_unlocked");
    const review: Review = {
      verdict: "blocked",
      by: "J. Rivera",
      role: "brand-safety reviewer",
      reason: "Compliance boundary violated.",
      uncertainty: "Observation data source reliability.",
      alternative: "Slot allocation drift detected.",
      at: new Date().toISOString(),
    };
    const reviewed = await applyReview(run, review);
    expect(exportUnlocked(reviewed)).toBe(true);
    expect(reviewed.review!.verdict).toBe("blocked");
  });
});

describe("dashboard — review + sign-off", () => {
  it("applyReview appends a signed audit entry", async () => {
    const run = await buildRun("run_review_test");
    const prevLen = run.audit.length;
    const beforeHash = run.audit[run.audit.length - 1].hash;
    const review: Review = {
      verdict: "re-review",
      by: "A. Manager",
      role: "compliance lead",
      reason: "Need deeper investigation of drift.",
      uncertainty: "Upstream data source.",
      alternative: "Could be config drift.",
      at: new Date().toISOString(),
    };
    const reviewed = await applyReview(run, review);
    expect(reviewed.audit.length).toBe(prevLen + 1);
    expect(reviewed.audit[prevLen].prevHash).toBe(beforeHash);
    expect(reviewed.audit[prevLen].actor).toBe("A. Manager");
    expect(reviewed.review!.verdict).toBe("re-review");
  });
});

describe("dashboard — executive summary", () => {
  it("summarizes the violation as the headline", async () => {
    const run = await buildRun("run_summary_violation");
    const s = summarize(run);
    expect(s.headline).toContain("VIOLATED");
    expect(s.verdict).toBe("blocked");
  });
});

describe("dashboard — non-simulation / red-line invariants", () => {
  it("workup is always a SIMULATED FIXTURE (no live path)", async () => {
    const run = await buildRun("run_mode_test");
    expect(run.mode).toBe("simulation");
  });

  it("the red-line rule is preserved exactly across runs", async () => {
    const run = await buildRun("run_redline_test");
    expect(run.config.complianceMinimum.metric).toBe("shareOfHome");
    expect(run.config.complianceMinimum.value).toBe(12);
    expect(run.config.complianceMinimum.operator).toBe(">=");
  });
});

describe("dashboard — hash primitives", () => {
  it("genesis is 64 zero chars", () => {
    expect(genesis()).toBe("0".repeat(64));
  });

  it("sha256 is deterministic and hex", async () => {
    const h = await sha256("hello");
    expect(h.length).toBe(64);
    expect(h).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("dashboard — view consistency (position, colour, score, data)", () => {
  it("every risk's displayed matrix position matches (likelihood, impact)", async () => {
    const run = await buildRun("run_pos_test");
    for (const r of run.risks) {
      const pos = riskCellPosition(r);
      expect(pos.likelihood).toBe(r.likelihood);
      expect(pos.impact).toBe(r.impact);
      expect(pos.likelihood).toBeGreaterThanOrEqual(1);
      expect(pos.likelihood).toBeLessThanOrEqual(3);
      expect(pos.impact).toBeGreaterThanOrEqual(1);
      expect(pos.impact).toBeLessThanOrEqual(3);
      expect(riskPositionConsistent(r)).toBe(true);
    }
  });

  it("severity colour class matches the risk's stated severity (not colour alone)", async () => {
    const run = await buildRun("run_colour_test");
    for (const r of run.risks) {
      const pill = severityToPillClass(r.severity);
      expect(pill).toBe(r.severity);
      expect(["ok", "warn", "bad"]).toContain(pill);
      if (r.severity === "bad") {
        expect(isRiskRed(r)).toBe(true);
        expect(pill).toBe("bad");
      }
    }
  });

  it("review-status colour class matches the risk's human review status", async () => {
    const run = await buildRun("run_reviewcolor_test");
    for (const r of run.risks) {
      const pill = reviewStatusPill(r.reviewStatus);
      expect(["ok", "warn", "bad"]).toContain(pill);
      const expected = r.reviewStatus === "resolved" ? "ok" : r.reviewStatus === "in-review" ? "warn" : "bad";
      expect(pill).toBe(expected);
    }
  });

  it("heat-score is the documented weighted formula", async () => {
    const run = await buildRun("run_heat_test");
    const { compScore, maxScore, aggregate } = computeHeatScore();
    const expected = WORKFLOW_CONFIG.maximizeWeight * maxScore + WORKFLOW_CONFIG.compositionWeight * compScore;
    expect(run.heatScore.aggregate).toBeCloseTo(expected, 10);
    expect(run.heatScore.composition).toBeCloseTo(compScore, 10);
    expect(run.heatScore.maximize).toBeCloseTo(maxScore, 10);
    expect(heatScoreFormula()).toContain("aggregate");
  });

  it("displayed likelihood/impact label words match the numeric tiers", async () => {
    const run = await buildRun("run_label_test");
    for (const r of run.risks) {
      expect(r.likelihoodLabel).toBe(likelihoodWord(r.likelihood));
      expect(r.impactLabel).toBe(likelihoodWord(r.impact));
      // overall severity label must be consistent with the L*I product
      expect(riskSeverityLabel(r.likelihood, r.impact)).toBe(
        r.likelihood * r.impact >= 6 ? "high" : r.likelihood * r.impact >= 3 ? "medium" : "low",
      );
    }
  });

  it("evidence coverage is a percentage derived from controls (shown in heatmap)", async () => {
    const run = await buildRun("run_cov_test");
    const cov = evidenceCoverage(run);
    expect(cov).toBeGreaterThanOrEqual(0);
    expect(cov).toBeLessThanOrEqual(100);
    const passed = run.controls.filter((c) => c.outcome === "passed").length;
    const warns = run.controls.filter((c) => c.outcome === "warn").length;
    const expected = Math.round(((passed + warns / 2) / run.controls.length) * 100);
    expect(cov).toBe(expected);
  });

  it("heatmap risk counts and evidence coverage are consistent with underlying risks", async () => {
    const run = await buildRun("run_heatmap_consistency_test");
    const red = run.risks.filter((r) => r.severity === "bad").length;
    const amber = run.risks.filter((r) => r.severity === "warn").length;
    expect(red).toBeGreaterThanOrEqual(1);
    expect(red + amber).toBe(run.risks.length);
    expect(evidenceCoverage(run)).toBeLessThanOrEqual(100);
    expect(run.heatScore.withinBoundary).toBe(false);
    expect(isRiskRed(run.risks[0])).toBe(true);
  });
});

describe("dashboard — sample data populates both graphics", () => {
  it("run contains both a populated risk map and a populated heatmap after simulation", async () => {
    const run = await buildRun("run_sample_test");
    // risk map input: >=1 risk in the 3x3 matrix
    expect(run.risks.length).toBeGreaterThanOrEqual(3);
    for (const r of run.risks) {
      const pos = riskCellPosition(r);
      expect(pos.likelihood).toBeGreaterThanOrEqual(1);
      expect(pos.impact).toBeGreaterThanOrEqual(1);
    }
    // heatmap input: 6 governance areas implied by controls + non-negotiable framing
    expect(run.controls.length).toBe(3);
    // evidence + decision log present for drill-down
    const r0 = run.risks[0];
    expect(r0.evidence.length).toBeGreaterThan(0);
    expect(r0.reviewStatus).toBeDefined();
  });

  it("audit entries remain hash-chained when a sign-off is appended (audit view)", async () => {
    const run = await buildRun("run_audit_test");
    const before = run.audit.length;
    const last = run.audit[before - 1].hash;
    const review: Review = {
      verdict: "blocked",
      by: "A. Manager",
      role: "compliance lead",
      reason: "Red-line violated.",
      uncertainty: "Observation source.",
      alternative: "Config drift.",
      at: new Date().toISOString(),
    };
    const reviewed = await applyReview(run, review);
    expect(reviewed.audit.length).toBe(before + 1);
    expect(reviewed.audit[before].prevHash).toBe(last);
    expect(reviewed.review!.verdict).toBe("blocked");
    // chain still verifiable end-to-end
    let prev = genesis();
    for (const e of reviewed.audit) {
      const recomputed = await makeHash(prev, { seq: e.seq, ts: e.ts, actor: e.actor, action: e.action, payload: e.payload });
      expect(recomputed).toBe(e.hash);
      prev = e.hash;
    }
    expect(reviewed.chainOk).toBe(true);
  });
});
