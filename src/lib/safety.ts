import type {
  Address,
  AuthorityLimits,
  ChainId,
  ApprovalState,
} from "./types";

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

export function normalizeAddress(a: string): Address {
  const s = a.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(s)) {
    throw new Error(`Invalid address: ${a}`);
  }
  return s as Address;
}

/** Parse a decimal token amount into base units (18 decimals) for comparison. */
export function toBaseUnits(amount: string, decimals = 18): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const [intPart, fracPart = ""] = trimmed.split(".");
  const fracPadded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(intPart + fracPadded);
}

export function checkChain(
  chainId: ChainId,
  allowed: ChainId,
): GuardResult {
  if (chainId !== allowed) {
    return {
      ok: false,
      reason: `Chain ${chainId} is not allowlisted (allowed: ${allowed}).`,
    };
  }
  return { ok: true };
}

export function checkContract(
  address: Address,
  allowed: Address[],
): GuardResult {
  const set = allowed.map((a) => a.toLowerCase());
  if (!set.includes(address.toLowerCase())) {
    return {
      ok: false,
      reason: `Contract ${address} is not allowlisted.`,
    };
  }
  return { ok: true };
}

export function checkRecipient(
  address: Address,
  allowed: Address[],
): GuardResult {
  const set = allowed.map((a) => a.toLowerCase());
  if (!set.includes(address.toLowerCase())) {
    return {
      ok: false,
      reason: `Recipient ${address} is not allowlisted.`,
    };
  }
  return { ok: true };
}

export function checkSpendCap(
  amount: string,
  maxSpend: string,
): GuardResult {
  try {
    const a = toBaseUnits(amount);
    const m = toBaseUnits(maxSpend);
    if (a > m) {
      return {
        ok: false,
        reason: `Amount ${amount} exceeds MAX_TESTNET_SPEND ${maxSpend}.`,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export function checkApproval(
  state: ApprovalState,
  required: boolean,
  bypassable: boolean,
): GuardResult {
  if (!required) return { ok: true };
  if (state === "present") return { ok: true };
  if (state === "bypassed") {
    return {
      ok: false,
      reason: `Approval was bypassed; execution requires explicit human approval.`,
    };
  }
  return {
    ok: false,
    reason: `Approval is absent; execution requires explicit human approval.`,
  };
}

export function checkKillSwitch(enabled: boolean): GuardResult {
  if (enabled) {
    return { ok: false, reason: `KILL_SWITCH is enabled; live execution halted.` };
  }
  return { ok: true };
}

export interface ExecutionPlan {
  chainId: ChainId;
  contract: Address;
  recipient: Address;
  amount: string;
  approval: ApprovalState;
}

export interface ValidationContext {
  limits: AuthorityLimits;
  approvalRequired: boolean;
  bypassable: boolean;
  killSwitch: boolean;
}

export interface ValidationOutcome {
  violations: string[];
  passed: boolean;
}

/**
 * Run every guard against an execution plan. Used by both the live executor
 * and the test suite. Never throws; returns a list of human-readable reasons.
 */
export function validateExecutionPlan(
  plan: ExecutionPlan,
  ctx: ValidationContext,
): ValidationOutcome {
  const violations: string[] = [];

  const kill = checkKillSwitch(ctx.killSwitch);
  if (!kill.ok) violations.push(kill.reason!);

  const chain = checkChain(plan.chainId, ctx.limits.allowedChainId);
  if (!chain.ok) violations.push(chain.reason!);

  const contract = checkContract(plan.contract, ctx.limits.allowedContracts);
  if (!contract.ok) violations.push(contract.reason!);

  const recipient = checkRecipient(plan.recipient, ctx.limits.allowedRecipients);
  if (!recipient.ok) violations.push(recipient.reason!);

  const spend = checkSpendCap(plan.amount, ctx.limits.maxSpend);
  if (!spend.ok) violations.push(spend.reason!);

  const approval = checkApproval(
    plan.approval,
    ctx.approvalRequired,
    ctx.bypassable,
  );
  if (!approval.ok) violations.push(approval.reason!);

  return { violations, passed: violations.length === 0 };
}
