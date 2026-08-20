import { describe, it, expect } from "bun:test";
import {
  checkChain,
  checkContract,
  checkRecipient,
  checkSpendCap,
  checkApproval,
  checkKillSwitch,
  validateExecutionPlan,
  toBaseUnits,
  normalizeAddress,
} from "../safety";
import type { Address, AuthorityLimits } from "../types";

const LIMITS: AuthorityLimits = {
  maxSpend: "5.0",
  allowedChainId: 11155111,
  allowedContracts: ["0x2222222222222222222222222222222222222222" as Address],
  allowedRecipients: ["0x3333333333333333333333333333333333333333" as Address],
};

const ctx = {
  limits: LIMITS,
  approvalRequired: true,
  bypassable: false,
  killSwitch: false,
};

describe("safety guards — spend cap", () => {
  it("allows amount at or below cap", () => {
    expect(checkSpendCap("5.0", "5.0").ok).toBe(true);
    expect(checkSpendCap("1.0", "5.0").ok).toBe(true);
  });
  it("rejects amount above cap", () => {
    expect(checkSpendCap("5.1", "5.0").ok).toBe(false);
    expect(checkSpendCap("999", "5.0").ok).toBe(false);
  });
  it("compares fractional amounts correctly", () => {
    expect(toBaseUnits("1.5")).toBe(1500000000000000000n);
    expect(checkSpendCap("1.000000000000000001", "1.0").ok).toBe(false);
  });
});

describe("safety guards — chain allowlisting", () => {
  it("allows allowed chain", () => {
    expect(checkChain(11155111, 11155111).ok).toBe(true);
  });
  it("rejects other chains (incl. mainnet)", () => {
    expect(checkChain(1, 11155111).ok).toBe(false);
    expect(checkChain(137, 11155111).ok).toBe(false);
  });
});

describe("safety guards — contract allowlisting", () => {
  it("allows allowlisted contract", () => {
    expect(
      checkContract("0x2222222222222222222222222222222222222222" as Address, LIMITS.allowedContracts).ok,
    ).toBe(true);
  });
  it("rejects non-allowlisted contract", () => {
    expect(
      checkContract("0x9999999999999999999999999999999999999999" as Address, LIMITS.allowedContracts).ok,
    ).toBe(false);
  });
});

describe("safety guards — recipient allowlisting", () => {
  it("allows allowlisted recipient", () => {
    expect(
      checkRecipient("0x3333333333333333333333333333333333333333" as Address, LIMITS.allowedRecipients).ok,
    ).toBe(true);
  });
  it("rejects non-allowlisted recipient", () => {
    expect(
      checkRecipient("0x4444444444444444444444444444444444444444" as Address, LIMITS.allowedRecipients).ok,
    ).toBe(false);
  });
});

describe("safety guards — approval", () => {
  it("requires present approval", () => {
    expect(checkApproval("present", true, false).ok).toBe(true);
    expect(checkApproval("absent", true, false).ok).toBe(false);
  });
  it("treats bypassed as a violation", () => {
    expect(checkApproval("bypassed", true, false).ok).toBe(false);
  });
  it("is a no-op when approval not required", () => {
    expect(checkApproval("absent", false, false).ok).toBe(true);
  });
});

describe("safety guards — kill switch", () => {
  it("halts when enabled", () => {
    expect(checkKillSwitch(true).ok).toBe(false);
    expect(checkKillSwitch(false).ok).toBe(true);
  });
});

describe("validateExecutionPlan — combined", () => {
  const plan = {
    chainId: 11155111,
    contract: "0x2222222222222222222222222222222222222222" as Address,
    recipient: "0x3333333333333333333333333333333333333333" as Address,
    amount: "5.0",
    approval: "present" as const,
  };
  it("passes a fully valid plan", () => {
    expect(validateExecutionPlan(plan, ctx).passed).toBe(true);
  });
  it("fails on wrong chain", () => {
    const r = validateExecutionPlan({ ...plan, chainId: 1 }, ctx);
    expect(r.passed).toBe(false);
    expect(r.violations.join()).toContain("Chain");
  });
  it("fails on wrong contract", () => {
    const r = validateExecutionPlan(
      { ...plan, contract: "0x9999999999999999999999999999999999999999" as Address },
      ctx,
    );
    expect(r.passed).toBe(false);
  });
  it("fails on wrong recipient", () => {
    const r = validateExecutionPlan(
      { ...plan, recipient: "0x4444444444444444444444444444444444444444" as Address },
      ctx,
    );
    expect(r.passed).toBe(false);
  });
  it("fails on overspend", () => {
    expect(validateExecutionPlan({ ...plan, amount: "9.0" }, ctx).passed).toBe(false);
  });
  it("fails on missing approval", () => {
    expect(validateExecutionPlan({ ...plan, approval: "absent" }, ctx).passed).toBe(false);
  });
  it("fails when kill switch is on", () => {
    expect(validateExecutionPlan(plan, { ...ctx, killSwitch: true }).passed).toBe(false);
  });
});

describe("address normalization", () => {
  it("lowercases and validates", () => {
    expect(normalizeAddress("0X2222222222222222222222222222222222222222")).toBe(
      "0x2222222222222222222222222222222222222222",
    );
  });
  it("rejects malformed addresses", () => {
    expect(() => normalizeAddress("not-an-address")).toThrow();
  });
});
