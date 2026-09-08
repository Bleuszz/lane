import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { CHANNELS, isMarketplaceId } from "@/lib/lane/channels";
import { CATEGORIES } from "@/lib/lane/categories";
import { CONDITIONS } from "@/lib/lane/types";
import { makeId } from "@/lib/lane/ids";
import { num0 } from "@/lib/lane/format";
import { accountLimit } from "@/lib/lane/plans";
import { applyPricingRule } from "@/lib/lane/pricing";
import type {
  AiVoice,
  BootstrapPayload,
  Condition,
  InventoryRow,
  ItemDraft,
  MarketplaceId,
  PlanId,
} from "@/lib/lane/types";
import {
  ensureUser,
  loadAccounts,
  loadItem,
  mapChannel,
  mapJob,
  mapRule,
  mapSale,
  mapShipping,
  mapTemplate,
} from "./map";
import {
  applySale,
  enqueueJob,
  liveEbayToken,
  processJob,
  tickOauthJobs,
} from "./process";
import { ebayConfigured, randomToken } from "./secret";
import { conditionFromLabel } from "@/lib/lane/condition";
import { ebayListInventory } from "./ebay";

const marketplaceSchema = z.string().refine(isMarketplaceId, "Unknown marketplace");

function emptyDraft(): ItemDraft {
  return {
    title: "",
    description: "",
    brand: "",
    categoryCanonical: "",
    condition: "good",
    sizeUk: "",
    sizeEu: "",
    sizeUs: "",
    colour: "",
    material: "",
    gender: "men",
    era: "",
    costPriceGbp: "",
    basePriceGbp: "",
    quantity: "1",
    weightG: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    postageProfileId: "",
    notes: "",
    tags: "",
    sku: "",
    photos: [],
  };
}

const draftSchema = z.object({
  title: z.string(),
  description: z.string(),
  brand: z.string(),
  categoryCanonical: z.string(),
  condition: z.enum(CONDITIONS),
  sizeUk: z.string(),
  sizeEu: z.string(),
  sizeUs: z.string(),
  colour: z.string(),
  material: z.string(),
  gender: z.string(),
  era: z.string(),
  costPriceGbp: z.string(),
  basePriceGbp: z.string(),
  quantity: z.string(),
  weightG: z.string(),
  lengthCm: z.string(),
  widthCm: z.string(),
  heightCm: z.string(),
  postageProfileId: z.string(),
  notes: z.string(),
  tags: z.string(),
  sku: z.string(),
  photos: z.array(z.object({ url: z.string(), phash: z.string().optional() })),
});

type SqlClient = Awaited<ReturnType<typeof getSql>>;

async function writeTags(sql: SqlClient, userId: string, itemId: string, tags: string[]) {
  await sql`delete from item_tags where item_id = ${itemId} and user_id = ${userId}`;
  for (const tag of tags) {
    const t = tag.trim().toLowerCase();
    if (!t) continue;
    await sql`insert into item_tags (item_id, user_id, tag) values (${itemId}, ${userId}, ${t}) on conflict do nothing`;
  }
}

async function writePhotos(
  sql: SqlClient,
  userId: string,
  itemId: string,
  photos: { url: string; phash?: string }[],
) {
  await sql`delete from item_photos where item_id = ${itemId} and user_id = ${userId}`;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!p?.url) continue;
    await sql`
      insert into item_photos (id, item_id, user_id, url, sort_order, is_primary, phash)
      values (${makeId("pho")}, ${itemId}, ${userId}, ${p.url}, ${i}, ${i === 0}, ${p.phash ?? null})
    `;
  }
}

