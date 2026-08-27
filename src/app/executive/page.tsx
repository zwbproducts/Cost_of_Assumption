"use client";

import { TestShell } from "@/components/TestShell";
import { matchedIntended, TONE } from "@/lib/loadTest";
import type { EvidencePacket } from "@/lib/types";
import { StatusPill } from "@/components/ui";
import { Dot } from "@/components/Vis";

export default function ExecutivePage() {
  return (
    <TestShell title="Executive summary">{(packet) => <Executive packet={packet} />}</TestShell>
  );
}

function confidenceLevel(packet: EvidencePacket): "low" | "medium" | "high" {
  const evid = packet.config.availableEvidence;
  const high = evid.filter((e) => e.uncertainty === "high").length;
  if (high > 0) return "low";
  if (evid.every((e) => e.uncertainty === "low")) return "high";
  return "medium";
}

function Executive({ packet }: { packet: EvidencePacket }) {
  const ok = matchedIntended(packet);
  const conf = confidenceLevel(packet);
  const human = packet.classification?.result;
  const next = packet.classification?.nextControl;

  const confScore = conf === "high" ? 80 : conf === "medium" ? 50 : 20;
  const confColor = conf === "high" ? TONE.ok : conf === "medium" ? TONE.warn : TONE.bad;

  return (
    <>
      <section className={`rounded-xl border-2 p-6 text-center ${
        ok ? "border-emerald-800 bg-emerald-900/10" : "border-rose-800 bg-rose-900/10"
      }`}>
        <div className="text-xs text-slate-400 mb-1">Decision</div>
        <div className={`text-3xl font-extrabold ${ok ? "text-emerald-300" : "text-rose-300"}`}>
          {ok ? "Release approved" : "Do not release"}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-xs text-slate-400 mb-1">Business consequence</div>
        <p className="text-sm text-slate-200">
          {packet.observedResultSentence} The chosen placement is in scope and on budget but conflicts with the
          premium brand positioning set out in the brief.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Card label="Evidence confidence" value={conf} tone={confColor} note={`${confScore}%`} />
        <Card label="Human decision" value={human ? human : "Not reviewed"} tone={human ? TONE.ok : TONE.neutral} note="" />
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-xs text-slate-400 mb-1">Next action</div>
        <p className="text-sm text-slate-200">
          {next
            ? next
            : "Approve only placements that satisfy the premium-positioning rule. Re-review after a measurable" +
              " boundary is added."}
        </p>
      </section>
    </>
  );
}

function Card({ label, value, tone, note }: { label: string; value: string; tone: string; note: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-slate-100 mt-1">{value}</div>
      {note ? <div className="text-xs text-slate-500 mt-1">{note}</div> : null}
      <Dot color={tone} label="" />
    </div>
  );
}
