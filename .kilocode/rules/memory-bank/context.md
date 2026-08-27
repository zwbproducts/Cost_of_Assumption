# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] **Simplified persona routing + graphical chain evidence** (2026-08-27)
  - Splash role cards now use short, single-action labels (Auditor→"Review audit trail", Manager→"Triage risks", Strategist→"Scan heat", Executive→"Read verdict", Security Director→"Verify chain + sign-off", Engineer→"Inspect chain") with icon + colored status dot for clean, understandable entry.
  - Added a reusable graphical `ChainGraph` SVG component (horizontal blocks + arrows, color per action, hover tooltips with seq/actor/ts/hash) rendering the tamper-evident audit chain as a graphic — used in BOTH the Audit/sign-off view (so Security Directors see their blockchain evidence as a simple chain at a glance) and the Blockchain Evidence view.
  - Fixed `chain-node` hover CSS in `globals.css`; removed now-unused `Avatar` import from dashboard page; resolved `TONE_COLOR` key errors (`rose`/`indigo` → valid `Tone` keys).
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
- Added Business-Workflow Governance Dashboard (option a: reusable engine foundation)
  - New primary route `/dashboard` + API routes `/api/dashboard/{simulate,classify,export,state,reset}`
  - 8-step Monday.com-style board: define → boundary → observations → compare → risk map → heat score → summary → sign-off + audit
  - Scenario: AI homepage product recommendation maximizing add-to-cart vs compliance red-line (≥12% organic snack slots)
  - Filterable board with category/slot drill-down, heat-map scoring, 3×3 risk grid
  - Blockchain Evidence view (secondary) isolated from primary workflow; synthetic hashes only
  - Hash-chained audit trail (SHA-256, genesis-anchored, tamper-evident recompute)
  - Human sign-off gating export: classification required (unlocks export), 409 otherwise
  - 22 new dashboard tests (scoring, controls, risk-map, audit lineage, red-line, blockchain-view, hash-chain) — all green
  - Minimal determinism fix to `store.ts` `buildPacket` (`generatedAt` derived from deterministic event ts instead of live `new Date()`) restoring packet-hash stability
- Re-themed `/dashboard` to a Monday.com-style board:
  - Light enterprise SaaS aesthetic: soft-gray page bg, white rounded-2xl cards, subtle shadows, rounded group headers with colored dot + pill counter
  - Group columns (New / In review / Approved) with item cards, leading severity indicator bar, colored status pills, owner avatars
  - Board header with view switcher (Board / Risk map / Heatmap / Executive summary / Audit / Blockchain evidence) + filter bar, sticky with blur backdrop
  - Item cards: hover lift shadow, selection ring, focus ring, keyboard activation
  - Monday-style status pills (ok/warn/bad/blue/purple/new) + monochromatic `mono-chip` hashes
  - Blockchain Evidence isolated as a secondary view, NOT on the primary workflow path
  - `globals.css` uses plain CSS (no `@apply` on custom classes) for cross-build stability
  - Added `RiskIcon` to `src/components/ui.tsx`; local `Badge`/`StatusPill` in page with extended tone set
  - Export gating preserved (409 until sign-off); hash-chained audit trail intact
  - `eslint.config.mjs` ignores built artifacts (`.next`, `.open-next`)
- Visual polish applied (Monified): group headers with colored dot + pill count, leading severity border-left bars on item cards, metric-card hover lift, `mono-chip` artefact hashes

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

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
