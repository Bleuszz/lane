export type ImportedSource = {
  remoteId: string; title: string; description: string | null; priceGbp: number;
  photoUrl?: string | null; photoUrls?: string[]; brand?: string | null;
  sizeLabel?: string | null; categoryName?: string | null; categoryPath?: string | null;
  categoryId?: string | null; conditionLabel?: string | null; colour?: string | null;
  material?: string | null; attributes?: Record<string, unknown>; url?: string | null;
};

/** Never choose an ambiguous 'T-shirts' leaf based on array order. */
export function resolveSourceCategory(source: ImportedSource, categories: { id: string; ebayUk?: { id: string | null }; vintedUk: { catalogId: string | null; path: string; name: string } }[], marketplace = "vinted_uk"): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (marketplace === "ebay_uk") {
    const matches = categories.filter(c => source.categoryId && c.ebayUk?.id === source.categoryId);
    return matches.length === 1 ? matches[0]!.id : "";
  }
  const byId = source.categoryId && categories.filter((c) => c.vintedUk.catalogId === source.categoryId);
  if (byId && byId.length === 1) return byId[0]!.id;
  const byPath = source.categoryPath && categories.filter((c) => norm(c.vintedUk.path) === norm(source.categoryPath!));
  if (byPath && byPath.length === 1) return byPath[0]!.id;
  const byName = source.categoryName && categories.filter((c) => norm(c.vintedUk.name) === norm(source.categoryName!));
  return byName && byName.length === 1 ? byName[0]!.id : "";
}

export function sourcePhotos(source: ImportedSource): { url: string }[] {
  const urls = [...(source.photoUrls ?? []), ...(source.photoUrl ? [source.photoUrl] : [])];
  return [...new Set(urls.filter((u) => /^https?:\/\//i.test(u)))].slice(0, 12).map((url) => ({ url }));
}

/** Listing attributes only: deliberately exclude seller profiles, tokens and cookies. */
export function listingSourceSnapshot(source: ImportedSource) {
  return {
    remoteId: source.remoteId, title: source.title, description: source.description,
    categoryId: source.categoryId ?? null, categoryName: source.categoryName ?? null,
    categoryPath: source.categoryPath ?? null, brand: source.brand ?? null,
    condition: source.conditionLabel ?? null, size: source.sizeLabel ?? null,
    colour: source.colour ?? null, material: source.material ?? null,
    photos: sourcePhotos(source).map((p) => p.url), priceGbp: source.priceGbp,
    attributes: source.attributes ?? {},
  };
}
