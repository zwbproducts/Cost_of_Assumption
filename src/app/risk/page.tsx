"use client";

import { TestShell } from "@/components/TestShell";
import { HeatRing, Dot, BarChart } from "@/components/Vis";
import { matchedIntended, TONE } from "@/lib/loadTest";
import type { EvidencePacket, Divergence } from "@/lib/types";
import { StatusPill } from "@/components/ui";

export default function RiskPage() {
  return (
    <TestShell title="Risk view">{(packet) => <Risk packet={packet} />}</TestShell>
  );
}

function Risk({ packet }: { packet: EvidencePacket }) {
  const cfg = packet.config;
  const deviations = packet.divergence.filter((d) => (d.note as string) !== "match");

  const boundaryScore = matchedIntended(packet) ? 100 : 0;
  const evidenceScore = Math.round(
    (cfg.availableEvidence.filter((e) => e.uncertainty === "low").length /
      Math.max(1, cfg.availableEvidence.length)) *
      100,
  );

  const controls = [
    { label: "Positioning boundary (would stop)", value: 0, color: TONE.bad },
    { label: "Evidence quality (current)", value: evidenceScore, color: TONE.ok },
    { label: "Deviation detected", value: deviations.length ? 100 : 0, color: TONE.bad },
  ];

  const likelihoodScore = 90;
  const impactScore = 80;

  return (
    <>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-xs text-slate-400">Declared boundary</h2>
        <p className="text-sm text-slate-200">{cfg.authority.declared}</p>
        <div className="flex items-center gap-3 mt-2">
          <HeatRing score={boundaryScore} label="Boundary" size={38} />
          <span className="text-xs text-slate-400">
            Budget {cfg.authority.limits.maxSpend} USD · approved scope enforced
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-xs text-slate-400">Available evidence</h2>
        <ul className="grid gap-2 text-sm">
          {cfg.availableEvidence.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2">
              <span className="text-slate-300">{e.content}</span>
              <StatusPill
                status={e.uncertainty === "low" ? "ok" : "warn"}
                label={e.uncertainty}
              />
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <Dot color={TONE.warn} label="Missing" />
          <span className="text-xs text-slate-400">
            No measurable premium-positioning rule. The brief says premium, but nothing enforces it.
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-xs text-slate-400">AI assumption</h2>
        <p className="text-sm text-slate-300">{cfg.assumptionUnderTest}</p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-xs text-slate-400">Observed deviation</h2>
        <ul className="grid gap-1.5 text-sm">
          {deviations.map((d: Divergence, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mono-chip text-xs">{d.field}</span>
              <span className="text-slate-400">expected</span>
              <b className="text-slate-200">{String(d.expected)}</b>
              <span className="text-slate-400">observed</span>
              <b className="text-rose-300">{String(d.observed)}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xs text-slate-400 mb-2">Risk heat</h2>
        <div className="flex items-center gap-5">
          <div className="text-center">
            <HeatRing score={likelihoodScore} label="Likelihood" size={52} />
            <span className="block text-xs text-slate-400 mt-1">high (deterministic rule)</span>
          </div>
          <div className="text-center">
            <HeatRing score={impactScore} label="Impact" size={52} />
            <span className="block text-xs text-slate-400 mt-1">high (brand dilution)</span>
          </div>
        </div>
        <div className="mt-3">
          <BarChart items={controls} />
        </div>
        <div className="flex gap-4 text-xs mt-2">
          <Dot color={TONE.bad} label="Likelihood" />
          <Dot color={TONE.bad} label="Impact" />
          <Dot color={TONE.ok} label="Controls" />
        </div>
      </section>

      <section className="rounded-xl border border-sky-800/40 bg-sky-900/10 p-4">
        <h2 className="text-xs text-slate-400">Recommended control</h2>
        <ul className="list-disc list-inside text-sm text-slate-200 ml-1 space-y-1">
          {(packet.controlAnalysis?.wouldStop ?? ["Add a measurable premium-positioning boundary."]).map(
            (c, i) => <li key={i}>{c}</li>,
          )}
        </ul>
      </section>
    </>
  );
}
