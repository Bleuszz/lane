import { AI_FIELDS, AI_OPERATIONS } from "../catalog.ts";
import type { AIProvider, AiInput, AiOutput, Suggestion } from "../types.ts";
export const mockProvider: AIProvider = {
  id: "mock",
  capabilities: () => ({
    listing: true,
    image: true,
    operations: Object.keys(AI_OPERATIONS) as AiInput["operation"][],
  }),
  healthCheck: async () => ({ available: true, developmentOnly: true }),
  estimateCost: () => ({ amount: 0, currency: "GBP" }),
  listingSuggestion: (input, context) => run(input, context, "listing"),
  imageTransform: (input, context) => run(input, context, "image"),
};
async function run(
  input: AiInput,
  context: Parameters<AIProvider["listingSuggestion"]>[1],
  family: string,
): Promise<unknown> {
  if (context.signal.aborted) throw Error("TIMEOUT");
  if (context.mode !== "SUCCESS" && context.mode !== "INVALID_OUTPUT") throw Error(context.mode);
  if (context.mode === "INVALID_OUTPUT") return { suggestions: "bad response" };
  const suggestions: Suggestion[] = AI_FIELDS.map((field) => {
    const known = input.fields[field];
    if (field === "title" || field === "description")
      return {
        field,
        value: `[MOCK] ${field === "title" ? "Improved listing title" : "Development description preview. No product facts were generated."}`,
        confidence: "low",
        evidence: "Development placeholder, not a factual recommendation.",
        safe: false,
      };
    return {
      field,
      value: null,
      confidence: "unknown",
      evidence:
        known.saved || known.source || known.user
          ? "Known value preserved; no change suggested."
          : "Cannot determine reliably. No image analysis was performed.",
      safe: false,
    };
  });
  const output: AiOutput = {
    mock: true,
    usage: { input: 0, output: 0, images: 0 },
    cost: { estimated: 0, actual: 0, currency: "GBP" },
  };
  return family === "listing"
    ? { ...output, suggestions }
    : {
        ...output,
        image: {
          kind: "development_placeholder",
          label: "AI PROVIDER NOT CONFIGURED — DEVELOPMENT PREVIEW",
        },
      };
}