async function insertItem(sql: SqlClient, userId: string, draft: ItemDraft): Promise<string> {
  const id = makeId("itm");
  const price = Number(draft.basePriceGbp);
  if (!draft.title.trim()) throw new Error("Title is required");
  if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be a number in GBP");
  const qty = Math.max(1, Math.floor(Number(draft.quantity) || 1));
  const cost = draft.costPriceGbp.trim() === "" ? null : Number(draft.costPriceGbp);
  await sql`
    insert into items (
      id, user_id, sku, title, description, brand, category_canonical, condition,
      size_uk, size_eu, size_us, colour, material, gender, era,
      cost_price_gbp, base_price_gbp, quantity, weight_g, length_cm, width_cm, height_cm,
      postage_profile_id, notes, status
    ) values (
      ${id}, ${userId}, ${draft.sku.trim() || null}, ${draft.title.trim()}, ${draft.description},
      ${draft.brand.trim() || null}, ${draft.categoryCanonical || null}, ${draft.condition},
      ${draft.sizeUk || null}, ${draft.sizeEu || null}, ${draft.sizeUs || null},
      ${draft.colour || null}, ${draft.material || null}, ${draft.gender || null}, ${draft.era || null},
      ${cost != null && Number.isFinite(cost) ? cost : null}, ${price}, ${qty},
      ${draft.weightG ? Number(draft.weightG) : null},
      ${draft.lengthCm ? Number(draft.lengthCm) : null},
      ${draft.widthCm ? Number(draft.widthCm) : null},
      ${draft.heightCm ? Number(draft.heightCm) : null},
      ${draft.postageProfileId || null}, ${draft.notes || null}, ${"draft"}
    )
  `;
  await writeTags(sql, userId, id, draft.tags.split(","));
  await writePhotos(sql, userId, id, draft.photos);
  return id;
}

async function loadInbox(sql: SqlClient, userId: string) {
  const accounts = await loadAccounts(sql, userId);
  const failed = await sql<Record<string, unknown>>`
    select j.*, i.title as item_title from jobs j
    left join items i on i.id = j.item_id
    where j.user_id = ${userId} and j.status in ('error', 'dead')
    order by j.updated_at desc limit 20
  `;
  const waiting = await sql<Record<string, unknown>>`
    select j.*, i.title as item_title from jobs j
    left join items i on i.id = j.item_id
    where j.user_id = ${userId} and j.status = 'waiting_for_browser'
    order by j.created_at asc limit 20
  `;
  return {
    failedJobs: failed.map(mapJob),
    waitingJobs: waiting.map(mapJob),
    offlineAccounts: accounts.filter((a) => a.status === "extension_offline"),
    reauthAccounts: accounts.filter((a) => a.status === "needs_reauth" || a.status === "paused"),
  };
}

async function inventoryRows(sql: SqlClient, userId: string): Promise<InventoryRow[]> {
  const items = await sql<Record<string, unknown>>`
    select * from items where user_id = ${userId} and status <> 'archived' order by created_at desc
  `;
  const photos = await sql<{ item_id: string; url: string }>`
    select item_id, url from item_photos where user_id = ${userId} and is_primary = true
  `;
  const photoMap = new Map(photos.map((p) => [p.item_id, p.url]));
  const channels = await sql<Record<string, unknown>>`
    select * from channel_listings where user_id = ${userId}
  `;
  const byItem = new Map<string, InventoryRow["channels"]>();
  for (const c of channels) {
    const mapped = mapChannel(c);
    const list = byItem.get(mapped.itemId) ?? [];
    list.push({
      id: mapped.id,
      marketplace: mapped.marketplace,
      remoteStatus: mapped.remoteStatus,
      channelPriceGbp: mapped.channelPriceGbp,
      url: mapped.url,
      lastError: mapped.lastError,
    });
    byItem.set(mapped.itemId, list);
  }
  return items.map((row) => ({
    id: String(row.id),
    sku: row.sku ? String(row.sku) : null,
    title: String(row.title),
    brand: row.brand ? String(row.brand) : null,
    quantity: num0(row.quantity),
    basePriceGbp: num0(row.base_price_gbp),
    status: String(row.status) as InventoryRow["status"],
    createdAt: String(row.created_at),
    primaryPhotoUrl: photoMap.get(String(row.id)) ?? null,
    colour: row.colour ? String(row.colour) : null,
    categoryCanonical: row.category_canonical ? String(row.category_canonical) : null,
    channels: byItem.get(String(row.id)) ?? [],
  }));
}

