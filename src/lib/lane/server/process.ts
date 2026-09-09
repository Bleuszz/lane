import type { Sql } from "@/lib/db";
import { CHANNELS } from "@/lib/lane/channels";
import { findCategory } from "@/lib/lane/categories";
import { estimateFees } from "@/lib/lane/fees";
import { num0 } from "@/lib/lane/format";
import { makeId } from "@/lib/lane/ids";
import { actionLimit } from "@/lib/lane/plans";
import { applyPricingRule } from "@/lib/lane/pricing";
import type { MarketplaceId } from "@/lib/lane/types";
import { asPlan, loadItem, mapAccount, mapRule, mapSettings } from "./map";
import { ebayPublish, ebayUpdateOffer, ebayWithdraw, ensureMerchantLocation, refreshEbayToken } from "./ebay";
import { liveVintedToken, vintedDelete, vintedPublish } from "./vinted";
import { unseal, seal } from "./secret";

export type JobRow = {
  id: string;
  type: string;
  status: string;
  marketplace: string | null;
  account_id: string | null;
  item_id: string | null;
  channel_listing_id: string | null;
  request_id: string;
  attempt: number;
  max_attempts: number;
};

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
  let initial = mode === "extension" ? "waiting_for_browser" : "queued";
  if (mode === "extension") {
    const tok = await sql<{ oauth_refresh_token: string | null }>`
      select oauth_refresh_token from marketplace_accounts where id = ${opts.accountId} and user_id = ${opts.userId}
    `;
    if (tok[0]?.oauth_refresh_token) initial = "queued";
  }
  await sql`
    insert into jobs (
      id, user_id, type, status, marketplace, account_id, item_id, channel_listing_id,
      request_id, payload
    ) values (
      ${id}, ${opts.userId}, ${opts.type}, ${initial}, ${opts.marketplace}, ${opts.accountId},
      ${opts.itemId}, ${opts.channelListingId}, ${makeId("req")}, ${JSON.stringify(opts.payload ?? {})}
    )
  `;
  return id;
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

