import { env } from "@/lib/env.server";
import { ebayEnv } from "./secret";
import { parseAspectRules, type AspectRule } from "../aspects";

const cache = new Map<string, { expires: number; rules: AspectRule[] }>();

export async function ebayAspectRules(categoryId: string): Promise<AspectRule[]> {
  if (!/^\d+$/.test(categoryId)) throw new Error("Choose a valid eBay category first.");
  const mode = ebayEnv();
  const key = `${mode}:${categoryId}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.rules;
  const clientId = env("EBAY_CLIENT_ID");
  const secret = env("EBAY_CLIENT_SECRET");
  if (!clientId || !secret) throw new Error("eBay field lookup is not configured yet. Your draft can still be saved.");
  const origin = mode === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const tokenResponse = await fetch(`${origin}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error(`eBay field lookup authorization failed (${tokenResponse.status}).`);
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error("eBay did not return a field lookup token.");
  const headers = { Authorization: `Bearer ${token.access_token}`, "Accept-Language": "en-GB" };
  const treeResponse = await fetch(`${origin}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_GB`, { headers, signal: AbortSignal.timeout(15000) });
  if (!treeResponse.ok) throw new Error(`eBay category lookup failed (${treeResponse.status}).`);
  const tree = await treeResponse.json() as { categoryTreeId?: string };
  if (!tree.categoryTreeId) throw new Error("eBay did not return a UK category tree.");
  const response = await fetch(`${origin}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(tree.categoryTreeId)}/get_item_aspects_for_category?category_id=${categoryId}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`eBay fields could not be loaded (${response.status}). Try another category or retry later.`);
  const body = await response.json() as { aspects?: unknown };
  const rules = parseAspectRules(body.aspects);
  if (cache.size > 200) cache.clear();
  cache.set(key, { rules, expires: Date.now() + 6 * 60 * 60 * 1000 });
  return rules;
}
