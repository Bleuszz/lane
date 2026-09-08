import { env } from "@/lib/env.server";
import { ebayEnv } from "./secret";
import type { Condition, ItemView } from "@/lib/lane/types";
import { findCategory } from "@/lib/lane/categories";
import { EBAY_CONDITION_MAP } from "@/lib/lane/types";

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

function hosts() {
  const sandbox = ebayEnv() === "sandbox";
  return {
    auth: sandbox ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com",
    api: sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com",
  };
}

export function ebayAuthorizeUrl(state: string): string {
  const clientId = env("EBAY_CLIENT_ID");
  const ruName = env("EBAY_RU_NAME");
  if (!clientId || !ruName) throw new Error("eBay keys are not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RU_NAME.");
  const u = new URL(`${hosts().auth}/oauth2/authorize`);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", ruName);
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("state", state);
  u.searchParams.set("prompt", "login");
  return u.toString();
}

async function tokenRequest(body: URLSearchParams): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const id = env("EBAY_CLIENT_ID");
  const secret = env("EBAY_CLIENT_SECRET");
  if (!id || !secret) throw new Error("eBay keys are not configured.");
  const res = await fetch(`${hosts().api}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw Object.assign(new Error(String(json.error_description ?? json.error ?? `eBay token HTTP ${res.status}`)), {
      body: JSON.stringify(json),
    });
  }
  return {
    access_token: String(json.access_token),
    refresh_token: json.refresh_token ? String(json.refresh_token) : undefined,
    expires_in: Number(json.expires_in ?? 7200),
  };
}

export async function exchangeEbayCode(code: string) {
  const ruName = env("EBAY_RU_NAME") ?? "";
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    }),
  );
}

export async function refreshEbayToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  );
}

export async function ebayFetch<T = Record<string, unknown>>(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: T; text: string }> {
  const res = await fetch(`${hosts().api}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json", "Content-Language": "en-GB" } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {} as T;
  try {
    json = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    /* HTML error page */
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function ebayUser(accessToken: string): Promise<{ username: string; userId: string | null }> {
  const r = await ebayFetch<{ username?: string; userId?: string; accountType?: string }>(
    accessToken,
    "GET",
    "/commerce/identity/v1/user/",
  );
  if (r.ok && r.json.username) {
    return { username: r.json.username, userId: r.json.userId ?? null };
  }
  const priv = await ebayFetch<{ userId?: string }>(accessToken, "GET", "/sell/account/v1/privilege");
  if (priv.ok) return { username: String(priv.json.userId ?? "ebay_uk"), userId: priv.json.userId ?? null };
  throw Object.assign(new Error("Could not read eBay identity. Reconnect the shop."), { body: r.text || priv.text });
}

export async function ensureMerchantLocation(accessToken: string, key: string): Promise<string> {
  const get = await ebayFetch(accessToken, "GET", `/sell/inventory/v1/location/${encodeURIComponent(key)}`);
  if (get.ok || get.status === 200) return key;
  const line1 = env("EBAY_LOCATION_LINE1");
  const city = env("EBAY_LOCATION_CITY");
  const postcode = env("EBAY_LOCATION_POSTCODE");
  if (!line1 || !city || !postcode) {
    throw new Error(
      "eBay needs a merchant location. Set EBAY_LOCATION_LINE1, EBAY_LOCATION_CITY and EBAY_LOCATION_POSTCODE to a real GB dispatch address.",
    );
  }
  const created = await ebayFetch(accessToken, "POST", `/sell/inventory/v1/location/${encodeURIComponent(key)}`, {
    location: {
      address: {
        addressLine1: line1,
        city,
        postalCode: postcode,
        country: "GB",
      },
    },
    name: env("EBAY_LOCATION_NAME") ?? "Lane dispatch",
    merchantLocationStatus: "ENABLED",
    locationTypes: ["WAREHOUSE"],
  });
  if (!created.ok && created.status !== 204 && created.status !== 409) {
    throw Object.assign(new Error(`eBay inventory location failed (HTTP ${created.status}).`), { body: created.text });
  }
  return key;
}

function conditionEnum(c: Condition): string {
  const map: Record<Condition, string> = {
    new_with_tags: "NEW",
    new_without_tags: "NEW_OTHER",
    very_good: "USED_VERY_GOOD",
    good: "USED_GOOD",
    satisfactory: "USED_ACCEPTABLE",
  };
  return map[c] ?? "USED_GOOD";
}

function skuFor(item: ItemView): string {
  const raw = (item.sku || item.id).replace(/[^A-Za-z0-9]+/g, "").slice(0, 50);
  return raw || item.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 50);
}

export async function ebayPublish(
  accessToken: string,
  locationKey: string,
  item: ItemView,
  priceGbp: number,
  quantity: number,
  existingOfferId?: string | null,
): Promise<{ listingId: string; offerId: string; sku: string; url: string }> {
  const sku = skuFor(item);
  const cat = findCategory(item.categoryCanonical);
  const categoryId = cat?.ebayUk.id;
  if (!categoryId) {
    throw new Error(`eBay category is unconfirmed for ${cat?.path ?? item.categoryCanonical ?? "this item"}. Pick a confirmed leaf before publishing.`);
  }
  const photos = item.photos.map((p) => p.url).filter((u) => /^https?:\/\//i.test(u));
  if (photos.length === 0) {
    throw new Error("eBay requires at least one publicly reachable http(s) photo URL.");
  }

  const inv = await ebayFetch(accessToken, "PUT", `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    availability: { shipToLocationAvailability: { quantity } },
    condition: conditionEnum(item.condition),
    conditionDescription: EBAY_CONDITION_MAP[item.condition]?.name,
    product: {
      title: item.title.slice(0, 80),
      description: item.description || item.title,
      aspects: {
        ...(item.brand ? { Brand: [item.brand] } : {}),
        ...(item.sizeUk ? { Size: [item.sizeUk] } : {}),
        ...(item.colour ? { Colour: [item.colour] } : {}),
      },
      imageUrls: photos.slice(0, 12),
      ...(item.brand ? { brand: item.brand } : {}),
    },
  });
  if (!inv.ok && inv.status !== 204) {
    throw Object.assign(new Error(`eBay inventory_item failed (HTTP ${inv.status}).`), { body: inv.text });
  }

  let offerId = existingOfferId ?? null;
  if (!offerId) {
    const offer = await ebayFetch<{ offerId?: string }>(accessToken, "POST", "/sell/inventory/v1/offer", {
      sku,
      marketplaceId: env("EBAY_MARKETPLACE_ID") ?? "EBAY_GB",
      format: "FIXED_PRICE",
      listingDescription: item.description || item.title,
      availableQuantity: quantity,
      quantityLimitPerBuyer: 1,
      pricingSummary: { price: { value: priceGbp.toFixed(2), currency: "GBP" } },
      listingPolicies: {
        fulfillmentPolicyId: env("EBAY_FULFILLMENT_POLICY_ID"),
        paymentPolicyId: env("EBAY_PAYMENT_POLICY_ID"),
        returnPolicyId: env("EBAY_RETURN_POLICY_ID"),
      },
      categoryId,
      merchantLocationKey: locationKey,
      includeCatalogProductDetails: true,
    });
    if (!offer.ok) {
      throw Object.assign(
        new Error(
          `eBay createOffer failed (HTTP ${offer.status}). You must opt in to Business Policies and set EBAY_FULFILLMENT_POLICY_ID, EBAY_PAYMENT_POLICY_ID, EBAY_RETURN_POLICY_ID.`,
        ),
        { body: offer.text },
      );
    }
    offerId = String(offer.json.offerId ?? "");
  }

  const pub = await ebayFetch<{ listingId?: string }>(
    accessToken,
    "POST",
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId!)}/publish`,
  );
  if (!pub.ok) {
    throw Object.assign(new Error(`eBay publishOffer failed (HTTP ${pub.status}).`), { body: pub.text });
  }
  const listingId = String(pub.json.listingId ?? "");
  return {
    listingId,
    offerId: offerId!,
    sku,
    url: `https://www.ebay.co.uk/itm/${listingId}`,
  };
}

export async function ebayUpdateOffer(
  accessToken: string,
  offerId: string,
  sku: string,
  item: ItemView,
  priceGbp: number,
  quantity: number,
) {
  await ebayFetch(accessToken, "PUT", `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    availability: { shipToLocationAvailability: { quantity } },
    condition: conditionEnum(item.condition),
    product: {
      title: item.title.slice(0, 80),
      description: item.description || item.title,
      imageUrls: item.photos.map((p) => p.url).filter((u) => /^https?:\/\//i.test(u)).slice(0, 12),
    },
  });
  const r = await ebayFetch(accessToken, "PUT", `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    availableQuantity: quantity,
    pricingSummary: { price: { value: priceGbp.toFixed(2), currency: "GBP" } },
    listingDescription: item.description || item.title,
  });
  if (!r.ok && r.status !== 204) {
    throw Object.assign(new Error(`eBay update offer failed (HTTP ${r.status}).`), { body: r.text });
  }
}

export async function ebayWithdraw(accessToken: string, offerId: string) {
  const r = await ebayFetch(accessToken, "POST", `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, {
    listingId: undefined,
  });
  if (!r.ok && r.status !== 204) {
    const alt = await ebayFetch(
      accessToken,
      "POST",
      `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`,
      {},
    );
    if (!alt.ok && alt.status !== 204) {
      throw Object.assign(new Error(`eBay withdraw failed (HTTP ${alt.status}).`), { body: alt.text });
    }
  }
}

export async function ebayListInventory(accessToken: string): Promise<
  {
    sku: string;
    title: string;
    priceGbp: number | null;
    quantity: number;
    listingId: string | null;
    offerId: string | null;
    url: string | null;
    photoUrl: string | null;
  }[]
> {
  const inv = await ebayFetch<{ inventoryItems?: Array<Record<string, unknown>> }>(
    accessToken,
    "GET",
    "/sell/inventory/v1/inventory_item?limit=100",
  );
  if (!inv.ok) {
    throw Object.assign(new Error(`eBay inventory list failed (HTTP ${inv.status}).`), { body: inv.text });
  }
  const items = inv.json.inventoryItems ?? [];
  const out = [];
  for (const row of items) {
    const sku = String(row.sku ?? "");
    const product = (row.product ?? {}) as Record<string, unknown>;
    const offers = await ebayFetch<{ offers?: Array<Record<string, unknown>> }>(
      accessToken,
      "GET",
      `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    );
    const offer = offers.json.offers?.[0];
    const listingId = offer?.listing ? String((offer.listing as { listingId?: string }).listingId ?? "") : "";
    const price = offer?.pricingSummary
      ? Number((offer.pricingSummary as { price?: { value?: string } }).price?.value ?? 0)
      : null;
    out.push({
      sku,
      title: String(product.title ?? sku),
      priceGbp: price,
      quantity: Number(
        ((row.availability as { shipToLocationAvailability?: { quantity?: number } } | undefined)
          ?.shipToLocationAvailability?.quantity ?? 1),
      ),
      listingId: listingId || null,
      offerId: offer?.offerId ? String(offer.offerId) : null,
      url: listingId ? `https://www.ebay.co.uk/itm/${listingId}` : null,
      photoUrl: Array.isArray(product.imageUrls) ? String(product.imageUrls[0] ?? "") || null : null,
    });
  }
  return out;
}
