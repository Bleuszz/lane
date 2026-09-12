import { AI_ALLOWANCES, AI_OPERATIONS, type AiOperation } from "./catalog.ts";
export function aiConfig(env: Record<string, string | undefined> = process.env) {
  const configured = (name: string, defaults: Record<string, number>) => {
    const raw = env[name] ? JSON.parse(env[name]!) : {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("AI_CONFIG_INVALID");
    for (const [key, value] of Object.entries(raw))
      if (
        !Object.hasOwn(defaults, key) ||
        !Number.isSafeInteger(value) ||
        Number(value) < 0 ||
        Number(value) > 100000
      )
        throw Error("AI_CONFIG_INVALID");
    return { ...defaults, ...raw } as Record<string, number>;
  };
  const allowances = configured("AI_PLAN_ALLOWANCES_JSON", AI_ALLOWANCES);
  // Trial and Starter never acquire AI access through a pricing edit.
  allowances.trial = 0;
  allowances.starter = 0;
  return {
    listing: env.AI_LISTING_ENABLED === "true",
    image: env.AI_IMAGE_ENABLED === "true",
    development: env.AI_MOCK_DEVELOPMENT === "true" && env.LANE_ENV !== "production",
    textProvider: env.AI_TEXT_PROVIDER || env.AI_PROVIDER || "mock",
    imageProvider: env.AI_IMAGE_PROVIDER || env.AI_PROVIDER || "mock",
    textModel: env.AI_TEXT_MODEL || "mock-listing-v1",
    imageModel: env.AI_IMAGE_MODEL || "mock-image-v1",
    costs: configured(
      "AI_OPERATION_COSTS_JSON",
      Object.fromEntries(Object.entries(AI_OPERATIONS).map(([k, v]) => [k, v.credits])),
    ) as Record<AiOperation, number>,
    allowances,
  };
}
export type AiConfig = ReturnType<typeof aiConfig>;
