"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { loadTest, selectedOption, intendedOption, matchedIntended, TONE } from "@/lib/loadTest";
import type { EvidencePacket, RetailOption, Divergence } from "@/lib/types";
import { Badge, Button, LoadingState } from "@/components/ui";
import { HeatRing, Dot } from "@/components/Vis";

type Step = "brief" | "showroom" | "decision" | "doubt" | "evidence";

export default function Home() {
  const [packet, setPacket] = useState<EvidencePacket | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("brief");

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
        <p className="text-rose-400">Could not load scenario: {err}</p>
      </main>
    );
  if (!packet)
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <div className="max-w-xl w-full">
          <LoadingState rows={5} />
        </div>
      </main>
    );

  const selected = selectedOption(packet);
  const intended = intendedOption(packet);
  const matched = matchedIntended(packet);
  const cfg = packet.config;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-6">
        <header className="text-center space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            SIMULATED FIXTURE - no real transactions, sample data only
          </div>
          <h1 className="text-2xl font-bold text-sky-300">Aurora seasonal launch</h1>
        </header>

        <nav aria-label="Journey progress" className="flex justify-center gap-2 text-xs text-slate-400">
          <ProgressDot active={step === "brief"} label="Brief" />
          <ProgressDot active={step === "showroom"} label="Showroom" />
          <ProgressDot active={step === "decision"} label="Decision" />
          <ProgressDot active={step === "doubt"} label="Review" />
          <ProgressDot active={step === "evidence"} label="Evidence" />
        </nav>

        {step === "brief" && selected && intended && (
          <Brief
            onNext={() => setStep("showroom")}
            selected={selected}
            intended={intended}
            budget={cfg.authority.limits.maxSpend}
          />
        )}
        {step === "showroom" && selected && (
          <Showroom options={cfg.options} selected={selected} onNext={() => setStep("decision")} />
        )}
        {step === "decision" && selected && intended && (
          <DecisionView
            selected={selected}
            intended={intended}
            matched={matched}
            divergence={packet.divergence}
            budget={cfg.authority.limits.maxSpend}
            onNext={() => setStep("doubt")}
          />
        )}
        {step === "doubt" && <DoubtView matched={matched} onNext={() => setStep("evidence")} />}
        {step === "evidence" && selected && intended && (
          <EvidenceRoom
            packet={packet}
            selected={selected}
            intended={intended}
            matched={matched}
          />
        )}

        {step !== "brief" && step !== "evidence" && (
          <div className="text-center">
            <button
              onClick={() => setStep("brief")}
              className="text-xs text-slate-400 hover:text-sky-300 underline"
            >
              Back to brief
            </button>
          </div>
        )}
      </div>

      <footer className="mt-8 text-center text-[10px] text-slate-500">
        <p>The simulated decision agent follows a fixed rule, not autonomous brand reasoning.</p>
        <p>This is a deterministic simulation; it does not replace QA, brand review, or human approval.</p>
      </footer>
    </main>
  );
}

function ProgressDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active ? "bg-sky-400 ring-2 ring-sky-400/30" : "bg-slate-700"
        }`}
        aria-hidden="true"
      />
      <span className={active ? "text-slate-200" : "text-slate-500"}>{label}</span>
    </span>
  );
}

function Brief({
  onNext,
  selected,
  intended,
  budget,
}: {
  onNext: () => void;
  selected: RetailOption;
  intended: RetailOption;
  budget: string;
}) {
  return (
    <section aria-labelledby="brief-heading" className="space-y-6 text-center">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-rose-400">Bridge Validation</p>
        <h2 id="brief-heading" className="text-xl font-semibold leading-snug text-slate-100">
          An AI-assisted retail decision can follow the visible rules and still undermine the
          intended customer experience.
        </h2>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-left space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">The buyer problem</p>
          <p className="text-sm text-slate-300 mt-1">
            A premium brand launched the <strong className="text-slate-100">Aurora seasonal line</strong> and
            asked an AI-assisted system to place it. The brief: maximise visibility, protect the premium
            brand, stay within the approved budget.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
          <Pillar icon="👀" label="Be noticed" />
          <Pillar icon="🛡️" label="Protect the premium brand" />
          <Pillar icon="💰" label="Stay within budget" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <IntentCard
            title="What the retailer wanted"
            label={intended.label}
            detail={`${intended.visibility} visibility · ${intended.positioning}`}
            tone="ok"
          />
          <IntentCard
            title="What the system chose"
            label={selected.label}
            detail={`${selected.visibility} visibility · ${selected.positioning}`}
            tone="bad"
            tag="Least-cost · back corner"
          />
        </div>

        <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-amber-200">
            It passed the formal checks. It failed the commercial intent.
          </p>
          <p className="text-xs text-amber-200/80">
            Within budget ({selected.cost} of {budget} cap) <Dot color={TONE.ok} label="yes" /> · In approved
            scope <Dot color={TONE.ok} label="yes" /> · Matches premium intent{" "}
            <Dot color={TONE.bad} label="no" />
          </p>
          <p className="text-xs text-slate-400 pt-1">
            The evidence gap: premium positioning was in the brief but was never expressed as a measurable
            minimum, so the cheapest valid option was selected.
          </p>
        </div>
      </div>

      <Button onClick={onNext} aria-label="Enter the showroom">
        See the placement in the showroom
      </Button>
    </section>
  );
}

function Pillar({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 py-3">
      <div className="text-xl">{icon}</div>
      <div className="text-xs text-slate-300 mt-1">{label}</div>
    </div>
  );
}

function IntentCard({
  title,
  label,
  detail,
  tone,
  tag,
}: {
  title: string;
  label: string;
  detail: string;
  tone: "ok" | "bad";
  tag?: string;
}) {
  const ring = tone === "ok" ? "border-emerald-700/50" : "border-rose-700/50";
  const dot = tone === "ok" ? TONE.ok : TONE.bad;
  return (
    <div className={`rounded-lg border ${ring} bg-slate-950 p-3 text-left`}>
      <p className="text-xs text-slate-400">{title}</p>
      <p className="text-sm font-semibold text-slate-100 mt-1">{label}</p>
      <p className="text-xs text-slate-400">{detail}</p>
      {tag ? <p className="text-[10px] text-rose-300 mt-1">{tag}</p> : null}
      <div className="mt-1">
        <Dot color={dot} label={tone === "ok" ? "intended" : "chosen"} />
      </div>
    </div>
  );
}

function Showroom({
  options,
  selected,
  onNext,
}: {
  options: RetailOption[];
  selected: RetailOption;
  onNext: () => void;
}) {
  return (
    <section aria-labelledby="showroom-heading" className="space-y-5">
      <h2 id="showroom-heading" className="text-lg font-semibold text-slate-100">Showroom</h2>
      <p className="text-xs text-slate-400">
        A simulated placement agent will pick the cheapest option that satisfies the rules below.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {options.map((o) => {
          const chosen = o.id === selected.id;
          return (
            <div
              key={o.id}
              className={`relative rounded-xl border p-4 text-center transition ${
                chosen
                  ? "border-amber-400/50 bg-slate-900 ring-2 ring-amber-400/30"
                  : "border-slate-800 bg-slate-950"
              }`}
              aria-label={`${o.label}, ${o.visibility} visibility, ${o.cost}. ${chosen ? "Selected by the system" : "Not selected"}`}
            >
              <div className="text-3xl mb-2">{o.id === "premium" ? "🏆" : o.id === "balanced" ? "⚖️" : "📍"}</div>
              <div className="font-medium text-slate-100">{o.label}</div>
              <div className="text-xs text-slate-400 mt-1">{o.visibility} visibility</div>
              <div className="text-sm font-semibold text-sky-300 mt-1">{o.cost}</div>
              <div className="text-xs text-slate-400 mt-1">Positioning: {o.positioning}</div>
              {chosen ? (
                <Badge tone="warn" className="absolute top-2 right-2">
                  System chose this
                </Badge>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="text-center text-xs text-slate-400">
        The cheaper option is valid, but cheaper does not automatically mean better for the brand goal.
      </div>
      <div className="flex justify-center">
        <Button onClick={onNext} aria-label="Reveal the decision">
          Reveal the decision
        </Button>
      </div>
    </section>
  );
}

function DecisionView({
  selected,
  intended,
  matched,
  divergence,
  budget,
  onNext,
}: {
  selected: RetailOption;
  intended: RetailOption;
  matched: boolean;
  divergence: Divergence[];
  budget: string;
  onNext: () => void;
}) {
  const budgetOk = divergence.find((d) => d.field === "budget")?.note === "match";
  return (
    <section aria-labelledby="decision-heading" className="space-y-5">
      <h2 id="decision-heading" className="text-lg font-semibold text-slate-100">The decision</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center space-y-4">
        <div>
          <span className="text-xs text-slate-400">The system chose</span>
          <div className="text-xl font-bold text-amber-300 mt-1">{selected.label}</div>
        </div>
        <p className="text-sm text-slate-300">
          It found a valid option within the approved budget and selected the cheapest available path, rather
          than the option that best served the brand goal.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
          <DecisionIndicator label="Within budget" value={budgetOk ? "YES" : "NO"} tone={budgetOk ? "ok" : "bad"} />
          <DecisionIndicator label="In approved scope" value="YES" tone="ok" />
          <DecisionIndicator
            label="Matches premium brand intent"
            value={matched ? "YES" : "NO"}
            tone={matched ? "ok" : "bad"}
          />
        </div>

        <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 px-4 py-3">
          <p className="font-medium text-amber-200">Allowed by the rules. Wrong for the intended outcome.</p>
        </div>
        <div className="text-xs text-slate-400">
          Intended placement: <span className="text-slate-200">{intended.label}</span> · Budget cap:{" "}
          <span className="text-slate-200">{budget} USD</span>
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">
        The agent is a deterministic fixture, not an autonomous decision-maker.
      </p>
      <div className="flex justify-center pt-2">
        <Button onClick={onNext} aria-label="Continue to review">
          Continue to review
        </Button>
      </div>
    </section>
  );
}

function DecisionIndicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad";
}) {
  const ring = tone === "ok" ? "ring-emerald-400/30" : "ring-rose-400/30";
  const bg = tone === "ok" ? "bg-emerald-900/15" : "bg-rose-900/15";
  const fg = tone === "ok" ? "text-emerald-300" : "text-rose-300";
  return (
    <div className={`rounded-xl border border-current ${bg} ring-2 ${ring} p-3`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-lg font-bold ${fg}`}>{value}</div>
    </div>
  );
}