export const getBootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BootstrapPayload> => {
    const sql = await getSql();
    const settings = await ensureUser(sql, context.userId);
    await tickOauthJobs(sql, context.userId);
    const accounts = await loadAccounts(sql, context.userId);
    const counts = await sql<{ status: string; n: number }>`
      select status, count(*)::int as n from items where user_id = ${context.userId} and status <> 'archived' group by status
    `;
    const countMap = Object.fromEntries(counts.map((c) => [c.status, c.n]));
    const gmv = await sql<{ gmv: string | number | null }>`
      select coalesce(sum(sold_price_gbp), 0) as gmv from sales where user_id = ${context.userId}
    `;
    return {
      settings,
      accounts,
      inbox: await loadInbox(sql, context.userId),
      liveCount: countMap.live ?? 0,
      soldCount: countMap.sold ?? 0,
      errorCount: countMap.error ?? 0,
      draftCount: countMap.draft ?? 0,
      gmvGbp: num0(gmv[0]?.gmv),
      ebayConfigured: ebayConfigured(),
    };
  });

export const getInventory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<InventoryRow[]> => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    return inventoryRows(sql, context.userId);
  });

export const getItemFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const item = await loadItem(sql, context.userId, data.id);
    if (!item) throw new Error("Item not found");
    return item;
  });

export const getJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const rows = await sql<Record<string, unknown>>`
      select j.*, i.title as item_title
      from jobs j
      left join items i on i.id = j.item_id
      where j.user_id = ${context.userId}
      order by j.created_at desc
      limit 80
    `;
    return rows.map(mapJob);
  });

export const getSales = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const rows = await sql<Record<string, unknown>>`
      select s.*, i.title as item_title, i.cost_price_gbp
      from sales s
      left join items i on i.id = s.item_id
      where s.user_id = ${context.userId}
      order by s.created_at desc
      limit 100
    `;
    return rows.map(mapSale);
  });

export const getSettingsExtras = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const shipping = await sql<Record<string, unknown>>`
      select * from shipping_profiles where user_id = ${context.userId} order by created_at asc
    `;
    const rules = await sql<Record<string, unknown>>`
      select * from pricing_rules where user_id = ${context.userId} order by created_at asc
    `;
    const templates = await sql<Record<string, unknown>>`
      select * from templates where user_id = ${context.userId} order by created_at desc
    `;
    return {
      shipping: shipping.map(mapShipping),
      rules: rules.map(mapRule),
      templates: templates.map(mapTemplate),
    };
  });

export const connectAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { marketplace: MarketplaceId; label?: string }) => {
    marketplaceSchema.parse(d.marketplace);
    return d;
  })
  .handler(async ({ context, data }): Promise<{ id?: string; oauthUrl?: string }> => {
    const sql = await getSql();
    const settings = await ensureUser(sql, context.userId);
    const def = CHANNELS[data.marketplace];
    if (!def?.enabled) throw new Error(`${def?.label ?? data.marketplace} is not in the UK pack yet.`);
    const accounts = await loadAccounts(sql, context.userId);
    const limit = accountLimit(settings.plan);
    if (limit !== "unlimited" && accounts.length >= limit) {
      throw new Error(`Plan ${settings.plan} allows ${limit} accounts. Delists are free; upgrade to add shops.`);
    }

    if (data.marketplace === "ebay_uk") {
      if (!ebayConfigured()) {
        throw new Error(
          "eBay developer keys are not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET and EBAY_RU_NAME, then click Connect again. See instructions.txt.",
        );
      }
      return { oauthUrl: "/api/ebay/start" };
    }

    if (accounts.some((a) => a.marketplace === data.marketplace && a.label === (data.label || def.label))) {
      throw new Error("That account is already connected.");
    }

    const id = makeId("acc");
    await sql`
      insert into marketplace_accounts (
        id, user_id, marketplace, mode, label, remote_username, status, oauth_connected, sandbox
      ) values (
        ${id}, ${context.userId}, ${data.marketplace}, ${def.mode},
        ${data.label?.trim() || def.label}, ${null},
        ${"extension_offline"},
        ${false}, ${false}
      )
    `;
    if (def.mode === "extension") {
      await sql`update user_settings set extension_enabled = true where user_id = ${context.userId}`;
    }
    return { id };
  });

export const rotatePairingToken = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const token = randomToken("lnb");
    await sql`update user_settings set extension_pairing_token = ${token} where user_id = ${context.userId}`;
    return { token };
  });

