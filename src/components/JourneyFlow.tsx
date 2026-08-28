"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadTest } from "@/lib/loadTest";
import type { EvidencePacket, RetailOption } from "@/lib/types";
import { LoadingState } from "@/components/ui";
import { Dot, HeatRing } from "@/components/Vis";
import { TONE } from "@/lib/loadTest";

type PersonaKey = "john" | "mary";

const PERSONAS: Record<
  PersonaKey,
  { name: string; emoji: string; type: string; assume: string; ask: string }
> = {
  john: {
    name: "John",
    emoji: "👨‍🔧",
    type: "price-conscious shopper",
    ask: "Choose a placement that stays within the approved budget.",
    assume: "John is price-driven, so the AI assumed the cheapest valid placement was best for him.",
  },
  mary: {
    name: "Mary",
    emoji: "🛍️",
    type: "brand-loyal shopper",
    ask: "Choose a placement that preserves premium brand positioning.",
    assume: "Mary values premium quality, but the AI still served the cheapest placement it was allowed to pick.",
  },
};

type Step = "shop" | "bag" | "checkout" | "receipt";

export default function JourneyFlow({ cKey }: { cKey: PersonaKey }) {
  const persona = PERSONAS[cKey] ?? PERSONAS.john;
  const [packet, setPacket] = useState<EvidencePacket | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("shop");

  useEffect(() => {
    let active = true;
    loadTest()
      .then((p) => {
        if (active) setPacket(p);
      })
      .catch((e) => {
        if (active) setErr((e as Error)?.message ?? String(e));
      });
    return () => {
      active = false;
    };
  }, []);

  if (err)
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <p className="text-rose-400">Could not load test: {err}</p>
      </main>
    );
  if (!packet)
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-xl mx-auto">
          <LoadingState rows={4} />
        </div>
      </main>
    );

  const cfg = packet.config;
  const selected = cfg.options.find((o) => o.id === cfg.selectedOptionId) ?? cfg.options[0];
  const intended = cfg.options.find((o) => o.id === cfg.intendedPositioning) ?? cfg.options[0];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6">
      <div className="w-full max-w-xl space-y-5">
        <header className="flex items-center gap-3 text-center">
          <span className="text-2xl">{persona.emoji}</span>
          <h1 className="text-xl font-bold text-sky-300">
            {persona.name}&rsquo;s holiday shop — {persona.type}
          </h1>
          <Link href="/" className="ml-auto text-xs text-slate-400 hover:text-sky-300 underline">
            Back to start
          </Link>
        </header>

        {step === "shop" && (
          <ShopView options={cfg.options} selectedId={cfg.selectedOptionId} onAdd={() => setStep("bag")} />
        )}

        {step === "bag" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="text-center">
              <span className="text-3xl">🛒</span>
              <div className="font-medium text-slate-100 mt-1">In bag</div>
              <div className="text-sm text-slate-300">{selected.label} ({selected.cost})</div>
            </div>
            <button
              onClick={() => setStep("checkout")}
              className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium py-2 text-white"
            >
              Proceed to checkout
            </button>
            <button onClick={() => setStep("shop")} className="text-xs text-slate-400 hover:text-sky-300">
              Keep shopping
            </button>
          </div>
        )}

        {step === "checkout" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="text-xs text-slate-400">Checkout</div>
            <div className="text-sm text-slate-300">Secure checkout · free returns · 30-day guarantee</div>
            <button
              onClick={() => setStep("receipt")}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium py-2 text-white"
            >
              Confirm purchase
            </button>
          </div>
        )}

        {step === "receipt" && (
          <ReceiptView
            persona={persona}
            selected={selected}
            intended={intended}
            observed={packet.observedResultSentence}
            divergence={packet.divergence}
            onReset={() => setStep("shop")}
          />
        )}
      </div>

      <footer className="mt-6 text-center text-[10px] text-slate-500">
        <span className="text-slate-400">John and Mary both saw the placement tier the AI picked.</span>
        <div className="mt-1 flex justify-center gap-3">
          <Dot color={TONE.bad} label="Same outcome" />
          <Dot color={TONE.warn} label="Premium breached" />
        </div>
        <div className="mt-1">
          <HeatRing score={90} label="Brand-risk" size={30} />
        </div>
      </footer>
    </main>
  );
}

function ShopView({ options, selectedId, onAdd }: { options: RetailOption[]; selectedId: string; onAdd: () => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs text-slate-400">Browse the holiday shelf</h2>
      {options.map((o) => {
        const chosen = o.id === selectedId;
        return (
          <div
            key={o.id}
            className={`rounded-xl border p-4 text-center transition ${
              chosen
                ? "border-amber-400/50 bg-slate-900 ring-2 ring-amber-400/30"
                : "border-slate-800 bg-slate-950"
            }`}
          >
            <div className="font-medium text-slate-100">{o.label}</div>
            <div className="text-xs text-slate-400 mt-1">{o.visibility} visibility</div>
            {chosen ? <span className="text-xs text-amber-300">(the placement served to shoppers)</span> : null}
            <button
              onClick={onAdd}
              className="mt-2 w-full rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium py-1.5 text-white"
            >
              Add to bag
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ReceiptView({
  persona,
  selected,
  intended,
  observed,
  divergence,
  onReset,
}: {
  persona: (typeof PERSONAS)[PersonaKey];
  selected: RetailOption;
  intended: RetailOption;
  observed: string;
  divergence: EvidencePacket["divergence"];
  onReset: () => void;
}) {
  const breached = divergence.find((d) => d.field === "positioning")?.note !== "match";
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="text-center">
        <span className="text-3xl">✅</span>
        <div className="font-medium text-slate-100 mt-1">Purchase confirmed</div>
      </div>

      <div className="grid gap-2 text-sm">
        <Fact label="What was asked" value={persona.ask} />
        <Fact label="AI assumed" value={persona.assume} />
        <Fact label="AI selected" value={`${selected.label} (${selected.cost})`} tone={breached ? "bad" : "ok"} />
        <Fact label="What happened" value={observed} />
        <Fact label="Intended" value={intended.label} />
      </div>

      {breached && (
        <div className="rounded-lg border border-rose-800/40 bg-rose-900/10 px-3 py-2 text-xs text-rose-200">
          The placement is in scope and on budget, but it breaks the premium brand positioning.
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onReset}
          className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium py-1.5 text-slate-100"
        >
          Another shopper
        </button>
        <Link
          href="/dashboard"
          className="flex-1 text-center rounded-lg bg-sky-700 hover:bg-sky-600 text-sm font-medium py-1.5 text-white"
        >
          Business impact and audit
        </Link>
      </div>
    </section>
  );
}

function Fact({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "bad" | "warn" }) {
  const color = tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-300" : "text-slate-200";
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={color}>{value}</div>
    </div>
  );
}
