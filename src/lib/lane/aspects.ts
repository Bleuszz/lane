/** Shared destination-field rules. Marketplace data and model output are untrusted. */
export type AspectRule = {
  name: string;
  required: boolean;
  selectionOnly: boolean;
  multiple: boolean;
  maxLength: number;
  values: string[];
};
export type AspectValues = Record<string, string[]>;
export type AspectSuggestion = { name: string; value: string; evidence: string };

export function parseAspectRules(raw: unknown): AspectRule[] {
  if (!Array.isArray(raw)) throw new Error("eBay returned an invalid field schema.");
  return raw.flatMap((entry) => {
    if (!entry || typeof entry.localizedAspectName !== "string") return [];
    const c = entry.aspectConstraint ?? {};
    return [{
      name: entry.localizedAspectName,
      required: c.aspectRequired === true,
      selectionOnly: c.aspectMode === "SELECTION_ONLY",
      multiple: c.itemToAspectCardinality === "MULTI",
      maxLength: Number(c.aspectMaxLength) > 0 ? Number(c.aspectMaxLength) : 65,
      values: (Array.isArray(entry.aspectValues) ? entry.aspectValues : [])
        .map((v: { localizedValue?: unknown }) => v.localizedValue)
        .filter((v: unknown): v is string => typeof v === "string"),
    }];
  });
}

export function normalizeAspectValue(rule: AspectRule, value: string): string | null {
  const clean = value.trim();
  if (!clean || clean.length > rule.maxLength) return null;
  const known = rule.values.find((v) => v.toLowerCase() === clean.toLowerCase());
  return known ?? (rule.selectionOnly ? null : clean);
}

export function validateAspects(rules: AspectRule[], values: AspectValues): string[] {
  const errors: string[] = [];
  for (const rule of rules) {
    const supplied = (values[rule.name] ?? []).filter((v) => v.trim());
    if (rule.required && !supplied.length) errors.push(`${rule.name} is required by eBay.`);
    if (!rule.multiple && supplied.length > 1) errors.push(`${rule.name} accepts one value.`);
    if (supplied.some((v) => normalizeAspectValue(rule, v) === null)) errors.push(`Check the value for ${rule.name}.`);
  }
  return errors;
}

export function sourceAspects(item: { brand?: string | null; sizeUk?: string | null; colour?: string | null; material?: string | null; gender?: string | null; channelFields?: { ebay_uk?: { aspects: AspectValues } } }): AspectValues {
  const values: AspectValues = {};
  for (const [name, value] of Object.entries({ Brand: item.brand, Size: item.sizeUk, Colour: item.colour, Material: item.material })) {
    if (value?.trim()) values[name] = [value.trim()];
  }
  return { ...values, ...item.channelFields?.ebay_uk?.aspects };
}

export function acceptedSuggestions(raw: unknown, rules: AspectRule[], source: string, current: AspectValues): AspectSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const result: AspectSuggestion[] = [];
  for (const s of raw) {
    if (!s || typeof s.name !== "string" || typeof s.value !== "string" || typeof s.evidence !== "string") continue;
    const rule = rules.find((r) => r.name === s.name);
    if (!rule || current[s.name]?.some((v) => v.trim()) || result.some((r) => r.name === s.name)) continue;
    const value = normalizeAspectValue(rule, s.value);
    const evidence = s.evidence.trim();
    // This first version only extracts text-backed values. It does not infer hidden facts from images.
    if (!value || evidence.length < 2 || !source.toLowerCase().includes(evidence.toLowerCase())) continue;
    if (!evidence.toLowerCase().includes(value.toLowerCase())) continue;
    // Require a whole value and reject ambiguous/negated mentions, even when the
    // model quotes only the positive token from a negative sentence.
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mentions = [...source.matchAll(new RegExp(`\\b${escaped}\\b`, "gi"))];
    if (!mentions.length || mentions.some((m) => {
      const before = source.slice(Math.max(0, m.index! - 80), m.index!);
      const clause = before.split(/[.\n;:{}]/).at(-1) ?? "";
      return /\b(not|no|without|non|faux|fake|imitation|unknown|unsure|possibly|maybe)\b/i.test(clause);
    })) continue;
    result.push({ name: rule.name, value, evidence });
  }
  return result;
}

export function applySuggestions(current: AspectValues, suggestions: AspectSuggestion[]): AspectValues {
  const next = { ...current };
  for (const s of suggestions) if (!next[s.name]?.some((v) => v.trim())) next[s.name] = [s.value];
  return next;
}
