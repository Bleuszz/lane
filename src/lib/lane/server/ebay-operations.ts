/** Response interpretation kept pure so retry decisions can be exercised without a marketplace account. */
export type EbayOffer = {
  offerId?: string; sku?: string; marketplaceId?: string; format?: string; status?: string;
  listing?: { listingId?: string; listingStatus?: string };
  [key: string]: unknown;
};

export function selectEbayOffer(offers: EbayOffer[], sku: string): EbayOffer | undefined {
  const matching = offers.filter((offer) => offer.sku === sku && offer.marketplaceId === "EBAY_GB" && offer.format === "FIXED_PRICE");
  if (matching.length > 1) throw new Error("Several eBay offers match this item. Reconcile them before publishing again.");
  return matching[0];
}

export function liveEbayReceipt(offer: EbayOffer | undefined) {
  if (offer?.status !== "PUBLISHED") return null;
  if (!offer.offerId || !offer.sku || !offer.listing?.listingId) {
    throw new Error("eBay reports a published offer without a complete receipt. Check the listing before retrying.");
  }
  return { offerId: offer.offerId, sku: offer.sku, listingId: offer.listing.listingId,
    url: `https://www.ebay.co.uk/itm/${offer.listing.listingId}` };
}

export function selectSellerPolicy(policies: Record<string, unknown>[], field: string, selected?: string) {
  const compatible = policies.filter((policy) => policy.marketplaceId === "EBAY_GB" &&
    Array.isArray(policy.categoryTypes) && policy.categoryTypes.some((category: { name?: string }) => category.name === "ALL_EXCLUDING_MOTORS_VEHICLES"));
  const match = selected ? compatible.find((policy) => policy[field] === selected) : compatible.length === 1 ? compatible[0] : undefined;
  if (!match?.[field]) throw new Error(`Choose a ${field.replace("PolicyId", "")} policy belonging to this eBay shop before publishing.`);
  return String(match[field]);
}
