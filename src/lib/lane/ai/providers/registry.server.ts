import { mockProvider } from "./mock.ts";
import type { AIProvider } from "../types.ts";
// Provider slots are intentionally unavailable. No SDK, key lookup or network client.
export const PROVIDER_SLOTS = ["mock", "openai", "google", "flux", "anthropic", "future"] as const;
export function providerFor(name: string): AIProvider {
  if (name !== "mock") throw Error("PROVIDER_UNAVAILABLE");
  return mockProvider;
}
