# Dashboard Vision — Implementation Plan

## Purpose
Demonstrate AI governance / "cost of an unchecked assumption" as a **Monday.com-style workflow dashboard** over a bounded business scenario, while preserving the project's existing evidence-engine invariants (deterministic, tamper-evident, human-classification-gated export). This is a **safe vertical slice**: simulated fixtures, no real data, no credentials.

## Scenario (fictional)
An AI homepage-product-recommendation workflow is configured to **maximize add-to-cart**. An operator **red-lines** the rule to also enforce a **compliance minimum** (e.g., "organic snack products must retain ≥ 12% of homepage slots") before the day's run is approved. The dashboard walks an operator through 8 steps: define → observe → compare → risk-map → heat-score → summarize → sign-off → audit.

## Architecture decision (option a)
Build a **self-contained dashboard model** in `src/lib/bv/` (data model + deterministic scoring) and **re-use** the existing engine's provenance/hash primitives by re-implementing a minimal local hash chain inside `bv` (so the dashboard is decoupled from the bridge scenario and remains coherent if the scenario is ever removed). The two flows are **separate routes**:
- `/dashboard` — new primary workflow board (this work).
- `/` — existing retail-brand demo (preserved, still works).

## Step mapping (8-step board)
1. **Define workflow** — set `maximize` goal, `complianceMinimum` (red-line), budget/slots.
2. **Declared boundary** — the red-line rule as an explicit, named control.
3. **Observations** — simulated add-to-cart + composition metrics over N slots.
4. **Declared-vs-observed** — table diffing each slot against the boundary (green/yellow/red cells).
5. **Risk map (3×3)** — likelihood × impact grid of "what if the red-line erodes...".
6. **Heat score** — weighted aggregate (composition weight + add-to-cart weight) with live recalc.
7. **Executive summary** — one-sentence verdict + plain-language bullets.
8. **Sign-off + audit** — operator verdict + reason → export unlocked; append-only audit history.

## Key guarantees preserved
- **Deterministic**: all values derived from seed fixtures, no randomness at runtime.
- **Tamper-evident**: audit entries are hash-chained (SHA-256, `prevHash | canonical(payload)`).
- **Human-in-the-loop**: export blocked (HTTP 409) until a review is recorded.
- **Non-claims**: explicit panel listing what the simulation does NOT prove.

## Out of scope (explicitly)
- Real recommendations, real metrics, real customers, real compliance approval. All values are `SIMULATED FIXTURE`.
- Live chain/contract verification (no credentials); blockchain view shows synthetic hashes only.
