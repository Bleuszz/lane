import type { ChannelMode, MarketplaceId } from "./types";

export type ChannelDef = {
  id: MarketplaceId;
  label: string;
  short: string;
  mode: ChannelMode;
  pack: "uk" | "shop" | "export";
  priority: 0 | 1 | 2 | 3 | 4;
  enabled: boolean;
  singleQty: boolean;
  site: string;
};

export const CHANNELS: Record<MarketplaceId, ChannelDef> = {
  vinted_uk: {
    id: "vinted_uk",
    label: "Vinted UK",
    short: "Vinted",
    mode: "extension",
    pack: "uk",
    priority: 0,
    enabled: true,
    singleQty: true,
    site: "www.vinted.co.uk",
  },
  ebay_uk: {
    id: "ebay_uk",
    label: "eBay UK",
    short: "eBay",
    mode: "oauth",
    pack: "uk",
    priority: 0,
    enabled: true,
    singleQty: false,
    site: "www.ebay.co.uk",
  },
  depop_uk: {
    id: "depop_uk",
    label: "Depop",
    short: "Depop",
    mode: "extension",
    pack: "uk",
    priority: 1,
    enabled: false,
    singleQty: true,
    site: "www.depop.com",
  },
  facebook_uk: {
    id: "facebook_uk",
    label: "Facebook Marketplace",
    short: "Facebook",
    mode: "extension",
    pack: "uk",
    priority: 1,
    enabled: false,
    singleQty: true,
    site: "www.facebook.com",
  },
  etsy_uk: {
    id: "etsy_uk",
    label: "Etsy UK",
    short: "Etsy",
    mode: "oauth",
    pack: "uk",
    priority: 2,
    enabled: false,
    singleQty: false,
    site: "www.etsy.com",
  },
  gumtree_uk: {
    id: "gumtree_uk",
    label: "Gumtree",
    short: "Gumtree",
    mode: "extension",
    pack: "uk",
    priority: 2,
    enabled: false,
    singleQty: true,
    site: "www.gumtree.com",
  },
  shopify: {
    id: "shopify",
    label: "Shopify",
    short: "Shopify",
    mode: "oauth",
    pack: "shop",
    priority: 3,
    enabled: false,
    singleQty: false,
    site: "shopify.com",
  },
  woocommerce: {
    id: "woocommerce",
    label: "WooCommerce",
    short: "Woo",
    mode: "oauth",
    pack: "shop",
    priority: 3,
    enabled: false,
    singleQty: false,
    site: "woocommerce.com",
  },
  grailed: {
    id: "grailed",
    label: "Grailed",
    short: "Grailed",
    mode: "extension",
    pack: "export",
    priority: 4,
    enabled: false,
    singleQty: true,
    site: "www.grailed.com",
  },
  whatnot: {
    id: "whatnot",
    label: "Whatnot",
    short: "Whatnot",
    mode: "oauth",
    pack: "export",
    priority: 4,
    enabled: false,
    singleQty: false,
    site: "www.whatnot.com",
  },
  poshmark: {
    id: "poshmark",
    label: "Poshmark",
    short: "Poshmark",
    mode: "extension",
    pack: "export",
    priority: 4,
    enabled: false,
    singleQty: true,
    site: "poshmark.com",
  },
  mercari: {
    id: "mercari",
    label: "Mercari",
    short: "Mercari",
    mode: "extension",
    pack: "export",
    priority: 4,
    enabled: false,
    singleQty: true,
    site: "www.mercari.com",
  },
};

export const MVP_CHANNELS: MarketplaceId[] = ["vinted_uk", "ebay_uk"];

export function channelList(opts?: { includeDisabled?: boolean }): ChannelDef[] {
  return Object.values(CHANNELS)
    .filter((c) => opts?.includeDisabled || c.enabled)
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

export function isMarketplaceId(value: string): value is MarketplaceId {
  return value in CHANNELS;
}
