# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

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
