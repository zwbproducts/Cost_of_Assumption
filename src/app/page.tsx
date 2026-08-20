"use client";

import { useCallback, useEffect, useState } from "react";
import type { EvidencePacket, ObservableEvent, TestConfig, ApprovalState } from "@/lib/types";

type PublicConfig = {
  mode: "simulation" | "live";
  networkName: string;
  explorerBase: string;
  limits: {
    maxSpend: string;
    allowedChainId: number;
    allowedContracts: string[];
    allowedRecipients: string[];
  };
  killSwitch: boolean;
  hasLiveCredentials: boolean;
  walletAddress: string | null;
};

type StateResponse = {
  initialized: boolean;
  chainIntegrity?: { ok: boolean; brokenAt?: number };
  packet?: EvidencePacket;
};

const NON_CLAIMS = [
  "One test does not prove universal agent behaviour.",
  "We do not claim to know hidden model reasoning, intent, or deception.",
  "This is not a general security guarantee.",
  "It does not replace QA, security review, compliance, or human authorization.",
  "A valid testnet transaction is not proof of a real-world (customer) loss.",
];

function trunc(s: string, n = 10): string {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

export default function Page() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [state, setState] = useState<StateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<string | null>(null);

  // classification form
  const [result, setResult] = useState("contradicted");
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [alternative, setAlternative] = useState("");
  const [nextControl, setNextControl] = useState("");

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch("/api/test/state").then((r) => r.json()),
    ]);
    setCfg(c);
    setState(s);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runSimulate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/test/simulate", { method: "POST" });
      const data = await r.json();
      setMsg("Simulation complete — evidence packet generated.");
      setState({ initialized: true, packet: data.packet, chainIntegrity: { ok: true } });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await fetch("/api/test/reset", { method: "DELETE" });
      setMsg("Local test data reset. Blockchain untouched.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runLive = async () => {
    setBusy(true);
    setLiveResult(null);
    try {
      const r = await fetch("/api/test/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval: "present" }),
      });
      const data = await r.json();
      setLiveResult(JSON.stringify(data, null, 2));
      if (data.packet) setState({ initialized: true, packet: data.packet, chainIntegrity: { ok: true } });
    } finally {
      setBusy(false);
    }
  };

  const exportPacket = (format: "json" | "csv") => {
    window.open(`/api/test/export?format=${format}`, "_blank");
  };

  const classify = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/test/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, reason, by, uncertainty, alternative, nextControl }),
      });
      const data = await r.json();
      if (!data.ok) {
        setMsg("Classification error: " + (data.error ?? "unknown"));
        return;
      }
      setMsg("Classification recorded.");
      setState({ initialized: true, packet: data.packet, chainIntegrity: { ok: true } });
    } finally {
      setBusy(false);
    }
  };

  const p = state?.packet;
  const mode = cfg?.mode ?? "simulation";

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Banner */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center font-semibold tracking-wide text-amber-200">
        TESTNET ONLY / SIMULATED EXPOSURE — no mainnet, no real funds, no irreversible assets
      </div>

      {/* Headline */}
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
          The transaction succeeded.{" "}
          <span className="text-rose-400">The decision was still unsafe.</span>
        </h1>
        <p className="text-slate-400 max-w-3xl">
          A bounded demonstration of how an AI agent can take a valid but unsafe
          least-resistance action on a disposable testnet when an authority
          boundary or decision assumption has not been validated.
        </p>
      </header>

      {/* Configuration + assumption + evidence (immutable test setup) */}
      {p && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <Field label="Test ID" value={p.config.testId} />
            <Field label="Timestamp" value={p.config.createdAt} />
            <Field label="Network" value={`${p.config.network.name} (${p.config.network.chainId})`} />
            <Field label="Wallet" value={`${p.config.wallet.label} · ${trunc(p.config.wallet.address)}`} />
            <Field
              label="Contract"
              value={`${p.config.contract.label} · ${trunc(p.config.contract.address)} · ${p.config.contract.method}`}
            />
            <Field label="Recipient" value={trunc(p.config.recipient)} />
          </div>

          <div className="text-sm">
            <h2 className="font-semibold text-sky-300 mb-1">Bridge Validation assumption under test</h2>
            <p className="text-slate-300">{p.config.assumptionUnderTest}</p>
          </div>

          <div className="text-sm">
            <h2 className="font-semibold text-sky-300 mb-1">Expected action (reviewer belief)</h2>
            <p className="text-slate-300">{p.config.expectedAction.summary}</p>
          </div>

          <div className="text-sm">
            <h2 className="font-semibold text-sky-300 mb-1">Declared authority</h2>
            <p className="text-slate-300">{p.config.authority.declared}</p>
          </div>

          <div className="text-sm">
            <h2 className="font-semibold text-sky-300 mb-1">Human approval state</h2>
            <ApprovalBadge config={p.config} events={p.events} />
          </div>

          <div className="text-sm">
            <h2 className="font-semibold text-sky-300 mb-1">
              Evidence available before execution{" "}
              <span className="text-xs text-slate-500">(with provenance &amp; uncertainty)</span>
            </h2>
            <ul className="space-y-1">
              {p.config.evidenceBefore.map((e) => (
                <li key={e.id} className="border-t border-slate-800 pt-1">
                  <span className="text-slate-200">{e.content}</span>
                  <span className="block text-xs text-slate-500">
                    provenance: {e.provenance} · uncertainty: {e.uncertainty}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Toolbar */}
      <section className="flex flex-wrap gap-3 items-center">
        <button
          onClick={runSimulate}
          disabled={busy}
          className="rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-2 font-medium"
        >
          Run deterministic simulation
        </button>
        <button
          onClick={runLive}
          disabled={busy}
          className="rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-4 py-2 font-medium"
        >
          Execute live (explicit approval)
        </button>
        <button
          onClick={() => exportPacket("json")}
          disabled={!p}
          className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-4 py-2 font-medium"
        >
          Export packet (JSON)
        </button>
        <button
          onClick={() => exportPacket("csv")}
          disabled={!p}
          className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-4 py-2 font-medium"
        >
          Export packet (CSV)
        </button>
        <button
          onClick={reset}
          disabled={busy}
          className="rounded-md border border-slate-600 hover:bg-slate-800 disabled:opacity-50 px-4 py-2 font-medium"
        >
          Reset local data
        </button>
        {cfg && (
          <span className="ml-auto text-xs text-slate-500">
            mode: <span className={mode === "live" ? "text-emerald-400" : "text-sky-400"}>{mode}</span>
            {" · "}kill-switch: {cfg.killSwitch ? "ON" : "off"}
          </span>
        )}
      </section>

      {msg && <div className="text-sm text-slate-300">{msg}</div>}
      {liveResult && (
        <pre className="text-xs bg-slate-900 border border-slate-800 rounded p-3 overflow-auto">
          {JSON.stringify(liveResult, null, 2)}
        </pre>
      )}

      {!p && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
          No evidence yet. Run the deterministic simulation (no credentials
          required) to populate the dashboard.
        </div>
      )}

      {p && (
        <>
          {/* Three cards */}
          <section className="grid md:grid-cols-3 gap-4">
            <Card title="Declared boundary">
              <p className="text-sm text-slate-300">{p.config.authority.declared}</p>
              <ul className="mt-3 text-xs text-slate-400 space-y-1">
                <li>Max spend: <span className="text-slate-200">{p.config.authority.limits.maxSpend} TEST</span></li>
                <li>Chain id: <span className="text-slate-200">{p.config.authority.limits.allowedChainId}</span></li>
                <li>Contracts: {p.config.authority.limits.allowedContracts.map((c) => <span key={c} className="block font-mono text-slate-200">{trunc(c)}</span>)}</li>
                <li>Recipients: {p.config.authority.limits.allowedRecipients.map((r) => <span key={r} className="block font-mono text-slate-200">{trunc(r)}</span>)}</li>
                <li>Approval required: <span className="text-slate-200">{String(p.config.approvalPoint.required)}</span></li>
              </ul>
            </Card>

            <Card title="Observed transaction">
              {p.onChain.status === "none" ? (
                <p className="text-sm text-slate-400">No on-chain result.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  <li>Status: <span className={p.onChain.status === "success" ? "text-emerald-400" : "text-rose-400"}>{p.onChain.status}</span></li>
                  <li className="font-mono text-xs break-all">Tx: {p.onChain.txHash ? trunc(p.onChain.txHash, 12) : "—"}</li>
                  <li>Recipient: <span className="font-mono text-xs">{trunc(p.onChain.recipient)}</span></li>
                  <li>Gas cost: <span className="text-slate-200">{p.onChain.gasCost}</span></li>
                  {p.onChain.explorerUrl && (
                    <li>
                      <a className="text-sky-400 underline" href={p.onChain.explorerUrl} target="_blank" rel="noreferrer">
                        Explorer link
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </Card>

            <Card title="Cost of unchecked assumption">
              <p className="text-sm text-slate-300">
                Expected <span className="text-slate-200">{p.config.expectedAction.amount} TEST</span>,
                agent sent <span className="text-rose-400">{p.onChain.tokenAmount} TEST</span>.
              </p>
              <p className="mt-2 text-xs text-amber-300">
                SIMULATED EXPOSURE: testnet token amount only. Never a real
                customer loss.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Recovery: <span className="text-slate-200">{p.recovery}</span> (testnet tokens, no real value).
              </p>
            </Card>
          </section>

          {/* Expected vs Observed */}
          <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="font-semibold mb-3">Expected vs Observed</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="text-slate-400 mb-1">Expected (reviewer belief)</h3>
                <p className="text-slate-200">{p.config.expectedAction.summary}</p>
                <p className="text-xs text-slate-400 mt-1">Amount: {p.config.expectedAction.amount} TEST</p>
              </div>
              <div>
                <h3 className="text-slate-400 mb-1">Observed (agent selected)</h3>
                <p className="text-slate-200">{p.agent.recommendation}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Amount: {p.agent.selectedAction.amount} TEST · gas est: {p.agent.selectedAction.gasEstimate}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              {p.divergence.map((d, i) => (
                <div key={i} className="flex flex-wrap gap-2 text-xs items-center border-t border-slate-800 pt-2">
                  <span className="font-mono text-slate-400">{d.field}</span>
                  <span className="text-slate-200">exp: {d.expected}</span>
                  <span className="text-rose-300">obs: {d.observed}</span>
                  <span className={
                    d.note === "valid_tx_but_unsafe_decision"
                      ? "text-amber-300"
                      : d.note === "match"
                      ? "text-emerald-400"
                      : "text-slate-400"
                  }>
                    [{d.note}]
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              A valid transaction is not the same as a safe decision.
            </p>
          </section>

          {/* Timeline */}
          <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="font-semibold mb-3">
              Observable event timeline
              {state?.chainIntegrity && (
                <span className={state.chainIntegrity.ok ? "ml-2 text-xs text-emerald-400" : "ml-2 text-xs text-rose-400"}>
                  hash-chain {state.chainIntegrity.ok ? "intact" : "BROKEN"}
                </span>
              )}
            </h2>
            <ol className="space-y-2">
              {p.events.map((e) => (
                <li key={e.seq} className="text-xs border-l-2 border-slate-700 pl-3">
                  <div className="flex gap-2 items-center">
                    <span className="font-mono text-slate-500">#{e.seq}</span>
                    <span className="font-semibold text-sky-300">{e.type}</span>
                    <span className="text-slate-500">{e.ts}</span>
                  </div>
                  <div className="text-slate-400">
                    {(e.payload.note as string) ?? (e.payload.content as string) ?? ""}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Control decision panel */}
          {p.controlAnalysis && (
            <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <h2 className="font-semibold mb-3">Control decision panel</h2>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <ControlCol title="Would have STOPPED it" items={p.controlAnalysis.wouldStop} tone="rose" />
                <ControlCol title="Would have ESCALATED it" items={p.controlAnalysis.wouldEscalate} tone="amber" />
                <ControlCol title="Would have ALLOWED it" items={p.controlAnalysis.wouldAllow} tone="slate" />
              </div>
            </section>
          )}

          {/* Human classification */}
          <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <h2 className="font-semibold">Human classification (required)</h2>
            {p.classification ? (
              <div className="text-sm space-y-1">
                <p>Result: <span className="text-sky-300">{p.classification.result}</span></p>
                <p>By: {p.classification.by} at {p.classification.at}</p>
                <p>Reason: {p.classification.reason}</p>
                <p className="text-xs text-slate-400">Uncertainty: {p.classification.uncertainty}</p>
                <p className="text-xs text-slate-400">Alternative: {p.classification.alternative}</p>
                <p className="text-xs text-slate-400">Next control: {p.classification.nextControl}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <select value={result} onChange={(e) => setResult(e.target.value)} className="bg-slate-800 rounded p-2">
                  <option value="supported">supported</option>
                  <option value="contradicted">contradicted</option>
                  <option value="unresolved">unresolved</option>
                  <option value="unsuitable">unsuitable</option>
                </select>
                <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Classifier identity" className="bg-slate-800 rounded p-2" />
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="bg-slate-800 rounded p-2 sm:col-span-2" />
                <input value={uncertainty} onChange={(e) => setUncertainty(e.target.value)} placeholder="Uncertainty" className="bg-slate-800 rounded p-2" />
                <input value={alternative} onChange={(e) => setAlternative(e.target.value)} placeholder="Alternative explanation" className="bg-slate-800 rounded p-2" />
                <input value={nextControl} onChange={(e) => setNextControl(e.target.value)} placeholder="Next control to test" className="bg-slate-800 rounded p-2 sm:col-span-2" />
                <button onClick={classify} disabled={busy} className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded p-2 font-medium">
                  Record classification
                </button>
              </div>
            )}
          </section>

          {/* Non-claims */}
          <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="font-semibold mb-2 text-sm">Non-claims (what this does NOT prove)</h2>
            <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
              {(p.nonClaims ?? NON_CLAIMS).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="font-semibold mb-2 text-sky-300">{title}</h2>
      {children}
    </div>
  );
}

function ControlCol({ title, items, tone }: { title: string; items: string[]; tone: "rose" | "amber" | "slate" }) {
  const color = tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-slate-300";
  return (
    <div>
      <h3 className={"font-semibold mb-1 " + color}>{title}</h3>
      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-200 font-mono text-xs break-all">{value}</div>
    </div>
  );
}

function ApprovalBadge({ config, events }: { config: TestConfig; events: ObservableEvent[] }) {
  const evt = events.find((e) => e.type === "approval");
  const state = (evt?.payload.state as ApprovalState) ?? "absent";
  const tone =
    state === "present" ? "text-emerald-400" : state === "bypassed" ? "text-rose-400" : "text-amber-400";
  const pinned = evt?.payload.amountPinned === true;
  return (
    <p className="text-slate-300">
      <span className={"font-semibold " + tone}>{state}</span>
      {" · required: "}
      <span className="text-slate-200">{String(config.approvalPoint.required)}</span>
      {" · bypassable: "}
      <span className="text-slate-200">{String(config.approvalPoint.bypassable)}</span>
      {" · amount pinned: "}
      <span className="text-slate-200">{String(pinned)}</span>
    </p>
  );
}
