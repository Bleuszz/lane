import { env } from "@/lib/env.server";
import type { Sql } from "@/lib/db";
import { findCategory } from "@/lib/lane/categories";
import { makeId } from "@/lib/lane/ids";
import type { ItemView } from "@/lib/lane/types";
import { seal, unseal } from "./secret";

const HOST = "https://www.vinted.co.uk";

type TokenSet = { access: string; refresh: string; expiresIn: number };

export async function refreshVintedToken(refreshToken: string): Promise<TokenSet> {
  const res = await fetch(`${HOST}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": env("VINTED_USER_AGENT") ?? "Mozilla/5.0 (Lane; +https://github.com/Bleuszz/lane)",
    },
    body: JSON.stringify({
      client_id: "web",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.access_token) {
    throw Object.assign(new Error(String(json.error_description ?? json.error ?? `Vinted token HTTP ${res.status}`)), {
      body: JSON.stringify(json).slice(0, 2000),
      code: res.status === 401 ? "needs_reauth" : "vinted",
    });
  }
  return {
    access: String(json.access_token),
    refresh: json.refresh_token ? String(json.refresh_token) : refreshToken,
    expiresIn: Number(json.expires_in ?? 7200),
  };
}

export async function vintedFetch<T = Record<string, unknown>>(
  access: string,
  method: string,
  path: string,
  body?: unknown,
  extra?: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: T; text: string }> {
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${access}`,
      Accept: "application/json, text/plain, */*",
      "X-Money-Object": "true",
      "Accept-Language": "en-GB",
      Origin: HOST,
      Referer: `${HOST}/`,
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {} as T;
  try {
    json = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    /* html / datadome */
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function vintedCurrentUser(access: string): Promise<{ id: string; login: string }> {
  const r = await vintedFetch<{ user?: { id?: number; login?: string } }>(access, "GET", "/api/v2/users/current");
  const user = r.json.user;
  if (!r.ok || !user?.id) {
    throw Object.assign(new Error("Vinted did not return the signed-in user. Session is dead or blocked (DataDome)."), {
      body: r.text.slice(0, 1500),
      code: "needs_reauth",
    });
  }
  return { id: String(user.id), login: String(user.login ?? "vinted") };
}

export type VintedRemote = {
  remoteId: string;
  title: string;
  description: string | null;
  priceGbp: number;
  photoUrl: string | null;
  brand: string | null;
  sizeLabel: string | null;
  categoryName: string | null;
  conditionLabel: string | null;
  url: string;
  status: string;
};

export async function vintedListWardrobe(access: string, userId: string): Promise<VintedRemote[]> {
  const out: VintedRemote[] = [];
  for (let page = 1; page <= 8 && out.length < 200; page += 1) {
    const r = await vintedFetch<{ items?: Array<Record<string, unknown>> }>(
      access,
      "GET",
      `/api/v2/users/${encodeURIComponent(userId)}/items?page=${page}&per_page=96&order=newest_first`,
    );
    if (!r.ok) {
      throw Object.assign(new Error(`Vinted wardrobe HTTP ${r.status}`), { body: r.text.slice(0, 1500) });
    }
    const items = r.json.items ?? [];
    if (items.length === 0) break;
    for (const it of items) {
      const id = String(it.id ?? "");
      if (!id) continue;
      const photo = it.photo as { url?: string } | undefined;
      const price = it.price as { amount?: string } | string | number | undefined;
      const amount = typeof price === "object" && price ? Number(price.amount) : Number(price ?? 0);
      out.push({
        remoteId: id,
        title: String(it.title ?? "Untitled"),
        description: it.description ? String(it.description) : null,
        priceGbp: Number.isFinite(amount) ? amount : 0,
        photoUrl: photo?.url ?? null,
        brand: it.brand_title ? String(it.brand_title) : null,
        sizeLabel: it.size_title ? String(it.size_title) : null,
        categoryName: it.catalog_id ? String(it.catalog_id) : null,
        conditionLabel: it.status_title ? String(it.status_title) : null,
        url: String(it.url ?? `${HOST}/items/${id}`),
        status: it.is_closed ? "ended" : "live",
      });
    }
    if (items.length < 96) break;
  }
  return out.slice(0, 200);
}

export async function liveVintedToken(
  sql: Sql,
  userId: string,
  accountId: string,
): Promise<{ access: string; remoteUserId: string | null }> {
  const rows = await sql<Record<string, unknown>>`
    select * from marketplace_accounts where id = ${accountId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error("Vinted account missing");
  let access = unseal(row.oauth_access_token ? String(row.oauth_access_token) : null);
  const refresh = unseal(row.oauth_refresh_token ? String(row.oauth_refresh_token) : null);
  const expires = row.oauth_expires_at ? new Date(String(row.oauth_expires_at)).getTime() : 0;
  if (!refresh) {
    throw Object.assign(
      new Error("No Vinted session on the server. Pair Lane Bridge (desktop Chrome or Firefox Android) or finish Connect from your phone."),
      { code: "needs_reauth" },
    );
  }
  if (!access || (expires && Date.now() > expires - 60_000)) {
    const next = await refreshVintedToken(refresh);
    access = next.access;
    await sql`
      update marketplace_accounts set
        oauth_access_token = ${seal(next.access)},
        oauth_refresh_token = ${seal(next.refresh)},
        oauth_expires_at = ${new Date(Date.now() + next.expiresIn * 1000).toISOString()},
        updated_at = now()
      where id = ${accountId} and user_id = ${userId}
    `;
  }
  return { access: access!, remoteUserId: row.remote_user_id ? String(row.remote_user_id) : null };
}

export async function saveVintedSession(
  sql: Sql,
  userId: string,
  tokens: { accessToken?: string | null; refreshToken: string },
): Promise<{ accountId: string; username: string }> {
  const refreshed = await refreshVintedToken(tokens.refreshToken);
  const access = tokens.accessToken || refreshed.access;
  const ident = await vintedCurrentUser(access);
  const existing = await sql<{ id: string }>`
    select id from marketplace_accounts
    where user_id = ${userId} and marketplace = ${"vinted_uk"}
    order by created_at asc limit 1
  `;
  const id = existing[0]?.id ?? makeId("acc");
  const expires = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
  if (existing[0]) {
    await sql`
      update marketplace_accounts set
        oauth_access_token = ${seal(access)},
        oauth_refresh_token = ${seal(refreshed.refresh)},
        oauth_expires_at = ${expires},
        oauth_connected = ${true},
        remote_user_id = ${ident.id},
        remote_username = ${ident.login},
        status = ${"green"},
        last_error = null,
        last_heartbeat_at = now(),
        sandbox = ${false},
        updated_at = now()
      where id = ${id} and user_id = ${userId}
    `;
  } else {
    await sql`
      insert into marketplace_accounts (
        id, user_id, marketplace, mode, label, remote_user_id, remote_username, status,
        oauth_connected, oauth_access_token, oauth_refresh_token, oauth_expires_at, sandbox
      ) values (
        ${id}, ${userId}, ${"vinted_uk"}, ${"extension"}, ${"Vinted UK"}, ${ident.id}, ${ident.login},
        ${"green"}, ${true}, ${seal(access)}, ${seal(refreshed.refresh)}, ${expires}, ${false}
      )
    `;
  }
  await sql`update user_settings set extension_enabled = true where user_id = ${userId}`;
  await sql`
    update vinted_connect_sessions
    set status = 'completed', account_id = ${id}, completed_at = now()
    where user_id = ${userId} and status = 'pending'
  `;
  return { accountId: id, username: ident.login };
}


async function vintedFindBrand(access: string, name: string | null): Promise<number | null> {
  if (!name) return null;
  const q = encodeURIComponent(name);
  for (const path of [`/api/v2/brands?search=${q}`, `/api/v2/brands/search?keyword=${q}`]) {
    const r = await vintedFetch<{ brands?: Array<{ id?: number; title?: string; name?: string }> }>(access, "GET", path);
    const list = r.json.brands ?? [];
    const lower = name.toLowerCase();
    const hit = list.find((b) => (b.title ?? b.name ?? "").toLowerCase() === lower)
      ?? list.find((b) => (b.title ?? b.name ?? "").toLowerCase().includes(lower));
    if (hit?.id) return Number(hit.id);
  }
  return null;
}

async function vintedFindColourIds(access: string, name: string | null): Promise<number[]> {
  if (!name) return [];
  const r = await vintedFetch<{ colors?: Array<{ id?: number; title?: string; code?: string }> }>(access, "GET", "/api/v2/colors");
  const list = r.json.colors ?? [];
  const lower = name.toLowerCase();
  const hit = list.find((c) => (c.title ?? c.code ?? "").toLowerCase() === lower)
    ?? list.find((c) => (c.title ?? "").toLowerCase().includes(lower));
  return hit?.id ? [Number(hit.id)] : [];
}

async function vintedFindSizeId(access: string, catalogId: number | null, sizeLabel: string | null): Promise<number | null> {
  if (!catalogId || !sizeLabel) return null;
  const paths = [
    `/api/v2/item_upload/sizes?catalog_id=${catalogId}`,
    `/api/v2/catalogs/${catalogId}`,
  ];
  const lower = sizeLabel.toLowerCase();
  for (const path of paths) {
    const r = await vintedFetch<{ sizes?: unknown; size_groups?: unknown }>(access, "GET", path);
    const raw = r.json.sizes ?? r.json.size_groups ?? [];
    const list = Array.isArray(raw) ? raw : [];
    const flat: Array<{ id?: number; title?: string; name?: string }> = [];
    for (const row of list as Array<Record<string, unknown>>) {
      if (Array.isArray(row.sizes)) flat.push(...(row.sizes as Array<{ id?: number; title?: string; name?: string }>));
      else flat.push(row as { id?: number; title?: string; name?: string });
    }
    const hit = flat.find((s) => (s.title ?? s.name ?? "").toLowerCase() === lower)
      ?? flat.find((s) => (s.title ?? s.name ?? "").toLowerCase().includes(lower));
    if (hit?.id) return Number(hit.id);
  }
  return null;
}

const STATUS_ID: Record<string, number> = {
  new_with_tags: 6,
  new_without_tags: 1,
  very_good: 2,
  good: 3,
  satisfactory: 4,
};

export async function vintedPublish(
  access: string,
  item: ItemView,
  priceGbp: number,
): Promise<{ remoteId: string; url: string }> {
  const photoIds: number[] = [];
  for (const photo of item.photos.slice(0, 8)) {
    const blob = await materialisePhoto(photo.url);
    if (!blob) continue;
    const fd = new FormData();
    fd.append("photo", blob, "photo.jpg");
    const up = await vintedFetch<{ photo?: { id?: number }; id?: number }>(access, "POST", "/api/v2/photos", fd);
    const id = Number(up.json.photo?.id ?? up.json.id ?? 0);
    if (up.ok && id) photoIds.push(id);
  }
  if (photoIds.length === 0) {
    throw new Error("Vinted publish needs at least one photo Lane can fetch (https URL or data URL).");
  }
  const cat = findCategory(item.categoryCanonical);
  const catalogId = cat?.vintedUk.catalogId ? Number(cat.vintedUk.catalogId) : null;
  const brandId = await vintedFindBrand(access, item.brand);
  const colourIds = await vintedFindColourIds(access, item.colour);
  const sizeId = await vintedFindSizeId(access, catalogId, item.sizeUk);
  const packageSizeId =
    item.postageProfileId === "vinted_large" ? 3 : item.postageProfileId === "vinted_medium" ? 2 : 1;
  const payload = {
    item: {
      title: item.title.slice(0, 100),
      description: item.description || item.title,
      price: priceGbp,
      currency: "GBP",
      catalog_id: catalogId ?? undefined,
      status_id: STATUS_ID[item.condition] ?? 3,
      package_size_id: packageSizeId,
      photo_ids: photoIds,
      is_unisex: item.gender === "unisex",
      ...(brandId ? { brand_id: brandId } : {}),
      ...(colourIds.length ? { color_ids: colourIds } : {}),
      ...(sizeId ? { size_id: sizeId } : {}),
    },
  };
  const created = await vintedFetch<{ item?: { id?: number; url?: string }; id?: number }>(
    access,
    "POST",
    "/api/v2/items",
    payload,
  );
  if (!created.ok) {
    throw Object.assign(new Error(`Vinted create item HTTP ${created.status}. Datacentre IPs are often blocked — use Lane Bridge if this repeats.`), {
      body: created.text.slice(0, 2000),
    });
  }
  const remoteId = String(created.json.item?.id ?? created.json.id ?? "");
  if (!remoteId) throw new Error("Vinted created an item but returned no id.");
  return { remoteId, url: created.json.item?.url ?? `${HOST}/items/${remoteId}` };
}

export async function vintedDelete(access: string, remoteId: string) {
  const r = await vintedFetch(access, "DELETE", `/api/v2/items/${encodeURIComponent(remoteId)}`);
  if (!r.ok && r.status !== 404) {
    const alt = await vintedFetch(access, "POST", `/api/v2/items/${encodeURIComponent(remoteId)}/delete`, {});
    if (!alt.ok && alt.status !== 404) {
      throw Object.assign(new Error(`Vinted delete HTTP ${alt.status}`), { body: alt.text.slice(0, 1500) });
    }
  }
}

async function materialisePhoto(url: string): Promise<Blob | null> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    const header = url.slice(0, comma);
    const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/jpeg";
    const buf = Buffer.from(url.slice(comma + 1), "base64");
    return new Blob([buf], { type: mime });
  }
  if (!/^https?:\/\//i.test(url)) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const type = res.headers.get("content-type") || "image/jpeg";
  return new Blob([buf], { type });
}
