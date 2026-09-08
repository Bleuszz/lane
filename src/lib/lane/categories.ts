export type CanonicalCategory = {
  id: string;
  label: string;
  path: string;
  ebayUk: { id: string | null; name: string; confirmed: boolean };
  vintedUk: { catalogId: string | null; name: string; path: string };
};

/**
 * Canonical tree with marketplace maps. eBay IDs that are well-known from the
 * public taxonomy are marked confirmed. Unknown IDs stay null — the form
 * shows a picker rather than silently posting the wrong leaf.
 */
export const CATEGORIES: CanonicalCategory[] = [
  {
    id: "menswear.tops.tshirts",
    label: "Men's T-shirts",
    path: "Menswear / Tops / T-shirts",
    ebayUk: { id: "15687", name: "Men's T-Shirts", confirmed: true },
    vintedUk: { catalogId: null, name: "T-shirts", path: "Men / Clothes / T-shirts" },
  },
  {
    id: "menswear.tops.hoodies",
    label: "Men's Hoodies",
    path: "Menswear / Tops / Hoodies",
    ebayUk: { id: "155184", name: "Men's Hoodies & Sweats", confirmed: false },
    vintedUk: { catalogId: null, name: "Hoodies & sweatshirts", path: "Men / Clothes / Jumpers & sweatshirts" },
  },
  {
    id: "menswear.tops.knitwear",
    label: "Men's Knitwear",
    path: "Menswear / Tops / Knitwear",
    ebayUk: { id: "11484", name: "Men's Jumpers", confirmed: false },
    vintedUk: { catalogId: null, name: "Jumpers", path: "Men / Clothes / Jumpers & sweatshirts" },
  },
  {
    id: "menswear.tops.polos",
    label: "Men's Polos",
    path: "Menswear / Tops / Polos",
    ebayUk: { id: "185101", name: "Men's Polo Shirts", confirmed: false },
    vintedUk: { catalogId: null, name: "Polo shirts", path: "Men / Clothes / Polo shirts" },
  },
  {
    id: "menswear.bottoms.jeans",
    label: "Men's Jeans",
    path: "Menswear / Bottoms / Jeans",
    ebayUk: { id: "11483", name: "Men's Jeans", confirmed: true },
    vintedUk: { catalogId: null, name: "Jeans", path: "Men / Clothes / Jeans" },
  },
  {
    id: "menswear.outerwear.jackets",
    label: "Men's Jackets",
    path: "Menswear / Outerwear / Jackets",
    ebayUk: { id: "57988", name: "Men's Coats, Jackets & Waistcoats", confirmed: true },
    vintedUk: { catalogId: null, name: "Jackets", path: "Men / Clothes / Jackets & coats" },
  },
  {
    id: "menswear.outerwear.coats",
    label: "Men's Coats",
    path: "Menswear / Outerwear / Coats",
    ebayUk: { id: "57988", name: "Men's Coats, Jackets & Waistcoats", confirmed: true },
    vintedUk: { catalogId: null, name: "Coats", path: "Men / Clothes / Jackets & coats" },
  },
  {
    id: "menswear.footwear.trainers",
    label: "Men's Trainers",
    path: "Menswear / Footwear / Trainers",
    ebayUk: { id: "15709", name: "Men's Trainers", confirmed: false },
    vintedUk: { catalogId: null, name: "Trainers", path: "Men / Shoes / Trainers" },
  },
  {
    id: "menswear.footwear.boots",
    label: "Men's Boots",
    path: "Menswear / Footwear / Boots",
    ebayUk: { id: "11498", name: "Men's Boots", confirmed: true },
    vintedUk: { catalogId: null, name: "Boots", path: "Men / Shoes / Boots" },
  },
  {
    id: "womenswear.tops.tshirts",
    label: "Women's T-shirts",
    path: "Womenswear / Tops / T-shirts",
    ebayUk: { id: "53159", name: "Women's T-Shirts", confirmed: false },
    vintedUk: { catalogId: null, name: "T-shirts", path: "Women / Clothes / T-shirts" },
  },
  {
    id: "womenswear.dresses",
    label: "Women's Dresses",
    path: "Womenswear / Dresses",
    ebayUk: { id: "63861", name: "Women's Dresses", confirmed: true },
    vintedUk: { catalogId: null, name: "Dresses", path: "Women / Clothes / Dresses" },
  },
  {
    id: "accessories.bags",
    label: "Bags",
    path: "Accessories / Bags",
    ebayUk: { id: "169291", name: "Bags", confirmed: false },
    vintedUk: { catalogId: null, name: "Bags", path: "Men / Accessories / Bags" },
  },
];

export function findCategory(id: string | null | undefined): CanonicalCategory | undefined {
  if (!id) return undefined;
  return CATEGORIES.find((c) => c.id === id);
}

export function searchCategories(q: string): CanonicalCategory[] {
  const n = q.trim().toLowerCase();
  if (!n) return CATEGORIES;
  return CATEGORIES.filter(
    (c) =>
      c.label.toLowerCase().includes(n) ||
      c.path.toLowerCase().includes(n) ||
      c.ebayUk.name.toLowerCase().includes(n) ||
      c.vintedUk.name.toLowerCase().includes(n),
  );
}
