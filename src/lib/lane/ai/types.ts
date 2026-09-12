import type { AiField, AiOperation, MockMode } from "./catalog.ts";
export type FieldValue = { source: string | null; saved: string | null; user: string | null };
export type AiInput = {
  operation: AiOperation;
  fields: Record<AiField, FieldValue>;
  destination: "ebay_uk" | "vinted_uk";
  category: string;
  // Opaque local references only in mock mode; no account/session/private notes.
  photoIds: string[];
  settings: { ratio: string; scene: string; presentation: string; prompt: string };
};
export type Suggestion = {
  field: AiField;
  value: string | null;
  confidence: "high" | "medium" | "low" | "unknown";
  evidence: string;
  safe: boolean;
};
export type AiOutput = {
  mock: true;
  suggestions?: Suggestion[];
  image?: { kind: "development_placeholder"; label: string };
  usage: { input: number; output: number; images: number };
  cost: { estimated: number | null; actual: number | null; currency: string };
};
export interface AIProvider {
  readonly id: string;
  capabilities(): { listing: boolean; image: boolean; operations: AiOperation[] };
  healthCheck(): Promise<{ available: boolean; developmentOnly: boolean }>;
  estimateCost(input: AiInput, model: string): { amount: number | null; currency: string };
  listingSuggestion(
    input: AiInput,
    context: { model: string; mode: MockMode; signal: AbortSignal },
  ): Promise<unknown>;
  imageTransform(
    input: AiInput,
    context: { model: string; mode: MockMode; signal: AbortSignal },
  ): Promise<unknown>;
}
