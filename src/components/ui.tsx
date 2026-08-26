import { type ReactNode, type ButtonHTMLAttributes } from "react";
import type { Severity } from "@/lib/bv/types";

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/50 p-4 ${className ?? ""}`}>
      {title ? <h2 className="font-semibold text-sky-300 mb-3">{title}</h2> : null}
      {children}
    </div>
  );
}

export function Qa({ q, a }: { q: string; a: string | ReactNode }) {
  return (
    <div className="py-1">
      <div className="text-slate-400 text-sm">{q}</div>
      <div className="text-slate-100">{a}</div>
    </div>
  );
}

export function Row({ label, value, tone = "ok" }: { label: string; value: string; tone?: "ok" | "bad" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-400" : tone === "warn" ? "text-amber-300" : "text-rose-400";
  return (
    <div className="flex justify-between border-b border-slate-800 pb-1">
      <span className="text-slate-400">{label}</span>
      <span className={"font-semibold " + color}>{value}</span>
    </div>
  );
}

const SEV_BG: Record<Severity, string> = {
  ok: "bg-emerald-900/25",
  warn: "bg-amber-900/25",
  bad: "bg-rose-900/25",
};
const SEV_TEXT: Record<Severity, string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-rose-300",
};

export function Badge({ tone, children, className }: { tone: Severity; children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={tone} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${SEV_BG[tone]} ${SEV_TEXT[tone]} border-white/5 ${className ?? ""}`}>
      {children}
    </span>
  );
}

export const STATUS_PILLS: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  bad: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  neutral: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  new: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
};

export function StatusPill({ status, label }: { status: string; label: ReactNode }) {
  const s = STATUS_PILLS[status] ?? STATUS_PILLS.neutral;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s}`}>{label}</span>;
}

export function Avatar({ name, initials }: { name: string; initials?: string }) {
  const init = initials ?? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hues = ["bg-indigo-400", "bg-rose-400", "bg-amber-400", "bg-emerald-400", "bg-sky-400", "bg-purple-400"];
  const color = hues[Math.abs(hashName(name)) % hues.length];
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-900 ${color}`} title={name}>
      {init}
    </div>
  );
}

export function SeverityIcon({ severity }: { severity: "ok" | "warn" | "bad" }) {
  if (severity === "ok") {
    return (
      <svg aria-hidden="true" className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="currentColor" aria-label="ok">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    );
  }
  const fill = severity === "warn" ? "currentColor" : "none";
  const circle = severity === "warn" ? "text-amber-400" : "text-rose-400";
  return (
    <svg aria-hidden="true" className={`w-3 h-3 ${circle}`} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" aria-label={severity === "warn" ? "warning" : "critical"}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="12" x2="12" y2="12.01" />
      {severity === "warn" ? <circle cx="12" cy="12" r="1" fill="currentColor" /> : null}
    </svg>
  );
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return h;
}

export function BoardTabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-700">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            value === t.id ? "bg-sky-50/10 text-sky-300 border-b-2 border-sky-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg bg-slate-900/30">
      <div className="text-slate-400 font-medium">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-5 bg-slate-800/60 rounded animate-pulse" style={{ width: `${80 - (i % 3) * 20}%` }} />
      ))}
    </div>
  );
}
