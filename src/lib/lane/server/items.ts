import type { Sql } from "../../db";
import type { ItemDraft } from "../types";
import { makeId } from "../ids";

export async function insertItem(sql: Sql, userId: string, draft: ItemDraft, suppliedId?: string): Promise<string> {
  const id = suppliedId ?? makeId("itm");
  const price = Number(draft.basePriceGbp);
  if (!draft.title.trim()) throw new Error("Title is required");
  if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be a number in GBP");
  const qty = Math.max(1, Math.floor(Number(draft.quantity) || 1));
  const cost = draft.costPriceGbp.trim() === "" ? null : Number(draft.costPriceGbp);
  await sql<{ id: string }>`
    with inserted as (insert into items (
      id, user_id, sku, title, description, brand, category_canonical, condition,
      size_uk, size_eu, size_us, colour, material, gender, era,
      cost_price_gbp, base_price_gbp, quantity, weight_g, length_cm, width_cm, height_cm,
      postage_profile_id, notes, status, channel_fields
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
      ${draft.postageProfileId || null}, ${draft.notes || null}, ${"draft"}, ${JSON.stringify(draft.channelFields ?? {})}::jsonb
    ) on conflict (id) do nothing returning id),
    photos as (insert into item_photos(id,item_id,user_id,url,sort_order,is_primary,phash)
      select p.id, i.id, ${userId}, p.url, p.position, p.position = 0, p.phash
      from inserted i cross join jsonb_to_recordset(${JSON.stringify(draft.photos.map((p,position) => ({id:makeId("pho"),url:p.url,phash:p.phash ?? null,position})))}::jsonb)
        as p(id text,url text,phash text,position int)),
    tags as (insert into item_tags(item_id,user_id,tag)
      select i.id, ${userId}, t.value from inserted i cross join
        jsonb_array_elements_text(${JSON.stringify([...new Set(draft.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean))])}::jsonb) t
      on conflict do nothing)
    select id from inserted
  `;
  return id;
}

