import type { PlanId } from "./types";

export type PlanDef = {
  id: PlanId;
  name: string;
  priceGbp: number;
  actions: number;
  accounts: number | "unlimited";
  channels: string;
  notes: string[];
};

export const PLAN_DEFS: Record<PlanId, PlanDef> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceGbp: 12,
    actions: 150,
    accounts: 2,
    channels: "Vinted UK + eBay UK",
    notes: ["150 publish-or-relist actions / month", "2 connected accounts"],
  },
  seller: {
    id: "seller",
    name: "Seller",
    priceGbp: 24,
    actions: 600,
    accounts: 6,
    channels: "Vinted, eBay, Depop, Facebook Marketplace",
    notes: ["600 actions / month", "6 accounts", "Depop + Facebook when those channels ship"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceGbp: 39,
    actions: 2000,
    accounts: "unlimited",
    channels: "Every supported UK channel",
    notes: [
      "2,000 actions / month",
      "Unlimited accounts on supported channels",
      "CSV import/export",
      "Autodelist SLA badge",
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
