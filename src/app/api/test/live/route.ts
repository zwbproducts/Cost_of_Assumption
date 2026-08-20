import { NextResponse } from "next/server";
import { executeLive } from "@/lib/live";
import { NotConfiguredProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

/**
 * Live testnet execution. Gated by safety guards and explicit operator approval.
 * No transaction is ever sent unless every guard passes and approval is present.
 * A real signing provider must be injected/server-configured; without one the
 * call validates guards and then reports that no signing backend is wired.
 */
export async function POST(req: Request) {
  let body: { approval?: string; amount?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const approval = body.approval;
  if (approval !== "present") {
    return NextResponse.json(
      { ok: false, error: "Explicit operator approval (approval='present') is required to execute." },
      { status: 400 },
    );
  }

  const outcome = await executeLive(new NotConfiguredProvider(), {
    approval: "present",
    amount: body.amount,
  });

  if (!outcome.ok && outcome.violations) {
    return NextResponse.json({ ok: false, violations: outcome.violations }, { status: 403 });
  }
  return NextResponse.json(outcome);
}
