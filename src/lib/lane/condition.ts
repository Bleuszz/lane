import type { Condition } from "@/lib/lane/types";

export function conditionFromLabel(label: string | null | undefined): Condition {
  const n = (label ?? "").toLowerCase();
  if (n.includes("new without") || n.includes("never worn")) return "new_without_tags";
  if (/\bnew with\b/.test(n)) return "new_with_tags";
  if (n.includes("very good") || n.includes("excellent")) return "very_good";
  if (n.includes("satisf") || n.includes("accept") || n.includes("fair")) return "satisfactory";
  if (n === "good") return "good";
  return "unknown";
}
