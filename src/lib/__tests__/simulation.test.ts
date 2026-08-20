import { describe, it, expect } from "bun:test";
import { loadConfig } from "../config";
import { buildTestConfig, SIM_FIXTURES } from "../scenario";
import { runSimulation } from "../simulation";
import { createStore, verifyChain, type Store } from "../store";
import { executeLive } from "../live";
import { RpcFailureError, NotConfiguredProvider, type ChainProvider, type SubmitResult } from "../provider";
import type { Address } from "../types";

function freshStore(): Store {
  const s = createStore({ persist: false });
  const config = buildTestConfig(loadConfig());
  s.initFromConfig(config);
  return s;
}

describe("simulation — determinism & safety", () => {
  it("is deterministic across runs", () => {
    const cfg = loadConfig();
    const a = runSimulation(buildTestConfig(cfg));
    const b = runSimulation(buildTestConfig(cfg));
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("selected action is within cap (valid) but exceeds expected amount (unsafe)", () => {
    const cfg = loadConfig();
    const sim = runSimulation(buildTestConfig(cfg));
    expect(Number(sim.agent.selectedAction.amount)).toBeLessThanOrEqual(
      Number(cfg.limits.maxSpend),
    );
    expect(sim.agent.selectedAction.amount).not.toEqual(
      buildTestConfig(cfg).expectedAction.amount,
    );
    expect(sim.divergence.find((d) => d.field === "recipient")?.note).toBe("match");
    expect(
      sim.divergence.find((d) => d.field === "tokenAmount")?.note,
    ).toBe("valid_tx_but_unsafe_decision");
  });

  it("contains no private key or secret material", () => {
    const cfg = loadConfig();
    const sim = runSimulation(buildTestConfig(cfg));
    const serialized = JSON.stringify(sim).toLowerCase();
    expect(serialized).not.toContain("privatekey");
    expect(serialized).not.toContain("mnemonic");
    expect(serialized).not.toContain("seedphrase");
    expect(serialized).not.toContain("testnet_private_key");
  });
});

describe("store — hash chaining", () => {
  it("produces an intact chain after simulation", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    expect(verifyChain(s.getState().events).ok).toBe(true);
  });

  it("detects tampering", () => {
    const s = freshStore();
    const sim = runSimulation(s.getState().config!);
    s.appendEvents(sim.events);
    const tampered = JSON.parse(JSON.stringify(s.getState().events));
    tampered[1].payload.amount = "999";
    expect(verifyChain(tampered).ok).toBe(false);
  });
});

describe("live execution — guards, duplicate, rpc failure", () => {
  function successProvider(): ChainProvider {
    return {
      async submitTx(): Promise<SubmitResult> {
        return {
          txHash: "0xfeed0001" as `0x${string}`,
          status: "success",
          gasCost: "0.000130 ETH (testnet gas)",
        };
      },
    };
  }

  it("executes only the allowlisted plan after explicit approval", async () => {
    const s = freshStore();
    const out = await executeLive(successProvider(), { approval: "present" }, s);
    expect(out.ok).toBe(true);
    expect(out.txHash).toBe("0xfeed0001");
    expect(s.getState().executed).toBe(true);
  });

  it("rejects duplicate execution", async () => {
    const s = freshStore();
    await executeLive(successProvider(), { approval: "present" }, s);
    const out2 = await executeLive(successProvider(), { approval: "present" }, s);
    expect(out2.ok).toBe(false);
    expect(String(out2.error)).toContain("DUPLICATE_EXECUTION");
  });

  it("rejects when approval is absent", async () => {
    const s = freshStore();
    const out = await executeLive(successProvider(), { approval: "absent" }, s);
    expect(out.ok).toBe(false);
    expect(out.violations?.join()).toContain("Approval");
  });

  it("captures RPC failure without marking executed", async () => {
    const s = freshStore();
    const failing: ChainProvider = {
      async submitTx(): Promise<SubmitResult> {
        throw new RpcFailureError("simulated RPC timeout");
      },
    };
    const out = await executeLive(failing, { approval: "present" }, s);
    expect(out.ok).toBe(false);
    expect(String(out.error)).toContain("RPC");
    expect(s.getState().executed).toBe(false);
  });

  it("reports when no signing backend is configured", async () => {
    const s = freshStore();
    const out = await executeLive(new NotConfiguredProvider(), { approval: "present" }, s);
    expect(out.ok).toBe(false);
  });
});

describe("evidence packet", () => {
  it("assembles a complete packet with non-claims", () => {
    const s = freshStore();
    const config = s.getState().config!;
    const sim = runSimulation(config);
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
    const packet = s.buildPacket();
    expect(packet.schemaVersion).toContain("bridge-validation");
    expect(packet.nonClaims.length).toBeGreaterThan(0);
    expect(packet.config.testId).toBe(SIM_FIXTURES.testId);
    expect(packet.packetHash.startsWith("0x")).toBe(true);
    expect(packet.decisionOutput.selectedAmount).toBe(SIM_FIXTURES.selectedAmount);
    expect(packet.classificationRequiredBeforeExport).toBe(true);
    expect(packet.negativeControls.length).toBeGreaterThan(0);
  });
});
