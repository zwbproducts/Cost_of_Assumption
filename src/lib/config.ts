import type { Address, AuthorityLimits, ChainId } from "./types";
import { normalizeAddress } from "./safety";
import { SIM_FIXTURES } from "./scenario";

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

function list(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface AppConfig {
  mode: "simulation" | "live";
  networkName: string;
  explorerBase: string;
  limits: AuthorityLimits;
  killSwitch: boolean;
  hasLiveCredentials: boolean;
  walletAddress: Address | null;
}

/**
 * Loads configuration from environment variables. NEVER returns the private
 * key. The private key (TESTNET_PRIVATE_KEY) is read only inside the live
 * executor and is never placed on this object.
 */
export function loadConfig(): AppConfig {
  const mode = bool(process.env.LIVE_ENABLED, false) ? "live" : "simulation";
  const chainId = (process.env.ALLOWED_CHAIN_ID ?? "11155111") as unknown as ChainId;
  const maxSpend = process.env.MAX_TESTNET_SPEND ?? "5.0";
  // When no allowlists are configured, default to the bounded scenario
  // fixtures so the deterministic simulation is internally consistent.
  const contracts = list(process.env.ALLOWED_CONTRACTS).length
    ? list(process.env.ALLOWED_CONTRACTS)
    : [SIM_FIXTURES.contractAddress];
  const recipients = list(process.env.ALLOWED_RECIPIENTS).length
    ? list(process.env.ALLOWED_RECIPIENTS)
    : [SIM_FIXTURES.recipientAddress];
  const killSwitch = bool(process.env.KILL_SWITCH, false);

  const walletAddress = process.env.TESTNET_WALLET_ADDRESS
    ? normalizeAddress(process.env.TESTNET_WALLET_ADDRESS)
    : null;

  const hasLiveCredentials = Boolean(
    process.env.TESTNET_RPC_URL && process.env.TESTNET_PRIVATE_KEY,
  );

  return {
    mode,
    networkName: process.env.NETWORK_NAME ?? "sepolia-testnet",
    explorerBase:
      process.env.EXPLORER_BASE ?? "https://sepolia.etherscan.io/tx/",
    limits: {
      maxSpend,
      allowedChainId: chainId,
      allowedContracts: contracts.map((c) => normalizeAddress(c)),
      allowedRecipients: recipients.map((r) => normalizeAddress(r)),
    },
    killSwitch,
    hasLiveCredentials,
    walletAddress,
  };
}

/** Only non-secret fields are safe to send to the browser. */
export function publicConfig(cfg: AppConfig) {
  return {
    mode: cfg.mode,
    networkName: cfg.networkName,
    explorerBase: cfg.explorerBase,
    limits: {
      maxSpend: cfg.limits.maxSpend,
      allowedChainId: cfg.limits.allowedChainId,
      allowedContracts: cfg.limits.allowedContracts,
      allowedRecipients: cfg.limits.allowedRecipients,
    },
    killSwitch: cfg.killSwitch,
    hasLiveCredentials: cfg.hasLiveCredentials,
    walletAddress: cfg.walletAddress,
  };
}
