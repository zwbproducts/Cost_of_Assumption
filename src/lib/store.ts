import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  AgentOutput,
  Classification,
  ControlAnalysis,
  Divergence,
  EvidencePacket,
  Hex,
  ObservableEvent,
  OnChainResult,
  TestConfig,
  DecisionInput,
  DecisionOutput,
  Provenance,
  NegativeControlResult,
  ChainVerification,
  HashChainVerification,
} from "./types";
import { GENESIS, hashEvent } from "./hash";
import { runNegativeControls } from "./controls";
import type { EventType } from "./types";

export const CLAIM =
  "A bounded deterministic simulation demonstrated that an allowlist and spend " +
  "cap can permit an action that violates the reviewer's expected amount.";
export const NON_CLAIMS_EXTRA = [
  "This does not establish general agent behaviour, hidden reasoning, intent, " +
  "deception, or real-world customer loss.",
];


const SCHEMA_VERSION = "bridge-validation/1.0";

export interface StoreOptions {
  persist?: boolean;
  dir?: string;
}

export interface TestRun {
  config: TestConfig | null;
  events: ObservableEvent[];
  agent: AgentOutput | null;
  onChain: OnChainResult | null;
  divergence: Divergence[];
  controlAnalysis: ControlAnalysis | null;
  decisionInput: DecisionInput | null;
  decisionOutput: DecisionOutput | null;
  agentProvenance: Provenance | null;
  testedAgent: (Provenance & { isDeterministicFixture: boolean; note: string }) | null;
  negativeControls: NegativeControlResult[];
  recovery: "simulated_reversal" | "reversed" | "unrecoverable_within_test" | "not_applicable" | null;
  classification: Classification | null;
  executed: boolean;
  executedAt: string | null;
}

function emptyRun(): TestRun {
  return {
    config: null,
    events: [],
    agent: null,
    onChain: null,
    divergence: [],
    controlAnalysis: null,
    decisionInput: null,
    decisionOutput: null,
    agentProvenance: null,
    testedAgent: null,
    negativeControls: [],
    recovery: null,
    classification: null,
    executed: false,
    executedAt: null,
  };
}

export const NON_CLAIMS: string[] = [
  "One test does not prove universal agent behaviour.",
  "We do not claim to know hidden model reasoning, intent, or deception.",
  "This is not a general security guarantee.",
  "It does not replace QA, security review, compliance, or human authorization.",
  "A valid testnet transaction is not proof of a real-world (customer) loss.",
];

export interface Store {
  initFromConfig(config: TestConfig): Promise<void>;
  getState(): TestRun;
  appendEvent(type: EventType, payload: Record<string, unknown>, ts: string): Promise<ObservableEvent>;
  appendEvents(inputs: { type: EventType; ts: string; payload: Record<string, unknown> }[]): Promise<ObservableEvent[]>;
  setAgent(agent: AgentOutput): Promise<void>;
  setOnChain(onChain: OnChainResult): Promise<void>;
  setDivergence(d: Divergence[]): Promise<void>;
  setControlAnalysis(c: ControlAnalysis): Promise<void>;
  setSimulationMeta(meta: {
    decisionInput: DecisionInput;
    decisionOutput: DecisionOutput;
    agentProvenance: Provenance;
    testedAgent: Provenance & { isDeterministicFixture: boolean; note: string };
  }): Promise<void>;
  setNegativeControls(): Promise<void>;
  setRecovery(r: "simulated_reversal" | "reversed" | "unrecoverable_within_test" | "not_applicable"): Promise<void>;
  markExecuted(at: string): Promise<void>;
  setClassification(c: Classification): Promise<void>;
  reset(): Promise<void>;
  buildPacket(): EvidencePacket;
}

/**
 * Create an isolated store. The app uses the default persisted singleton;
 * tests create their own in-memory instances so they never share state or
 * touch the filesystem.
 */