export const syncRemoteCatalog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const accounts = await loadAccounts(sql, context.userId);
    const account = accounts.find((a) => a.id === data.accountId);
    if (!account) throw new Error("Account not found");

    if (account.marketplace === "ebay_uk") {
      const { access } = await liveEbayToken(sql, context.userId, account.id);
      const live = await ebayListInventory(access);
      let upserted = 0;
      for (const row of live) {
        if (!row.listingId && !row.sku) continue;
        const remoteId = row.listingId ?? row.sku;
        const existing = await sql<{ id: string }>`
          select id from remote_listings where account_id = ${account.id} and remote_id = ${remoteId} and user_id = ${context.userId}
        `;
        if (existing[0]) {
          await sql`
            update remote_listings set
              url = ${row.url}, title = ${row.title}, price_gbp = ${row.priceGbp ?? 0}, quantity = ${row.quantity},
              status = ${row.listingId ? "live" : "draft"}, photo_url = ${row.photoUrl}, updated_at = now()
            where id = ${existing[0].id}
          `;
        } else {
          await sql`
            insert into remote_listings (
              id, user_id, account_id, marketplace, remote_id, url, title, price_gbp, quantity, status, photo_url
            ) values (
              ${makeId("rmt")}, ${context.userId}, ${account.id}, ${"ebay_uk"}, ${remoteId}, ${row.url},
              ${row.title}, ${row.priceGbp ?? 0}, ${row.quantity}, ${row.listingId ? "live" : "draft"}, ${row.photoUrl}
            )
          `;
        }
        upserted += 1;
      }
      return { source: "ebay" as const, upserted, waiting: false as const };
    }

    return {
      source: "extension" as const,
      upserted: 0,
      waiting: true as const,
      message:
        "Keep Chrome open on vinted.co.uk with Lane Bridge paired. The extension pushes your wardrobe here on each heartbeat.",
    };
  });

