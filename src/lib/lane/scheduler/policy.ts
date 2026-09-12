export const OPERATIONS = ["PUBLISH", "RELIST", "UPDATE", "DELIST", "PRICE_UPDATE"] as const;
export type Operation = (typeof OPERATIONS)[number];
export const MODES = ["MANUAL", "ASSISTED", "SCHEDULED", "AUTOMATIC"] as const;
export type QueueMode = (typeof MODES)[number];
export type Marketplace = "ebay_uk" | "vinted_uk";
export type Capability = "SUPPORTED" | "EXPERIMENTAL" | "MANUAL_ONLY" | "UNSUPPORTED";
export type Policy = {
  operations: Record<Operation, Capability>;
  automation: boolean;
  batch: boolean;
  imageNormalization: Capability;
  minSeconds: number;
  hourly: number;
  daily: number;
  batchSize: number;
};
export const SYSTEM_CAPS = {
  minSeconds: 60,
  maxSeconds: 3600,
  hourly: 30,
  daily: 100,
  batchSize: 50,
} as const;
// Operational ceilings for this Lane foundation, NOT marketplace-published limits.
const manual: Policy = {
  operations: {
    PUBLISH: "MANUAL_ONLY",
    RELIST: "MANUAL_ONLY",
    UPDATE: "MANUAL_ONLY",
    DELIST: "MANUAL_ONLY",
    PRICE_UPDATE: "MANUAL_ONLY",
  },
  automation: false,
  batch: false,
  imageNormalization: "EXPERIMENTAL",
  minSeconds: 300,
  hourly: 12,
  daily: 50,
  batchSize: 20,
};
export const MARKETPLACE_POLICIES: Record<Marketplace, Policy> = {
  ebay_uk: { ...manual, operations: { ...manual.operations } },
  vinted_uk: { ...manual, operations: { ...manual.operations } },
};
export function policyDenial(
  policy: Policy,
  operation: Operation,
  mode: QueueMode,
  count = 1,
): string | null {
  const support = policy.operations[operation];
  if (!support || support === "UNSUPPORTED") return "OPERATION_UNSUPPORTED";
  if (mode !== "MANUAL" && (support !== "SUPPORTED" || !policy.automation))
    return "AUTOMATION_NOT_VALIDATED";
  if (mode !== "MANUAL" && count > 1 && !policy.batch) return "BATCH_NOT_VALIDATED";
  return null;
}
