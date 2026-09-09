import { getSql, type Sql } from "@/lib/db";
import { findCategory } from "@/lib/lane/categories";
import { makeId } from "@/lib/lane/ids";
import type { MarketplaceId } from "@/lib/lane/types";
import { applySale, applyExtensionJobResult, markExtensionHealth } from "./process";
import { loadItem } from "./map";
import { saveVintedSession } from "./vinted";
import { tokensEqual } from "./secret";

export type BridgeUser = { userId: string; pairingToken: string };

export function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("Origin") ?? "";
  if (
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin === "http://localhost:8080" ||
    origin === "http://127.0.0.1:8080"
  ) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "600");
  return headers;
}

export function json(request: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

export async function resolvePairing(request: Request): Promise<BridgeUser | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("lnb_")) return null;
  const sql = await getSql();
  const rows = await sql<{ user_id: string; extension_pairing_token: string }>`
    select user_id, extension_pairing_token from user_settings where extension_pairing_token is not null
  `;
  const hit = rows.find((r) => r.extension_pairing_token && tokensEqual(r.extension_pairing_token, token));
  if (!hit) return null;
  return { userId: hit.user_id, pairingToken: token };
}

export async function handleBridge(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/bridge\/?/, "").replace(/\/$/, "");

  const user = await resolvePairing(request);
  if (!user) return json(request, { error: "Invalid pairing token. Copy it from Lane → Settings → Channels." }, 401);

  const sql = await getSql();

  try {
    if (request.method === "GET" && (path === "me" || path === "")) {
      return json(request, await bridgeMe(sql, user.userId));
    }
    if (request.method === "POST" && path === "heartbeat") {
      const body = await readJson(request);
      return json(request, await bridgeHeartbeat(sql, user.userId, body));
    }
    if (request.method === "GET" && path === "jobs") {
      return json(request, { jobs: await pendingJobs(sql, user.userId) });
    }
    if (request.method === "GET" && path.startsWith("jobs/")) {
      const id = path.slice("jobs/".length);
      const jobs = await pendingJobs(sql, user.userId, id);
      const job = jobs[0];
      if (!job) return json(request, { error: "Job not found" }, 404);
      return json(request, { job });
    }
    if (request.method === "POST" && path.match(/^jobs\/[^/]+\/result$/)) {
      const id = path.split("/")[1] ?? "";
      const body = await readJson(request);
      await applyExtensionJobResult(sql, user.userId, id, {
        ok: Boolean(body.ok),
        remoteId: body.remoteId ? String(body.remoteId) : undefined,
        url: body.url ? String(body.url) : undefined,
        error: body.error ? String(body.error) : undefined,
        errorBody: body.errorBody ? String(body.errorBody) : undefined,
      });
      return json(request, { ok: true });
    }
    if (request.method === "POST" && path === "session") {
      const body = await readJson(request);
      const refresh = body.refreshToken ? String(body.refreshToken) : "";
      if (!refresh) return json(request, { error: "refreshToken required" }, 400);
      const saved = await saveVintedSession(sql, user.userId, {
        accessToken: body.accessToken ? String(body.accessToken) : null,
        refreshToken: refresh,
      });
      return json(request, { ok: true, username: saved.username });
    }
    if (request.method === "POST" && path === "identity") {
      const body = await readJson(request);
      await applyIdentity(sql, user.userId, body);
      return json(request, { ok: true });
    }
    if (request.method === "POST" && path === "catalog") {
      const body = await readJson(request);
      const upserted = await upsertCatalog(sql, user.userId, body);
      return json(request, { ok: true, upserted });
    }
    if (request.method === "POST" && path === "sold") {
      const body = await readJson(request);
      if (!body.itemId && !body.remoteId) return json(request, { error: "itemId or remoteId required" }, 400);
      let itemId = body.itemId ? String(body.itemId) : "";
      if (!itemId && body.remoteId) {
        const rows = await sql<{ item_id: string }>`
          select item_id from channel_listings
          where user_id = ${user.userId} and remote_id = ${String(body.remoteId)} and marketplace = ${"vinted_uk"}
          limit 1
        `;
        itemId = rows[0]?.item_id ?? "";
      }
      if (!itemId) return json(request, { error: "No canonical item linked to that Vinted listing." }, 404);
      await applySale(sql, user.userId, {
        itemId,
        marketplace: "vinted_uk",
        via: "extension_poll",
        soldPriceGbp: body.soldPriceGbp != null ? Number(body.soldPriceGbp) : undefined,
      });
      return json(request, { ok: true });
    }
    return json(request, { error: `Unknown bridge path /${path}` }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bridge error";
    return json(request, { error: message }, 400);
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Body must be JSON");
  }
}

