import { selectEbayOffer, liveEbayReceipt, selectSellerPolicy, type EbayOffer } from "./ebay-operations";
import { sourceAspects, validateAspects } from "../aspects";
import { ebayAspectRules } from "./taxonomy";
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
    signal: AbortSignal.timeout(30_000),
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
    signal: AbortSignal.timeout(30_000),
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
  if (get.ok) return key;
  if (get.status !== 404) throw Object.assign(new Error("Could not verify this shop's eBay dispatch location."), { body: get.text });
  const list = await ebayFetch<{ locations?: { merchantLocationKey?: string; merchantLocationStatus?: string }[] }>(
    accessToken, "GET", "/sell/inventory/v1/location?limit=100");
  if (!list.ok) throw Object.assign(new Error("Could not read this shop's dispatch locations."), { body: list.text });
  const enabled = (list.json.locations ?? []).filter((location) => location.merchantLocationStatus === "ENABLED" && location.merchantLocationKey);
  if (enabled.length === 1) return enabled[0].merchantLocationKey!;
  throw new Error(enabled.length ? "Choose this shop's dispatch location before publishing." : "Add a real dispatch location to this eBay shop before publishing.");
}

async function sellerPolicies(accessToken: string, settings: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const kind of ["fulfillment", "payment", "return"]) {
    const field = `${kind}PolicyId`;
    const response = await ebayFetch<Record<string, Record<string, unknown>[]>>(
      accessToken, "GET", `/sell/account/v1/${kind}_policy?marketplace_id=EBAY_GB`);
    if (!response.ok) throw Object.assign(new Error(`Could not read this shop's ${kind} policies.`), { body: response.text });
    result[field] = selectSellerPolicy(response.json[`${kind}Policies`] ?? [], field,
      typeof settings[field] === "string" ? settings[field] as string : undefined);
  }
  return result;
}

async function reconcileOffer(accessToken: string, sku: string, offerId?: string | null): Promise<EbayOffer | undefined> {
  if (offerId) {
    const response = await ebayFetch<EbayOffer>(accessToken, "GET", `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`);
    if (!response.ok) throw Object.assign(new Error("Could not reconcile the saved eBay offer. No new offer was created."), { body: response.text });
    return response.json;
  }
  const response = await ebayFetch<{ offers?: EbayOffer[]; errors?: { errorId?: number }[] }>(accessToken, "GET",
    `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=EBAY_GB&format=FIXED_PRICE`);
  if (!response.ok) {
    // Accept only eBay's explicit missing-resource response, never authentication,
    // throttling or server failures. All ambiguous lookups stop publication.
    if ([400, 404].includes(response.status) && response.json.errors?.length && response.json.errors.every((error) => error.errorId === 25710)) return undefined;
    throw Object.assign(new Error("Could not check existing eBay offers. No new offer was created."), { body: response.text });
  }
  return selectEbayOffer(response.json.offers ?? [], sku);
}

function conditionEnum(c: Condition): string {
  if (c === "unknown") throw new Error("Confirm item condition before publishing to eBay.");
  const map: Partial<Record<Condition, string>> = {
    new_with_tags: "NEW",
    new_without_tags: "NEW_OTHER",
    very_good: "USED_VERY_GOOD",
    good: "USED_GOOD",
    satisfactory: "USED_ACCEPTABLE",
  };
  return map[c]!;
}

function skuFor(item: ItemView): string {
  // User-editable SKU labels can collide or change. Canonical IDs are stable.
  return `LANE_${Buffer.from(item.id).toString("base64url")}`.slice(0, 50);
}

export async function ebayReconcileListing(accessToken: string, item: ItemView, offerId?: string | null) {
  return liveEbayReceipt(await reconcileOffer(accessToken, skuFor(item), offerId));
}

