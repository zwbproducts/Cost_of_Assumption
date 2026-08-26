const GENESIS = "0".repeat(64);
const ENCODER = new TextEncoder();

export function genesis(): string {
  return GENESIS;
}

export async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", ENCODER.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function makeHash(prev: string, payload: unknown): Promise<string> {
  const body = `${prev}|${JSON.stringify(payload)}`;
  return sha256(body);
}
