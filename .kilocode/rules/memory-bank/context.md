# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] **Customer-first retail refactor** (2026-08-28)
  - `/` is now an interactive **shopper journey** (browse → bag → checkout → receipt) using the one selected placement; CTA → `/dashboard`.
  - `/dashboard` is the **business hub** with 4 audience buttons: Strategic / Risk / Executive / Engineering (each audience route has a Back-to-start link).
  - Removed the competing giant `/dashboard` board, `/api/dashboard/*`, and `src/lib/bv/*`; engine + 4 legacy tests kept intact.
  - Added `src/lib/loadTest.ts` (client: state → simulate, classify, export) + shared `TestShell`, `Vis` (`HeatRing`/`Dot`/`ChainGraph`/`BarChart`), `BackToStart`.
  - Information boundaries enforced: bridge/transaction wording (`recipient`, `contract`, `tx`) isolated to the engineering route and labelled simulated/synthetic; aligned `decision.ts`/`scenario.ts` prose to retail.
  - All green: typecheck, lint, next build SSG 9/9 pages, 54 tests.
  - Docs: rewrote `docs/SPLASH_DESIGN.md`, removed obsolete `docs/DASHBOARD.md`, pointer added to `docs/DESIGN.md`.
- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] Built "Bridge Validation: Cost of an Unchecked Assumption" MVP (safe vertical slice)
  - Deterministic simulation engine (no credentials) producing full evidence packet
  - Safety guards: spend cap, chain/contract/recipient allowlists, approval, kill switch
  - Append-only hash-chained event store (in-memory for tests, file-persisted singleton for app)
  - API routes: config, define, simulate, live (gated), classify, export, reset
  - Dashboard: banner, headline, 3 cards, config/assumption/evidence, timeline, expected-vs-observed, control panel, classification, export
  - Tests (bun test): spend cap, allowlists, duplicate execution, missing approval, kill switch, RPC failure, simulation safety, hash-chain integrity
  - Design doc at docs/DESIGN.md (threat model, data model, mermaid, scenario, assumptions, plan)
  - Live execution path gated behind guards + explicit approval + injected provider; no real signing backend wired yet (returns LIVE_NOT_CONFIGURED)
- [superseded 2026-08-28] The earlier competing Business-Workflow Governance Dashboard (the giant `/dashboard` board + `/api/dashboard/*` + `src/lib/bv/*`) was removed to prioritise the customer in the splash and restore a single source of truth. See the 2026-08-28 "Customer-first retail refactor" entry above.

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Customer-first shopper journey (splash) | ✅ Ready |
| `src/app/dashboard/page.tsx` | Business hub (4 audience buttons) | ✅ Ready |
| `src/app/strategic/page.tsx` | Strategic view | ✅ Ready |
| `src/app/risk/page.tsx` | Risk view | ✅ Ready |
| `src/app/executive/page.tsx` | Executive summary | ✅ Ready |
| `src/app/engineering/page.tsx` | Engineering & audit | ✅ Ready |
| `src/components/TestShell.tsx` | Shared loader + Back-to-start header | ✅ Ready |
| `src/components/Vis.tsx` | HeatRing / Dot / ChainGraph / BarChart | ✅ Ready |
| `src/components/ui.tsx` | Badge / Button / StatusPill / etc | ✅ Ready |
| `src/lib/loadTest.ts` | Client: state/simulate, classify, export + field helpers | ✅ Ready |
| `src/lib/*` | Legacy engine (types, store, scenario, simulation, decision, controls, safety, csv, hash, config) | ✅ Ready |
| `src/app/api/test/*` | Test routes (state/simulate/classify/export/define/live/reset) | ✅ Ready |
| `docs/SPLASH_DESIGN.md` | Customer-first structure + field mapping | ✅ Ready |
| Removed | `src/app/api/dashboard/*`, `src/lib/bv/*` (competing concept) | Removed |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-08-20 | Built Bridge Validation MVP: simulation-first safe vertical slice, safety guards, hash-chained store, dashboard, tests, design doc |
| 2026-08-26 | Monified `/dashboard` + `globals.css`: light Monday.com aesthetic, group-header dots, severity bars, status pills, print styles; rewritten `page.tsx` with board/risk/heatmap/summary/audit/blockchain views, local Badge/StatusPill, RiskIcon added to ui.tsx; all green (typecheck, lint, build, 84 tests) |
| 2026-08-26 | Colour-first UX: SVG `HeatRing` badges, `ColorKey` legend, severity-coloured leading bars + hover glow borders, metric hover pop; decision-aid kept text-light |
| 2026-08-26 | Visual-first rewrite: icon-only view tabs (tooltip), `SlotCanvas` 9-tile grid (colour-coded, violation dots, hover glow/scale) replacing slot table, SVG `HeatRing` gauges + `BarChart` SVG across views (governance heat, evidence/signals, compliance-vs-target), data-driven coloured group-column headers + leading severity bars with severity-tinted hover glow, tables & prose collapsed to short captions/icon legends |
| 2026-08-26 | Simplified all views: icon-only tooltip tabs (first tab renamed "Audit trail - compliance"), HeroCompliance card (big verdict + ring) on board, compact issue-board cards (severity dot + ring), SVG BarCharts everywhere, prose reduced to short captions |
| 2026-08-27 | Simplified ALL wording across the dashboard (wording sweep): shortened banner, HeroCompliance metric line, issue-board subtitle, slot aria-label/title, risk-item aria-label, RiskDetail caption (Decision aid · review), L×I label, RiskMapView subtitle, Recommendation, Non-claims→Limits, red-line banner, Export status, sign-off option labels (in/out of bounds), BlockchainView caption→"Chain evidence", ChainGraph tooltip (short hash tail). Role tab tooltips shortened. No logic change. All green: typecheck, lint, next build SSG 10/10, 84 tests |
| 2026-08-27 | Dashboard tabs now show a 1-word label + icon with a short tooltip (no eyestrain); `?view=` URL sync (`viewFromUrl`/`switchView`) so role links land on the right tab |
| 2026-08-27 | Moved home-page narrative into `docs/SPLASH_DESIGN.md` (scenario, decision question, role mapping, invariants, non-claims) |
| 2026-08-27 | Role-based splash hub (`src/app/page.tsx`): Auditor->board, Manager->risk, Strategist->heatmap, Executive->summary, Security Director->sign-off, Engineer->chain; each card icon + 1-line action linking `/dashboard?view=<id>` |
| 2026-08-27 | Added graphical `ChainGraph` SVG (horizontal blocks + arrows, colour per action, hover tooltips) to Audit/sign-off view (Security Directors see blockchain evidence as a simple chain) and Blockchain view; fixed `chain-node` hover CSS; dropped unused Avatar import |
| 2026-08-28 | Refactored to customer-first routing: `/` = interactive shopper journey; `/dashboard` = business hub with 4 audience buttons. Removed competing `/dashboard` board, `/api/dashboard/*`, `src/lib/bv/*`; kept legacy engine + 4 tests. Added `loadTest.ts`, `TestShell`, `Vis` components; enforced information boundaries (bridge/tx jargon only in engineering route, labelled simulated/synthetic); aligned `decision.ts`/`scenario.ts` prose to retail. All green: typecheck, lint, build 9/9, 54 tests |