function DoubtView({ matched, onNext }: { matched: boolean; onNext: () => void }) {
  const [answered, setAnswered] = useState<string | null>(null);
  return (
    <section aria-labelledby="doubt-heading" className="space-y-5">
      <h2 id="doubt-heading" className="text-lg font-semibold text-slate-100">Moment of doubt</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center space-y-4">
        <p className="font-medium text-slate-100">Would you approve this placement for the Aurora launch?</p>
        {!matched && (
          <p className="text-xs text-slate-400">This is an interactive teaching moment, not a stored market study.</p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <OptionButton label="Approve" value="approved" chosen={answered} set={setAnswered} tone="ok" />
          <OptionButton label="Send for review" value="review" chosen={answered} set={setAnswered} tone="warn" />
          <OptionButton label="Reject" value="rejected" chosen={answered} set={setAnswered} tone="bad" />
        </div>

        {answered && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/30 px-4 py-3">
            <p className="text-sm text-slate-200">The budget check passed.</p>
            <p className="text-sm text-rose-300">The brand-intent check was missing.</p>
          </div>
        )}
      </div>
      <div className="flex justify-center">
        <Button onClick={onNext} disabled={!answered} aria-label="Show me why">
          Show me why
        </Button>
      </div>
    </section>
  );
}

function OptionButton({
  label,
  value,
  chosen,
  set,
  tone,
}: {
  label: string;
  value: string;
  chosen: string | null;
  set: (v: string) => void;
  tone: "ok" | "warn" | "bad";
}) {
  const active = chosen === value;
  const ring =
    tone === "ok" ? "ring-emerald-400/40" : tone === "warn" ? "ring-amber-400/40" : "ring-rose-400/40";
  return (
    <button
      type="button"
      onClick={() => set(value)}
      className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
        active
          ? `${ring} ring-2 bg-slate-800 text-slate-100`
          : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

function EvidenceRoom({
  packet,
  selected,
  intended,
  matched,
}: {
  packet: EvidencePacket;
  selected: RetailOption;
  intended: RetailOption;
  matched: boolean;
}) {
  return (
    <section aria-labelledby="evidence-heading" className="space-y-4">
      <h2 id="evidence-heading" className="text-lg font-semibold text-slate-100">Evidence room</h2>
      <p className="text-xs text-slate-400">
        The visible choice mapped to the underlying test record ({packet.config.testId}).
      </p>

      <EvidenceCard title="A. Human brief" tone="ok">
        {packet.config.brandBrief}
      </EvidenceCard>

      <EvidenceCard title="B. Declared authority" tone="ok">
        {packet.config.authority.declared}
      </EvidenceCard>

      <EvidenceCard title="C. Unchecked assumption" tone="warn">
        {packet.config.assumptionUnderTest}
      </EvidenceCard>

      <EvidenceCard title="D. Expected versus observed" tone={matched ? "ok" : "bad"}>
        <ul className="grid gap-1.5">
          <li>
            Expected: <b>{intended.label}</b> ({intended.positioning}) — intended premium positioning.
          </li>
          <li>
            Observed: <b>{selected.label}</b> ({selected.positioning}) — the chosen placement.
          </li>
          {packet.divergence
            .filter((d) => d.note !== "match")
            .map((d, i) => (
              <li key={i} className="text-sm">
                <span className="text-slate-400">{d.field}:</span> expected <b>{String(d.expected)}</b>, observed{" "}
                <b className="text-rose-300">{String(d.observed)}</b>
              </li>
            ))}
        </ul>
      </EvidenceCard>

      <EvidenceCard title="E. Control gap" tone="bad">
        <ul className="list-disc list-inside">
          <li>Budget and approved scope were checked.</li>
          <li>Premium positioning was not expressed as a measurable minimum, so it was not enforced.</li>
        </ul>
      </EvidenceCard>

      <EvidenceCard title="F. Human decision" tone={packet.classification ? "ok" : "warn"}>
        {packet.classification ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge tone="ok">{packet.classification.result}</Badge>
              <span className="text-slate-300">
                by {packet.classification.by} ({packet.classification.reviewerRole})
              </span>
            </div>
            <p className="text-sm text-slate-300">{packet.classification.reason}</p>
            <p className="text-xs text-slate-400">
              Uncertainty: {packet.classification.uncertainty} · Next control:{" "}
              {packet.classification.nextControl || "-"}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">Not yet classified.</p>
            <Link href="/engineering" className="text-sky-300 hover:underline text-sm">
              Classify this outcome
            </Link>
          </div>
        )}
      </EvidenceCard>

      <EvidenceCard title="G. Recommended controls" tone="ok">
        <ul className="list-disc list-inside">
          {(packet.controlAnalysis.wouldStop || [
            "Add a measurable premium-positioning boundary (e.g. must be Premium or Balanced).",
          ]).map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </EvidenceCard>

      <div className="space-y-3 pt-3">
        <h3 className="text-center text-sm font-semibold text-slate-200">Where would you like to go next?</h3>
        <div className="flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-500 px-6 py-3 text-base font-semibold text-white border border-sky-500"
          >
            Explore the evidence in depth
          </Link>
        </div>
        <div className="flex justify-center gap-4 text-xs">
          <Link href="/" className="text-slate-400 hover:text-sky-300 underline">
            Back to start
          </Link>
          <a
            href="https://github.com/zwbproducts/Cost_of_Assumption"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-sky-300 underline"
          >
            How it works
          </a>
        </div>
      </div>
      <div className="flex justify-center gap-4 pt-2">
        <HeatRing score={matched ? 10 : 90} label="Result" size={44} />
        <Dot color={matched ? TONE.ok : TONE.bad} label={matched ? "on brief" : "off brief"} />
      </div>
    </section>
  );
}

function EvidenceCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "ok" | "warn" | "bad";
  children: ReactNode;
}) {
  const titleClass =
    tone === "ok"
      ? "text-sky-300"
      : tone === "warn"
        ? "text-amber-300"
        : "text-rose-300";
  const borderClass =
    tone === "ok"
      ? "border-t border-sky-800/40"
      : tone === "warn"
        ? "border-t border-amber-800/40"
        : "border-t border-rose-800/40";
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm open:bg-slate-900">
      <summary className={`cursor-pointer list-none font-medium ${titleClass}`}>{title}</summary>
      <div className={`mt-2 pt-2 ${borderClass}`}>
        <div className="space-y-2 text-slate-300">{children}</div>
      </div>
    </details>
  );
}
