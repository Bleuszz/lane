import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";
import type { PlanId, StripeSetup } from "@/lib/lane/types";

export function stripeSetup(): StripeSetup {
  const prices = {
    starter: Boolean(env("STRIPE_PRICE_STARTER")),
    seller: Boolean(env("STRIPE_PRICE_SELLER")),
    pro: Boolean(env("STRIPE_PRICE_PRO")),
    aiPack: Boolean(env("STRIPE_PRICE_AI_PACK")),
  };
  const secret = Boolean(env("STRIPE_SECRET_KEY"));
  return {
    configured: secret && prices.starter,
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
  if (plan === "starter") return env("STRIPE_PRICE_STARTER");
  if (plan === "seller") return env("STRIPE_PRICE_SELLER");
  if (plan === "pro") return env("STRIPE_PRICE_PRO");
  return undefined;
}

export function planForPriceId(priceId: string): PlanId | null {
  if (priceId === env("STRIPE_PRICE_STARTER")) return "starter";
  if (priceId === env("STRIPE_PRICE_SELLER")) return "seller";
  if (priceId === env("STRIPE_PRICE_PRO")) return "pro";
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
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const [k, v] = piece.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