async function bridgeMe(sql: Sql, userId: string) {
  const accounts = await sql<Record<string, unknown>>`
    select id, marketplace, status, remote_username, last_heartbeat_at
    from marketplace_accounts where user_id = ${userId} and mode = 'extension'
  `;
  return {
    ok: true,
    userId,
    accounts: accounts.map((a) => ({
      id: String(a.id),
      marketplace: String(a.marketplace),
      status: String(a.status),
      username: a.remote_username ? String(a.remote_username) : null,
      lastHeartbeatAt: a.last_heartbeat_at ? String(a.last_heartbeat_at) : null,
    })),
  };
}

async function bridgeHeartbeat(sql: Sql, userId: string, body: Record<string, unknown>) {
  await sql`
    update user_settings set extension_awake = true, extension_enabled = true where user_id = ${userId}
  `;
  await sql`
    update marketplace_accounts
    set last_heartbeat_at = now(),
        status = case when status in ('paused', 'needs_reauth', 'rate_limited') then status else 'green' end,
        last_error = null,
        updated_at = now()
    where user_id = ${userId} and mode = 'extension'
  `;
  if (body.username || body.userId) {
    await applyIdentity(sql, userId, body);
  }
  await markExtensionHealth(sql, userId);
  const jobs = await pendingJobs(sql, userId);
  return { ok: true, jobs };
}

async function applyIdentity(sql: Sql, userId: string, body: Record<string, unknown>) {
  const username = body.username ? String(body.username) : null;
  const remoteUserId = body.userId ? String(body.userId) : null;
  if (!username && !remoteUserId) return;
  await sql`
    update marketplace_accounts
    set remote_username = coalesce(${username}, remote_username),
        remote_user_id = coalesce(${remoteUserId}, remote_user_id),
        updated_at = now()
    where user_id = ${userId} and marketplace = ${"vinted_uk"}
  `;
}

async function pendingJobs(sql: Sql, userId: string, jobId?: string) {
  const rows = jobId
    ? await sql<Record<string, unknown>>`
        select j.*, i.title as item_title
        from jobs j
        left join items i on i.id = j.item_id
        where j.user_id = ${userId} and j.id = ${jobId}
          and j.status in ('waiting_for_browser', 'uploading_photos', 'creating', 'running')
      `
    : await sql<Record<string, unknown>>`
        select j.*, i.title as item_title
        from jobs j
        join marketplace_accounts a on a.id = j.account_id
        left join items i on i.id = j.item_id
        where j.user_id = ${userId}
          and a.mode = 'extension'
          and j.status in ('waiting_for_browser', 'uploading_photos', 'creating')
        order by j.created_at asc
        limit 8
      `;

  const out = [];
  for (const row of rows) {
    const item = row.item_id ? await loadItem(sql, userId, String(row.item_id)) : null;
    const cat = findCategory(item?.categoryCanonical);
    const listing = item?.channels.find((c) => c.id === String(row.channel_listing_id ?? ""));
    out.push({
      id: String(row.id),
      type: String(row.type),
      status: String(row.status),
      marketplace: String(row.marketplace ?? "vinted_uk") as MarketplaceId,
      requestId: String(row.request_id),
      accountId: row.account_id ? String(row.account_id) : null,
      itemId: row.item_id ? String(row.item_id) : null,
      channelListingId: row.channel_listing_id ? String(row.channel_listing_id) : null,
      item: item
        ? {
            title: item.title,
            description: item.description,
            brand: item.brand,
            categoryCanonical: item.categoryCanonical,
            vintedCatalogId: cat?.vintedUk.catalogId ?? null,
            vintedCatalogName: cat?.vintedUk.name ?? null,
            vintedCatalogPath: cat?.vintedUk.path ?? null,
            condition: item.condition,
            sizeUk: item.sizeUk,
            colour: item.colour,
            material: item.material,
            gender: item.gender,
            packageSizeId: item.postageProfileId === "vinted_large" ? 3 : item.postageProfileId === "vinted_medium" ? 2 : 1,
            priceGbp: listing?.channelPriceGbp ?? item.basePriceGbp,
            quantity: 1,
            sku: item.sku,
            photos: item.photos.map((p) => ({ url: p.url })),
          }
        : null,
      listing: listing
        ? { id: listing.id, remoteId: listing.remoteId, url: listing.url }
        : null,
    });
  }
  return out;
}

