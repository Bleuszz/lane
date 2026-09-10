import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

async function loadEbay() {
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/src/")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  } });
  try { return await import("../src/lib/lane/server/ebay.ts"); } finally { hooks.deregister(); }
}

test("eBay publisher reconciles lost create/publish acknowledgements without duplicate remote creates", async () => {
  const { ebayPublish } = await loadEbay();
  const originalFetch = globalThis.fetch;
  const originalId = process.env.EBAY_CLIENT_ID;
  const originalSecret = process.env.EBAY_CLIENT_SECRET;
  process.env.EBAY_CLIENT_ID = "fixture-id";
  process.env.EBAY_CLIENT_SECRET = "fixture-secret";
  const item = { id: "item-stable-id", sku: "editable label", categoryCanonical: "menswear.tops.tshirts", title: "Blue cotton shirt",
    description: "Source description", condition: "good", brand: "Brand", colour: "Blue", material: "Cotton", sizeUk: "M",
    quantity: 1, photos: [{ url: "https://example.test/source.jpg" }], channelFields: {} };
  let offer;
  let creates = 0;
  let publishes = 0;
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const method = options.method ?? "GET";
    if (path.includes("oauth2/token")) return response({ access_token: "fixture-access" });
    if (path.endsWith("get_default_category_tree_id")) return response({ categoryTreeId: "3" });
    if (path.endsWith("get_item_aspects_for_category")) return response({ aspects: [] });
    if (path.endsWith("/offer") && method === "GET") return response({ offers: offer ? [offer] : [] });
    if (path.includes("/inventory_item/")) return new Response(null, { status: 204 });
    for (const kind of ["fulfillment", "payment", "return"]) {
      if (path.endsWith(`/${kind}_policy`)) return response({ [`${kind}Policies`]: [{ marketplaceId: "EBAY_GB",
        [`${kind}PolicyId`]: `${kind}-this-shop`, categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }] }] });
    }
    if (path.endsWith("/offer") && method === "POST") {
      creates += 1;
      const body = JSON.parse(options.body);
      offer = { ...body, offerId: "remote-offer", status: "UNPUBLISHED" };
      return response({ offerId: offer.offerId }, 201);
    }
    if (path.endsWith("/publish")) {
      publishes += 1;
      offer = { ...offer, status: "PUBLISHED", listing: { listingId: "remote-live-listing" } };
      // The marketplace succeeds; the caller sees a dropped connection.
      throw new Error("simulated acknowledgement lost");
    }
    throw new Error(`Unexpected network request in fixture: ${method} ${path}`);
  };
  try {
    await assert.rejects(ebayPublish("access", "shop-location", item, 20, 1, null, {}, async () => {
      throw new Error("simulated database write failure after remote create");
    }), /database write failure/);
    await assert.rejects(ebayPublish("access", "shop-location", item, 20, 1), /acknowledgement lost/);
    const result = await ebayPublish("access", "shop-location", { ...item, sku: "user edited SKU meanwhile" }, 20, 1);
    assert.equal(result.listingId, "remote-live-listing");
    assert.equal(creates, 1);
    assert.equal(publishes, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalId === undefined) delete process.env.EBAY_CLIENT_ID; else process.env.EBAY_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.EBAY_CLIENT_SECRET; else process.env.EBAY_CLIENT_SECRET = originalSecret;
  }
});

