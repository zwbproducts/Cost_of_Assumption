import { NextResponse } from "next/server";
import { store, verifyChain } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const run = store.getState();
  if (!run.config) {
    return NextResponse.json({ initialized: false });
  }
  const packet = store.buildPacket();
  const chainCheck = verifyChain(run.events);
  return NextResponse.json({
    initialized: true,
    chainIntegrity: chainCheck,
    packet,
  });
}