async function bumpHourly(sql: Sql, accountId: string, userId: string, max: number) {
  const rows = await sql<Record<string, unknown>>`
    select publishes_this_hour, hour_window_start, max_publishes_per_hour
    from marketplace_accounts where id = ${accountId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error("Account missing");
  const windowStart = row.hour_window_start ? new Date(String(row.hour_window_start)).getTime() : 0;
  const stale = !windowStart || Date.now() - windowStart > 60 * 60 * 1000;
  const used = stale ? 0 : num0(row.publishes_this_hour);
  const cap = num0(row.max_publishes_per_hour) || max;
  if (used >= cap) {
    await sql`update marketplace_accounts set status = 'rate_limited', last_error = ${"Hourly publish cap reached on this account."} where id = ${accountId} and user_id = ${userId}`;
    throw Object.assign(new Error(`Hourly cap (${cap}/hour) reached on this account. Updates and delists are free.`), {
      code: "rate_limited",
    });
  }
  if (stale) {
    await sql`update marketplace_accounts set publishes_this_hour = 1, hour_window_start = now() where id = ${accountId} and user_id = ${userId}`;
  } else {
    await sql`update marketplace_accounts set publishes_this_hour = publishes_this_hour + 1 where id = ${accountId} and user_id = ${userId}`;
  }
}

async function consumeAction(sql: Sql, userId: string, type: string) {
  if (type !== "publish" && type !== "relist") return;
  const rows = await sql<Record<string, unknown>>`select * from user_settings where user_id = ${userId}`;
  const settings = mapSettings(rows[0] ?? {});
  const limit = actionLimit(asPlan(settings.plan));
  if (settings.actionsUsedMonth >= limit) {
    throw Object.assign(
      new Error(
        `Monthly action cap reached (${limit}). Updates and delists are free so you can still keep inventory clean.`,
      ),
      { code: "cap" },
    );
  }
  await sql`update user_settings set actions_used_month = actions_used_month + 1 where user_id = ${userId}`;
}

export async function liveEbayToken(
  sql: Sql,
  userId: string,
  accountId: string,
): Promise<{ access: string; locationKey: string }> {
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
  const ensured = await ensureMerchantLocation(access, locationKey);
  if (ensured !== row.merchant_location_key) {
    await sql`update marketplace_accounts set merchant_location_key = ${ensured} where id = ${accountId} and user_id = ${userId}`;
  }
  return { access, locationKey: ensured };
}

export async function processJob(
  sql: Sql,
  userId: string,
  jobId: string,
  source: "worker" | "extension",
): Promise<{ ok: boolean; error?: string }> {
  const jobs = await sql<JobRow>`
    select id, type, status, marketplace, account_id, item_id, channel_listing_id, request_id, attempt, max_attempts
    from jobs where id = ${jobId} and user_id = ${userId}
  `;
  const job = jobs[0];
  if (!job) return { ok: false, error: "Job not found" };
  if (job.status === "done") return { ok: true };

  const marketplace = (job.marketplace ?? "") as MarketplaceId;
  const mode = CHANNELS[marketplace]?.mode ?? "extension";
  if (mode === "extension" && source !== "extension") {
    await sql`update jobs set status = 'waiting_for_browser', updated_at = now() where id = ${jobId} and user_id = ${userId}`;
    return { ok: false, error: "waiting_for_browser" };
  }
  if (mode === "oauth" && source !== "worker") {
    return { ok: false, error: "oauth_job" };
  }

  await sql`
    update jobs set status = ${job.type === "publish" ? "creating" : "running"}, started_at = coalesce(started_at, now()), attempt = attempt + 1, updated_at = now()
    where id = ${jobId} and user_id = ${userId}
  `;

  try {
    const accounts = await sql<Record<string, unknown>>`
      select * from marketplace_accounts where id = ${job.account_id} and user_id = ${userId}
    `;
    const account = accounts[0] ? mapAccount(accounts[0]) : null;
    if (!account) throw new Error("Marketplace account missing");

    if (job.type === "publish" || job.type === "relist") {
      await bumpHourly(sql, account.id, userId, 30);
      await consumeAction(sql, userId, job.type);
    }

    if (marketplace === "ebay_uk") {
      await runEbayJob(sql, userId, job);
    } else if (marketplace === "vinted_uk" && source === "worker") {
      const parked = await runVintedJob(sql, userId, job);
      if (parked) return { ok: false, error: "waiting_for_browser" };
    } else if (source === "extension") {
      throw new Error("Extension jobs must complete via the Lane Bridge result API, not the server worker.");
    } else {
      throw new Error(`${CHANNELS[marketplace]?.label ?? marketplace} has no server adapter.`);
    }

    await sql`
      update jobs set status = 'done', finished_at = now(), error_message = null, error_body = null, updated_at = now(),
        result = ${JSON.stringify({ ok: true })}
      where id = ${jobId} and user_id = ${userId}
    `;
    await sql`
      update marketplace_accounts set consecutive_errors = 0, last_error = null,
        status = case when status = 'rate_limited' then status else 'green' end,
        updated_at = now()
      where id = ${account.id} and user_id = ${userId}
    `;
    if (job.item_id) await refreshItemStatus(sql, userId, job.item_id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown adapter error";
    const body = err && typeof err === "object" && "body" in err ? String((err as { body?: string }).body ?? "") : message;
    const attempt = job.attempt + 1;
    const dead = attempt >= (job.max_attempts || 5);
    await sql`
      update jobs set
        status = ${dead ? "dead" : "error"},
        error_message = ${message},
        error_body = ${body},
        finished_at = now(),
        updated_at = now()
      where id = ${jobId} and user_id = ${userId}
    `;
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
  const { access, locationKey } = await liveEbayToken(sql, userId, job.account_id);

  if (job.type === "delist") {
    const rows = await sql<{ ebay_offer_id: string | null }>`
      select ebay_offer_id from channel_listings where id = ${job.channel_listing_id} and user_id = ${userId}
    `;
    const offerId = rows[0]?.ebay_offer_id;
    if (!offerId) throw new Error("No eBay offer id on this listing. It was never published through Lane.");
    await ebayWithdraw(access, offerId);
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
  const qty = Math.max(1, item.quantity);
  const cat = findCategory(item.categoryCanonical);

  if (job.type === "update") {
    const rows = await sql<{ ebay_offer_id: string | null; ebay_sku: string | null }>`
      select ebay_offer_id, ebay_sku from channel_listings where id = ${listing.id} and user_id = ${userId}
    `;
    if (!rows[0]?.ebay_offer_id || !rows[0]?.ebay_sku) throw new Error("Nothing live to update on eBay.");
    await ebayUpdateOffer(access, rows[0].ebay_offer_id, rows[0].ebay_sku, item, price, qty);
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
    locationKey,
    item,
    price,
    qty,
    job.type === "relist" ? null : existing[0]?.ebay_offer_id,
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

async function runVintedJob(sql: Sql, userId: string, job: JobRow): Promise<boolean> {
  if (!job.account_id) throw new Error("Job missing account");
  let access: string;
  try {
    ({ access } = await liveVintedToken(sql, userId, job.account_id));
  } catch {
    await sql`
      update jobs set status = 'waiting_for_browser', error_message = ${"Vinted session not on the server yet. Pair Lane Bridge or finish phone connect."}, updated_at = now()
      where id = ${job.id} and user_id = ${userId}
    `;
    return true;
  }

  if (job.type === "delist") {
    const rows = await sql<{ remote_id: string | null }>`
      select remote_id from channel_listings where id = ${job.channel_listing_id} and user_id = ${userId}
    `;
    if (rows[0]?.remote_id) await vintedDelete(access, rows[0].remote_id);
    await sql`
      update channel_listings set remote_status = 'ended', quantity_on_channel = 0, last_synced_at = now(), last_error = null, updated_at = now()
      where id = ${job.channel_listing_id} and user_id = ${userId}
    `;
    return false;
  }

  if (!job.item_id || !job.channel_listing_id) throw new Error("Job missing item/channel");
  const item = await loadItem(sql, userId, job.item_id);
  if (!item) throw new Error("Canonical item missing");
  const listing = item.channels.find((c) => c.id === job.channel_listing_id);
  if (!listing) throw new Error("Channel listing missing");
  const rules = (await sql<Record<string, unknown>>`select * from pricing_rules where user_id = ${userId}`).map(mapRule);
  const price = listing.channelPriceGbp ?? applyPricingRule(item.basePriceGbp, rules.find((r) => r.marketplace === "vinted_uk"));
  const cat = findCategory(item.categoryCanonical);
  const published = await vintedPublish(access, item, price);
  await sql`
    update channel_listings set
      remote_id = ${published.remoteId},
      url = ${published.url},
      mapped_category = ${cat?.vintedUk.name ?? null},
      mapped_category_id = ${cat?.vintedUk.catalogId ?? null},
      channel_price_gbp = ${price},
      remote_status = 'live',
      last_synced_at = now(),
      last_error = null,
      quantity_on_channel = ${1},
      updated_at = now()
    where id = ${listing.id} and user_id = ${userId}
  `;
  return false;
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
  },
) {
  const item = await loadItem(sql, userId, opts.itemId);
  if (!item) throw new Error("Item not found");
  const channel = item.channels.find((c) => c.marketplace === opts.marketplace && c.remoteStatus === "live");
  const soldPrice = opts.soldPriceGbp ?? channel?.channelPriceGbp ?? item.basePriceGbp;
  const fees = estimateFees({
    marketplace: opts.marketplace,
    listPriceGbp: soldPrice,
    categoryCanonical: item.categoryCanonical,
  });
  const remaining = Math.max(0, item.quantity - 1);

  await sql`
    insert into sales (id, user_id, item_id, marketplace, account_id, sold_price_gbp, fees_gbp, net_gbp, quantity, detected_via)
    values (
      ${makeId("sal")}, ${userId}, ${item.id}, ${opts.marketplace}, ${channel?.marketplaceAccountId ?? null},
      ${soldPrice}, ${fees.feeGbp}, ${fees.youReceiveGbp}, ${1}, ${opts.via}
    )
  `;

  if (channel?.remoteId) {
    await sql`
      update remote_listings set status = 'sold', quantity = 0, updated_at = now()
      where account_id = ${channel.marketplaceAccountId} and remote_id = ${channel.remoteId} and user_id = ${userId}
    `;
    await sql`
      update channel_listings set remote_status = 'sold', quantity_on_channel = 0, last_synced_at = now(), updated_at = now()
      where id = ${channel.id} and user_id = ${userId}
    `;
  }

  if (remaining <= 0) {
    await sql`
      update items set quantity = 0, status = 'sold', sold_channel = ${opts.marketplace}, sold_price_gbp = ${soldPrice}, sold_at = now(), updated_at = now()
      where id = ${item.id} and user_id = ${userId}
    `;
    const others = item.channels.filter(
      (c) => c.id !== channel?.id && (c.remoteStatus === "live" || c.remoteStatus === "queued" || c.remoteStatus === "waiting_for_browser"),
    );
    for (const other of others) {
      await enqueueJob(sql, {
        userId,
        type: "delist",
        marketplace: other.marketplace,
        accountId: other.marketplaceAccountId,
        itemId: item.id,
        channelListingId: other.id,
      });
    }
  } else {
    await sql`
      update items set quantity = ${remaining}, updated_at = now()
      where id = ${item.id} and user_id = ${userId}
    `;
  }
}

export async function tickOauthJobs(sql: Sql, userId: string) {
  await markExtensionHealth(sql, userId);
  const queued = await sql<{ id: string }>`
    select j.id from jobs j
    join marketplace_accounts a on a.id = j.account_id
    where j.user_id = ${userId}
      and j.status = 'queued'
      and (a.mode = 'oauth' or a.oauth_refresh_token is not null)
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
  result: {
    ok: boolean;
    remoteId?: string;
    url?: string;
    error?: string;
    errorBody?: string;
  },
) {
  const jobs = await sql<JobRow>`
    select id, type, status, marketplace, account_id, item_id, channel_listing_id, request_id, attempt, max_attempts
    from jobs where id = ${jobId} and user_id = ${userId}
  `;
  const job = jobs[0];
  if (!job) throw new Error("Job not found");
  if (job.status === "done") return;

  if (!result.ok) {
    const attempt = job.attempt + 1;
    const dead = attempt >= (job.max_attempts || 5);
    await sql`
      update jobs set status = ${dead ? "dead" : "error"}, error_message = ${result.error ?? "Bridge reported failure"},
        error_body = ${result.errorBody ?? null}, finished_at = now(), updated_at = now(), attempt = ${attempt}
      where id = ${jobId} and user_id = ${userId}
    `;
    if (job.account_id) {
      await sql`
        update marketplace_accounts
        set consecutive_errors = consecutive_errors + 1, last_error = ${result.error ?? "Bridge reported failure"}, updated_at = now()
        where id = ${job.account_id} and user_id = ${userId}
      `;
    }
    if (job.channel_listing_id) {
      await sql`update channel_listings set remote_status = 'error', last_error = ${result.error ?? "failed"}, updated_at = now() where id = ${job.channel_listing_id} and user_id = ${userId}`;
    }
    if (job.item_id) await refreshItemStatus(sql, userId, job.item_id);
    return;
  }

  if (job.type === "publish" || job.type === "relist") {
    if (job.account_id) {
      try {
        await bumpHourly(sql, job.account_id, userId, 30);
      } catch (err) {
        await sql`
          update jobs set status = 'error', error_message = ${err instanceof Error ? err.message : "rate limited"}, finished_at = now(), updated_at = now()
          where id = ${jobId} and user_id = ${userId}
        `;
        throw err;
      }
    }
    await consumeAction(sql, userId, job.type);
  }

  if (job.type === "delist" && job.channel_listing_id) {
    await sql`
      update channel_listings set remote_status = 'ended', quantity_on_channel = 0, last_synced_at = now(), last_error = null, updated_at = now()
      where id = ${job.channel_listing_id} and user_id = ${userId}
    `;
  } else if (job.channel_listing_id && result.remoteId) {
    await sql`
      update channel_listings set
        remote_id = ${result.remoteId},
        url = ${result.url ?? null},
        remote_status = 'live',
        last_synced_at = now(),
        last_error = null,
        updated_at = now()
      where id = ${job.channel_listing_id} and user_id = ${userId}
    `;
  }
  await sql`
    update jobs set status = 'done', finished_at = now(), error_message = null, error_body = null, updated_at = now(),
      result = ${JSON.stringify(result)}
    where id = ${jobId} and user_id = ${userId}
  `;
  if (job.account_id) {
    await sql`
      update marketplace_accounts set consecutive_errors = 0, last_error = null, status = 'green', updated_at = now()
      where id = ${job.account_id} and user_id = ${userId}
    `;
  }
  if (job.item_id) await refreshItemStatus(sql, userId, job.item_id);
}