test("publish and update reject any unhosted or HTTP selected photo before remote mutation", async () => {
  const { ebayPublish, ebayUpdateOffer } = await loadEbay();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("No network call is permitted for an invalid photo selection"); };
  try {
    for (const invalid of ["data:image/png;base64,edited-photo", "http://example.test/photo.jpg", "blob:https://lane.test/local-copy", "not-a-url"]) {
      const item = { photos: [{ url: "https://example.test/source.jpg" }, { url: invalid }] };
      await assert.rejects(ebayPublish("access", "location", item, 10, 1), /Photo 2.*HTTPS/);
      await assert.rejects(ebayUpdateOffer("access", "offer", "sku", item, 10, 1), /Photo 2.*HTTPS/);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("eBay import retains every source photo and specific while absent fields remain unknown", async () => {
  const { ebayListInventory } = await loadEbay();
  const originalFetch = globalThis.fetch;
  const photoUrls = ["https://images.example.test/front.jpg", "https://images.example.test/back.jpg", "https://images.example.test/label.jpg"];
  const response = (value) => new Response(JSON.stringify(value), { status: 200 });
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.method, "GET");
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/inventory_item")) return response({ inventoryItems: [
      { sku: "known", condition: "PRE_OWNED_EXCELLENT", conditionDescription: "Tiny mark shown in photo 2",
        availability: { shipToLocationAvailability: { quantity: 2 } },
        product: { title: "Original title", description: "Original full description", imageUrls: photoUrls,
          brand: "Source brand", aspects: { Size: ["M"], Colour: ["Blue"], Material: ["Cotton", "Elastane"], Fit: ["Regular"] } } },
      { sku: "unknown", product: {} },
    ] });
    if (parsed.pathname.endsWith("/offer")) return response({ offers: parsed.searchParams.get("sku") === "known" ? [
      { sku: "known", marketplaceId: "EBAY_GB", format: "FIXED_PRICE", offerId: "offer", categoryId: "15687",
        status: "PUBLISHED", listing: { listingId: "listing", listingStatus: "ACTIVE" }, pricingSummary: { price: { value: "22.50", currency: "GBP" } } },
    ] : [] });
    throw new Error(`Unexpected fixture request ${parsed.pathname}`);
  };
  try {
    const [known, unknown] = await ebayListInventory("access");
    assert.deepEqual(known.photoUrls, photoUrls);
    assert.equal(known.description, "Original full description");
    assert.equal(known.brand, "Source brand");
    assert.equal(known.sizeLabel, "M");
    assert.equal(known.colour, "Blue");
    assert.deepEqual(known.aspects.Material, ["Cotton", "Elastane"]);
    assert.deepEqual(known.aspects.Fit, ["Regular"]);
    assert.equal(known.categoryId, "15687");
    assert.equal(known.condition, "PRE_OWNED_EXCELLENT");
    assert.equal(known.conditionDescription, "Tiny mark shown in photo 2");
    assert.equal(known.quantity, 2);
    assert.equal(known.priceGbp, 22.5);
    assert.equal(unknown.title, "");
    assert.equal(unknown.quantity, null);
    assert.equal(unknown.priceGbp, null);
    assert.equal(unknown.condition, null);
    assert.equal(unknown.categoryId, null);
    assert.deepEqual(unknown.aspects, {});
    assert.deepEqual(unknown.photoUrls, []);
  } finally { globalThis.fetch = originalFetch; }
});


test("sale stock update changes quantity only and checks per-offer failure", async()=>{
  const {ebayUpdateQuantity}=await loadEbay();
  const originalFetch=globalThis.fetch;
  let response={responses:[{sku:"stable-sku",offerId:"offer-one",statusCode:200}]};
  let checked=false;
  globalThis.fetch=async(url,opts)=>{
    assert.equal(new URL(url).pathname,"/sell/inventory/v1/bulk_update_price_quantity");
    assert.equal(checked,true);
    assert.deepEqual(JSON.parse(opts.body),{requests:[{sku:"stable-sku",shipToLocationAvailability:{quantity:2},offers:[{offerId:"offer-one",availableQuantity:2}]}]});
    return Response.json(response);
  };
  try {
    await ebayUpdateQuantity("local-fixture","offer-one","stable-sku",2,async()=>{checked=true;});
    response={responses:[{sku:"stable-sku",offerId:"offer-one",statusCode:400}]};
    await assert.rejects(ebayUpdateQuantity("local-fixture","offer-one","stable-sku",2),/not fully confirmed/);
    response={responses:[]};
    await assert.rejects(ebayUpdateQuantity("local-fixture","offer-one","stable-sku",2),/not fully confirmed/);
  } finally {globalThis.fetch=originalFetch;}
});
