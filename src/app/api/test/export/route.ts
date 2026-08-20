import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const run = store.getState();
  if (!run.config) {
    return NextResponse.json({ ok: false, error: "No test data to export." }, { status: 404 });
  }
  const packet = store.buildPacket();
  const filename = `bridge-validation-${packet.config.testId}.json`;
  return new NextResponse(JSON.stringify(packet, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
