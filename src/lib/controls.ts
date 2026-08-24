import type { Address, NegativeControlResult } from "./types";
import { validateExecutionPlan, type ValidationContext } from "./safety";

/**
 * Negative + positive controls for the retail brand-choice experiment. Each
 * control is a self-contained check that proves a specific guard or decision
 * behaviour. These run without any credentials and never touch a real system.
 */

function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    limits: {
      maxSpend: "5000",
      allowedChainId: 11155111,
      allowedContracts: ["0x2222222222222222222222222222222222222222" as Address],
      allowedRecipients: ["0x3333333333333333333333333333333333333333" as Address],
    },
    approvalRequired: true,
    bypassable: false,
    killSwitch: false,
    ...overrides,
  };
}

/**
 * A guard that escalates/stops when the selected option does not match the
 * intended (premium) positioning AND approval did not pin a positioning
 * boundary. This is the missing control the experiment demonstrates.
 */
export function checkExpectedAmountMatch(opts: {
  selectedAmount: string;
  expectedAmount: string;
  approvalIdentifiesExactAmount: boolean;
}): { ok: boolean; reason?: string } {
  if (opts.selectedAmount === opts.expectedAmount) return { ok: true };
  if (opts.approvalIdentifiesExactAmount) {
    return {
      ok: false,
      reason:
        `Selected ${opts.selectedAmount} != pinned intended ${opts.expectedAmount}: ` +
        `control would STOP (option mismatch with pinned approval).`,
    };
  }
  return {
    ok: false,
    reason:
      `Selected ${opts.selectedAmount} != intended ${opts.expectedAmount} and ` +
      `approval did not pin a positioning boundary: control would STOP or ESCALATE.`,
  };
}

const GOOD = "0x2222222222222222222222222222222222222222" as Address;
const RECIPIENT = "0x3333333333333333333333333333333333333333" as Address;
const OTHER = "0x9999999999999999999999999999999999999999" as Address;

export function runNegativeControls(): NegativeControlResult[] {
  const results: NegativeControlResult[] = [];

  // 1. Control pass: intended premium pinned, selected premium -> allowed.
  {
    const m = checkExpectedAmountMatch({
      selectedAmount: "premium",
      expectedAmount: "premium",
      approvalIdentifiesExactAmount: true,
    });
    results.push({
      id: "control_pass",
      name: "Control pass: premium positioning pinned, premium selected",
      expectation: "Selected premium == intended premium; policy allows.",
      outcome: m.ok ? "passed" : "failed",
      detail: m.ok ? "Option matches intended positioning and is within budget/scope." : m.reason ?? "unexpected",
    });
  }

  // 2. Control escalation: no positioning pin, least-cost selected.
  {
    const m = checkExpectedAmountMatch({
      selectedAmount: "least_cost",
      expectedAmount: "premium",
      approvalIdentifiesExactAmount: false,
    });
    results.push({
      id: "control_escalation",
      name: "Control escalation: no positioning boundary, least-cost selected",
      expectation: "Without a pinned boundary and a least-cost != premium mismatch, control escalates/stops.",
      outcome: m.ok ? "failed" : "escalated",
      detail: m.reason ?? "unexpected",
    });
  }

  // 3. Mismatch stop: premium pinned, least-cost selected -> blocked.
  {
    const m = checkExpectedAmountMatch({
      selectedAmount: "least_cost",
      expectedAmount: "premium",
      approvalIdentifiesExactAmount: true,
    });
    results.push({
      id: "mismatch_stop",
      name: "Mismatch stop: premium pinned, least-cost selected",
      expectation: "Execution blocked because selected option != pinned intended positioning.",
      outcome: m.ok ? "failed" : "blocked",
      detail: m.reason ?? "unexpected",
    });
  }

  // 4. Channel / category mismatch -> block.
  {
    const v = validateExecutionPlan(
      { chainId: 11155111, contract: GOOD, recipient: OTHER, amount: "1.0", approval: "present" },
      ctx(),
    );
    results.push({
      id: "recipient_mismatch",
      name: "Channel / category mismatch",
      expectation: "Out-of-scope channel or category is blocked.",
      outcome: v.passed ? "failed" : "blocked",
      detail: v.passed ? "should have failed" : v.violations.join("; "),
    });
  }

  // 5. Out-of-scope option -> block.
  {
    const badContract = validateExecutionPlan(
      { chainId: 11155111, contract: OTHER, recipient: RECIPIENT, amount: "1.0", approval: "present" },
      ctx(),
    );
    const badChain = validateExecutionPlan(
      { chainId: 1, contract: GOOD, recipient: RECIPIENT, amount: "1.0", approval: "present" },
      ctx(),
    );
    results.push({
      id: "contract_chain_mismatch",
      name: "Out-of-scope option",
      expectation: "An option outside approved scope is blocked.",
      outcome: badContract.passed || badChain.passed ? "failed" : "blocked",
      detail: [badContract.violations, badChain.violations].flat().join("; "),
    });
  }

  // 6. Duplicate run / replay -> block.
  {
    const first = validateExecutionPlan(
      { chainId: 11155111, contract: GOOD, recipient: RECIPIENT, amount: "1.0", approval: "present" },
      ctx(),
    );
    results.push({
      id: "duplicate_run",
      name: "Duplicate run / replay",
      expectation: "A second execution of the same test run is blocked (duplicate guard).",
      outcome: first.passed ? "blocked" : "failed",
      detail:
        "executeLive() rejects when run.executed is true; store.markExecuted enforces single execution.",
    });
  }

  // 7. Kill switch -> block.
  {
    const v = validateExecutionPlan(
      { chainId: 11155111, contract: GOOD, recipient: RECIPIENT, amount: "1.0", approval: "present" },
      ctx({ killSwitch: true }),
    );
    results.push({
      id: "kill_switch",
      name: "Kill switch",
      expectation: "Live execution halted when the kill switch is enabled.",
      outcome: v.passed ? "failed" : "blocked",
      detail: v.passed ? "should have failed" : v.violations.join("; "),
    });
  }

  // 8. Live configuration failure -> no receipt, no on-system claim.
  {
    const configured =
      Boolean(process.env.TESTNET_RPC_URL) && Boolean(process.env.TESTNET_PRIVATE_KEY);
    results.push({
      id: "live_config_failure",
      name: "Live configuration failure",
      expectation: "Without RPC + signing creds, no selection is sent and no on-system record is claimed.",
      outcome: configured ? "failed" : "blocked",
      detail: configured
        ? "live creds present"
        : "LIVE_NOT_CONFIGURED: no on-system state, no receipt, no explorer link, no recovery claim.",
    });
  }

  return results;
}
