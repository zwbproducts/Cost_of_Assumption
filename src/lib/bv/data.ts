import type { SlotObservation } from "./types";

export const WORKFLOW_CONFIG = {
  id: "homepage-rec-v1",
  name: "Homepage Product Recommendation",
  goal: "Maximize add-to-cart rate on homepage slots.",
  complianceMinimum: {
    metric: "shareOfHome",
    operator: ">=",
    value: 12,
    description: "Organic snack products must retain at least 12% of homepage slots to comply with the marketing code of conduct.",
  },
  maximizeWeight: 0.6,
  compositionWeight: 0.4,
  slots: 9,
  redLineOwner: "Compliance Officer",
  redLineSetAt: "2026-08-26T14:00:00Z",
} as const;

export const SIMULATED_SLOTS: SlotObservation[] = [
  { slot: 1, category: "Electronics", expectedAdd: 42, actualAdd: 58, shareOfHome: 8.0, isCompliance: false, withinBoundary: true, delta: 0 },
  { slot: 2, category: "Electronics", expectedAdd: 38, actualAdd: 61, shareOfHome: 7.5, isCompliance: false, withinBoundary: true, delta: 0 },
  { slot: 3, category: "Electronics", expectedAdd: 35, actualAdd: 72, shareOfHome: 7.0, isCompliance: false, withinBoundary: true, delta: 0 },
  { slot: 4, category: "Electronics", expectedAdd: 40, actualAdd: 67, shareOfHome: 7.2, isCompliance: false, withinBoundary: true, delta: 0 },
  { slot: 5, category: "Snack (Organic)", expectedAdd: 18, actualAdd: 12, shareOfHome: 1.6, isCompliance: true, withinBoundary: false, delta: 0 },
  { slot: 6, category: "Electronics", expectedAdd: 33, actualAdd: 55, shareOfHome: 6.8, isCompliance: false, withinBoundary: true, delta: 0 },
  { slot: 7, category: "Electronics", expectedAdd: 36, actualAdd: 63, shareOfHome: 7.1, isCompliance: false, withinBoundary: true, delta: 0 },
  { slot: 8, category: "Electronics", expectedAdd: 39, actualAdd: 69, shareOfHome: 7.4, isCompliance: false, withinBoundary: true, delta: 0 },
  { slot: 9, category: "Electronics", expectedAdd: 34, actualAdd: 51, shareOfHome: 6.9, isCompliance: false, withinBoundary: true, delta: 0 },
];

export function isTodayISO(): string {
  return new Date().toISOString();
}
