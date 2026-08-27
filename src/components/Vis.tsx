"use client";

import type { ObservableEvent } from "@/lib/types";

const ringColor = (score: number) => (score >= 66 ? "#ef4444" : score >= 33 ? "#f59e0b" : "#0d9488");

export function HeatRing({ score, label, size = 44, show = true }: { score: number; label: string; size?: number; show?: boolean }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = (size - 10) / 2;
  const c = Math.PI * r;
  const offset = c * (1 - pct / 100);
  const col = ringColor(pct);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label}: ${pct}%`} className="ring" focusable="false">
      <title>{`${label}: ${pct}%`}</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(31 41 55 / 0.6)" strokeWidth={size / 22} />
      {show && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={size / 22} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" className="fill-slate-200" fontSize={size / 4} fontWeight={700}>{Math.round(pct)}</text>
    </svg>
  );
}

export function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-slate-300">{label}</span>
    </span>
  );
}

const TYPE_COLOR: Record<string, string> = {
  tx_submit: "#ef4444",
  tx_receipt: "#ef4444",
  approval: "#f59e0b",
  policy_throttle: "#f59e0b",
  policy_check: "#38bdf8",
  agent_response: "#a78bfa",
  agent_request: "#64748b",
  tx_prepare: "#10b981",
  tool_call: "#fb923c",
  error: "#ef4444",
  default: "#64748b",
};

export function ChainGraph({ entries, height = 56 }: { entries: ObservableEvent[]; height?: number }) {
  const n = entries.length;
  if (!n) return <span className="text-xs text-slate-400">No events.</span>;
  const bw = 106;
  const bh = 36;
  const gap = 8;
  const pad = 12;
  const totalW = pad * 2 + n * bw + (n - 1) * gap;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${totalW} ${height + 8}`} role="img" aria-label="Evidence chain" className="w-full h-auto">
        <title>Evidence chain</title>
        {entries.map((a, i) => {
          const x = pad + i * (bw + gap);
          const col = TYPE_COLOR[a.type] ?? TYPE_COLOR.default;
          return (
            <g key={a.seq} transform={`translate(${x} 0)`} className="chain-node">
              <rect x={0} y={8} width={bw} height={bh} rx={6} fill="#0f172a" stroke={col} strokeWidth={2} />
              <rect x={0} y={8} width={bw} height={12} rx="6 6 0 0" fill={col} opacity={0.15} />
              <text x={6} y={20} className="fill-slate-300" fontSize={10} fontWeight={600}>#{a.seq}</text>
              <text x={6} y={33} className="fill-slate-400" fontSize={9}>{a.type}</text>
              {i < n - 1 && (
                <>
                  <line x1={bw} y1={24} x2={bw + gap} y2={24} stroke={col} strokeWidth={2} strokeLinecap="round" />
                  <polygon points={`${bw + gap - 1} 21 ${bw + gap + 3} 24 ${bw + gap - 1} 27`} fill={col} />
                </>
              )}
              <title>{`#${a.seq} ${a.type} · ${a.ts} · ${a.hash.slice(0, 10)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BarChart({ items, max }: { items: { label: string; value: number; color: string }[]; max?: number }) {
  const ceiling = max ?? Math.max(1, ...items.map((i) => i.value));
  const gap = 8;
  const barHeight = 10;
  const yStep = barHeight + gap;
  const totalH = Math.max(72, items.length * yStep + gap);
  const labelW = 140;
  const trackW = 200;
  return (
    <svg viewBox={`0 0 ${labelW + trackW + 40} ${totalH}`} role="img" aria-label="bar chart" className="w-full" preserveAspectRatio="xMidYMid meet">
      <title>Bar chart</title>
      {items.map((it, i) => {
        const w = (it.value / ceiling) * trackW;
        const y = i * yStep + gap;
        return (
          <g key={i} transform={`translate(0 ${y})`}>
            <title>{`${it.label}: ${it.value}`}</title>
            <text x={labelW - 6} y={barHeight / 2 + 3} textAnchor="end" className="fill-slate-300" fontSize={10} fontWeight={500}>{it.label}</text>
            <rect x={labelW} y={0} width={trackW} height={barHeight} rx={barHeight / 2} className="fill-slate-700/50" />
            <rect x={labelW} y={0} width={w} height={barHeight} rx={barHeight / 2} style={{ fill: it.color }} />
          </g>
        );
      })}
    </svg>
  );
}
