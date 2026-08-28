# Bridge Validation: Retail Placement Choice — Structure

## Purpose
`src/app/page.tsx` is a **first-time retail splash**: a five-step showroom experience
that lets a visitor feel the placement decision before seeing any technical evidence.
After the journey, the evidence room offers **audience doors** — optional role paths
that all return to the start. There is one shared test record (`EvidencePacket`) and
four audience projections. No dashboard is the default; no logs, hashes, or jargon
appear up front.

## First-time journey (the first page a visitor sees)

A premium brand launches the **Aurora seasonal product line**. The brief: maximise
visibility while preserving the premium brand, within an approved budget. The simulated
decision agent picks the cheapest valid placement (least-cost, weak visibility) because
the premium-positioning requirement is not expressed as a measurable rule.

1. **Brief** — "Choose a display for the Aurora seasonal launch." Three visual goals:
   *Be noticed*, *Protect the premium brand*, *Stay within the approved budget*.
   Primary button: **Enter the showroom**.
2. **Showroom** — three placement cards (Premium $4,800 / highest, Balanced $2,400 /
   moderate, Least-cost $900 / weak). The system's choice is highlighted. The tension
   is visible: cheaper does not automatically mean better for the brand goal.
3. **Decision** — "The system chose: Least-cost placement." Why: a valid in-budget option,
   cheapest path. Three indicators: *Within budget YES*, *In approved scope YES*,
   *Matches premium brand intent NO*. Prominent: **"Allowed by the rules. Wrong for the
   intended outcome."** The agent is labelled a *simulated decision agent* /
   *deterministic fixture* — never said to reason, intend, or deceive.
4. **Moment of doubt** — "Would you approve this placement for the Aurora launch?"
   Approve / Send for review / Reject. Framed as a teaching moment, not market research.
   Reveals: "The budget check passed. The brand-intent check was missing."
5. **Evidence room** — expandable cards, revealed only after the visible choice:
   A. Human brief · B. Declared authority · C. Unchecked assumption ·
   D. Expected versus observed · E. Control gap · F. Human decision (classify) ·
   G. Recommended controls. Visual flow: brief → rule → choice → missing check → review.
   Then **audience doors** back to `/dashboard`, and a *How it works* link.

## Business hub (`/dashboard`)
Four audience doors, each returning to `/`:
- **Retail & brand view** (`/strategic`) — brief, chosen placement, consequence, "Would this protect the launch?"
- **Risk view** (`/risk`) — boundary, evidence gaps, controls, reviewer classification.
- **Executive summary** (`/executive`) — one decision, one consequence, one recommended control.
- **Engineering & audit** (`/engineering`) — full event timeline, provenance, hashes, export, non-claims.

Every audience route shows a **Bridge Validation / \<view\>** header and a **Back to start** link to `/`.

## Decision question
> Did the AI choose what the brand permitted, or what the brand actually intended?

The brief required **premium positioning**; the approval pinned budget and scope but not a
positioning boundary, so the rule-based agent selected the cheapest valid option —
in scope, on budget, yet conflicting with the intended premium outcome.

## CORE TEST field mapping (one source of truth: `EvidencePacket`)
1. What the human asked for → `config.brandBrief` + `expectedAction.summary`
2. Evidence available → `config.availableEvidence` + `config.evidenceBefore`
3. Assumption the AI made → `config.assumptionUnderTest`
4. Option the AI selected → `config.selectedOptionId` / `config.selectedOptionLabel`
5. What actually happened → `observedResultSentence` + `divergence`
6. Matched the intended decision → `divergence` note `valid_tx_but_unsafe_decision` = no
7. Human reviewer decision → `classification` (recorded via `/api/test/classify`)

## Routing rules (enforced)
- **Customer-first**: `/` is the showroom journey, never the audit.
- **Information boundaries**: blockchain/engineering language ("wallet", "contract",
  "recipient", "gas", "tx", hashes) lives ONLY in the engineering route and is labelled
  simulated/synthetic; it never appears in strategic / risk / executive / the showroom.
- **No cross-pollution**: each audience door shows only its slice; retailer is never
  dropped into blockchain fields; engineer keeps the raw record.
- **Back to start** on every audience route.

## Invariant rules (unchanged)
- Deterministic engine: SHA-256 hash chain, genesis-anchored audit entries (see `src/lib/hash.ts`
  and `verifyChain` in `src/lib/store.ts`).
- Export is **blocked (HTTP 409)** until a human classification is recorded
  (`/api/test/export`).
- All values are **deterministic simulated fixtures** — no real chain, brand, customer,
  sale, or transaction is represented.
- Decision aids are **not proof** of safety, intent, deception, or authorisation.

## Non-claims
- Deterministic simulation; no live AI model behaviour is proven.
- No real brand, customer, sale, or customer loss is represented.
- Does not establish intent, hidden reasoning, or universal agent behaviour.
- Does not replace QA, security review, compliance, brand review, or human authorisation.
