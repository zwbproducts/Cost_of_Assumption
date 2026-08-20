import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Canonical, stable stringification for hashing. Keys are sorted so that the
 * hash is deterministic regardless of object key insertion order.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * Hash an event given the previous event hash and its canonical payload.
 * The first event uses GENESIS as prevHash, making tampering detectable.
 */
export const GENESIS = "0".repeat(64) as `0x${string}`;

export function hashEvent(
  prevHash: string,
  payload: Record<string, unknown>,
): string {
  return sha256(prevHash + "|" + canonicalize(payload));
}