export const disconnectAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from marketplace_accounts where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const setExtensionAwake = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { awake: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    await sql`update user_settings set extension_awake = ${data.awake}, extension_enabled = true where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const setForceError = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string; forceError: string | null }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update marketplace_accounts set force_error = ${data.forceError}, updated_at = now()
      where id = ${data.accountId} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const oauth = await tickOauthJobs(sql, context.userId);
    return { oauth };
  });

export const previewRemote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return previewRemoteRows(sql, context.userId, data.accountId);
  });

async function previewRemoteRows(sql: SqlClient, userId: string, accountId: string) {
  const remotes = await sql<Record<string, unknown>>`
    select * from remote_listings
    where account_id = ${accountId} and user_id = ${userId} and status = 'live'
    order by created_at asc
  `;
  const items = await sql<{ id: string; title: string; base_price_gbp: string | number; phash: string | null }>`
    select i.id, i.title, i.base_price_gbp, p.phash
    from items i
    left join item_photos p on p.item_id = i.id and p.is_primary = true
    where i.user_id = ${userId} and i.status <> 'archived'
  `;
  const linked = await sql<{ remote_id: string }>`
    select remote_id from channel_listings
    where marketplace_account_id = ${accountId} and user_id = ${userId} and remote_id is not null
  `;
  const linkedSet = new Set(linked.map((r) => r.remote_id));

  return remotes.map((r) => {
    const title = String(r.title);
    const price = num0(r.price_gbp);
    const phash = r.phash ? String(r.phash) : null;
    const hit =
      items.find((i) => phash && i.phash === phash) ??
      items.find(
        (i) =>
          i.title.trim().toLowerCase() === title.trim().toLowerCase() &&
          Math.abs(num0(i.base_price_gbp) - price) < 0.005,
      );
    return {
      remoteId: String(r.remote_id),
      title,
      description: r.description ? String(r.description) : null,
      priceGbp: price,
      photoUrl: r.photo_url ? String(r.photo_url) : null,
      brand: r.brand ? String(r.brand) : null,
      sizeLabel: r.size_label ? String(r.size_label) : null,
      categoryName: r.category_name ? String(r.category_name) : null,
      conditionLabel: r.condition_label ? String(r.condition_label) : null,
      status: String(r.status),
      phash,
      url: r.url ? String(r.url) : null,
      matchItemId: hit?.id ?? null,
      matchReason: hit ? (phash && hit.phash === phash ? "photo hash" : "title + price") : null,
      alreadyImported: linkedSet.has(String(r.remote_id)),
    };
  });
}

export const importRemote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { accountId: string; remoteIds: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const accounts = await loadAccounts(sql, context.userId);
    const account = accounts.find((a) => a.id === data.accountId);
    if (!account) throw new Error("Account not found");
    const preview = await previewRemoteRows(sql, context.userId, data.accountId);
    const selected = preview.filter((p) => data.remoteIds.includes(p.remoteId) && !p.alreadyImported);
    if (selected.length > 200) throw new Error("Import cap is 200 items per run.");
    let created = 0;
    let linked = 0;
    for (const row of selected) {
      let itemId = row.matchItemId;
      if (!itemId) {
        const draft: ItemDraft = {
          ...emptyDraft(),
          title: row.title,
          description: row.description ?? row.title,
          brand: row.brand ?? "",
          categoryCanonical: "",
          condition: conditionFromLabel(row.conditionLabel),
          sizeUk: row.sizeLabel ?? "",
          colour: "",
          basePriceGbp: String(row.priceGbp),
          quantity: "1",
          photos: row.photoUrl ? [{ url: row.photoUrl, phash: row.phash ?? undefined }] : [],
        };
        itemId = await insertItem(sql, context.userId, draft);
        created += 1;
      } else {
        linked += 1;
      }
      const listingId = makeId("chl");
      await sql`
        insert into channel_listings (
          id, item_id, user_id, marketplace, marketplace_account_id, remote_id, url,
          mapped_category, channel_price_gbp, remote_status, last_synced_at, quantity_on_channel
        ) values (
          ${listingId}, ${itemId}, ${context.userId}, ${account.marketplace}, ${account.id},
          ${row.remoteId}, ${row.url}, ${row.categoryName}, ${row.priceGbp}, ${"live"}, now(), ${1}
        )
      `;
      await sql`update items set status = 'live', updated_at = now() where id = ${itemId} and user_id = ${context.userId} and status <> 'sold'`;
    }
    return { created, linked, imported: selected.length };
  });

export const createItemFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: ItemDraft) => draftSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const id = await insertItem(sql, context.userId, data);
    return { id };
  });

export const updateItemFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; draft: ItemDraft }) => ({ id: d.id, draft: draftSchema.parse(d.draft) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await loadItem(sql, context.userId, data.id);
    if (!existing) throw new Error("Item not found");
    const draft = data.draft;
    const price = Number(draft.basePriceGbp);
    if (!draft.title.trim()) throw new Error("Title is required");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be a number in GBP");
    const qty = Math.max(0, Math.floor(Number(draft.quantity) || 0));
    const cost = draft.costPriceGbp.trim() === "" ? null : Number(draft.costPriceGbp);
    await sql`
      update items set
        sku = ${draft.sku.trim() || null},
        title = ${draft.title.trim()},
        description = ${draft.description},
        brand = ${draft.brand.trim() || null},
        category_canonical = ${draft.categoryCanonical || null},
        condition = ${draft.condition},
        size_uk = ${draft.sizeUk || null},
        size_eu = ${draft.sizeEu || null},
        size_us = ${draft.sizeUs || null},
        colour = ${draft.colour || null},
        material = ${draft.material || null},
        gender = ${draft.gender || null},
        era = ${draft.era || null},
        cost_price_gbp = ${cost != null && Number.isFinite(cost) ? cost : null},
        base_price_gbp = ${price},
        quantity = ${qty},
        weight_g = ${draft.weightG ? Number(draft.weightG) : null},
        length_cm = ${draft.lengthCm ? Number(draft.lengthCm) : null},
        width_cm = ${draft.widthCm ? Number(draft.widthCm) : null},
        height_cm = ${draft.heightCm ? Number(draft.heightCm) : null},
        postage_profile_id = ${draft.postageProfileId || null},
        notes = ${draft.notes || null},
        updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    await writeTags(sql, context.userId, data.id, draft.tags.split(","));
    await writePhotos(sql, context.userId, data.id, draft.photos);
    return { ok: true as const };
  });

