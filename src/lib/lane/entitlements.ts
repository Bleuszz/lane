import { PLAN_DEFS, TRIAL_ACTION_LIMIT } from "./plans.ts";
import type { PlanId } from "./types.ts";

export function entitlements(input: {
  plan: PlanId; billingStatus: string; trialEndsAt: string | null;
  trialActionsUsed: number; actionsUsedMonth: number;
}, now = Date.now()) {
  const paid = input.billingStatus === "active";
  const trialActive = input.billingStatus === "trialing" && input.trialEndsAt !== null
    && Date.parse(input.trialEndsAt) > now;
  const limit = paid ? PLAN_DEFS[input.plan].actions : TRIAL_ACTION_LIMIT;
  const used = paid ? input.actionsUsedMonth : input.trialActionsUsed;
  return {
    paid, trialActive, canPublish: (paid || trialActive) && used < limit,
    actionsLimit: limit, actionsRemaining: paid || trialActive ? Math.max(0, limit - used) : 0,
    aiCreditsLimit: paid ? PLAN_DEFS[input.plan].aiCredits : 0,
    // Expiry never deletes data or prevents export, edits, or protective delisting.
    canManageInventory: true,
  };
}
