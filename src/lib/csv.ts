import type { EvidencePacket } from "./types";

function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (value === null || value === undefined) {
    out[prefix] = "";
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix] = "";
      return out;
    }
    value.forEach((v, i) => flatten(v, prefix ? `${prefix}.${i}` : `${i}`, out));
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  out[prefix] = String(value);
  return out;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Serialize an evidence packet to a single-row (wide) CSV record. The
 * classification record is included via `classification.*` columns so the
 * packet can be analysed alongside other exported packets in a spreadsheet.
 */
export function packetToCsv(packet: EvidencePacket): string {
  const flat = flatten(packet);
  const keys = Object.keys(flat).sort();
  const header = keys.map(csvCell).join(",");
  const row = keys.map((k) => csvCell(flat[k])).join(",");
  return header + "\n" + row + "\n";
}