export const cloneItemFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const item = await loadItem(sql, context.userId, data.id);
    if (!item) throw new Error("Item not found");
    const draft: ItemDraft = {
      title: `${item.title} (copy)`,
      description: item.description,
      brand: item.brand ?? "",
      categoryCanonical: item.categoryCanonical ?? "",
      condition: item.condition,
      sizeUk: item.sizeUk ?? "",
      sizeEu: item.sizeEu ?? "",
      sizeUs: item.sizeUs ?? "",
      colour: item.colour ?? "",
      material: item.material ?? "",
      gender: item.gender ?? "",
      era: item.era ?? "",
      costPriceGbp: item.costPriceGbp != null ? String(item.costPriceGbp) : "",
      basePriceGbp: String(item.basePriceGbp),
      quantity: String(Math.max(1, item.quantity)),
      weightG: item.weightG != null ? String(item.weightG) : "",
      lengthCm: item.lengthCm != null ? String(item.lengthCm) : "",
      widthCm: item.widthCm != null ? String(item.widthCm) : "",
      heightCm: item.heightCm != null ? String(item.heightCm) : "",
      postageProfileId: item.postageProfileId ?? "",
      notes: item.notes ?? "",
      tags: item.tags.join(","),
      sku: item.sku ? `${item.sku}-COPY` : "",
      photos: item.photos.map((p) => ({ url: p.url, phash: p.phash ?? undefined })),
    };
    const id = await insertItem(sql, context.userId, draft);
    return { id };
  });

export const archiveItemFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`update items set status = 'archived', updated_at = now() where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const publishItems = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { itemIds: string[]; accountIds: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const accounts = await loadAccounts(sql, context.userId);
    const picked = accounts.filter((a) => data.accountIds.includes(a.id));
    if (picked.length === 0) throw new Error("Select at least one connected account.");
    const rules = (await sql<Record<string, unknown>>`select * from pricing_rules where user_id = ${context.userId}`).map(mapRule);
    let queued = 0;
    for (const itemId of data.itemIds) {
      const item = await loadItem(sql, context.userId, itemId);
      if (!item || item.status === "sold" || item.status === "archived") continue;
      for (const account of picked) {
        const existing = item.channels.find(
          (c) =>
            c.marketplaceAccountId === account.id &&
            (c.remoteStatus === "live" || c.remoteStatus === "queued" || c.remoteStatus === "waiting_for_browser"),
        );
        if (existing?.remoteStatus === "live") continue;
        let listingId = existing?.id;
        const price = applyPricingRule(
          item.basePriceGbp,
          rules.find((r) => r.marketplace === account.marketplace),
        );
        const qty = CHANNELS[account.marketplace]?.singleQty ? 1 : Math.max(1, item.quantity);
        const waiting = CHANNELS[account.marketplace].mode === "extension" ? "waiting_for_browser" : "queued";
        if (!listingId) {
          listingId = makeId("chl");
          await sql`
            insert into channel_listings (
              id, item_id, user_id, marketplace, marketplace_account_id, channel_price_gbp,
              remote_status, quantity_on_channel
            ) values (
              ${listingId}, ${item.id}, ${context.userId}, ${account.marketplace}, ${account.id},
              ${price}, ${waiting}, ${qty}
            )
          `;
        } else {
          await sql`
            update channel_listings set remote_status = ${waiting},
              channel_price_gbp = ${price}, last_error = null, updated_at = now()
            where id = ${listingId} and user_id = ${context.userId}
          `;
        }
        await enqueueJob(sql, {
          userId: context.userId,
          type: "publish",
          marketplace: account.marketplace,
          accountId: account.id,
          itemId: item.id,
          channelListingId: listingId,
        });
        queued += 1;
      }
      await sql`update items set status = 'queued', updated_at = now() where id = ${itemId} and user_id = ${context.userId} and status in ('draft', 'error')`;
    }
    await tickOauthJobs(sql, context.userId);
    return { queued };
  });

export const delistListings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { itemIds: string[]; accountIds?: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    let queued = 0;
    for (const itemId of data.itemIds) {
      const item = await loadItem(sql, context.userId, itemId);
      if (!item) continue;
      const targets = item.channels.filter((c) => {
        if (c.remoteStatus !== "live" && c.remoteStatus !== "queued" && c.remoteStatus !== "waiting_for_browser") {
          return false;
        }
        if (data.accountIds?.length) return data.accountIds.includes(c.marketplaceAccountId);
        return true;
      });
      for (const c of targets) {
        await enqueueJob(sql, {
          userId: context.userId,
          type: "delist",
          marketplace: c.marketplace,
          accountId: c.marketplaceAccountId,
          itemId: item.id,
          channelListingId: c.id,
        });
        queued += 1;
      }
    }
    await tickOauthJobs(sql, context.userId);
    return { queued };
  });

export const relistListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { channelListingId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from channel_listings where id = ${data.channelListingId} and user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) throw new Error("Channel listing not found");
    const marketplace = String(row.marketplace) as MarketplaceId;
    await enqueueJob(sql, {
      userId: context.userId,
      type: "relist",
      marketplace,
      accountId: String(row.marketplace_account_id),
      itemId: String(row.item_id),
      channelListingId: data.channelListingId,
    });
    await tickOauthJobs(sql, context.userId);
    return { ok: true as const };
  });

export const pushUpdate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { itemId: string; accountIds?: string[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const item = await loadItem(sql, context.userId, data.itemId);
    if (!item) throw new Error("Item not found");
    const targets = item.channels.filter((c) => {
      if (c.remoteStatus !== "live") return false;
      if (data.accountIds?.length) return data.accountIds.includes(c.marketplaceAccountId);
      return true;
    });
    for (const c of targets) {
      await enqueueJob(sql, {
        userId: context.userId,
        type: "update",
        marketplace: c.marketplace,
        accountId: c.marketplaceAccountId,
        itemId: item.id,
        channelListingId: c.id,
      });
    }
    await tickOauthJobs(sql, context.userId);
    return { queued: targets.length };
  });

export const markSoldFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { itemId: string; marketplace: MarketplaceId; via?: "webhook" | "extension_poll" | "manual" }) => {
    marketplaceSchema.parse(d.marketplace);
    return d;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await applySale(sql, context.userId, {
      itemId: data.itemId,
      marketplace: data.marketplace,
      via: data.via ?? "manual",
    });
    await tickOauthJobs(sql, context.userId);
    return { ok: true as const };
  });

export const retryJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { jobId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select j.*, a.mode from jobs j
      left join marketplace_accounts a on a.id = j.account_id
      where j.id = ${data.jobId} and j.user_id = ${context.userId}
    `;
    const job = rows[0];
    if (!job) throw new Error("Job not found");
    const next = String(job.mode) === "extension" ? "waiting_for_browser" : "queued";
    await sql`
      update jobs set status = ${next}, error_message = null, error_body = null, finished_at = null, updated_at = now()
      where id = ${data.jobId} and user_id = ${context.userId}
    `;
    if (String(job.mode) === "oauth") {
      await processJob(sql, context.userId, data.jobId, "worker");
    }
    return { ok: true as const };
  });

