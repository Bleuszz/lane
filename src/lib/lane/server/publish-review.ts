import { createHash } from "node:crypto";
import type { Sql } from "../../db";
import type { AccountView, ItemView, PricingRuleView } from "../types";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}

/** Detect saved-content/price/destination changes, excluding routine heartbeats. */
export function publishReviewHash(item: ItemView, accounts: AccountView[], rules: PricingRuleView[]): string {
  const destinations = accounts.map(a=>({id:a.id,marketplace:a.marketplace,label:a.label,mode:a.mode,sandbox:a.sandbox,status:a.status})).sort((a,b)=>a.id.localeCompare(b.id));
  const relevantRules = rules.filter(r=>accounts.some(a=>a.marketplace===r.marketplace)).sort((a,b)=>a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(canonical({item,destinations,rules:relevantRules}))).digest("hex");
}

export function assertPublishReviews(items: ItemView[], accounts: AccountView[], rules: PricingRuleView[], hashes?: Record<string,string>) {
  if (!hashes && items.length <= 1) return; // Single-item editors have their own review.
  if (!hashes) throw new Error("Review each selected item before publishing this batch.");
  for (const item of items) {
    if (hashes[item.id] !== publishReviewHash(item,accounts,rules)) throw new Error(`“${item.title}” or its destination settings changed. Reload the batch and review it again; nothing has been queued.`);
  }
}

/** Lock all item parents before reading, validating or queuing any part of a batch. */
export async function withPublishItems<T>(sql: Sql, userId: string, ids: string[], load: (tx: Sql,userId:string,id:string)=>Promise<ItemView|null>, run: (tx:Sql,items:ItemView[])=>Promise<T>) {
  return sql.transaction(async tx => {
    const unique = [...new Set(ids)].sort();
    const locked = await tx<{id:string}>`select id from items where user_id=${userId} and id=any(${unique}::text[]) order by id for update`;
    if (locked.length !== unique.length) throw new Error("A selected item is unavailable. Refresh the inventory before publishing.");
    const items: ItemView[] = [];
    for (const id of unique) {
      const item = await load(tx,userId,id);
      if (!item || item.status === "sold" || item.status === "archived") throw new Error("Sold, archived or unavailable items cannot be published. Update your selection.");
      items.push(item);
    }
    return run(tx,items);
  });
}
