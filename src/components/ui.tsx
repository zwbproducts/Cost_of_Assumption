import { type ReactNode, type ButtonHTMLAttributes } from "react";

export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between">
        <h2 className="font-semibold text-sky-300 mb-2">{title}</h2>
        {action}
      </div>
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

const SEV: Record<"ok" | "warn" | "bad", string> = {
  ok: "bg-emerald-900/30 text-emerald-300 border-emerald-800",
  warn: "bg-amber-900/30 text-amber-300 border-amber-800",
  bad: "bg-rose-900/30 text-rose-300 border-rose-800",
};

export function Badge({ tone, children }: { tone: "ok" | "warn" | "bad"; children: ReactNode }) {
  return <span className={`px-2 py-0.5 rounded text-xs border ${SEV[tone]}`}>{children}</span>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 border-b border-slate-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${value === t.id ? "border-sky-400 text-sky-300" : "border-transparent text-slate-400 hover:text-slate-200"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button className={`rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-2 font-medium text-sm ${className}`} {...rest}>
      {children}
    </button>
  );
}