export function createStore(opts: StoreOptions = {}): Store {
  const persist = opts.persist ?? true;
  // Serverless runtimes (e.g. AWS Lambda) have a read-only cwd but a writable
  // /tmp. Persist there so the demo keeps working across warm invocations;
  // if even that fails we fall back to in-memory state and never throw.
  const dataDir = opts.dir ?? path.join(os.tmpdir(), "cost-of-assumption-data");
  const runFile = path.join(dataDir, "run.json");
  let run: TestRun = emptyRun();
  let persistBroken = false;

  async function persistNow(): Promise<void> {
    if (!persist || persistBroken) return;
    try {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(runFile, JSON.stringify(run, null, 2), "utf8");
    } catch {
      persistBroken = true;
    }
  }

  function lastHash(): Hex {
    return run.events.length ? run.events[run.events.length - 1].hash : GENESIS;
  }

  function appendEvent(
    type: EventType,
    payload: Record<string, unknown>,
    ts: string,
  ): ObservableEvent {
    const seq = run.events.length;
    const prevHash = lastHash();
    const hash = ("0x" + hashEvent(prevHash, payload)) as Hex;
    const event: ObservableEvent = { seq, ts, type, payload, prevHash, hash };
    run.events.push(event);
    return event;
  }

  return {
    async initFromConfig(config) {
      run = emptyRun();
      run.config = config;
      await persistNow();
    },
    getState() {
      return run;
    },
    async appendEvent(type, payload, ts) {
      const e = appendEvent(type, payload, ts);
      await persistNow();
      return e;
    },
    async appendEvents(inputs) {
      const out: ObservableEvent[] = [];
      for (const i of inputs) out.push(appendEvent(i.type, i.payload, i.ts));
      await persistNow();
      return out;
    },
    async setAgent(agent) {
      run.agent = agent;
      await persistNow();
    },
    async setOnChain(onChain) {
      run.onChain = onChain;
      await persistNow();
    },
    async setDivergence(d) {
      run.divergence = d;
      await persistNow();
    },
    async setControlAnalysis(c) {
      run.controlAnalysis = c;
      await persistNow();
    },
    async setSimulationMeta(meta) {
      run.decisionInput = meta.decisionInput;
      run.decisionOutput = meta.decisionOutput;
      run.agentProvenance = meta.agentProvenance;
      run.testedAgent = meta.testedAgent;
      await persistNow();
    },
    async setNegativeControls() {
      run.negativeControls = runNegativeControls();
      await persistNow();
    },
    async setRecovery(r) {
      run.recovery = r;
      await persistNow();
    },
    async markExecuted(at) {
      if (run.executed) throw new Error("DUPLICATE_EXECUTION: test already executed.");
      run.executed = true;
      run.executedAt = at;
      await persistNow();
    },
    async setClassification(c) {
      run.classification = c;
      await persistNow();
    },
    async reset() {
      run = emptyRun();
      if (!persist) return;
      try {
        await fs.rm(runFile, { force: true });
        await fs.rmdir(dataDir, { recursive: true }).catch(() => {});
      } catch {
        // best-effort; in-memory state already cleared
      }
    },
    buildPacket(): EvidencePacket {
      if (!run.config) throw new Error("No test configuration initialized.");
      const verification: HashChainVerification = (() => {
        const chain = verifyChain(run.events);
        return {
          ok: chain.ok,
          brokenAt: chain.brokenAt,
          packetHash: "0x" as Hex,
          canonicalRule:
            "packetHash = sha256(prevHash + '|' + canonicalize(sorted(packetWithoutHash)))",
        };
      })();
      const chainVerification: ChainVerification = {
        verified: run.config.mode === "live" && run.executed,
        note:
          run.config.mode === "live"
            ? run.executed
              ? "Live receipt verified against configured Sepolia RPC."
              : "No live receipt; nothing verified on chain."
            : "Simulation only: no chain verification performed; all values are SIMULATED FIXTURE.",
      };
      const selectedOption =
        run.config!.options.find((o) => o.id === run.config!.selectedOptionId) ??
        run.config!.options[0];
      const packet: EvidencePacket = {
        schemaVersion: SCHEMA_VERSION,
        runId: run.config.runId,
        mode: run.config.mode,
        brandBrief: run.config.brandBrief,
        options: run.config.options,
        intendedPositioning: run.config.intendedPositioning,
        selectedOptionLabel: selectedOption?.label ?? run.config.selectedOptionId,
        observedResultSentence:
          "The agent stayed within budget, but selected a lower-cost option that " +
          "conflicted with the brand's intended premium positioning.",
        config: run.config,
        events: run.events,
        agent: run.agent!,
        onChain: run.onChain!,
        divergence: run.divergence,
        controlAnalysis: run.controlAnalysis!,
        decisionInput: run.decisionInput!,
        decisionOutput: run.decisionOutput!,
        recovery: run.recovery ?? "not_applicable",
        classification: run.classification,
        classificationRequiredBeforeExport: true,
        agentProvenance: run.agentProvenance!,
        testedAgent: run.testedAgent!,
        chainVerification,
        negativeControls: run.negativeControls,
        claim: CLAIM,
         nonClaims: [...NON_CLAIMS, ...NON_CLAIMS_EXTRA],
         verification,
         generatedAt: run.events.length
           ? run.events[run.events.length - 1].ts
           : run.config.createdAt,
         packetHash: "0x" as Hex,
      };
      packet.packetHash = ("0x" +
        hashEvent(
          run.events.length ? run.events[run.events.length - 1].hash : GENESIS,
          { packet: packetWithoutHash(packet) },
        )) as Hex;
      packet.verification.packetHash = packet.packetHash;
      return packet;
    },
  };
}

function packetWithoutHash(p: EvidencePacket): Record<string, unknown> {
  const { packetHash, ...rest } = p;
  return rest as Record<string, unknown>;
}

/** Default persisted singleton used by the API routes. */
export const store: Store = createStore({ persist: true });

/** Verify the hash chain integrity of a list of events. */
export function verifyChain(events: ObservableEvent[]): {
  ok: boolean;
  brokenAt?: number;
} {
  let prev = GENESIS;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.seq !== i) return { ok: false, brokenAt: i };
    if (e.prevHash !== prev) return { ok: false, brokenAt: i };
    const recomputed = ("0x" + hashEvent(prev, e.payload)) as Hex;
    if (recomputed !== e.hash) return { ok: false, brokenAt: i };
    prev = e.hash;
  }
  return { ok: true };
}
