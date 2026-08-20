export type ChainId = number;
export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type TestId = string;

export type Mode = "simulation" | "live";

export type ApprovalState = "absent" | "present" | "bypassed";

export interface AuthorityLimits {
  maxSpend: string; // human-readable token amount as string (decimal)
  allowedChainId: ChainId;
  allowedContracts: Address[];
  allowedRecipients: Address[];
}

export interface AuthorityBoundary {
  declared: string;
  limits: AuthorityLimits;
}

export interface ExpectedAction {
  summary: string;
  amount: string;
  recipient: Address;
}

export interface ApprovalPoint {
  required: boolean;
  bypassable: boolean;
}

export interface EvidenceItem {
  id: string;
  kind: string;
  content: string;
  provenance: string;
  uncertainty: string;
}

export interface TestConfig {
  runId: string;
  testId: TestId;
  createdAt: string;
  network: { name: string; chainId: ChainId; explorerBase: string };
  wallet: { label: string; address: Address };
  contract: { label: string; address: Address; method: string };
  recipient: Address;
  fixedParams: Record<string, unknown>;
  authority: AuthorityBoundary;
  expectedAction: ExpectedAction;
  approvalPoint: ApprovalPoint;
  approvalRecord: ApprovalRecord;
  evidenceBefore: EvidenceItem[];
  successCriterion: string;
  assumptionUnderTest: string;
  mode: Mode;
}

/**
 * Separates the distinct approval facts the spec requires. The original
 * scenario shows approval IS present, but it is NOT transaction-specific.
 */
export interface ApprovalRecord {
  exists: boolean;
  nonBypassable: boolean;
  identifiesRecipient: boolean;
  identifiesExactAmount: boolean;
  coversExactTransaction: boolean;
  text: string;
  reviewerRole: string;
  reviewerTimestamp: string;
}

export type EventType =
  | "agent_request"
  | "agent_response"
  | "tool_call"
  | "policy_check"
  | "approval"
  | "tx_prepare"
  | "tx_submit"
  | "tx_receipt"
  | "error";

export interface ObservableEvent {
  seq: number;
  ts: string;
  type: EventType;
  payload: Record<string, unknown>;
  prevHash: Hex;
  hash: Hex;
}

export interface AgentOutput {
  recommendation: string;
  selectedAction: {
    method: string;
    amount: string;
    recipient: Address;
    gasEstimate: string;
  };
  reasoningObserved: string;
}

export interface OnChainResult {
  txHash?: Hex;
  /** Simulation only: a deterministic fixture id, never a real chain hash. */
  simulatedTxId?: Hex;
  status: "success" | "reverted" | "pending" | "failed" | "none";
  gasCost: string;
  tokenAmount: string;
  recipient: Address;
  explorerUrl?: string;
  /** True when every value above is a simulated fixture, not an observed fact. */
  synthetic?: boolean;
}

export interface Divergence {
  field: string;
  expected: string;
  observed: string;
  note: "valid_tx_but_unsafe_decision" | "match" | "other";
}

export type ClassificationResult =
  | "supported"
  | "contradicted"
  | "unresolved"
  | "unsuitable";

export interface Classification {
  result: ClassificationResult;
  reason: string;
  uncertainty: string;
  alternative: string;
  nextControl: string;
  by: string;
  reviewerRole: string;
  at: string;
}

export interface Provenance {
  provider: string;
  model: string;
  role: string;
  source: string;
}

export type DataKind =
  | "observed_fact"
  | "deterministic_fixture"
  | "operator_configuration"
  | "quoted_agent_output"
  | "inference"
  | "unverified_claim";

/**
 * Explicit input packet for the decision function. Storing this is what makes
 * the "unsafe" outcome reproducible and proves it was not injected by a result
 * site — the selected amount is derived from these inputs, not asserted.
 */
export interface DecisionInput {
  request: string;
  approvalText: string;
  approvalIdentifiesExactAmount: boolean;
  approvalIdentifiesRecipient: boolean;
  approvalCoversExactTransaction: boolean;
  reviewerRole: string;
  reviewerTimestamp: string;
  expectedAmount: string;
  expectedAmountProvenance: string;
  spendCap: string;
  spendCapProvenance: string;
  agentInput: { prompt: string; context: string };
  algorithm: "deterministic-fixture";
  replaySeed: string;
}

export interface DecisionOutput {
  selectedAmount: string;
  selectedRecipient: Address;
  rule: string;
  algorithm: "deterministic-fixture";
  replaySeed: string;
}

export interface ChainVerification {
  verified: boolean;
  chainId?: ChainId;
  receiptStatus?: string;
  blockNumber?: number;
  signer?: Address;
  nonce?: number;
  gasUsed?: string;
  method?: string;
  note: string;
}

export interface ControlAnalysis {
  wouldStop: string[];
  wouldEscalate: string[];
  wouldAllow: string[];
}

export interface EvidencePacket {
  schemaVersion: string;
  runId: string;
  mode: Mode;
  config: TestConfig;
  events: ObservableEvent[];
  agent: AgentOutput;
  onChain: OnChainResult;
  divergence: Divergence[];
  controlAnalysis: ControlAnalysis;
  decisionInput: DecisionInput;
  decisionOutput: DecisionOutput;
  recovery: "simulated_reversal" | "reversed" | "unrecoverable_within_test" | "not_applicable";
  classification: Classification | null;
  classificationRequiredBeforeExport: true;
  agentProvenance: Provenance;
  testedAgent: Provenance & {
    isDeterministicFixture: boolean;
    note: string;
  };
  chainVerification: ChainVerification;
  negativeControls: NegativeControlResult[];
  claim: string;
  nonClaims: string[];
  verification: HashChainVerification;
  generatedAt: string;
  packetHash: Hex;
}

export interface NegativeControlResult {
  id: string;
  name: string;
  expectation: string;
  outcome: "passed" | "blocked" | "escalated" | "failed";
  detail: string;
}

export interface HashChainVerification {
  ok: boolean;
  brokenAt?: number;
  packetHash: Hex;
  canonicalRule: string;
}
