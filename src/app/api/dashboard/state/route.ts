import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, mode: "simulation", source: "SIMULATED FIXTURES" });
}
