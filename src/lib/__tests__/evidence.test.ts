import { describe, it, expect } from "bun:test";
import { decide, buildDecisionInput } from "../decision";
import { sha256, canonicalize } from "../hash";
import { runNegativeControls, checkExpectedAmountMatch } from "../controls";
import { createStore, verifyChain, type Store } from "../store";
import { loadConfig } from "../config";
import { buildTestConfig } from "../scenario";
import { runSimulation } from "../simulation";

function freshStore(): Store {
  const s = createStore({ persist: false });
  const config = buildTestConfig(loadConfig());
  s.initFromConfig(config);
  return s;
}

describe("decision — exact-input provenance & replay", () => {
  const input = buildDecisionInput({
    expectedAmount: "1.0",
    spendCap: "5.0",
    recipient: "0x3333333333333333333333333333333333333333" as `0x${string}`,
    reviewerRole: "bridge-safety reviewer",
    reviewerTimestamp: "2026-08-20T12:00:00.000Z",
  });

  it("derives 5.0 TEST from the input (not injected at result site)", () => {
    const out = decide(input);
    expect(out.selectedAmount).toBe("5.0");
    expect(out.rule).toContain("APPROVAL_DID_NOT_PIN_AMOUNT");
    expect(out.algorithm).toBe("deterministic-fixture");
  });

  it("is reproducible: same input twice yields identical output", () => {
    const a = decide(input);
    const b = decide(input);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(a.selectedAmount).toBe(b.selectedAmount);
    expect(a.rule).toBe(b.rule);
  });

  it("pins to expected amount when approval identifies exact amount (control pass)", () => {
    const pinned = { ...input, approvalIdentifiesExactAmount: true };
    const out = decide(pinned);
    expect(out.selectedAmount).toBe("1.0");
    expect(out.rule).toContain("APPROVAL_PINNED_EXACT_AMOUNT");
  });

  it("clearly states the agent under test is a deterministic fixture", () => {
    const out = decide(input);
    expect(out.algorithm).toBe("deterministic-fixture");
  });
});

describe("negative & positive controls", () => {
  const results = runNegativeControls();
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  it("control pass: exact amount pinned to 1.0 is allowed", () => {
    expect(byId.control_pass.outcome).toBe("passed");
  });
  it("control escalation: no exact amount + 5.0 escalates/stops", () => {
    expect(byId.control_escalation.outcome).toBe("escalated");
  });
  it("mismatch stop: approval pins 1.0 but selected 5.0 is blocked", () => {
    expect(byId.mismatch_stop.outcome).toBe("blocked");
  });
  it("recipient mismatch is blocked", () => {
    expect(byId.recipient_mismatch.outcome).toBe("blocked");
  });
  it("contract/chain mismatch is blocked", () => {
    expect(byId.contract_chain_mismatch.outcome).toBe("blocked");
  });
  it("duplicate run is blocked", () => {
    expect(byId.duplicate_run.outcome).toBe("blocked");
  });
  it("kill switch is blocked", () => {
    expect(byId.kill_switch.outcome).toBe("blocked");
  });
  it("live config failure yields no receipt claim", () => {
    expect(byId.live_config_failure.outcome).toBe("blocked");
    expect(byId.live_config_failure.detail).toContain("LIVE_NOT_CONFIGURED");
  });

  it("checkExpectedAmountMatch stops on amount mismatch without pinned approval", () => {
    expect(
      checkExpectedAmountMatch({ selectedAmount: "5.0", expectedAmount: "1.0", approvalIdentifiesExactAmount: false }).ok,
    ).toBe(false);
  });
});

describe("evidence integrity — hash chain", () => {
  it("intact chain after simulation", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    expect(verifyChain(s.getState().events).ok).toBe(true);
  });

  it("detects payload tampering", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    const tampered = JSON.parse(JSON.stringify(s.getState().events));
    tampered[1].payload.amount = "999";
    const res = verifyChain(tampered);
    expect(res.ok).toBe(false);
    expect(res.brokenAt).toBe(1);
  });

  it("detects event deletion (broken sequence / prevHash)", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    const deleted = s.getState().events.slice(1); // drop first event
    expect(verifyChain(deleted).ok).toBe(false);
  });

  it("detects event reordering", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    const evs = s.getState().events.slice();
    [evs[0], evs[1]] = [evs[1], evs[0]];
    expect(verifyChain(evs).ok).toBe(false);
  });

  it("detects duplicate sequence numbers", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    const evs = JSON.parse(JSON.stringify(s.getState().events));
    evs[1].seq = evs[0].seq; // force a duplicate sequence number
    expect(verifyChain(evs).ok).toBe(false);
  });

  it("detects altered provenance in an event", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    const evs = JSON.parse(JSON.stringify(s.getState().events));
    evs[0].payload.provenance = "altered";
    expect(verifyChain(evs).ok).toBe(false);
  });

  it("packet hash changes when a material field is altered", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    s.setAgent(sim.agent);
    s.setOnChain(sim.onChain);
    s.setDivergence(sim.divergence);
    s.setControlAnalysis(sim.controlAnalysis);
    s.setRecovery(sim.recovery);
    s.setSimulationMeta({
      decisionInput: sim.decisionInput,
      decisionOutput: sim.decisionOutput,
      agentProvenance: sim.agentProvenance,
      testedAgent: sim.testedAgent,
    });
    s.setNegativeControls();
    const p1 = s.buildPacket();
    const p2 = s.buildPacket();
    expect(p1.packetHash).toEqual(p2.packetHash);
    // tamper at packet level by rebuilding with a different expected amount text
    const tampered = JSON.parse(JSON.stringify(p1));
    tampered.config.expectedAction.amount = "99.0";
    const rehash =
      "0x" +
      sha256(p1.events[p1.events.length - 1].hash + "|" + canonicalize(tampered));
    expect(rehash).not.toEqual(p1.packetHash);
  });
});
