# Splash & Role Entry Points — Design Notes

## Purpose
`src/app/page.tsx` is a **splash hub**, not documentation. It routes each persona to the
dashboard tab that serves them, with one-click clarity and no reading.

The verbose narrative that previously lived on the home page (the "what happened",
the decision question, and the non-claims) has been moved here into design notes so the
UI stays visual and at-a-glance.

## Scenario (what this simulates)
An AI homepage recommender is configured to **maximise add-to-cart**. A separate
compliance requirement mandates **at least 12% organic-snack share of home**.

The simulated run places **1 compliant organic slot** and **8 electronics slots**, so the
observed organic share is ~1.6% — a boundary breach. Everything in the dashboard is derived
from this single deterministic fixture.

## Decision question (moved from the home page)
> Did the agent choose what the brand permitted, or what the brand actually intended?

## Role -> tab mapping
| Persona | Tab (icon) | Why they enter there |
|---|---|---|
| Auditor | Audit trail (bar chart) | See the compliance audit trail: slot grid + issue board + boundary verdict |
| Manager | Risk map (target) | Triage the 3x3 likelihood/impact matrix and open issues |
| Strategist | Heatmap (fire) | Scan organisational heat across governance areas |
| Executive | Summary (chart upward) | One verdict, compliance bar, recommendation |
| Security Director | Sign-off (scroll) | Record the verdict that unlocks export |
| Engineer | Chain (chain link) | Inspect the hash-chained event log |

## Why a board per role
- **Auditors / Managers** need structured evidence and status lanes (kanban).
- **Strategists** need an aggregate RAG heat view, not line-by-line detail.
- **Executives** need a single verdict and a compliance trend.
- **Security Directors** need a gated sign-off form that blocks export until recorded.
- **Engineers** need tamper-evidence, not business prose.

## Invariant rules (unchanged)
- Deterministic engine: SHA-256 hash chain, genesis-anchored audit entries.
- Export is **blocked (HTTP 409)** until a human sign-off is recorded.
- All values are **simulated fixtures** — no real recommender, customers, or spend.
- Decision aids are **not proof** of safety or authorization; they must show uncertainty
  and a human review status.

## What this does NOT prove (non-claims)
- It does not predict real customer behaviour.
- It does not replace brand, merchandising, legal, compliance, or human approval.
- A "passing" simulation here is a recorded assertion, not authorization to ship.
