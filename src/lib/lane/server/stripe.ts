import Stripe from "stripe";
import { env } from "../../env.server.ts";
import type { PlanId, StripeSetup } from "@/lib/lane/types";

export function stripeSetup(): StripeSetup {
  const prices = {
    starter: Boolean(env("STRIPE_PRICE_V2_STARTER")),
    seller: Boolean(env("STRIPE_PRICE_V2_SELLER")),
    pro: Boolean(env("STRIPE_PRICE_V2_PRO")),
    aiPack: Boolean(env("STRIPE_PRICE_AI_PACK")),
  };
  const secret = Boolean(env("STRIPE_SECRET_KEY"));
  return {
    configured: secret && prices.starter && prices.seller && prices.pro && Boolean(env("STRIPE_WEBHOOK_SECRET")) && env("LANE_BILLING_V2_READY") === "true",
    secret,
    webhook: Boolean(env("STRIPE_WEBHOOK_SECRET")),
    prices,
  };
}

export function stripeConfigured(): boolean {
  return stripeSetup().configured;
}

export function stripePublishable(): string | undefined {
  return env("STRIPE_PUBLISHABLE_KEY");
}

export function priceIdFor(plan: PlanId): string | undefined {
  if (plan === "starter") return env("STRIPE_PRICE_V2_STARTER");
  if (plan === "seller") return env("STRIPE_PRICE_V2_SELLER");
  if (plan === "pro") return env("STRIPE_PRICE_V2_PRO");
  return undefined;
}

export function planForPriceId(priceId: string): PlanId | null {
  if (priceId === env("STRIPE_PRICE_V2_STARTER") || priceId === env("STRIPE_PRICE_STARTER")) return "starter";
  if (priceId === env("STRIPE_PRICE_V2_SELLER") || priceId === env("STRIPE_PRICE_SELLER")) return "seller";
  if (priceId === env("STRIPE_PRICE_V2_PRO") || priceId === env("STRIPE_PRICE_PRO")) return "pro";
  return null;
}

export async function stripeForm(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<Record<string, unknown>> {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    body.set(k, String(v));
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe HTTP ${res.status}`);
  }
  return json;
}

export function verifyStripeSignature(rawBody: string, header: string | null): boolean {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const timestamps = header.split(",").map(piece => piece.trim()).filter(piece => piece.startsWith("t="));
  if (timestamps.length !== 1 || !/^t=\d+$/.test(timestamps[0])) return false;
  const timestamp = Number(timestamps[0].slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  try { Stripe.webhooks.constructEvent(rawBody, header, secret); return true; }
  catch { return false; }
}

export function retrieveBillingSubscription(id: string): Promise<Stripe.Subscription> {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Billing is not configured");
  const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia", timeout: 10000, maxNetworkRetries: 0 });
  return stripe.subscriptions.retrieve(id, { expand: ["latest_invoice"] });
}
