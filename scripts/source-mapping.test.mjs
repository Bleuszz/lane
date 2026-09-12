import { CATEGORIES } from "../src/lib/lane/categories.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeVintedSource } from "../src/lib/lane/vinted-source.ts";
import { listingSourceSnapshot, resolveSourceCategory, sourcePhotos } from "../src/lib/lane/import-source.ts";
import { conditionFromLabel } from "../src/lib/lane/condition.ts";
import { acceptedSuggestions, applySuggestions, parseAspectRules, sourceAspects, validateAspects } from "../src/lib/lane/aspects.ts";
import { validateListing } from "../src/lib/lane/listing-fields.ts";

test("Vinted imports preserve six/seven photos, multiple colours, UK size range and source facts", () => {
  for (const count of [6, 7]) {
    const urls = Array.from({ length: count }, (_, i) => `https://images.example/item-${i}.jpg`);
    const normalized = normalizeVintedSource({
      id: 123, title: "Striped top", description: "Small pull near hem", price: { amount: "12.50" },
      photos: urls.map((url) => ({ url })), photo: { url: urls[0] },
      colors: [{ title: "Blue" }, { title: "White" }], size_title: "UK 10–12",
      catalog: { id: 44, title: "T-shirts", path: "Women > Tops > T-shirts" },
      brand: { title: "Example" }, condition_title: "Good", material_title: "Cotton",
      seller: { email: "not-preserved@example.test" }, access_token: "do-not-retain",
    });
    assert.deepEqual(normalized.photoUrls, urls);
    assert.deepEqual(sourcePhotos(normalized).map(p => p.url), urls);
    assert.equal(normalized.colour, "Blue, White");
    assert.equal(normalized.sizeLabel, "UK 10–12");
    assert.equal(normalized.material, "Cotton");
    assert.equal(normalized.description, "Small pull near hem");
    const snapshot = listingSourceSnapshot(normalized);
    assert.equal(snapshot.size, "UK 10–12");
    assert.equal(snapshot.photos.length, count);
    assert.equal(JSON.stringify(snapshot).includes("do-not-retain"), false);
    assert.equal(JSON.stringify(snapshot).includes("not-preserved@"), false);
  }
});

test("ambiguous source categories stay unresolved until an exact path or ID exists", () => {
  const categories = [
    { id: "men.tee", vintedUk: { catalogId: "1", path: "Men > Tops > T-shirts", name: "T-shirts" } },
    { id: "women.tee", vintedUk: { catalogId: "2", path: "Women > Tops > T-shirts", name: "T-shirts" } },
  ];
  const source = { remoteId: "1", title: "T-shirt", description: null, priceGbp: 10, categoryName: "T-shirts" };
  assert.equal(resolveSourceCategory(source, categories), "");
  assert.equal(resolveSourceCategory({ ...source, categoryPath: "  Women > Tops > T-shirts " }, categories), "women.tee");
  assert.equal(resolveSourceCategory({ ...source, categoryId: "1" }, categories), "men.tee");
  assert.equal(resolveSourceCategory({ ...source, categoryName: "Mystery" }, categories), "");
});

test("missing source condition stays unknown and blocks publishing", () => {
  const normalized = normalizeVintedSource({ id: "1", title: "Top" });
  assert.equal(normalized.conditionLabel, null);
  assert.equal(conditionFromLabel(normalized.conditionLabel), "unknown");
  assert.equal(conditionFromLabel("Live"), "unknown");
  const draft = { condition: "unknown", photos: [{ url: "https://example.test/photo.jpg" }], title: "Top", description: "Details", categoryCanonical: "women.tee", basePriceGbp: "12", quantity: "1" };
  assert.ok(validateListing(draft, "ebay").includes("Confirm the item condition before publishing."));
});

const rules = parseAspectRules([
  { localizedAspectName: "Material", aspectConstraint: { aspectRequired: true, aspectMode: "SELECTION_ONLY", itemToAspectCardinality: "SINGLE" }, aspectValues: [{ localizedValue: "Cotton" }, { localizedValue: "Leather" }] },
  { localizedAspectName: "Size", aspectConstraint: { aspectRequired: true, aspectMaxLength: 30 } },
]);

test("manual destination overrides survive autofill and malformed/unsupported evidence is rejected", () => {
  const current = sourceAspects({ material: "Cotton", sizeUk: "UK 10–12", channelFields: { ebay_uk: { aspects: { Material: ["Leather"] } } } });
  assert.deepEqual(current.Material, ["Leather"]);
  const good = { name: "Material", value: "cotton", evidence: "100% cotton" };
  assert.deepEqual(acceptedSuggestions([good], rules, "Label: 100% cotton", current), []);
  const accepted = acceptedSuggestions([good], rules, "Label: 100% cotton", {});
  assert.equal(accepted[0].value, "Cotton");
  assert.deepEqual(applySuggestions(current, accepted), current);
  assert.deepEqual(acceptedSuggestions([
    { name: "Material", value: "Leather", evidence: "genuine leather" },
    { name: "Material", value: "Silk", evidence: "silk" },
    { name: "Invented field", value: "cotton", evidence: "100% cotton" },
    { name: "Size", value: "UK 14", evidence: "100% cotton" },
    null, { name: "Material", value: "Cotton", evidence: 42 },
  ], rules, "Label: 100% cotton, silk lining", {}), []);
  assert.deepEqual(validateAspects(rules, { Material: ["Cotton"], Size: ["UK 10–12"] }), []);
  assert.ok(validateAspects(rules, { Material: ["Silk"] }).includes("Check the value for Material."));
  assert.ok(validateAspects(rules, { Material: ["Cotton"] }).includes("Size is required by eBay."));
  assert.ok(validateAspects(rules, { Material: ["Cotton", "Leather"], Size: ["M"] }).includes("Material accepts one value."));
});

test("new without tags must never become new with tags", () => {
  assert.equal(conditionFromLabel("New without tags"), "new_without_tags");
});

test("negated material evidence cannot become an affirmative item specific", () => {
  assert.deepEqual(acceptedSuggestions([{ name: "Material", value: "Leather", evidence: "not leather" }], rules, "Synthetic, not leather", {}), []);
  assert.deepEqual(acceptedSuggestions([{ name: "Material", value: "Leather", evidence: "leather" }], rules, "Synthetic, not leather", {}), []);
});

// Synthetic API-shaped fixtures based on the two owner-provided public pages.
// This proves mapping behavior, not authenticated wardrobe/API compatibility.
test("owner sample category IDs and UK ranges survive mapping without inventing material", () => {
  for (const sample of [
    {catalog:190, size:"L / UK 16-18", colours:["Pink"], count:6, category:"womenswear.knitwear.vneck"},
    {catalog:529, size:"S / UK 8-10", colours:["White","Red"], count:7, category:"womenswear.knitwear.knitted"},
  ]) {
    const source = normalizeVintedSource({id:sample.catalog,title:"Sample knitwear",description:"Original description",price:{amount:"24.99"},
      catalog_id:sample.catalog,size_title:sample.size,brand:{title:"Ralph Lauren"},condition_title:"Very good",
      colors:sample.colours.map(title=>({title})),photos:Array.from({length:sample.count},(_,i)=>({url:`https://example.test/${i}.jpg`}))});
    assert.equal(resolveSourceCategory(source,CATEGORIES),sample.category);
    assert.equal(source.sizeLabel,sample.size);
    assert.equal(source.colour,sample.colours.join(", "));
    assert.equal(source.photoUrls.length,sample.count);
    assert.equal(source.material,null);
  }
});
