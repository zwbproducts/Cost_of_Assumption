import { loadConfig } from "./config";
import { validateExecutionPlan, type ExecutionPlan, type ValidationContext } from "./safety";
import { SIM_FIXTURES } from "./scenario";
import { store as defaultStore, type Store } from "./store";
import type { ApprovalState } from "./types";
import {
  RpcFailureError,
  NotConfiguredProvider,
  type ChainProvider,
  type SubmitResult,
} from "./provider";

export interface LiveOutcome {
  ok: boolean;
  violations?: string[];
  txHash?: string;
  status?: string;
  error?: string;
}

/**
 * Execute the allowlisted testnet transaction after explicit validation.
 * Requires: kill-switch off, all allowlists, spend cap, and human approval.
 * Duplicate execution is rejected. RPC failures are captured, never silent.
 *
 * The provider is injected so the safety behaviour can be unit-tested without
 * a real wallet or RPC.
 */
export async function executeLive(
  provider: ChainProvider,
  options: { amount?: string; approval: ApprovalState },
  storeApi: Store = defaultStore,
): Promise<LiveOutcome> {
  const cfg = loadConfig();
  const run = storeApi.getState();
  if (!run.config) return { ok: false, error: "No initialized test configuration." };

  // Duplicate execution guard: never submit twice for the same test run.
  if (run.executed) {
    return { ok: false, error: "DUPLICATE_EXECUTION: this test run was already executed." };
  }

  const amount = options.amount ?? SIM_FIXTURES.selectedAmount;
  const ctx: ValidationContext = {
    limits: cfg.limits,
    approvalRequired: run.config.approvalPoint.required,
    bypassable: run.config.approvalPoint.bypassable,
    killSwitch: cfg.killSwitch,
  };
  const plan: ExecutionPlan = {
    contract: run.config.contract.address,
    recipient: run.config.recipient,
    amount,
    chainId: cfg.limits.allowedChainId,
    approval: options.approval,
  };

  const validation = validateExecutionPlan(plan, ctx);
  if (!validation.passed) {
    await storeApi.appendEvent("policy_check", {
      passed: false,
      violations: validation.violations,
      note: "Execution rejected by safety guards before any on-chain call.",
    }, new Date().toISOString());
    return { ok: false, violations: validation.violations };
  }

  await storeApi.appendEvent("policy_check", {
    passed: true,
    note: "All safety guards passed; proceeding to explicit approval + submission.",
  }, new Date().toISOString());
  await storeApi.appendEvent("approval", {
    state: options.approval,
    scope: "explicit operator approval for allowlisted testnet transaction",
    note: "Explicit operator approval recorded.",
  }, new Date().toISOString());
  await storeApi.appendEvent("tx_prepare", {
    to: plan.contract,
    method: run.config.contract.method,
    args: { recipient: plan.recipient, amount: plan.amount },
    mode: "live",
  }, new Date().toISOString());

  const submittedAt = new Date().toISOString();
  try {
    const result = await provider.submitTx(plan, ctx);
    await storeApi.appendEvent("tx_submit", { txHash: result.txHash, mode: "live" }, new Date().toISOString());
    await storeApi.appendEvent("tx_receipt", {
      txHash: result.txHash,
      status: result.status,
      gasCost: result.gasCost,
      tokenAmount: plan.amount,
      recipient: plan.recipient,
    }, new Date().toISOString());
    await storeApi.markExecuted(submittedAt);
    await storeApi.setOnChain({
      txHash: result.txHash,
      status: result.status,
      gasCost: result.gasCost,
      tokenAmount: plan.amount,
      recipient: plan.recipient,
      explorerUrl: run.config.network.explorerBase + result.txHash,
    });
    return { ok: true, txHash: result.txHash, status: result.status };
  } catch (e) {
    const err = e as Error;
    const isRpc = err instanceof RpcFailureError || /rpc/i.test(err.message);
    await storeApi.appendEvent("error", {
      phase: "tx_submission",
      message: err.message,
      kind: isRpc ? "rpc_failure" : "execution_error",
      note: "No on-chain state changed by this error; execution was not marked executed.",
    }, new Date().toISOString());
    return { ok: false, error: err.message };
  }
}
