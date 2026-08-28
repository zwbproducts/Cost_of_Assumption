"use client";

import { useState } from "react";
import Link from "next/link";
import { SIM_FIXTURES } from "@/lib/scenario";

type Step = "shop" | "bag" | "checkout" | "receipt";

const SHOPPER_LABEL: Record<string, string> = {
  premium: "Featured shelf",
  moderate: "Mid aisle",
  "weak (dilution risk)": "Back corner",
};

export default function Home() {
  const [step, setStep] = useState<Step>("shop");
  const selected = SIM_FIXTURES;
  const option = selected.options.find((o) => o.id === selected.selectedOptionId) ?? selected.options[0];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-sky-300">Holiday Shelf Placement Choice</h1>
          <p className="text-slate-400 text-sm">A seasonal shopper experience for the Aurora line.</p>
        </div>

        {step === "shop" && (
          <ShopCard option={option} onAdd={() => setStep("bag")} />
        )}

        {step === "bag" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 text-center">
            <span className="text-3xl">🛒</span>
            <div className="font-medium">Added to bag</div>
            <div className="text-sm text-slate-300">{option.label} Aurora Hoodie</div>
            <button
              onClick={() => setStep("checkout")}
              className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium py-2 text-white"
            >
              Proceed to checkout
            </button>
            <button onClick={() => setStep("shop")} className="text-xs text-slate-400 hover:text-slate-300">
              Keep shopping
            </button>
          </div>
        )}

        {step === "checkout" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="text-sm text-slate-400">Checkout</div>
            <div className="text-sm text-slate-300">Secure checkout · free shipping · 30-day returns</div>
            <button
              onClick={() => setStep("receipt")}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium py-2 text-white"
            >
              Confirm purchase
            </button>
          </div>
        )}

        {step === "receipt" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 text-center">
            <span className="text-3xl">✅</span>
            <div className="font-medium text-slate-100">Purchase confirmed</div>
            <div className="text-sm text-slate-300">
              You shopped under the {option.label}. Shoppers saw{" "}
              {SHOPPER_LABEL[option.positioning] ?? option.positioning} placement.
            </div>
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="text-xs text-slate-400">
                The placement chosen for shoppers is cheaper, but it reduces premium visibility.
              </div>
              <Link
                href="/dashboard"
                className="inline-block rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-medium py-1.5 px-3 text-white"
              >
                View business impact and audit
              </Link>
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-slate-500 pt-4">
          Simulated retail experience — no real transactions.
        </div>
      </div>
    </main>
  );
}

function ShopCard({ option, onAdd }: { option: (typeof SIM_FIXTURES.options)[number]; onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 text-center">
      <span className="text-4xl">🎁</span>
      <div className="font-medium text-slate-100">{option.label}</div>
      <div className="text-xs text-slate-400">
        {SHOPPER_LABEL[option.positioning] ?? option.positioning}
      </div>
      <div className="text-xs text-slate-500">(visibility: {option.visibility})</div>
      <button
        onClick={onAdd}
        className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium py-2 text-white"
      >
        Add to bag
      </button>
    </div>
  );
}
