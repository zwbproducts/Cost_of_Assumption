import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { buildTestConfig } from "@/lib/scenario";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const config = buildTestConfig(loadConfig());
  await store.initFromConfig(config);
  return NextResponse.json({ ok: true, config });
}
