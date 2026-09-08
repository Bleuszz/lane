import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env.server";

function key(): Buffer {
  const secret = env("BETTER_AUTH_SECRET");
  if (!secret) {
    if (env("GROK_PROJECT_ID")) {
      throw new Error("BETTER_AUTH_SECRET is required to encrypt marketplace tokens.");
    }
    return createHash("sha256").update("lane-preview-only-not-for-production").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function seal(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${enc.toString("base64url")}.${tag.toString("base64url")}`;
}

export function unseal(packed: string | null | undefined): string | null {
  if (!packed) return null;
  const [v, ivB, dataB, tagB] = packed.split(".");
  if (v !== "v1" || !ivB || !dataB || !tagB) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function randomToken(prefix: string, bytes = 24): string {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signOauthState(userId: string): string {
  const packed = seal(JSON.stringify({ u: userId, t: Date.now(), n: randomBytes(8).toString("hex") }));
  if (!packed) throw new Error("Could not sign OAuth state");
  return packed;
}

export function readOauthState(state: string): { userId: string } {
  const raw = unseal(state);
  if (!raw) throw new Error("Invalid eBay OAuth state. Start Connect again from Lane.");
  const parsed = JSON.parse(raw) as { u?: string; t?: number };
  if (!parsed.u || !parsed.t) throw new Error("Invalid eBay OAuth state.");
  if (Date.now() - parsed.t > 20 * 60 * 1000) throw new Error("eBay OAuth timed out. Click Connect eBay UK again.");
  return { userId: parsed.u };
}

export function ebayConfigured(): boolean {
  return Boolean(env("EBAY_CLIENT_ID") && env("EBAY_CLIENT_SECRET") && env("EBAY_RU_NAME"));
}

export function ebayPoliciesConfigured(): boolean {
  return Boolean(env("EBAY_FULFILLMENT_POLICY_ID") && env("EBAY_PAYMENT_POLICY_ID") && env("EBAY_RETURN_POLICY_ID"));
}

export function ebayEnv(): "production" | "sandbox" {
  return env("EBAY_ENV") === "sandbox" ? "sandbox" : "production";
}