export const bulkEdit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      itemIds: string[];
      priceGbp?: string;
      titleFind?: string;
      titleReplace?: string;
      descriptionAppend?: string;
      tags?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    let changed = 0;
    for (const id of data.itemIds) {
      const item = await loadItem(sql, context.userId, id);
      if (!item) continue;
      let title = item.title;
      if (data.titleFind) title = title.replaceAll(data.titleFind, data.titleReplace ?? "");
      const description = data.descriptionAppend
        ? `${item.description}\n\n${data.descriptionAppend}`
        : item.description;
      const price = data.priceGbp != null && data.priceGbp !== "" ? Number(data.priceGbp) : item.basePriceGbp;
      await sql`
        update items set title = ${title}, description = ${description}, base_price_gbp = ${price}, updated_at = now()
        where id = ${id} and user_id = ${context.userId}
      `;
      if (data.tags) await writeTags(sql, context.userId, id, data.tags.split(","));
      changed += 1;
    }
    return { changed };
  });

export const saveTemplateFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; payload: ItemDraft }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const id = makeId("tpl");
    await sql`
      insert into templates (id, user_id, name, payload)
      values (${id}, ${context.userId}, ${data.name.trim() || "Untitled"}, ${JSON.stringify(data.payload)})
    `;
    return { id };
  });

