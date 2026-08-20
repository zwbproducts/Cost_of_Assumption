import type { Address, ChainId, Hex } from "./types";
import type { ExecutionPlan, ValidationContext } from "./safety";

export interface SubmitResult {
  txHash: Hex;
  status: "success" | "reverted" | "failed";
  gasCost: string;
}

/**
 * Abstraction over the chain RPC. In production this would wrap a signed
 * submission via a wallet; for tests it can be a fake that succeeds or fails.
 * No private key ever leaves the server process.
 */
export interface ChainProvider {
  submitTx(plan: ExecutionPlan, ctx: ValidationContext): Promise<SubmitResult>;
}

/** Default provider: refuses to run unless a real signing backend is wired in. */
export class NotConfiguredProvider implements ChainProvider {
  async submitTx(): Promise<SubmitResult> {
    throw new Error(
      "LIVE_NOT_CONFIGURED: set TESTNET_RPC_URL and TESTNET_PRIVATE_KEY and inject a signing provider.",
    );
  }
}

export class RpcFailureError extends Error {
  constructor(message = "RPC failure") {
    super(message);
    this.name = "RpcFailureError";
  }
}

export function planFromConfig(
  contract: Address,
  recipient: Address,
  amount: string,
  chainId: ChainId,
  approval: ExecutionPlan["approval"],
): ExecutionPlan {
  return { contract, recipient, amount, chainId, approval };
}
