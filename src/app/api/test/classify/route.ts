import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { Classification, ClassificationResult } from "@/lib/types";

export const dynamic = "force-dynamic";

const RESULTS: ClassificationResult[] = [
  "supported",
  "contradicted",
  "unresolved",
  "unsuitable",
];

export async function POST(req: Request) {
  let body: Partial<Classification>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.result || !RESULTS.includes(body.result)) {
    return NextResponse.json(
      { ok: false, error: "result must be one of: " + RESULTS.join(", ") },
      { status: 400 },
    );
  }
  if (!body.reason || !body.by) {
    return NextResponse.json(
      { ok: false, error: "reason and by (classifier identity) are required." },
      { status: 400 },
    );
  }

  const classification: Classification = {
    result: body.result,
    reason: body.reason,
    uncertainty: body.uncertainty ?? "",
    alternative: body.alternative ?? "",
    nextControl: body.nextControl ?? "",
    by: body.by,
    at: new Date().toISOString(),
  };
  await store.setClassification(classification);
  return NextResponse.json({ ok: true, packet: store.buildPacket() });
}