export const deleteTemplateFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from templates where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const upsertPricingRule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      id?: string;
      marketplace: MarketplaceId;
      kind: "flat" | "plus_amount" | "plus_percent" | "round_99" | "undercut";
      amount: number | null;
      undercutMarketplace?: MarketplaceId | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    if (data.id) {
      await sql`
        update pricing_rules set kind = ${data.kind}, amount = ${data.amount}, undercut_marketplace = ${data.undercutMarketplace ?? null}
        where id = ${data.id} and user_id = ${context.userId}
      `;
      return { id: data.id };
    }
    const id = makeId("pr");
    await sql`
      insert into pricing_rules (id, user_id, marketplace, kind, amount, undercut_marketplace)
      values (${id}, ${context.userId}, ${data.marketplace}, ${data.kind}, ${data.amount}, ${data.undercutMarketplace ?? null})
    `;
    return { id };
  });

export const setPlanFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { plan: PlanId; aiPack: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    await sql`
      update user_settings set plan = ${data.plan}, ai_pack = ${data.aiPack}, billing_status = 'active'
      where user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    await sql`update user_settings set onboarding_complete = true, onboarding_step = 5 where user_id = ${context.userId}`;
    return { ok: true as const };
  });

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export const exportCsv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await inventoryRows(sql, context.userId);
    const header = ["id", "sku", "title", "brand", "category", "status", "qty", "price_gbp", "colour"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [r.id, r.sku ?? "", csvEscape(r.title), r.brand ?? "", r.categoryCanonical ?? "", r.status, r.quantity, r.basePriceGbp, r.colour ?? ""].join(","),
      );
    }
    return lines.join("\n");
  });

export const importCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { csv: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    const records = parseCsv(data.csv);
    let created = 0;
    for (const rec of records) {
      const title = rec.title ?? rec.Title;
      const price = rec.price_gbp ?? rec.price ?? rec.Price;
      if (!title || !price) continue;
      const draft: ItemDraft = {
        ...emptyDraft(),
        title,
        description: rec.description ?? "",
        brand: rec.brand ?? "",
        categoryCanonical: rec.category ?? rec.category_canonical ?? "",
        condition: (CONDITIONS as readonly string[]).includes(rec.condition)
          ? (rec.condition as Condition)
          : "good",
        sizeUk: rec.size_uk ?? rec.size ?? "",
        colour: rec.colour ?? rec.color ?? "",
        basePriceGbp: String(price),
        costPriceGbp: rec.cost_gbp ?? rec.cost ?? "",
        quantity: rec.qty ?? rec.quantity ?? "1",
        sku: rec.sku ?? "",
        tags: rec.tags ?? "",
      };
      await insertItem(sql, context.userId, draft);
      created += 1;
    }
    return { created };
  });

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0] ?? "").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = cells[i] ?? "";
    });
    return rec;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export const generateListingCopy = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { voice: AiVoice; notes: string; brand?: string; categoryCanonical?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const settings = await ensureUser(sql, context.userId);
    void sql;
    if (!settings.aiPack) {
      return { ok: false as const, error: "AI pack is off. Turn it on in Billing (£5/mo)." };
    }
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available in this environment." };
    const cats = CATEGORIES.map((c) => c.id).join(", ");
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write UK reseller listing copy. Reply with JSON only: {title, description, brand, categoryCanonical, condition, colour, material}. condition is one of new_with_tags, new_without_tags, very_good, good, satisfactory. categoryCanonical must be one of: " +
              cats +
              ". Voice: " +
              data.voice +
              ". Never invent a marketplace category id. GBP implied. No hashtags. No emoji.",
          },
          {
            role: "user",
            content: `Notes from seller:\n${data.notes}\nBrand hint: ${data.brand ?? ""}\nCategory hint: ${data.categoryCanonical ?? ""}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = body.choices[0]?.message.content ?? "";
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    try {
      const parsed = z
        .object({
          title: z.string(),
          description: z.string(),
          brand: z.string(),
          categoryCanonical: z.string(),
          condition: z.enum(CONDITIONS),
          colour: z.string(),
          material: z.string(),
        })
        .parse(JSON.parse(jsonText));
      return { ok: true as const, draft: parsed };
    } catch {
      return { ok: false as const, error: "AI returned copy we could not parse. Try again." };
    }
  });
