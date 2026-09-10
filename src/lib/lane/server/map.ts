import { bool, iso, num, num0 } from "@/lib/lane/format";
import { TRIAL_ACTION_LIMIT } from "@/lib/lane/plans";
import { entitlements } from "../entitlements";
import { recordActivation } from "./events";
import { CHANNELS } from "@/lib/lane/channels";
import type {
  AccountStatus,
  AccountView,
  ChannelListingView,
  Condition,
  ItemStatus,
  ItemView,
  JobStatus,
  JobType,
  JobView,
  MarketplaceId,
  PhotoView,
  PlanId,
  PricingRuleView,
  SaleView,
  ShippingProfileView,
  TemplateView,
  UserSettingsView,
} from "@/lib/lane/types";
import { monthKey } from "@/lib/lane/format";
import type { Sql } from "@/lib/db";
import { makeId } from "@/lib/lane/ids";
import { POSTAGE_PRESETS } from "@/lib/lane/postage";
import { randomToken } from "./secret";

export function asPlan(v: unknown): PlanId {
  return v === "seller" || v === "pro" ? v : "starter";
}

export function mapSettings(row: Record<string, unknown>): UserSettingsView {
  const plan = asPlan(row.plan);
  const used = num0(row.actions_used_month);
  const trialStartedAt = iso(row.trial_started_at);
  const trialEndsAt = iso(row.trial_ends_at);
  const trialActionsUsed = num0(row.trial_actions_used);
  const billingStatus = String(row.billing_status ?? "trialing");
  const access = entitlements({ plan, billingStatus, trialEndsAt, trialActionsUsed, actionsUsedMonth: used });
  const limit = access.actionsLimit;
  return {
    plan,
    trialStartedAt, trialEndsAt, trialActionsUsed, trialActionsLimit: TRIAL_ACTION_LIMIT,
    trialActive: access.trialActive, canPublish: access.canPublish,
    aiPack: access.aiCreditsLimit > 0 && bool(row.ai_autofill_enabled),
    aiAutofillEnabled: bool(row.ai_autofill_enabled),
    aiCreditsUsed: num0(row.ai_credits_used),
    aiCreditsLimit: access.aiCreditsLimit,
    onboardingStep: num0(row.onboarding_step),
    onboardingComplete: bool(row.onboarding_complete),
    extensionEnabled: bool(row.extension_enabled),
    extensionAwake: bool(row.extension_awake),
    pairingToken: row.extension_pairing_token ? String(row.extension_pairing_token) : null,
    actionsUsedMonth: used,
    actionsMonth: row.actions_month ? String(row.actions_month) : null,
    actionsLimit: limit,
    actionsRemaining: access.actionsRemaining,
    billingStatus,
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
  };
}

export function mapAccount(row: Record<string, unknown>): AccountView {
  const marketplace = String(row.marketplace) as MarketplaceId;
  return {
    id: String(row.id),
    marketplace,
    mode: CHANNELS[marketplace]?.mode ?? "extension",
    label: String(row.label),
    remoteUsername: row.remote_username ? String(row.remote_username) : null,
    status: String(row.status) as AccountStatus,
    lastHeartbeatAt: iso(row.last_heartbeat_at),
    lastError: row.last_error ? String(row.last_error) : null,
    consecutiveErrors: num0(row.consecutive_errors),
    maxPublishesPerHour: num0(row.max_publishes_per_hour) || 30,
    publishesThisHour: num0(row.publishes_this_hour),
    oauthConnected: bool(row.oauth_connected),
    sandbox: bool(row.sandbox),
    forceError: row.force_error ? String(row.force_error) : null,
    hasServerSession: Boolean(row.oauth_refresh_token),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
  };
}

export function mapPhoto(row: Record<string, unknown>): PhotoView {
  return {
    id: String(row.id),
    url: String(row.url),
    sortOrder: num0(row.sort_order),
    isPrimary: bool(row.is_primary),
    phash: row.phash ? String(row.phash) : null,
  };
}

export function mapChannel(
  row: Record<string, unknown>,
  account?: AccountView,
): ChannelListingView {
  const marketplace = String(row.marketplace) as MarketplaceId;
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    marketplace,
    marketplaceAccountId: String(row.marketplace_account_id),
    accountLabel: account?.label ?? CHANNELS[marketplace]?.label ?? marketplace,
    mode: account?.mode ?? CHANNELS[marketplace]?.mode ?? "extension",
    remoteId: row.remote_id ? String(row.remote_id) : null,
    url: row.url ? String(row.url) : null,
    mappedCategory: row.mapped_category ? String(row.mapped_category) : null,
    mappedCategoryId: row.mapped_category_id ? String(row.mapped_category_id) : null,
    channelPriceGbp: num(row.channel_price_gbp),
    channelShippingGbp: num(row.channel_shipping_gbp),
    remoteStatus: String(row.remote_status ?? "draft"),
    lastSyncedAt: iso(row.last_synced_at),
    lastError: row.last_error ? String(row.last_error) : null,
    quantityOnChannel: num0(row.quantity_on_channel),
  };
}

