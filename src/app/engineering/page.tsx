"use client";

import { useCallback, useState, type ReactNode } from "react";
import { TestShell } from "@/components/TestShell";
import { ChainGraph } from "@/components/Vis";
import { classifyPacket, downloadExport, CLASSIFY_RESULTS } from "@/lib/loadTest";
import type { EvidencePacket, ClassificationResult } from "@/lib/types";
import { Badge, Button, StatusPill } from "@/components/ui";
import { useRouter } from "next/navigation";

export default function EngineeringPage() {
  return (
    <TestShell title="Engineering & audit">
      {(packet, refresh) => <Engineering packet={packet} refresh={refresh} />}
    </TestShell>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left text-xs text-slate-400 select-none"
        aria-expanded={open}
      >
        <span className="float-right text-xs text-slate-500">{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open ? <div className="mt-2 pt-2 border-t border-slate-800 space-y-3 text-sm">{children}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-mono break-all">{value ?? "—"}</span>
    </div>
  );
}

function ResetButton() {
  const router = useRouter();
  const onReset = useCallback(async () => {
    await fetch("/api/test/reset", { method: "DELETE" });
    router.replace("/");
  }, [router]);
  return (
    <button
      onClick={onReset}
      className="text-xs text-rose-400 hover:text-rose-300 border border-rose-800/40 rounded px-2 py-1"
    >
      Clear this test and return to start
    </button>
  );
}

function Engineering({ packet, refresh }: { packet: EvidencePacket; refresh: () => Promise<void> }) {
  const cfg = packet.config;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    result: "unresolved" as ClassificationResult,
    by: "",
    reviewerRole: "risk reviewer",
    reason: "",
    uncertainty: "",
    alternative: "",
    nextControl: "",
  });

  const onClassify = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      await classifyPacket({
        result: form.result,
        by: form.by,
        reviewerRole: form.reviewerRole,
        reason: form.reason,
        uncertainty: form.uncertainty,
        alternative: form.alternative,
        nextControl: form.nextControl,
      });
      await refresh();
      setStatus("Classification recorded.");
    } catch (e) {
      setStatus((e as Error)?.message ?? "Classification failed");
    } finally {
      setBusy(false);
    }
  }, [form, refresh]);

  const doExport = useCallback(async (format: "json" | "csv") => {
    setStatus(null);
    try {
      const blob = await downloadExport(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bridge-validation-${cfg.testId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded (${format}).`);
    } catch (e) {
      setStatus((e as Error)?.message ?? "Export failed");
    }
  }, [cfg.testId]);

  const selectedLabel =
    cfg.options.find((o) => o.id === cfg.selectedOptionId)?.label ?? cfg.selectedOptionId;
  const deviations = packet.divergence.filter((d) => d.note !== "match");

  return (
    <>
      <Section title="Test identity" defaultOpen>
        <Row label="Test ID" value={cfg.testId} />
        <Row label="Run ID" value={packet.runId} />
        <Row label="Mode" value={cfg.mode} />
        <Row label="Generated at" value={packet.generatedAt} />
      </Section>

      <Section title="Selected action &amp; result" defaultOpen>
        <Row label="Selected option" value={selectedLabel} />
        <Row label="Human intended" value={cfg.intendedPositioning} />
        <Row label="Matched intended" value={packet.divergence.find((d) => d.field === "placementOption")?.note === "match" ? "yes" : "no"} />
        <div className="mt-2 text-sm text-slate-300">{packet.observedResultSentence}</div>
        {deviations.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <Badge tone={d.note === "match" ? "ok" : "bad"}>{d.note}</Badge>
            <span className="text-slate-400">{d.field}</span>
            <span className="text-slate-400">expected</span> {String(d.expected)} <span className="text-slate-400">observed</span> {String(d.observed)}
          </div>
        ))}
      </Section>

      <Section title="Evidence chain" defaultOpen>
        <ChainGraph entries={packet.events} />
        <Row label="Chain integrity" value={packet.verification.ok ? "intact" : `BROKEN at ${packet.verification.brokenAt}`} />
        <Row label="On-chain result" value={packet.onChain.status} />
        <Row label="Synthetic fixture" value={packet.onChain.synthetic ? "yes (simulated, not verified on chain)" : "no"} />
        <Row label="Chain check note" value={packet.chainVerification.note} />
      </Section>

      <Section title="Selected action (full)">
        <Row label="Method" value={packet.agent.selectedAction.method} />
        <Row label="Amount / option" value={packet.agent.selectedAction.amount} />
        <Row label="Recipient" value={packet.agent.selectedAction.recipient} />
        <Row label="Gas estimate" value={packet.agent.selectedAction.gasEstimate} />
      </Section>

      <Section title="Evidence references">
        <div className="space-y-2">
          <div>
            <div className="text-xs text-slate-400">Human request</div>
            <div className="text-sm text-slate-300">{packet.decisionInput.request}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Approval text</div>
            <div className="text-sm text-slate-300">{packet.decisionInput.approvalText}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Available evidence</div>
            {packet.config.availableEvidence.map((e) => (
              <div key={e.id} className="flex gap-2 text-xs">
                <Badge tone="ok">{e.kind}</Badge>
                <span className="text-slate-300">{e.content}</span>
                <span className="text-slate-500">{e.uncertainty}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Provenance">
        <Row label="Agent provider" value={packet.agentProvenance.provider} />
        <Row label="Agent model" value={packet.agentProvenance.model} />
        <Row label="Agent role" value={packet.agentProvenance.role} />
        <Row label="Tested agent" value={packet.testedAgent.isDeterministicFixture ? "deterministic fixture" : "live"} />
        <div className="text-xs text-slate-400">{packet.testedAgent.note}</div>
      </Section>

      <Section title="Controls">
        <Row label="Would stop" value={packet.controlAnalysis.wouldStop.join(" | ")} />
        <Row label="Would escalate" value={packet.controlAnalysis.wouldEscalate.join(" | ")} />
        <Row label="Would allow" value={packet.controlAnalysis.wouldAllow.join(" | ")} />
        <div className="grid gap-1.5">
          {packet.negativeControls.map((nc) => (
            <div key={nc.id} className="flex items-center gap-2 text-xs">
              <Badge tone={nc.outcome === "passed" ? "ok" : nc.outcome === "blocked" ? "warn" : "bad"}>{nc.outcome}</Badge>
              <span className="text-slate-400">{nc.name}</span>
              <span className="text-slate-500">{nc.detail}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Hashes &amp; verification">
        <Row label="Packet hash" value={packet.packetHash} />
        <Row label="Verification rule" value={packet.verification.canonicalRule} />
        <Row label="Genesis-anchored" value={packet.events[0]?.prevHash === "0".repeat(64) ? "yes" : "no"} />
        <div className="grid gap-1 text-xs">
          {packet.events.map((e) => (
            <div key={e.seq} className="font-mono text-slate-400">
              #{e.seq} {e.type} → {e.hash.slice(0, 16)}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Claim &amp; non-claims">
        <div className="text-sm text-slate-300">{packet.claim}</div>
        <ul className="list-disc list-inside text-xs text-slate-400 ml-1">
          {packet.nonClaims.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </Section>

      <Section title="Reviewer classification &amp; export" defaultOpen>
        {packet.classification ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusPill
                status={packet.classification.result === "supported" ? "ok" : packet.classification.result === "contradicted" ? "bad" : "warn"}
                label={packet.classification.result}
              />
              <span className="text-xs text-slate-400">
                by {packet.classification.by} ({packet.classification.reviewerRole}) at {packet.classification.at}
              </span>
            </div>
            <Row label="Reason" value={packet.classification.reason} />
            <Row label="Uncertainty" value={packet.classification.uncertainty} />
            <Row label="Alternative" value={packet.classification.alternative} />
            {packet.classification.nextControl ? <Row label="Next control" value={packet.classification.nextControl} /> : null}
          </div>
        ) : (
          <div className="text-xs text-slate-400">Not classified. A human reviewer must classify before export.</div>
        )}

        <div className="grid gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              className="bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-100"
              placeholder="Reviewer name"
              value={form.by}
              onChange={(e) => setForm({ ...form, by: e.target.value })}
            />
            <select
              className="bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-100"
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value as ClassificationResult })}
            >
              {CLASSIFY_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <input
            className="bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-100"
            placeholder="Why this classification"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              className="bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-100"
              placeholder="Uncertainty"
              value={form.uncertainty}
              onChange={(e) => setForm({ ...form, uncertainty: e.target.value })}
            />
            <input
              className="bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-100"
              placeholder="Alternative explanation"
              value={form.alternative}
              onChange={(e) => setForm({ ...form, alternative: e.target.value })}
            />
          </div>
          <input
            className="bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-100"
            placeholder="Next control (optional)"
            value={form.nextControl}
            onChange={(e) => setForm({ ...form, nextControl: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={onClassify} disabled={busy || !form.by || !form.reason}>
              {busy ? "Saving…" : "Record classification"}
            </Button>
            <Button onClick={() => doExport("json")} disabled={busy}>JSON export</Button>
            <Button onClick={() => doExport("csv")} disabled={busy}>CSV export</Button>
          </div>
          {status ? <span className="text-slate-400">{status}</span> : null}
        </div>
      </Section>

      <Section title="Reset">
        <ResetButton />
      </Section>
    </>
  );
}
