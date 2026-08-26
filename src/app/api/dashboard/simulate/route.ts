import { NextResponse } from "next/server";
import { buildRun } from "@/lib/bv/workflow";
import type { WorkflowRun } from "@/lib/bv/types";

export async function POST() {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const run: WorkflowRun = await buildRun(runId);
    return NextResponse.json({ ok: true, packet: run });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
