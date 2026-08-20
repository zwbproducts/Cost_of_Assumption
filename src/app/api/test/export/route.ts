import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { packetToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const run = store.getState();
  if (!run.config) {
    return NextResponse.json({ ok: false, error: "No test data to export." }, { status: 404 });
  }
  const packet = store.buildPacket();
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();

  if (format === "csv") {
    const filename = `bridge-validation-${packet.config.testId}.csv`;
    return new NextResponse(packetToCsv(packet), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const filename = `bridge-validation-${packet.config.testId}.json`;
  return new NextResponse(JSON.stringify(packet, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