export function mapItemBase(row: Record<string, unknown>): Omit<ItemView, "tags" | "photos" | "channels"> {
  return {
    channelFields: (row.channel_fields ?? {}) as ItemView["channelFields"],
    id: String(row.id),
    sku: row.sku ? String(row.sku) : null,
    title: String(row.title),
    description: String(row.description ?? ""),
    brand: row.brand ? String(row.brand) : null,
    categoryCanonical: row.category_canonical ? String(row.category_canonical) : null,
    condition: (String(row.condition ?? "unknown") as Condition),
    sizeUk: row.size_uk ? String(row.size_uk) : null,
    sizeEu: row.size_eu ? String(row.size_eu) : null,
    sizeUs: row.size_us ? String(row.size_us) : null,
    colour: row.colour ? String(row.colour) : null,
    material: row.material ? String(row.material) : null,
    gender: row.gender ? String(row.gender) : null,
    era: row.era ? String(row.era) : null,
    costPriceGbp: num(row.cost_price_gbp),
    basePriceGbp: num0(row.base_price_gbp),
    quantity: num0(row.quantity),
    weightG: num(row.weight_g),
    lengthCm: num(row.length_cm),
    widthCm: num(row.width_cm),
    heightCm: num(row.height_cm),
    postageProfileId: row.postage_profile_id ? String(row.postage_profile_id) : null,
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status ?? "draft") as ItemStatus,
    soldChannel: row.sold_channel ? String(row.sold_channel) : null,
    soldPriceGbp: num(row.sold_price_gbp),
    soldAt: iso(row.sold_at),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

export function mapJob(row: Record<string, unknown>): JobView {
  return {
    id: String(row.id),
    type: String(row.type) as JobType,
    status: String(row.status) as JobStatus,
    marketplace: row.marketplace ? (String(row.marketplace) as MarketplaceId) : null,
    accountId: row.account_id ? String(row.account_id) : null,
    itemId: row.item_id ? String(row.item_id) : null,
    itemTitle: row.item_title ? String(row.item_title) : null,
    channelListingId: row.channel_listing_id ? String(row.channel_listing_id) : null,
    requestId: String(row.request_id),
    attempt: num0(row.attempt),
    maxAttempts: num0(row.max_attempts) || 5,
    errorMessage: row.error_message ? String(row.error_message) : null,
    errorBody: row.error_body ? String(row.error_body) : null,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
  };
}

export function mapSale(row: Record<string, unknown>): SaleView {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    itemTitle: row.item_title ? String(row.item_title) : "Item",
    marketplace: String(row.marketplace) as MarketplaceId,
    soldPriceGbp: num0(row.sold_price_gbp),
    feesGbp: num(row.fees_gbp),
    netGbp: num(row.net_gbp),
    quantity: num0(row.quantity) || 1,
    detectedVia: String(row.detected_via ?? "manual"),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    costPriceGbp: num(row.cost_price_gbp),
  };
}

export function mapShipping(row: Record<string, unknown>): ShippingProfileView {
  return {
    id: String(row.id),
    name: String(row.name),
    marketplace: row.marketplace ? (String(row.marketplace) as MarketplaceId) : null,
    carrier: String(row.carrier),
    service: String(row.service),
    packageType: String(row.package_type),
    buyerPays: bool(row.buyer_pays),
    priceGbp: num0(row.price_gbp),
    collection: bool(row.collection),
  };
}

export function mapRule(row: Record<string, unknown>): PricingRuleView {
  return {
    id: String(row.id),
    marketplace: String(row.marketplace) as MarketplaceId,
    kind: String(row.kind) as PricingRuleView["kind"],
    amount: num(row.amount),
    undercutMarketplace: row.undercut_marketplace
      ? (String(row.undercut_marketplace) as MarketplaceId)
      : null,
  };
}

export function mapTemplate(row: Record<string, unknown>): TemplateView {
  return {
    id: String(row.id),
    name: String(row.name),
    payload: String(row.payload ?? "{}"),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
  };
}