function selectedPhotoUrls(item: ItemView): string[] {
  if (!item.photos.length) throw new Error("eBay requires at least one publicly reachable HTTPS photo.");
  return item.photos.map((photo, index) => {
    let url: URL;
    try { url = new URL(photo.url); } catch { throw new Error(`Photo ${index + 1} needs a public HTTPS URL before publishing to eBay.`); }
    if (url.protocol !== "https:" || !url.hostname) {
      throw new Error(`Photo ${index + 1} needs a public HTTPS URL. Host the edited image or remove it from this listing first.`);
    }
    return photo.url;
  });
}

export async function ebayPublish(
  accessToken: string,
  locationKey: string,
  item: ItemView,
  priceGbp: number,
  quantity: number,
  existingOfferId?: string | null,
  settings: Record<string, unknown> = {},
  saveReceipt?: (receipt: { offerId: string; sku: string }) => Promise<void>,
  beforeWrite?: () => Promise<void>,
): Promise<{ listingId: string; offerId: string; sku: string; url: string }> {
  const photos = selectedPhotoUrls(item);
  let sku = skuFor(item);
  const remote = await reconcileOffer(accessToken, sku, existingOfferId);
  const alreadyLive = liveEbayReceipt(remote);
  if (alreadyLive) return alreadyLive;
  if (remote?.sku) sku = remote.sku;
  if (!item.title.trim() || item.title.trim().length > 80) throw new Error("Review the eBay title: it must be 1–80 characters. Lane will not shorten it silently.");
  if (!item.description.trim()) throw new Error("Add a description before publishing to eBay.");
  const cat = findCategory(item.categoryCanonical);
  const categoryId = cat?.ebayUk.id;
  if (!categoryId || !cat?.ebayUk.confirmed) {
    throw new Error(`eBay category is unconfirmed for ${cat?.path ?? item.categoryCanonical ?? "this item"}. Pick a confirmed leaf before publishing.`);
  }
  const aspects = sourceAspects(item);
  const fieldErrors = validateAspects(await ebayAspectRules(categoryId), aspects);
  if (fieldErrors.length) throw new Error(fieldErrors.join(" "));

  await beforeWrite?.();
  const inv = await ebayFetch(accessToken, "PUT", `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    availability: { shipToLocationAvailability: { quantity } },
    condition: conditionEnum(item.condition),
    conditionDescription: EBAY_CONDITION_MAP[item.condition]?.name,
    product: {
      title: item.title.slice(0, 80),
      description: item.description || item.title,
      aspects,
      imageUrls: photos.slice(0, 12),
      ...(item.brand ? { brand: item.brand } : {}),
    },
    ...(item.weightG
      ? {
          packageWeightAndSize: {
            weight: { value: Math.max(0.01, item.weightG / 1000), unit: "KILOGRAM" },
            ...(item.lengthCm && item.widthCm && item.heightCm
              ? {
                  dimensions: {
                    length: item.lengthCm,
                    width: item.widthCm,
                    height: item.heightCm,
                    unit: "CENTIMETER",
                  },
                }
              : {}),
          },
        }
      : {}),
  });
  if (!inv.ok && inv.status !== 204) {
    throw Object.assign(new Error(`eBay inventory_item failed (HTTP ${inv.status}).`), { body: inv.text });
  }

  let offerId = remote?.offerId ?? existingOfferId ?? null;
  if (!offerId) {
    const listingPolicies = await sellerPolicies(accessToken, settings);
    await beforeWrite?.();
    const offer = await ebayFetch<{ offerId?: string }>(accessToken, "POST", "/sell/inventory/v1/offer", {
      sku,
      marketplaceId: "EBAY_GB",
      format: "FIXED_PRICE",
      listingDescription: item.description || item.title,
      availableQuantity: quantity,
      quantityLimitPerBuyer: 1,
      pricingSummary: { price: { value: priceGbp.toFixed(2), currency: "GBP" } },
      listingPolicies,
      categoryId,
      merchantLocationKey: locationKey,
      includeCatalogProductDetails: true,
    });
    if (!offer.ok) {
      throw Object.assign(
        new Error(
          `eBay createOffer failed (HTTP ${offer.status}). Check this shop's business policies and dispatch location.`,
        ),
        { body: offer.text },
      );
    }
    offerId = String(offer.json.offerId ?? "");
    if (!offerId) throw new Error("eBay createOffer returned no offer ID. Reconcile before retrying.");
  }

  await saveReceipt?.({ offerId: offerId!, sku });
  await beforeWrite?.();
  const pub = await ebayFetch<{ listingId?: string }>(
    accessToken,
    "POST",
    `/sell/inventory/v1/offer/${encodeURIComponent(offerId!)}/publish`,
  );
  if (!pub.ok) {
    throw Object.assign(new Error(`eBay publishOffer failed (HTTP ${pub.status}).`), { body: pub.text });
  }
  const listingId = String(pub.json.listingId ?? "");
  if (!listingId) throw new Error("eBay did not return a listing ID. Reconcile before retrying.");
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
  beforeWrite?: () => Promise<void>,
) {
  const photos = selectedPhotoUrls(item);
  const currentItem = await ebayFetch<Record<string, unknown>>(accessToken, "GET", `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`);
  const currentOffer = await ebayFetch<Record<string, unknown>>(accessToken, "GET", `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`);
  if (!currentItem.ok || !currentOffer.ok) throw new Error("Could not read the current eBay listing. No update was sent.");
  const { sku: _sku, locale: _locale, ...inventoryBody } = currentItem.json;
  const product = (inventoryBody.product ?? {}) as Record<string, unknown>;
  await beforeWrite?.();
  const updated = await ebayFetch(accessToken, "PUT", `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    ...inventoryBody,
    availability: { ...((inventoryBody.availability ?? {}) as Record<string, unknown>), shipToLocationAvailability: { quantity } },
    condition: conditionEnum(item.condition),
    product: { ...product, title: item.title.slice(0, 80), description: item.description || item.title,
      aspects: { ...((product.aspects ?? {}) as Record<string, string[]>), ...sourceAspects(item) },
      imageUrls: photos.slice(0, 12) },
  });
  if (!updated.ok) throw Object.assign(new Error(`eBay inventory update failed (HTTP ${updated.status}).`), { body: updated.text });
  const { offerId: _offerId, listing: _listing, status: _status, ...offerBody } = currentOffer.json;
  await beforeWrite?.();
  const r = await ebayFetch(accessToken, "PUT", `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`, {
    ...offerBody, availableQuantity: quantity,
    pricingSummary: { ...((offerBody.pricingSummary ?? {}) as Record<string, unknown>), price: { value: priceGbp.toFixed(2), currency: "GBP" } },
    listingDescription: item.description || item.title,
  });
  if (!r.ok) throw Object.assign(new Error(`eBay update offer failed (HTTP ${r.status}).`), { body: r.text });
}

/** Stock-only sale propagation must never rewrite photos, descriptions or price. */
export async function ebayUpdateQuantity(accessToken: string, offerId: string, sku: string, quantity: number, beforeWrite?: () => Promise<void>) {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Invalid stock quantity.");
  await beforeWrite?.();
  const result = await ebayFetch<{responses?: Array<{sku?:string;offerId?:string;statusCode?:number;errors?:unknown[]}>}>(accessToken,"POST","/sell/inventory/v1/bulk_update_price_quantity",{
    requests:[{sku,shipToLocationAvailability:{quantity},offers:[{offerId,availableQuantity:quantity}]}],
  });
  const rows = result.json.responses ?? [];
  if (!result.ok || !rows.length || rows.some(r=>r.sku!==sku || !r.statusCode || r.statusCode<200 || r.statusCode>=300 || r.errors?.length) || !rows.some(r=>r.offerId===offerId)) throw new Error("eBay stock update was not fully confirmed. Check the listing before retrying.");
}

export async function ebayWithdraw(accessToken: string, offerId: string, beforeWrite?: () => Promise<void>) {
  const before = await ebayFetch<EbayOffer>(accessToken, "GET", `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`);
  if (!before.ok) throw Object.assign(new Error("Could not verify whether the eBay listing has ended."), { body: before.text });
  if (before.json.status === "UNPUBLISHED") return;
  await beforeWrite?.();
  const r = await ebayFetch(accessToken, "POST", `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, {});
  if (!r.ok) throw Object.assign(new Error(`eBay withdraw failed (HTTP ${r.status}). Recheck before retrying.`), { body: r.text });
}

