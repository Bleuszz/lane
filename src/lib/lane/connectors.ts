import type { ItemView, MarketplaceId } from "./types";

/** Capability declarations are promises a connector implements, not marketing availability. */
export type ConnectorCapabilities = {
  import: boolean;
  publish: boolean;
  update: boolean;
  delist: boolean;
  soldEvents: boolean;
  reconcilePublish: boolean;
  requiresBrowser: boolean;
};

export type ChannelDraft = {
  item: ItemView;
  accountId: string;
  priceGbp: number;
  quantity: number;
  /** Destination-only values; never overwrite the canonical inventory with guessed data. */
  fields: Record<string, unknown>;
};

export type PublishedListing = { remoteId: string; url: string; receipt: Record<string, string> };
export type Reconciliation =
  | { status: "found"; listing: PublishedListing }
  | { status: "absent" }
  | { status: "unknown"; reason: string };

/** New marketplaces must implement this contract before being offered as connectable. */
export interface MarketplaceConnector {
  id: MarketplaceId;
  capabilities: ConnectorCapabilities;
  validate(draft: ChannelDraft): Promise<{ field: string; message: string }[]>;
  publish(draft: ChannelDraft, operationId: string): Promise<PublishedListing>;
  reconcile(draft: ChannelDraft, operationId: string): Promise<Reconciliation>;
  update(draft: ChannelDraft, listing: PublishedListing): Promise<void>;
  delist(listing: PublishedListing): Promise<void>;
}
