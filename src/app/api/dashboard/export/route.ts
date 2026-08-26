import { NextResponse } from "next/server";
import type { WorkflowRun } from "@/lib/bv/types";

interface ExportBody {
  run: WorkflowRun;
  format: "json" | "csv";
}

export async function POST(req: Request) {
  const body = (await req.json()) as ExportBody;
  const { run, format } = body;
  if (!run) {
    return NextResponse.json({ ok: false, error: "No run provided" }, { status: 404 });
  }
  if (!run.review) {
    return NextResponse.json(
      { ok: false, error: "Export blocked until a human review is recorded." },
      { status: 409 },
    );
  }
  if (format === "csv") {
    const csv = toCsv(run);
    const headers = new Headers({ "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=brand-choice-export.csv" });
    return new NextResponse(csv, { status: 200, headers });
  }
  const headers = new Headers({ "Content-Type": "application/json", "Content-Disposition": "attachment; filename=brand-choice-export.json" });
  return new NextResponse(JSON.stringify(run, null, 2), { status: 200, headers });
}

function toCsv(run: WorkflowRun): string {
  const rows: string[] = [];
  rows.push("field,value");
  const esc = (v: unknown) => String(v ?? "").replace(/"/g, '""');
  rows.push(`runId,"${esc(run.runId)}"`);
  rows.push(`workflow,"${esc(run.config.name)}"`);
  rows.push(`goal,"${esc(run.config.goal)}"`);
  rows.push(`complianceMinimum,"${esc(run.config.complianceMinimum.description)}"`);
  rows.push(`complianceShare,"${run.observations.totals.complianceShare.toFixed(2)}"`);
  rows.push(`totalAdd,"${run.observations.totals.totalAdd}"`);
  rows.push(`heatAggregate,"${run.heatScore.aggregate.toFixed(4)}"`);
  rows.push(`withinBoundary,"${run.heatScore.withinBoundary}"`);
  rows.push(`verdict,"${esc(run.review?.verdict ?? "")}"`);
  rows.push(`reviewer,"${esc(run.review?.by ?? "")}"`);
  rows.push(`reviewerRole,"${esc(run.review?.role ?? "")}"`);
  rows.push(`claim,"${esc(run.claim)}"`);
  for (const s of run.observations.slots) {
    rows.push(`slot_${s.slot},"${esc(s.category)}|add:${s.actualAdd}|share:${s.shareOfHome}|within:${s.withinBoundary}"`);
  }
  for (const c of run.controls) {
    rows.push(`control_${c.id},"${esc(c.outcome)}|${esc(c.detail)}"`);
  }
  for (const a of run.audit) {
    rows.push(`audit_${a.seq},"${esc(a.actor)}|${esc(a.action)}|${a.hash.slice(0, 16)}"`);
  }
  return rows.join("\n") + "\n";
}