export type EbayInventoryImport = {
  sku: string;
  title: string;
  description: string | null;
  priceGbp: number | null;
  quantity: number | null;
  listingId: string | null;
  offerId: string | null;
  url: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  sizeLabel: string | null;
  colour: string | null;
  material: string | null;
  /** Original eBay enum and description, never an invented canonical condition. */
  condition: string | null;
  conditionDescription: string | null;
  aspects: Record<string, string[]>;
  status: string | null;
};

export async function ebayListInventory(accessToken: string): Promise<EbayInventoryImport[]> {
  const inv = await ebayFetch<{ inventoryItems?: Array<Record<string, unknown>> }>(
    accessToken, "GET", "/sell/inventory/v1/inventory_item?limit=100");
  if (!inv.ok) throw Object.assign(new Error(`eBay inventory list failed (HTTP ${inv.status}).`), { body: inv.text });
  const out: EbayInventoryImport[] = [];
  for (const row of inv.json.inventoryItems ?? []) {
    const sku = String(row.sku ?? "");
    const product = (row.product ?? {}) as Record<string, unknown>;
    const offer = await reconcileOffer(accessToken, sku);
    const listingId = offer?.listing?.listingId ?? null;
    const priceValue = (offer?.pricingSummary as { price?: { value?: string; currency?: string } } | undefined)?.price;
    const price = priceValue?.value != null && priceValue.currency === "GBP" ? Number(priceValue.value) : null;
    const photoUrls = Array.isArray(product.imageUrls) ? product.imageUrls.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
    const aspects: Record<string, string[]> = {};
    if (product.aspects && typeof product.aspects === "object" && !Array.isArray(product.aspects)) {
      for (const [name, values] of Object.entries(product.aspects)) {
        if (Array.isArray(values)) aspects[name] = values.filter((value): value is string => typeof value === "string");
      }
    }
    const aspect = (...names: string[]) => {
      const key = Object.keys(aspects).find((key) => names.some((name) => name.toLowerCase() === key.toLowerCase()));
      return key ? aspects[key][0] ?? null : null;
    };
    const quantity = (row.availability as { shipToLocationAvailability?: { quantity?: number } } | undefined)?.shipToLocationAvailability?.quantity;
    out.push({
      sku,
      title: typeof product.title === "string" ? product.title : "",
      description: typeof product.description === "string" ? product.description : typeof offer?.listingDescription === "string" ? offer.listingDescription : null,
      priceGbp: price != null && Number.isFinite(price) ? price : null,
      quantity: typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 0 ? quantity : null,
      listingId,
      offerId: offer?.offerId ?? null,
      url: listingId ? `https://www.ebay.co.uk/itm/${listingId}` : null,
      photoUrl: photoUrls[0] ?? null,
      photoUrls,
      categoryId: typeof offer?.categoryId === "string" ? offer.categoryId : null,
      categoryName: typeof offer?.categoryName === "string" ? offer.categoryName : null,
      brand: typeof product.brand === "string" ? product.brand : aspect("Brand"),
      sizeLabel: aspect("Size"),
      colour: aspect("Colour", "Color"),
      material: aspect("Material"),
      condition: typeof row.condition === "string" ? row.condition : null,
      conditionDescription: typeof row.conditionDescription === "string" ? row.conditionDescription : null,
      aspects,
      status: offer?.listing?.listingStatus ?? offer?.status ?? null,
    });
  }
  return out;
}