type CatalogItem = {
  remoteId: string;
  url?: string | null;
  title: string;
  description?: string | null;
  priceGbp: number;
  quantity?: number;
  photoUrl?: string | null;
  brand?: string | null;
  sizeLabel?: string | null;
  categoryName?: string | null;
  colour?: string | null;
  conditionLabel?: string | null;
  status?: string;
};

export async function upsertCatalog(sql: Sql, userId: string, body: Record<string, unknown>): Promise<number> {
  const items = Array.isArray(body.items) ? (body.items as CatalogItem[]) : [];
  if (items.length > 200) throw new Error("Catalog sync cap is 200 items per run.");
  const accounts = await sql<{ id: string }>`
    select id from marketplace_accounts where user_id = ${userId} and marketplace = ${"vinted_uk"} order by created_at asc limit 1
  `;
  const accountId = accounts[0]?.id;
  if (!accountId) throw new Error("Connect Vinted UK in Lane before syncing a wardrobe.");

  if (body.username || body.userId) await applyIdentity(sql, userId, body);

  let n = 0;
  for (const item of items) {
    if (!item?.remoteId || !item?.title) continue;
    const price = Number(item.priceGbp);
    if (!Number.isFinite(price)) continue;
    const existing = await sql<{ id: string }>`
      select id from remote_listings where account_id = ${accountId} and remote_id = ${String(item.remoteId)} and user_id = ${userId}
    `;
    if (existing[0]) {
      await sql`
        update remote_listings set
          url = ${item.url ?? null},
          title = ${item.title},
          description = ${item.description ?? null},
          price_gbp = ${price},
          quantity = ${item.quantity ?? 1},
          status = ${item.status ?? "live"},
          photo_url = ${item.photoUrl ?? null},
          category_name = ${item.categoryName ?? null},
          brand = ${item.brand ?? null},
          size_label = ${item.sizeLabel ?? null},
          colour = ${item.colour ?? null},
          condition_label = ${item.conditionLabel ?? null},
          updated_at = now()
        where id = ${existing[0].id} and user_id = ${userId}
      `;
    } else {
      await sql`
        insert into remote_listings (
          id, user_id, account_id, marketplace, remote_id, url, title, description, price_gbp, quantity,
          status, photo_url, category_name, brand, size_label, colour, condition_label
        ) values (
          ${makeId("rmt")}, ${userId}, ${accountId}, ${"vinted_uk"}, ${String(item.remoteId)}, ${item.url ?? null},
          ${item.title}, ${item.description ?? null}, ${price}, ${item.quantity ?? 1}, ${item.status ?? "live"},
          ${item.photoUrl ?? null}, ${item.categoryName ?? null}, ${item.brand ?? null}, ${item.sizeLabel ?? null},
          ${item.colour ?? null}, ${item.conditionLabel ?? null}
        )
      `;
    }
    n += 1;
  }
  return n;
}
