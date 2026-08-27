"use client";

import type { EvidencePacket, RetailOption, ClassificationResult } from "@/lib/types";

let cached: EvidencePacket | null = null;
let loading: Promise<EvidencePacket> | null = null;

export const CLASSIFY_RESULTS: ClassificationResult[] = [
  "supported",
  "contradicted",
  "unresolved",
  "unsuitable",
];

async function readPacket(): Promise<EvidencePacket> {
  const res = await fetch("/api/test/state", { cache: "no-store" });
  const state = await res.json();
  if (state?.initialized && state?.packet) return state.packet as EvidencePacket;
  const sim = await fetch("/api/test/simulate", { method: "POST" }).then((r) => r.json());
  if (!sim?.ok || !sim?.packet) throw new Error(sim?.error ?? "Failed to run simulation");
  return sim.packet as EvidencePacket;
}

export async function loadTest(): Promise<EvidencePacket> {
  if (cached) return cached;
  if (loading) return loading;
  loading = readPacket();
  try {
    cached = await loading;
    return cached;
  } finally {
    loading = null;
  }
}

export async function refetchTest(): Promise<EvidencePacket> {
  cached = null;
  cached = await readPacket();
  return cached;
}

export async function classifyPacket(req: {
  result: ClassificationResult;
  reason: string;
  uncertainty: string;
  alternative: string;
  nextControl?: string;
  by: string;
  reviewerRole: string;
}): Promise<EvidencePacket> {
  const res = await fetch("/api/test/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error ?? "Classification failed");
  cached = data.packet as EvidencePacket;
  return cached;
}

export async function downloadExport(format: "json" | "csv"): Promise<Blob> {
  const res = await fetch(`/api/test/export?format=${format}`);
  if (!res.ok) throw new Error(`Export blocked (${res.status})`);
  return await res.blob();
}

export function selectedOption(packet: EvidencePacket): RetailOption | undefined {
  return packet.config.options.find((o) => o.id === packet.config.selectedOptionId);
}

export function intendedOption(packet: EvidencePacket): RetailOption | undefined {
  return (
    packet.config.options.find((o) => o.id === packet.config.intendedPositioning) ??
    packet.config.options[0]
  );
}

export function matchedIntended(packet: EvidencePacket): boolean {
  const sel = packet.config.selectedOptionId;
  return sel === packet.config.intendedPositioning;
}

export const TONE = {
  ok: "#0d9488",
  warn: "#f59e0b",
  bad: "#ef4444",
  neutral: "#94a3a8",
} as const;
