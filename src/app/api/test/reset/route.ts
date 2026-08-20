import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Deletes only local test data. It can never touch the blockchain.
 */
export async function DELETE() {
  await store.reset();
  return NextResponse.json({ ok: true, note: "Local test data deleted. Blockchain untouched." });
}
