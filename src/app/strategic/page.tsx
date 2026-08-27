"use client";

import { TestShell } from "@/components/TestShell";
import { HeatRing, Dot, BarChart } from "@/components/Vis";
import { selectedOption, intendedOption, matchedIntended, TONE } from "@/lib/loadTest";
import type { EvidencePacket, RetailOption } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type OptRow = { opt: RetailOption; impact: number; uncertainty: number; uncertaintyLabel: string };

export default function StrategicPage() {
  return (
    <TestShell title="Strategic view">
      {(packet) => <Strategic packet={packet} />}
    </TestShell>
  );
}

function Strategic({ packet }: { packet: EvidencePacket }) {
  const cfg = packet.config;
  const sel = selectedOption(packet);
  const intended = intendedOption(packet);
  const ok = matchedIntended(packet);

  const rows: OptRow[] = cfg.options.map((o) => {
    let impact: number;
    if (o.positioning === "highest") impact = 10;
    else if (o.positioning === "moderate") impact = 40;
    else impact = 90;
    const unc = o.id === cfg.selectedOptionId ? 80 : 20;
    const uncLabel = unc >= 66 ? "high" : "low";
    return { opt: o, impact, uncertainty: unc, uncertaintyLabel: uncLabel };
  });

  const impactColor = (v: number) => (v >= 66 ? TONE.bad : v >= 33 ? TONE.warn : TONE.ok);
  const uncColor = (v: number) => (v >= 66 ? TONE.bad : v >= 33 ? TONE.warn : TONE.ok);

  return (
    <>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-xs text-slate-400">What the business asked for</h2>
        <p className="text-sm text-slate-200">{cfg.brandBrief}</p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-xs text-slate-400">Intended outcome</h2>
        <p className="text-sm text-slate-200">{cfg.expectedAction.summary}</p>
        <div className="flex items-center gap-4 text-xs">
          <Dot color={TONE.ok} label="Budget cap" />
          <span className="text-slate-400">up to {cfg.authority.limits.maxSpend} USD</span>
          <Dot color={TONE.warn} label="Positioning" />
          <span className="text-slate-400">premium (Premium or Balanced)</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-xs text-slate-400">Placement options</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {rows.map((r) => {
            const chosen = sel?.id === r.opt.id;
            return (
              <div
                key={r.opt.id}
                className={`rounded-xl border p-3 text-center transition ${
                  chosen
                    ? "border-amber-400/50 bg-slate-900 ring-2 ring-amber-400/30"
                    : "border-slate-800 bg-slate-950"
                }`}
              >
                <div className="font-medium text-sm text-slate-100">{r.opt.label}</div>
                <div className="text-xs text-slate-400 mb-2">{r.opt.cost}</div>
                <HeatRing score={r.impact} label="Impact" size={40} />
                <Dot color={uncColor(r.uncertainty)} label={`uncertainty ${r.uncertaintyLabel}`} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs">
          <Dot color={TONE.ok} label="Impact = brand harm risk" />
          <Dot color={TONE.bad} label="Uncertainty = evidence quality" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xs text-slate-400 mb-2">What happened</h2>
        <div className="flex items-center gap-3 mb-2">
          <span className="font-medium text-slate-100">Selected: {sel?.label ?? cfg.selectedOptionId}</span>
          <span className="text-slate-400">vs intended {intended?.label}</span>
          <StatusPill status={ok ? "ok" : "bad"} label={ok ? "on brief" : "off brief"} />
        </div>
        <p className="text-sm text-slate-300">{packet.observedResultSentence}</p>
      </section>

      <section className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-4">
        <h2 className="text-xs text-slate-400">Next decision</h2>
        <p className="text-sm text-slate-200">
          The placement is in scope and on budget, but it breaks the premium rule. <strong>Do not release the selected
          placement</strong>. Re-run the brief with a measurable premium-positioning boundary before approval.
        </p>
      </section>
    </>
  );
}
