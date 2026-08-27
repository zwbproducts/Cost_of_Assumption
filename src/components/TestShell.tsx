"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { EvidencePacket } from "@/lib/types";
import { loadTest, refetchTest } from "@/lib/loadTest";
import { LoadingState } from "@/components/ui";

export function BackToStart() {
  return (
    <Link href="/" className="text-xs text-slate-400 hover:text-sky-300 underline">
      Back to start
    </Link>
  );
}

export function TestShell({
  title,
  children,
}: {
  title: string;
  children: (packet: EvidencePacket, refresh: () => Promise<void>) => ReactNode;
}) {
  const [packet, setPacket] = useState<EvidencePacket | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadTest().then(
      (p) => {
        if (active) setPacket(p);
      },
      (e) => {
        if (active) setErr((e as Error)?.message ?? String(e));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    return refetchTest()
      .then(setPacket)
      .catch((e) => setErr((e as Error)?.message ?? String(e)));
  }, []);

  if (err) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <p className="text-rose-400">Could not load test: {err}</p>
      </main>
    );
  }
  if (!packet) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <LoadingState rows={5} />
        </div>
      </main>
    );
  }

  const banner =
    packet.mode === "simulation"
      ? "SIMULATED FIXTURE - no real spend, sample data only"
      : "LIVE MODE";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="text-center bg-slate-900/40 border-b border-slate-800 text-[10px] text-slate-400 py-1 font-mono">
        {banner}
      </div>
      <header className="border-b border-slate-800 px-4 py-3 max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs underline text-sky-300 hover:text-sky-200">
            Bridge Validation
          </Link>
          <span className="text-slate-600">/</span>
          <h1 className="text-sm font-medium text-sky-300">{title}</h1>
        </div>
        <BackToStart />
      </header>
      <div className="max-w-5xl mx-auto p-4 space-y-5">{children(packet, refresh)}</div>
    </main>
  );
}
