/** Normalize source listing data without seller profiles or authentication data. */
export function normalizeVintedSource(raw: Record<string, unknown>) {
  const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const label = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;
  const brand = obj(raw.brand ?? raw.brand_dto);
  const category = obj(raw.catalog);
  const photo = obj(raw.photo);
  const photos = Array.isArray(raw.photos) ? raw.photos : [];
  const photoUrls = photos.map((p) => label(obj(p).url) ?? label(obj(p).full_size_url)).filter((p): p is string => Boolean(p));
  const firstPhoto = label(photo.url) ?? photoUrls[0] ?? null;
  const allPhotos = [...new Set([...photoUrls, ...(firstPhoto ? [firstPhoto] : [])])].filter((u) => /^https?:\/\//i.test(u)).slice(0, 12);
  const amount = Number(obj(raw.price).amount ?? raw.price ?? 0);
  const rawColour = raw.color ?? raw.colour ?? raw.colors;
  const colour = Array.isArray(rawColour) ? rawColour.map((c) => label(obj(c).title) ?? label(c)).filter(Boolean).join(", ") : label(rawColour) ?? label(raw.colour_title);
  const conditionNames: Record<string, string> = { "6": "New with tags", "1": "New without tags", "2": "Very good", "3": "Good", "4": "Satisfactory" };
  const conditionLabel = label(raw.status_title) ?? label(raw.condition_title) ?? conditionNames[String(raw.status_id ?? raw.status)] ?? (typeof raw.status === "string" && ["Very good", "Good", "Satisfactory", "New with tags", "New without tags"].includes(raw.status) ? raw.status : null);
  const attributes = Array.isArray(raw.item_attributes) ? raw.item_attributes.slice(0, 50).map((a) => { const v = obj(a); return { id: v.id ?? null, name: label(v.name) ?? label(v.title), value: label(v.value) ?? label(v.title) }; }) : [];
  return {
    remoteId: String(raw.id ?? ""), title: String(raw.title ?? ""),
    description: label(raw.description), priceGbp: Number.isFinite(amount) ? amount : 0,
    photoUrl: firstPhoto, photoUrls: allPhotos,
    brand: label(brand.title) ?? label(raw.brand_title),
    sizeLabel: label(raw.size_title) ?? label(raw.size),
    categoryName: label(category.title) ?? label(raw.catalog_title),
    categoryId: raw.catalog_id != null ? String(raw.catalog_id) : category.id != null ? String(category.id) : null,
    categoryPath: label(raw.catalog_path) ?? label(category.path),
    colour: colour || null, conditionLabel, material: label(raw.material) ?? label(raw.material_title),
    attributes: { itemAttributes: attributes },
    url: label(raw.url) ?? `https://www.vinted.co.uk/items/${String(raw.id ?? "")}`,
    status: raw.is_closed ? raw.item_closing_action === "sold" ? "sold" : "ended" : "live",
  };
}
