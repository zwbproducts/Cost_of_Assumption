import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { buildTestConfig } from "@/lib/scenario";
import { runSimulation } from "@/lib/simulation";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Runs the deterministic simulated scenario end-to-end without any credentials.
 * A new user can call this and immediately receive the full evidence packet.
 */
export async function POST() {
  const cfg = loadConfig();
  const config = buildTestConfig(cfg);
  await store.initFromConfig(config);

  const sim = runSimulation(config);
  await store.appendEvents(sim.events);
  await store.setAgent(sim.agent);
  await store.setOnChain(sim.onChain);
  await store.setDivergence(sim.divergence);
  await store.setControlAnalysis(sim.controlAnalysis);
  await store.setRecovery(sim.recovery);

  return NextResponse.json({ ok: true, packet: store.buildPacket(), mode: cfg.mode });
}
