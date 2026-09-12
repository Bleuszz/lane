import { ebayPhotoError } from "./photos.ts";
import type { ItemDraft } from "@/lib/lane/types";

export type ListingTarget = "vinted" | "ebay" | "both";

export const LISTING_TARGETS: { id: ListingTarget; title: string; body: string }[] = [
  {
    id: "vinted",
    title: "Vinted only",
    body: "Prepare a listing for your Vinted wardrobe.",
  },
  {
    id: "ebay",
    title: "eBay only",
    body: "Start with your item, then complete the details eBay needs.",
  },
  {
    id: "both",
    title: "Vinted + eBay",
    body: "Prepare one item for both shops, with a final review before publishing.",
  },
];

export const VINTED_PARCELS = [
  { id: "vinted_small", label: "Small", sizeId: 1, hint: "Jewellery, small accessories" },
  { id: "vinted_medium", label: "Medium", sizeId: 2, hint: "Tops, shoes, most clothing" },
  { id: "vinted_large", label: "Large", sizeId: 3, hint: "Coats, bulky items" },
] as const;

export const COLOURS = [
  "Black",
  "White",
  "Grey",
  "Beige",
  "Cream",
  "Brown",
  "Navy",
  "Blue",
  "Light blue",
  "Turquoise",
  "Green",
  "Khaki",
  "Yellow",
  "Orange",
  "Red",
  "Pink",
  "Burgundy",
  "Purple",
  "Gold",
  "Silver",
  "Multicolour",
] as const;

export function packageSizeId(postageProfileId: string | null | undefined): number {
  if (postageProfileId === "vinted_medium") return 2;
  if (postageProfileId === "vinted_large") return 3;
  return 1;
}

export function genderFromCategory(canonical: string | null | undefined): string {
  if (!canonical) return "unisex";
  if (canonical.startsWith("womenswear")) return "women";
  if (canonical.startsWith("kids")) return "kids";
  if (canonical.startsWith("menswear")) return "men";
  return "unisex";
}

export function departmentOf(canonical: string): "men" | "women" | "kids" | "other" {
  if (canonical.startsWith("menswear") || canonical.startsWith("men.")) return "men";
  if (canonical.startsWith("womenswear") || canonical.startsWith("women.")) return "women";
  if (canonical.startsWith("kids")) return "kids";
  return "other";
}

export function needsSize(canonical: string | null | undefined): boolean {
  if (!canonical) return true;
  if (canonical.startsWith("accessories")) return false;
  return true;
}

export function fieldsFor(target: ListingTarget) {
  const vinted = target === "vinted" || target === "both";
  const ebay = target === "ebay" || target === "both";
  return {
    vinted,
    ebay,
    photos: true,
    title: true,
    description: true,
    category: true,
    condition: true,
    price: true,
    brand: true,
    colour: true,
    sizeUk: true,
    material: vinted,
    parcel: vinted,
    sku: ebay,
    quantity: ebay,
    weight: ebay,
    dimensions: ebay,
    httpsPhotos: ebay,
    titleMax: ebay ? 80 : 100,
    descriptionMax: vinted && !ebay ? 1000 : 4000,
  };
}

export function validateListing(draft: ItemDraft, target: ListingTarget): string[] {
  const f = fieldsFor(target);
  const errors: string[] = [];
  if (draft.condition === "unknown") errors.push("Confirm the item condition before publishing.");
  if (draft.photos.length === 0) errors.push("Add at least one photo.");
  if (!draft.title.trim()) errors.push("Title is required.");
  if (f.ebay && draft.title.trim().length > 80) errors.push("eBay titles max 80 characters.");
  if (f.vinted && !f.ebay && draft.title.trim().length > 100) errors.push("Vinted titles max 100 characters.");
  if (!draft.description.trim()) errors.push("Description is required.");
  if (f.vinted && !f.ebay && draft.description.trim().length > 1000) {
    errors.push("Vinted descriptions max 1,000 characters.");
  }
  if (!draft.categoryCanonical) errors.push("Pick a category.");
  const price = Number(draft.basePriceGbp);
  if (!Number.isFinite(price) || price <= 0) errors.push("Price must be a number in GBP.");
  if (f.vinted && !draft.brand.trim()) errors.push("Vinted needs a brand, or tick No brand.");
  if (f.vinted && needsSize(draft.categoryCanonical) && !draft.sizeUk.trim()) {
    errors.push("Vinted needs a size for this category.");
  }
  if (f.vinted && !draft.colour.trim()) errors.push("Vinted needs a colour.");
  if (f.vinted && !draft.postageProfileId) errors.push("Pick a Vinted parcel size.");
  if (f.ebay) {
    const photoError = ebayPhotoError(draft.photos.map(p => p.url));
    if (photoError) errors.push(photoError);
    const qty = Number(draft.quantity);
    if (!Number.isFinite(qty) || qty < 1) errors.push("eBay needs quantity of at least 1.");
  }
  return errors;
}
