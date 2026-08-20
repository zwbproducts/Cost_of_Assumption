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
  evidenceBefore: EvidenceItem[];
  successCriterion: string;
  assumptionUnderTest: string;
  mode: Mode;
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
  status: "success" | "reverted" | "pending" | "failed" | "none";
  gasCost: string;
  tokenAmount: string;
  recipient: Address;
  explorerUrl?: string;
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
  at: string;
}

export interface ControlAnalysis {
  wouldStop: string[];
  wouldEscalate: string[];
  wouldAllow: string[];
}

export interface EvidencePacket {
  schemaVersion: string;
  config: TestConfig;
  events: ObservableEvent[];
  agent: AgentOutput;
  onChain: OnChainResult;
  divergence: Divergence[];
  controlAnalysis: ControlAnalysis;
  recovery: "reversed" | "unrecoverable_within_test" | "not_applicable";
  classification: Classification | null;
  nonClaims: string[];
  generatedAt: string;
  packetHash: Hex;
}
