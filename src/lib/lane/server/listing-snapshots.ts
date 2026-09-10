import { createHash } from "node:crypto";
import type { Sql } from "../../db";
import type { ItemView } from "../types";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}

export async function storeListingSnapshot(sql: Sql, userId: string, item: ItemView, priceGbp: number) {
  if (!Number.isFinite(priceGbp) || priceGbp <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("A positive price and stock quantity are required before queueing.");
  // Keep only listing data: no private notes, cost, live receipts or timestamps.
  const content = canonical({version:1,priceGbp,item:{
    id:item.id,sku:item.sku,title:item.title,description:item.description,brand:item.brand,
    categoryCanonical:item.categoryCanonical,condition:item.condition,sizeUk:item.sizeUk,sizeEu:item.sizeEu,sizeUs:item.sizeUs,
    colour:item.colour,material:item.material,gender:item.gender,era:item.era,basePriceGbp:item.basePriceGbp,quantity:item.quantity,
    weightG:item.weightG,lengthCm:item.lengthCm,widthCm:item.widthCm,heightCm:item.heightCm,postageProfileId:item.postageProfileId,
    channelFields:item.channelFields ?? {},photos:item.photos.map(p=>({url:p.url,phash:p.phash})),
  }});
  const serialized = JSON.stringify(content);
  const id = `snap_${createHash("sha256").update(JSON.stringify([userId,item.id,serialized])).digest("hex")}`;
  await sql`insert into listing_snapshots(id,user_id,item_id,content) values (${id},${userId},${item.id},${serialized}::jsonb) on conflict do nothing`;
  return id;
}

export async function loadListingSnapshot(sql: Sql, userId: string, payload: unknown, current: ItemView): Promise<{item:ItemView;priceGbp:number}> {
  let parsed = payload;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { throw new Error("The queued job payload is invalid. Do not publish this job."); }
  }
  const ref = parsed && typeof parsed === "object" ? (parsed as Record<string,unknown>).listingSnapshotId : null;
  if (typeof ref !== "string") throw new Error("This legacy job has no saved listing snapshot. Review it before creating a new action.");
  const rows = await sql<{content:{version:number;priceGbp:number;item:Partial<ItemView>}}>`select content from listing_snapshots where id=${ref} and user_id=${userId} and item_id=${current.id}`;
  const saved = rows[0]?.content;
  if (!saved || saved.version !== 1 || saved.item.id !== current.id || typeof saved.item.title !== "string" || !Array.isArray(saved.item.photos) || !Number.isFinite(saved.priceGbp) || saved.priceGbp <= 0 || !Number.isInteger(saved.item.quantity) || Number(saved.item.quantity) <= 0) throw new Error("The queued listing snapshot is unavailable or invalid. Do not publish this job.");
  if (!Number.isInteger(current.quantity) || current.quantity < 0) throw new Error("Current inventory quantity needs review.");
  // All public content comes from the saved revision; current state remains the
  // authority for stock/sold handling and remote IDs used for reconciliation.
  return {priceGbp:saved.priceGbp,item:{...current,...saved.item,quantity:Math.min(current.quantity,Number(saved.item.quantity)),status:current.status,channels:current.channels} as ItemView};
}
