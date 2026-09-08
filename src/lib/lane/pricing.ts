import type { MarketplaceId, PricingRuleView } from "./types";

export function applyPricingRule(baseGbp: number, rule: PricingRuleView | undefined): number {
  if (!rule) return roundMoney(baseGbp);
  let next = baseGbp;
  switch (rule.kind) {
    case "flat":
      next = rule.amount ?? baseGbp;
      break;
    case "plus_amount":
      next = baseGbp + (rule.amount ?? 0);
      break;
    case "plus_percent":
      next = baseGbp * (1 + (rule.amount ?? 0) / 100);
      break;
    case "round_99":
      next = Math.floor(baseGbp) + 0.99;
      break;
    case "undercut":
      next = baseGbp - (rule.amount ?? 1);
      break;
  }
  return roundMoney(Math.max(0.01, next));
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ruleFor(
  rules: PricingRuleView[],
  marketplace: MarketplaceId,
): PricingRuleView | undefined {
  return rules.find((r) => r.marketplace === marketplace);
}
