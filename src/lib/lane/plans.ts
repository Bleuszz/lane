import type { PlanId } from "./types";

export type PlanDef = {
  id: PlanId;
  name: string;
  priceGbp: number;
  actions: number;
  aiCredits: number;
  accounts: number | "unlimited";
  channels: string;
  notes: string[];
};

export const PLAN_DEFS: Record<PlanId, PlanDef> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceGbp: 9,
    actions: 150,
    aiCredits: 0,
    accounts: "unlimited",
    channels: "Every supported marketplace",
    notes: ["150 publish-or-relist actions / month", "All supported connections", "Photo cleanup included", "No AI credits"],
  },
  seller: {
    id: "seller",
    name: "Seller",
    priceGbp: 19,
    actions: 600,
    aiCredits: 150,
    accounts: "unlimited",
    channels: "Every supported marketplace",
    notes: ["600 actions / month", "All supported connections", "150 AI credits / month", "Optional field autofill"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceGbp: 29,
    actions: 2000,
    aiCredits: 500,
    accounts: "unlimited",
    channels: "Every supported UK channel",
    notes: [
      "2,000 actions / month",
      "Unlimited accounts on supported channels",
      "CSV import/export",
      "500 AI credits / month", "Optional field autofill", "Photo cleanup included",
    ],
  },
};

export const AI_PACK_GBP = 5;

export function actionLimit(plan: PlanId): number {
  return PLAN_DEFS[plan].actions;
}

export function accountLimit(plan: PlanId): number | "unlimited" {
  return PLAN_DEFS[plan].accounts;
}

/** No payment details or AI provider calls are needed to try Lane. */
export const TRIAL_DAYS = 7;
export const TRIAL_ACTION_LIMIT = 25;
