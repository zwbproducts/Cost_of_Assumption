import { NextResponse } from "next/server";
import type { ClassificationRequest, WorkflowRun } from "@/lib/bv/types";
import { applyReview } from "@/lib/bv/workflow";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { run: WorkflowRun; review: Omit<ClassificationRequest, "by"> & { by: string } };
    const missing = ["verdict", "by", "role", "reason", "uncertainty", "alternative"].filter(
      (k) => !(k in body.review) || !body.review[k as keyof ClassificationRequest],
    );
    if (missing.length) {
      return NextResponse.json({ ok: false, error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }
    if (!body.run) {
      return NextResponse.json({ ok: false, error: "No run provided" }, { status: 404 });
    }
    const review = {
      verdict: body.review.verdict,
      by: body.review.by,
      role: body.review.role,
      reason: body.review.reason,
      uncertainty: body.review.uncertainty,
      alternative: body.review.alternative,
      at: new Date().toISOString(),
    };
    const run = await applyReview(body.run, review);
    return NextResponse.json({ ok: true, packet: run });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
