import Link from "next/link";

const CUSTOMERS = [
  {
    key: "john",
    emoji: "👨‍🔧",
    name: "John",
    type: "price-conscious shopper",
    assume: "Discount-driven. The AI assumed the cheapest valid placement was best.",
    href: "/journey?c=john",
  },
  {
    key: "mary",
    emoji: "🛍️",
    name: "Mary",
    type: "brand-loyal shopper",
    assume: "Values premium quality. The AI assumed premium mattered.",
    href: "/journey?c=mary",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-7">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-sky-300">Holiday Shelf Placement Choice</h1>
          <p className="text-slate-300 text-sm">
            Pick a shopper to see what the AI assumed, what it did, and what actually happened.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {CUSTOMERS.map((c) => (
            <Link key={c.key} href={c.href} className="block group">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center transition group-hover:border-sky-600 group-hover:bg-slate-900">
                <span className="text-3xl">{c.emoji}</span>
                <span className="font-medium text-slate-100">{c.name}</span>
                <span className="text-xs text-slate-400">{c.type}</span>
                <span className="text-xs text-slate-400">{c.assume}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="text-center pt-2">
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-sky-300 underline">
            Skip the journey → Business hub
          </Link>
        </div>
      </div>
    </main>
  );
}
