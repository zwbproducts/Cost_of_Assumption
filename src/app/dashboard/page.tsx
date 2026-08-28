import Link from "next/link";

const VIEWS = [
  { href: "/strategic", icon: "📊", label: "Strategic view", desc: "The business choice and what happened." },
  { href: "/risk", icon: "🎯", label: "Risk view", desc: "Boundary, evidence gaps, and controls." },
  { href: "/executive", icon: "📈", label: "Executive summary", desc: "One-page verdict and next decision." },
  { href: "/engineering", icon: "⛓", label: "Engineering & audit", desc: "Full evidence chain, hashes, and sign-off." },
];

export default function DashboardHub() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-7">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-sky-300">Bridge Validation</h1>
          <p className="text-slate-400 text-sm">
            After the customer journey, inspect the same choice through each role.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {VIEWS.map((v) => (
            <Link key={v.href} href={v.href} className="block group">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center transition group-hover:border-sky-600 group-hover:bg-slate-900">
                <span className="text-3xl">{v.icon}</span>
                <span className="font-medium text-slate-100">{v.label}</span>
                <span className="text-xs text-slate-400">{v.desc}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="pt-4">
          <Link href="/" className="text-xs text-slate-400 hover:text-sky-300 underline">
            Back to start
          </Link>
        </div>
      </div>
    </main>
  );
}
