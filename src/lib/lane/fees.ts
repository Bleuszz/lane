import type { MarketplaceId } from "./types";

/** UK fee tables for 2026. Hand-coded from published seller docs — not live rates. */
export type FeeBreakdown = {
  marketplace: MarketplaceId;
  listPriceGbp: number;
  feeGbp: number;
  youReceiveGbp: number;
  note: string;
};

export function ebayFvfRate(canonicalCategory: string | null | undefined): number {
  const cat = canonicalCategory ?? "";
  if (cat.startsWith("electronics")) return 0.1115;
  if (cat.startsWith("menswear.footwear") || cat.startsWith("womenswear.footwear")) {
    return 0.1115;
  }
  // Clothing, shoes, accessories — eBay UK 2025/26 published FVF band
  if (cat.startsWith("menswear") || cat.startsWith("womenswear") || cat.startsWith("accessories")) {
    return 0.1115;
  }
  return 0.1115;
}

export function estimateFees(opts: {
  marketplace: MarketplaceId;
  listPriceGbp: number;
  shippingGbp?: number;
  categoryCanonical?: string | null;
}): FeeBreakdown {
  const list = opts.listPriceGbp;
  const shipping = opts.shippingGbp ?? 0;
  const total = list + shipping;

  if (opts.marketplace === "ebay_uk") {
    const rate = ebayFvfRate(opts.categoryCanonical);
    const fee = Math.round((total * rate + 0.3) * 100) / 100;
    return {
      marketplace: "ebay_uk",
      listPriceGbp: list,
      feeGbp: fee,
      youReceiveGbp: Math.round((list - fee) * 100) / 100,
      note: `eBay UK FVF ${Math.round(rate * 10000) / 100}% of item+postage + £0.30. Insertion free on a shop.`,
    };
  }

  if (opts.marketplace === "vinted_uk") {
    return {
      marketplace: "vinted_uk",
      listPriceGbp: list,
      feeGbp: 0,
      youReceiveGbp: list,
      note: "Vinted UK seller fee is £0. Buyer protection is paid by the buyer, not you.",
    };
  }

  if (opts.marketplace === "depop_uk") {
    const fee = Math.round((list * 0.1 + 0.3) * 100) / 100;
    return {
      marketplace: "depop_uk",
      listPriceGbp: list,
      feeGbp: fee,
      youReceiveGbp: Math.round((list - fee) * 100) / 100,
      note: "Depop UK: 10% selling fee + 30p payment fee (2025 published table).",
    };
  }

  return {
    marketplace: opts.marketplace,
    listPriceGbp: list,
    feeGbp: 0,
    youReceiveGbp: list,
    note: "Fee table not loaded for this channel yet.",
  };
}

export function compareTakeHome(opts: {
  listPriceGbp: number;
  categoryCanonical?: string | null;
}): { ebay: FeeBreakdown; vinted: FeeBreakdown } {
  return {
    ebay: estimateFees({
      marketplace: "ebay_uk",
      listPriceGbp: opts.listPriceGbp,
      categoryCanonical: opts.categoryCanonical,
    }),
    vinted: estimateFees({
      marketplace: "vinted_uk",
      listPriceGbp: opts.listPriceGbp,
    }),
  };
}
