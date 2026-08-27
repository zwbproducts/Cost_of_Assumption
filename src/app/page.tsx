import Link from "next/link";

const ROLES: {
  name: string;
  view: string;
  icon: string;
  action: string;
  tone: "teal" | "amber" | "purple" | "sky" | "rose" | "indigo";
}[] = [
  { name: "Auditor", view: "board", icon: "📊", action: "Review the compliance audit trail", tone: "teal" },
  { name: "Manager", view: "risk", icon: "🎯", action: "Inspect and triage risks", tone: "amber" },
  { name: "Strategist", view: "heatmap", icon: "🔥", action: "Scan organisational heat", tone: "purple" },
  { name: "Executive", view: "summary", icon: "📈", action: "Read the verdict", tone: "sky" },
  { name: "Security Director", view: "audit", icon: "📜", action: "Approve sign-off & export", tone: "rose" },
  { name: "Engineer", view: "blockchain", icon: "⛓", action: "Inspect the evidence chain", tone: "indigo" },
];

const TONE_CLASSES = {
  teal: { dot: "bg-teal-500", ring: "ring-teal-200/60", card: "border-teal-200" },
  amber: { dot: "bg-amber-500", ring: "ring-amber-200/60", card: "border-amber-200" },
  purple: { dot: "bg-purple-500", ring: "ring-purple-200/60", card: "border-purple-200" },
  sky: { dot: "bg-sky-500", ring: "ring-sky-200/60", card: "border-sky-200" },
  rose: { dot: "bg-rose-500", ring: "ring-rose-200/60", card: "border-rose-200" },
  indigo: { dot: "bg-indigo-600", ring: "ring-indigo-200/60", card: "border-indigo-200" },
} as const;

export default function SplashPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center font-semibold tracking-wide text-amber-800 text-[11px]">
        SIMULATED FIXTURE - no real recommender, customers, or spend. All values are SIMULATED FIXTURES.
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Homepage Brand Choice</h1>
          <p className="text-slate-500 text-sm">A governance dashboard for an AI recommender that maximises add-to-cart.</p>
        </div>

        <nav aria-label="Role entry points" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLES.map((r) => {
            const tone = TONE_CLASSES[r.tone];
            return (
              <Link
                key={r.view}
                href={`/dashboard?view=${r.view}`}
                className={`group block rounded-2xl bg-white border ${tone.card} p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:ring-2 ${tone.ring} focus:outline-none focus:ring-2 focus:ring-sky-400`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{r.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-800 group-hover:text-sky-800">{r.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.action}</div>
                  </div>
                  <span className={`ml-auto h-3 w-3 rounded-full ${tone.dot}`} title={`${r.name} view`} />
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
          Each view is a recorded decision aid, not proof of safety. Export is blocked until a human signs off. See design notes.
        </div>
      </div>
    </main>
  );
}
