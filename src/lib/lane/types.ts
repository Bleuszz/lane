export const ITEM_STATUSES = [
  "draft",
  "queued",
  "live",
  "sold",
  "reserved",
  "error",
  "archived",
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CONDITIONS = [
  "new_with_tags",
  "new_without_tags",
  "very_good",
  "good",
  "satisfactory",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags: "New with tags",
  new_without_tags: "New without tags",
  very_good: "Very good",
  good: "Good",
  satisfactory: "Satisfactory",
};

export const EBAY_CONDITION_MAP: Record<Condition, { id: string; name: string }> = {
  new_with_tags: { id: "1000", name: "New" },
  new_without_tags: { id: "1500", name: "New other" },
  very_good: { id: "4000", name: "Very Good" },
  good: { id: "5000", name: "Good" },
  satisfactory: { id: "6000", name: "Acceptable" },
};

export const JOB_TYPES = [
  "publish",
  "update",
  "delist",
  "relist",
  "import",
  "fetch_status",
  "mark_sold",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  "queued",
  "waiting_for_browser",
  "uploading_photos",
  "creating",
  "running",
  "done",
  "error",
  "dead",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ACCOUNT_STATUSES = [
  "green",
  "needs_reauth",
  "extension_offline",
  "rate_limited",
  "paused",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const PLANS = ["starter", "seller", "pro"] as const;
export type PlanId = (typeof PLANS)[number];

export const AI_VOICES = ["short", "detailed", "vintage", "streetwear"] as const;
export type AiVoice = (typeof AI_VOICES)[number];

export type ChannelMode = "oauth" | "extension";

export type MarketplaceId =
  | "vinted_uk"
  | "ebay_uk"
  | "depop_uk"
  | "facebook_uk"
  | "etsy_uk"
  | "gumtree_uk"
  | "shopify"
  | "woocommerce"
  | "grailed"
  | "whatnot"
  | "poshmark"
  | "mercari";

export type RemoteListingPreview = {
  remoteId: string;
  title: string;
  description: string | null;
  priceGbp: number;
  photoUrl: string | null;
  brand: string | null;
  sizeLabel: string | null;
  categoryName: string | null;
  conditionLabel: string | null;
  status: string;
  phash: string | null;
  url: string | null;
};

export type ChannelListingView = {
  id: string;
  itemId: string;
  marketplace: MarketplaceId;
  marketplaceAccountId: string;
  accountLabel: string;
  mode: ChannelMode;
  remoteId: string | null;
  url: string | null;
  mappedCategory: string | null;
  mappedCategoryId: string | null;
  channelPriceGbp: number | null;
  channelShippingGbp: number | null;
  remoteStatus: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  quantityOnChannel: number;
};

export type PhotoView = {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  phash: string | null;
};

export type ItemView = {
  id: string;
  sku: string | null;
  title: string;
  description: string;
  brand: string | null;
  categoryCanonical: string | null;
  condition: Condition;
  sizeUk: string | null;
  sizeEu: string | null;
  sizeUs: string | null;
  colour: string | null;
  material: string | null;
  gender: string | null;
  era: string | null;
  costPriceGbp: number | null;
  basePriceGbp: number;
  quantity: number;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  postageProfileId: string | null;
  notes: string | null;
  status: ItemStatus;
  soldChannel: string | null;
  soldPriceGbp: number | null;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  photos: PhotoView[];
  channels: ChannelListingView[];
};

export type InventoryRow = {
  id: string;
  sku: string | null;
  title: string;
  brand: string | null;
  quantity: number;
  basePriceGbp: number;
  status: ItemStatus;
  createdAt: string;
  primaryPhotoUrl: string | null;
  colour: string | null;
  categoryCanonical: string | null;
  channels: {
    id: string;
    marketplace: MarketplaceId;
    remoteStatus: string;
    channelPriceGbp: number | null;
    url: string | null;
    lastError: string | null;
  }[];
};

export type AccountView = {
  id: string;
  marketplace: MarketplaceId;
  mode: ChannelMode;
  label: string;
  remoteUsername: string | null;
  status: AccountStatus;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  consecutiveErrors: number;
  maxPublishesPerHour: number;
  publishesThisHour: number;
  oauthConnected: boolean;
  sandbox: boolean;
  forceError: string | null;
  hasServerSession: boolean;
  createdAt: string;
};

export type JobView = {
  id: string;
  type: JobType;
  status: JobStatus;
  marketplace: MarketplaceId | null;
  accountId: string | null;
  itemId: string | null;
  itemTitle: string | null;
  channelListingId: string | null;
  requestId: string;
  attempt: number;
  maxAttempts: number;
  errorMessage: string | null;
  errorBody: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type SaleView = {
  id: string;
  itemId: string;
  itemTitle: string;
  marketplace: MarketplaceId;
  soldPriceGbp: number;
  feesGbp: number | null;
  netGbp: number | null;
  quantity: number;
  detectedVia: string;
  createdAt: string;
  costPriceGbp: number | null;
};

export type ShippingProfileView = {
  id: string;
  name: string;
  marketplace: MarketplaceId | null;
  carrier: string;
  service: string;
  packageType: string;
  buyerPays: boolean;
  priceGbp: number;
  collection: boolean;
};

export type PricingRuleView = {
  id: string;
  marketplace: MarketplaceId;
  kind: "flat" | "plus_amount" | "plus_percent" | "round_99" | "undercut";
  amount: number | null;
  undercutMarketplace: MarketplaceId | null;
};

export type TemplateView = {
  id: string;
  name: string;
  payload: string;
  createdAt: string;
};

export type UserSettingsView = {
  plan: PlanId;
  aiPack: boolean;
  onboardingStep: number;
  onboardingComplete: boolean;
  extensionEnabled: boolean;
  extensionAwake: boolean;
  pairingToken: string | null;
  actionsUsedMonth: number;
  actionsMonth: string | null;
  actionsLimit: number;
  actionsRemaining: number;
  billingStatus: string;
  stripeCustomerId: string | null;
};

export type InboxPayload = {
  failedJobs: JobView[];
  waitingJobs: JobView[];
  offlineAccounts: AccountView[];
  reauthAccounts: AccountView[];
};

export type StripeSetup = {
  configured: boolean;
  secret: boolean;
  webhook: boolean;
  prices: { starter: boolean; seller: boolean; pro: boolean; aiPack: boolean };
};

export type BootstrapPayload = {
  settings: UserSettingsView;
  accounts: AccountView[];
  inbox: InboxPayload;
  liveCount: number;
  soldCount: number;
  errorCount: number;
  draftCount: number;
  gmvGbp: number;
  ebayConfigured: boolean;
  stripeConfigured: boolean;
  stripeSetup: StripeSetup;
};

export type ItemDraft = {
  title: string;
  description: string;
  brand: string;
  categoryCanonical: string;
  condition: Condition;
  sizeUk: string;
  sizeEu: string;
  sizeUs: string;
  colour: string;
  material: string;
  gender: string;
  era: string;
  costPriceGbp: string;
  basePriceGbp: string;
  quantity: string;
  weightG: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  postageProfileId: string;
  notes: string;
  tags: string;
  sku: string;
  photos: { url: string; phash?: string }[];
};