async function purgePreviewPlaceholders(sql: Sql, userId: string) {
  const fakes = await sql<{ id: string }>`
    select id from marketplace_accounts
    where user_id = ${userId}
      and oauth_access_token is null
      and remote_username in ('london_rails', 'lane_uk_shop')
  `;
  for (const f of fakes) {
    await sql`delete from remote_listings where account_id = ${f.id} and user_id = ${userId}`;
    await sql`delete from channel_listings where marketplace_account_id = ${f.id} and user_id = ${userId}`;
    await sql`delete from jobs where account_id = ${f.id} and user_id = ${userId}`;
    await sql`delete from marketplace_accounts where id = ${f.id} and user_id = ${userId}`;
  }
}

export async function ensureUser(sql: Sql, userId: string): Promise<UserSettingsView> {
  await sql`insert into user_settings (user_id, actions_month, extension_awake) values (${userId}, ${monthKey()}, ${false}) on conflict (user_id) do nothing`;
  await recordActivation(sql, userId, "user_signup");
  const trial = await sql`select user_id from user_settings where user_id = ${userId} and trial_started_at is not null`;
  if (trial.length) await recordActivation(sql, userId, "trial_started");
  await purgePreviewPlaceholders(sql, userId);

  const rows = await sql<Record<string, unknown>>`select * from user_settings where user_id = ${userId}`;
  if (!rows[0]?.extension_pairing_token) {
    await sql`update user_settings set extension_pairing_token = ${randomToken("lnb")} where user_id = ${userId}`;
  }

  let settings = mapSettings(
    (await sql<Record<string, unknown>>`select * from user_settings where user_id = ${userId}`)[0] ?? {
      plan: "starter",
      actions_used_month: 0,
    },
  );
  if (settings.actionsMonth !== monthKey()) {
    await sql`update user_settings set actions_used_month = 0, actions_month = ${monthKey()} where user_id = ${userId}`;
    settings = mapSettings((await sql<Record<string, unknown>>`select * from user_settings where user_id = ${userId}`)[0] ?? {});
  }

  const profiles = await sql`select id from shipping_profiles where user_id = ${userId} limit 1`;
  if (profiles.length === 0) {
    for (const p of POSTAGE_PRESETS) {
      await sql`
        insert into shipping_profiles (
          id, user_id, name, marketplace, carrier, service, package_type, buyer_pays, price_gbp, collection
        ) values (
          ${makeId("shp")}, ${userId}, ${p.name}, ${p.marketplace}, ${p.carrier}, ${p.service},
          ${p.packageType}, ${p.buyerPays}, ${p.priceGbp}, ${p.collection}
        )
      `;
    }
  }

  const rules = await sql`select id from pricing_rules where user_id = ${userId} limit 1`;
  if (rules.length === 0) {
    await sql`insert into pricing_rules (id, user_id, marketplace, kind, amount) values (${makeId("pr")}, ${userId}, ${"ebay_uk"}, ${"flat"}, ${null})`;
    await sql`insert into pricing_rules (id, user_id, marketplace, kind, amount, undercut_marketplace) values (${makeId("pr")}, ${userId}, ${"vinted_uk"}, ${"flat"}, ${null}, ${null})`;
  }

  const usage = await sql<{ used: number }>`select used from ai_credit_usage where user_id = ${userId} and month = ${new Date().toISOString().slice(0, 7)}`;
  return { ...settings, aiCreditsUsed: Number(usage[0]?.used ?? 0) };
}

export async function loadAccounts(sql: Sql, userId: string): Promise<AccountView[]> {
  const rows = await sql<Record<string, unknown>>`
    select * from marketplace_accounts where user_id = ${userId} order by created_at asc
  `;
  return rows.map(mapAccount);
}

export async function loadItem(sql: Sql, userId: string, itemId: string): Promise<ItemView | null> {
  const items = await sql<Record<string, unknown>>`
    select * from items where id = ${itemId} and user_id = ${userId} limit 1
  `;
  if (!items[0]) return null;
  const accounts = await loadAccounts(sql, userId);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const photos = await sql<Record<string, unknown>>`
    select * from item_photos where item_id = ${itemId} and user_id = ${userId} order by sort_order asc
  `;
  const tags = await sql<{ tag: string }>`
    select tag from item_tags where item_id = ${itemId} and user_id = ${userId} order by tag
  `;
  const channels = await sql<Record<string, unknown>>`
    select * from channel_listings where item_id = ${itemId} and user_id = ${userId} order by created_at asc
  `;
  return {
    ...mapItemBase(items[0]),
    tags: tags.map((t) => t.tag),
    photos: photos.map(mapPhoto),
    channels: channels.map((c) => mapChannel(c, byId.get(String(c.marketplace_account_id)))),
  };
}
