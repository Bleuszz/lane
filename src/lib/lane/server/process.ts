import type { Sql } from "@/lib/db";
import { CHANNELS } from "@/lib/lane/channels";
import { findCategory } from "@/lib/lane/categories";
import { estimateFees } from "@/lib/lane/fees";
import { makeId } from "@/lib/lane/ids";
import { reserveListingAction, recordActivation } from "./events";
import { claimJob, recoverExpiredJobs, renewJobLease, intentKey, saleEventKey, type ClaimedJob } from "./operations";
import { applyPricingRule } from "@/lib/lane/pricing";
import type { MarketplaceId } from "@/lib/lane/types";
import { loadItem, mapAccount, mapRule } from "./map";
import { ebayPublish, ebayReconcileListing, ebayUpdateOffer, ebayWithdraw, ensureMerchantLocation, refreshEbayToken } from "./ebay";
import { unseal, seal } from "./secret";

export type JobRow = ClaimedJob;

export async function enqueueJob(
  sql: Sql,
  opts: {
    userId: string;
    type: string;
    marketplace: MarketplaceId;
    accountId: string;
    itemId: string | null;
    channelListingId: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<string> {
  const id = makeId("job");
  const mode = CHANNELS[opts.marketplace]?.mode ?? "extension";
  const initial = mode === "extension" ? "waiting_for_browser" : "queued";
  const key = intentKey(opts.type, opts.accountId, opts.itemId, opts.channelListingId);
  const rows = await sql<{ id: string }>`
    insert into jobs (id, user_id, type, status, marketplace, account_id, item_id, channel_listing_id,
      request_id, payload, idempotency_key)
    values (${id}, ${opts.userId}, ${opts.type}, ${initial}, ${opts.marketplace}, ${opts.accountId},
      ${opts.itemId}, ${opts.channelListingId}, ${makeId("req")}, ${JSON.stringify(opts.payload ?? {})}, ${key})
    on conflict (user_id, idempotency_key) where idempotency_key is not null and status in
      ('queued', 'waiting_for_browser', 'uploading_photos', 'creating', 'running', 'error')
    do update set updated_at = jobs.updated_at
    returning id
  `;
  return rows[0].id;
}

export async function markExtensionHealth(sql: Sql, userId: string) {
  await sql`
    update marketplace_accounts
    set status = 'extension_offline',
        last_error = 'No heartbeat in 60s from the Lane Bridge Chrome extension. Open Chrome, keep vinted.co.uk signed in, and leave the extension enabled.',
        updated_at = now()
    where user_id = ${userId}
      and mode = 'extension'
      and status <> 'paused'
      and status <> 'needs_reauth'
      and (last_heartbeat_at is null or last_heartbeat_at < now() - interval '60 seconds')
  `;
}

export async function reserveJobHourly(sql: Sql, userId: string, jobId: string, accountId: string, max = 30) {
  const reserved = await sql<{ id: string }>`
    with locked as (select id, hourly_reserved from jobs where id = ${jobId} and user_id = ${userId} for update),
    charged as (
      update marketplace_accounts set publishes_this_hour = case
          when hour_window_start is null or hour_window_start < now() - interval '1 hour' then 1 else publishes_this_hour + 1 end,
        hour_window_start = case when hour_window_start is null or hour_window_start < now() - interval '1 hour' then now() else hour_window_start end
      where id = ${accountId} and user_id = ${userId} and exists (select 1 from locked where not hourly_reserved)
        and (case when hour_window_start is null or hour_window_start < now() - interval '1 hour' then 0 else publishes_this_hour end)
          < coalesce(nullif(max_publishes_per_hour, 0), ${max}) returning id
    ) update jobs set hourly_reserved = true where id = ${jobId} and user_id = ${userId}
      and (hourly_reserved or exists (select 1 from charged)) returning id
  `;
  if (!reserved[0]) throw Object.assign(new Error("Hourly publish cap reached on this account. Updates and delists are free."), { code: "rate_limited" });
}

export async function liveEbayToken(
  sql: Sql,
  userId: string,
  accountId: string,
  requireLocation = false,
): Promise<{ access: string; locationKey: string; settings: Record<string, unknown> }> {
  const rows = await sql<Record<string, unknown>>`
    select * from marketplace_accounts where id = ${accountId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error("eBay account missing");
  let access = unseal(row.oauth_access_token ? String(row.oauth_access_token) : null);
  const refresh = unseal(row.oauth_refresh_token ? String(row.oauth_refresh_token) : null);
  const expires = row.oauth_expires_at ? new Date(String(row.oauth_expires_at)).getTime() : 0;
  if (!access || !refresh) {
    await sql`update marketplace_accounts set status = 'needs_reauth', last_error = ${"eBay access token missing. Click Connect eBay UK again."} where id = ${accountId} and user_id = ${userId}`;
    throw new Error("eBay is not connected with a real OAuth token. Click Connect eBay UK.");
  }
  if (expires && Date.now() > expires - 60_000) {
    const next = await refreshEbayToken(refresh);
    access = next.access_token;
    await sql`
      update marketplace_accounts set
        oauth_access_token = ${seal(next.access_token)},
        oauth_refresh_token = ${seal(next.refresh_token ?? refresh)},
        oauth_expires_at = ${new Date(Date.now() + next.expires_in * 1000).toISOString()},
        updated_at = now()
      where id = ${accountId} and user_id = ${userId}
    `;
  }
  const locationKey = String(row.merchant_location_key ?? "LANE_UK");
  const ensured = requireLocation ? await ensureMerchantLocation(access, locationKey) : locationKey;
  if (ensured !== row.merchant_location_key) {
    await sql`update marketplace_accounts set merchant_location_key = ${ensured} where id = ${accountId} and user_id = ${userId}`;
  }
  return { access, locationKey: ensured, settings: (row.connector_settings ?? {}) as Record<string, unknown> };
}

export async function processJob(
  sql: Sql,
  userId: string,
  jobId: string,
  source: "worker" | "extension",
): Promise<{ ok: boolean; error?: string }> {
  const snapshot = await sql<JobRow>`select * from jobs where id = ${jobId} and user_id = ${userId}`;
  if (!snapshot[0]) return { ok: false, error: "Job not found" };
  if (snapshot[0].status === "done") return { ok: true };
  const job = await claimJob(sql, userId, jobId, makeId("lease"), source);
  if (!job) return { ok: false, error: "Job already claimed or not ready for this executor." };
  const marketplace = (job.marketplace ?? "") as MarketplaceId;

  try {
    const accounts = await sql<Record<string, unknown>>`
      select * from marketplace_accounts where id = ${job.account_id} and user_id = ${userId}
    `;
    const account = accounts[0] ? mapAccount(accounts[0]) : null;
    if (!account) throw new Error("Marketplace account missing");

    if (job.type === "publish" || job.type === "relist") {
      await reserveJobHourly(sql, userId, job.id, account.id);
      await reserveListingAction(sql, userId, job.request_id, job.type);
    }

    if (marketplace === "ebay_uk") {
      await runEbayJob(sql, userId, job);

    } else if (source === "extension") {
      throw new Error("Extension jobs must complete via the Lane Bridge result API, not the server worker.");
    } else {
      throw new Error(`${CHANNELS[marketplace]?.label ?? marketplace} has no server adapter.`);
    }

    const completed = await sql`
      update jobs set status = 'done', lease_token = null, lease_expires_at = null, needs_reconciliation = false, finished_at = now(), error_message = null, error_body = null, updated_at = now(),
        result = ${JSON.stringify({ ok: true })}
      where id = ${jobId} and user_id = ${userId} and lease_token = ${job.lease_token} returning id
    `;
    if (!completed[0]) return { ok: false, error: "A newer worker owns this job. Marketplace reconciliation is required." };
    await sql`
      update marketplace_accounts set consecutive_errors = 0, last_error = null,
        status = case when status = 'rate_limited' then status else 'green' end,
        updated_at = now()
      where id = ${account.id} and user_id = ${userId}
    `;
    if (job.item_id) {
      await ensureSoldItemDelisted(sql, userId, job.item_id, job.channel_listing_id);
      await refreshItemStatus(sql, userId, job.item_id);
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown adapter error";
    const body = err && typeof err === "object" && "body" in err ? String((err as { body?: string }).body ?? "") : message;
    const attempt = job.attempt;
    const dead = attempt >= (job.max_attempts || 5);
    const failed = await sql`
      update jobs set
        status = ${dead ? "dead" : "error"},
        lease_token = null, lease_expires_at = null,
        needs_reconciliation = ${job.type === "publish" || job.type === "relist"},
        error_message = ${message},
        error_body = ${body},
        finished_at = now(),
        updated_at = now()
      where id = ${jobId} and user_id = ${userId} and lease_token = ${job.lease_token} returning id
    `;
    if (!failed[0]) return { ok: false, error: "A newer worker owns this job." };
    if (job.account_id) {
      await sql`
        update marketplace_accounts
        set consecutive_errors = consecutive_errors + 1, last_error = ${message}, updated_at = now()
        where id = ${job.account_id} and user_id = ${userId}
      `;
    }
    if (job.channel_listing_id) {
      await sql`
        update channel_listings set last_error = ${message}, remote_status = 'error', updated_at = now()
        where id = ${job.channel_listing_id} and user_id = ${userId}
      `;
    }
    if (job.item_id) await refreshItemStatus(sql, userId, job.item_id);
    return { ok: false, error: message };
  }
}

async function runEbayJob(sql: Sql, userId: string, job: JobRow) {
  if (!job.account_id) throw new Error("Job missing account");
  const { access, locationKey, settings } = await liveEbayToken(sql, userId, job.account_id);

  if (job.type === "delist") {
    const rows = await sql<{ ebay_offer_id: string | null }>`
      select ebay_offer_id from channel_listings where id = ${job.channel_listing_id} and user_id = ${userId}
    `;
    const offerId = rows[0]?.ebay_offer_id;
    if (!offerId) throw new Error("No eBay offer id on this listing. It was never published through Lane.");
    await ebayWithdraw(access, offerId, () => renewJobLease(sql, userId, job.id, job.lease_token));
    await sql`
      update channel_listings set remote_status = 'ended', quantity_on_channel = 0, last_synced_at = now(), last_error = null, updated_at = now()
      where id = ${job.channel_listing_id} and user_id = ${userId}
    `;
    await sql`
      update remote_listings set status = 'ended', updated_at = now()
      where account_id = ${job.account_id} and user_id = ${userId}
        and remote_id = (select remote_id from channel_listings where id = ${job.channel_listing_id})
    `;
    return;
  }

  if (!job.item_id || !job.channel_listing_id) throw new Error("Job missing item/channel");
  const item = await loadItem(sql, userId, job.item_id);
  if (!item) throw new Error("Canonical item missing");
  const listing = item.channels.find((c) => c.id === job.channel_listing_id);
  if (!listing) throw new Error("Channel listing missing");
  const rules = (await sql<Record<string, unknown>>`select * from pricing_rules where user_id = ${userId}`).map(mapRule);
  const price = listing.channelPriceGbp ?? applyPricingRule(item.basePriceGbp, rules.find((r) => r.marketplace === "ebay_uk"));
  if (item.quantity <= 0 || item.status === "sold" || item.status === "archived") {
    const saved = await sql<{ ebay_offer_id: string | null }>`select ebay_offer_id from channel_listings where id = ${listing.id} and user_id = ${userId}`;
    const remote = await ebayReconcileListing(access, item, saved[0]?.ebay_offer_id);
    if (remote) await ebayWithdraw(access, remote.offerId, () => renewJobLease(sql, userId, job.id, job.lease_token));
    await sql`update channel_listings set remote_status = 'ended', quantity_on_channel = 0,
      remote_id = coalesce(${remote?.listingId ?? null}, remote_id), ebay_offer_id = coalesce(${remote?.offerId ?? null}, ebay_offer_id),
      last_error = null, updated_at = now() where id = ${listing.id} and user_id = ${userId}`;
    return;
  }
  if (item.condition === "unknown") throw new Error("Confirm the item condition before publishing.");
  const qty = item.quantity;
  const cat = findCategory(item.categoryCanonical);

  if (job.type === "update") {
    const rows = await sql<{ ebay_offer_id: string | null; ebay_sku: string | null }>`
      select ebay_offer_id, ebay_sku from channel_listings where id = ${listing.id} and user_id = ${userId}
    `;
    if (!rows[0]?.ebay_offer_id || !rows[0]?.ebay_sku) throw new Error("Nothing live to update on eBay.");
    await ebayUpdateOffer(access, rows[0].ebay_offer_id, rows[0].ebay_sku, item, price, qty, () => renewJobLease(sql, userId, job.id, job.lease_token));
    await sql`
      update channel_listings set remote_status = 'live', last_synced_at = now(), last_error = null, channel_price_gbp = ${price}, updated_at = now()
      where id = ${listing.id} and user_id = ${userId}
    `;
    return;
  }

  const existing = await sql<{ ebay_offer_id: string | null }>`
    select ebay_offer_id from channel_listings where id = ${listing.id} and user_id = ${userId}
  `;
  const published = await ebayPublish(
    access,
    await ensureMerchantLocation(access, locationKey),
    item,
    price,
    qty,
    existing[0]?.ebay_offer_id,
    settings,
    async (receipt) => {
      await renewJobLease(sql, userId, job.id, job.lease_token);
      await sql`update channel_listings set ebay_offer_id = ${receipt.offerId}, ebay_sku = ${receipt.sku}, updated_at = now()
        where id = ${listing.id} and user_id = ${userId}`;
    },
    () => renewJobLease(sql, userId, job.id, job.lease_token),
  );
  await sql`
    update channel_listings set
      remote_id = ${published.listingId},
      url = ${published.url},
      ebay_offer_id = ${published.offerId},
      ebay_sku = ${published.sku},
      mapped_category = ${cat?.ebayUk.name ?? null},
      mapped_category_id = ${cat?.ebayUk.id ?? null},
      channel_price_gbp = ${price},
      remote_status = 'live',
      last_synced_at = now(),
      last_error = null,
      quantity_on_channel = ${qty},
      updated_at = now()
    where id = ${listing.id} and user_id = ${userId}
  `;
  const have = await sql`select id from remote_listings where account_id = ${job.account_id} and remote_id = ${published.listingId} and user_id = ${userId}`;
  if (have.length === 0) {
    await sql`
      insert into remote_listings (
        id, user_id, account_id, marketplace, remote_id, url, title, description, price_gbp, quantity,
        status, photo_url, category_name, brand, size_label, colour, condition_label
      ) values (
        ${makeId("rmt")}, ${userId}, ${job.account_id}, ${"ebay_uk"}, ${published.listingId}, ${published.url},
        ${item.title}, ${item.description}, ${price}, ${qty}, ${"live"}, ${item.photos[0]?.url ?? null},
        ${cat?.ebayUk.name ?? null}, ${item.brand}, ${item.sizeUk}, ${item.colour}, ${item.condition}
      )
    `;
  }
}

export async function refreshItemStatus(sql: Sql, userId: string, itemId: string) {
  const itemRows = await sql<{ status: string; quantity: number }>`
    select status, quantity from items where id = ${itemId} and user_id = ${userId}
  `;
  if (!itemRows[0] || itemRows[0].status === "sold" || itemRows[0].status === "archived") return;
  const channels = await sql<{ remote_status: string }>`
    select remote_status from channel_listings where item_id = ${itemId} and user_id = ${userId}
  `;
  const statuses = channels.map((c) => c.remote_status);
  let next = "draft";
  if (statuses.some((s) => s === "error")) next = "error";
  else if (statuses.some((s) => s === "live")) next = "live";
  else if (statuses.some((s) => s === "queued" || s === "waiting_for_browser")) next = "queued";
  else if (statuses.some((s) => s === "sold")) next = "sold";
  await sql`update items set status = ${next}, updated_at = now() where id = ${itemId} and user_id = ${userId}`;
}

export async function applySale(
  sql: Sql,
  userId: string,
  opts: {
    itemId: string;
    marketplace: MarketplaceId;
    via: "webhook" | "extension_poll" | "manual";
    soldPriceGbp?: number;
    eventId?: string;
    remoteId?: string;
    accountId?: string;
    quantity?: number;
  },
) {
  const item = await loadItem(sql, userId, opts.itemId);
  if (!item) throw new Error("Item not found");
  const channels = item.channels.filter((c) => c.marketplace === opts.marketplace
    && (!opts.accountId || c.marketplaceAccountId === opts.accountId)
    && (!opts.remoteId || c.remoteId === opts.remoteId));
  if (channels.length > 1 && !opts.accountId && !opts.remoteId) throw new Error("Identify which account or listing sold this item.");
  const channel = channels.find((c) => c.remoteStatus === "live") ?? channels[0];
  if ((opts.accountId || opts.remoteId) && !channel) throw new Error("Sale listing is not linked to this item.");
  if (item.quantity > 1 && !opts.eventId && opts.via !== "extension_poll") {
    throw new Error("A stable order-line or manual sale reference is required for multi-quantity inventory.");
  }
  const soldPrice = opts.soldPriceGbp ?? channel?.channelPriceGbp ?? item.basePriceGbp;
  const quantity = opts.quantity ?? 1;
  if (!Number.isFinite(soldPrice) || soldPrice < 0 || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Sale price and quantity are invalid.");
  }
  const fees = estimateFees({ marketplace: opts.marketplace, listPriceGbp: soldPrice, categoryCanonical: item.categoryCanonical });
  const accountId = channel?.marketplaceAccountId ?? null;
  const event = saleEventKey({ ...opts, accountId, remoteId: opts.remoteId ?? channel?.remoteId, itemId: item.id });
  const rows = await sql<{ recorded: boolean }>`select lane_record_sale(
    ${userId}, ${item.id}, ${channel?.id ?? null}, ${opts.marketplace}, ${accountId},
    ${makeId("sal")}, ${event}, ${soldPrice}, ${fees.feeGbp}, ${fees.youReceiveGbp}, ${opts.via}, ${quantity}
  ) as recorded`;
  return { recorded: rows[0]?.recorded === true };
}

export async function tickOauthJobs(sql: Sql, userId: string) {
  await markExtensionHealth(sql, userId);
  await recoverExpiredJobs(sql, userId);
  const queued = await sql<{ id: string }>`
    select j.id from jobs j
    join marketplace_accounts a on a.id = j.account_id
    where j.user_id = ${userId}
      and j.status = 'queued'
      and a.mode = 'oauth'
    order by j.created_at asc
    limit 3
  `;
  const results = [];
  for (const q of queued) {
    results.push(await processJob(sql, userId, q.id, "worker"));
  }
  return results;
}

/** Web-app heartbeat must NOT complete Vinted jobs. Only the Chrome extension may. */
export async function tickExtensionJobs(_sql: Sql, _userId: string) {
  return { awake: false as const, processed: [] as { ok: boolean; error?: string }[] };
}

export async function applyExtensionJobResult(
  sql: Sql,
  userId: string,
  jobId: string,
  result: { ok: boolean; remoteId?: string; url?: string; error?: string; errorBody?: string; claimToken?: string },
) {
  const jobs = await sql<JobRow>`select * from jobs where id = ${jobId} and user_id = ${userId}`;
  const job = jobs[0];
  if (!job) throw new Error("Job not found");
  if (job.status === "done") return;
  if (!result.claimToken || !job.lease_token || job.lease_token !== result.claimToken) {
    throw new Error("This browser no longer owns the job. Refresh the queue before submitting a result.");
  }
  if (!result.ok) {
    await sql`update jobs set status = ${job.attempt >= job.max_attempts ? "dead" : "error"},
      lease_token = null, lease_expires_at = null, needs_reconciliation = ${job.type === "publish" || job.type === "relist"},
      error_message = ${result.error ?? "Bridge reported failure"}, error_body = ${result.errorBody ?? null},
      finished_at = now(), updated_at = now()
      where id = ${jobId} and user_id = ${userId} and lease_token = ${result.claimToken}`;
    if (job.channel_listing_id) {
      await sql`update channel_listings set remote_status = 'error', last_error = ${result.error ?? "failed"}, updated_at = now()
        where id = ${job.channel_listing_id} and user_id = ${userId}`;
    }
    if (job.item_id) await refreshItemStatus(sql, userId, job.item_id);
    return;
  }
  if ((job.type === "publish" || job.type === "relist") && !result.remoteId) {
    throw new Error("A successful publish must include the marketplace listing ID.");
  }
  // Reservation happens before Bridge hands out work. Results can be retried
  // after acknowledgement loss without consuming another action.
  await sql`with completed as (
    update jobs set status = 'done', lease_token = null, lease_expires_at = null,
      needs_reconciliation = false, result = ${JSON.stringify(result)}, error_message = null,
      error_body = null, finished_at = now(), updated_at = now()
    where id = ${jobId} and user_id = ${userId} and lease_token = ${result.claimToken}
    returning channel_listing_id, type
  ) update channel_listings c set
      remote_status = case when completed.type = 'delist' then 'ended' else 'live' end,
      remote_id = coalesce(${result.remoteId ?? null}, remote_id), url = coalesce(${result.url ?? null}, url),
      quantity_on_channel = case when completed.type = 'delist' then 0 else quantity_on_channel end,
      last_synced_at = now(), last_error = null, updated_at = now()
    from completed where c.id = completed.channel_listing_id and c.user_id = ${userId}`;
  if (job.type === "publish") await recordActivation(sql, userId, "first_publish", job.marketplace ?? undefined).catch(() => undefined);
  if (job.item_id) {
    await ensureSoldItemDelisted(sql, userId, job.item_id, job.channel_listing_id);
    await refreshItemStatus(sql, userId, job.item_id);
  }
}

async function ensureSoldItemDelisted(sql: Sql, userId: string, itemId: string, channelId: string | null) {
  const rows = await sql<{ marketplace: MarketplaceId; marketplace_account_id: string }>`
    select c.marketplace, c.marketplace_account_id from channel_listings c join items i on i.id = c.item_id and i.user_id = c.user_id
    where c.id = ${channelId} and c.user_id = ${userId} and i.id = ${itemId}
      and (i.quantity <= 0 or i.status = 'sold') and c.remote_status = 'live'`;
  for (const row of rows) await enqueueJob(sql, { userId, type: "delist", marketplace: row.marketplace,
    accountId: row.marketplace_account_id, itemId, channelListingId: channelId });
}
