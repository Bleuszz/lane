import type { Sql } from "../../db";

async function lockItems(tx: Sql, userId: string, ids: string[]) {
  const unique=[...new Set(ids)].sort();
  if (!unique.length || unique.length>200 || unique.some(id=>!id || id.length>200)) throw new Error("Select 1-200 valid items.");
  const rows=await tx<{id:string;status:string}>`select id,status from items where user_id=${userId} and id=any(${unique}::text[]) order by id for update`;
  if(rows.length!==unique.length) throw new Error("A selected item is unavailable. Nothing was changed.");
  return rows;
}

export async function archiveInventoryItem(sql:Sql,userId:string,id:string,restore=false) {
  return sql.transaction(async tx=>{
    const [item]=await lockItems(tx,userId,[id]);
    const jobs=await tx`select id from jobs where user_id=${userId} and item_id=${id}
      and (status<>'done' or needs_reconciliation or lease_token is not null) limit 1`;
    const listings=await tx`select id from channel_listings where user_id=${userId} and item_id=${id}
      and remote_status not in ('ended','sold','draft') limit 1`;
    if(jobs.length || listings.length) throw new Error("End live listings and finish or reconcile pending/failed jobs before archiving or restoring. Your records have been kept.");
    if(restore) {
      if(item.status!=="archived") throw new Error("This item is not archived.");
      await tx`update items set status=case when quantity=0 then 'sold' else 'draft' end,updated_at=now() where id=${id} and user_id=${userId}`;
      return {ok:true as const};
    }
    await tx`update items set status='archived',updated_at=now() where id=${id} and user_id=${userId}`;
    return {ok:true as const};
  });
}

/** Permanent deletion is only for unlisted drafts with no execution/sale history. */
export async function deleteInventoryDrafts(sql:Sql,userId:string,ids:string[]) {
  return sql.transaction(async tx=>{
    const items=await lockItems(tx,userId,ids);
    for(const item of items) {
      const history=await tx`select id from sales where user_id=${userId} and item_id=${item.id}
        union all select id from jobs where user_id=${userId} and item_id=${item.id}
        union all select id from channel_listings where user_id=${userId} and item_id=${item.id}
          and (remote_status<>'draft' or remote_id is not null or ebay_offer_id is not null or url is not null) limit 1`;
      if(!["draft","archived"].includes(item.status) || history.length) throw new Error("Only unlisted drafts without job or sales history can be deleted. Archive completed items to keep their records. Nothing was deleted.");
    }
    for(const item of items) {
      await tx`delete from item_photos where item_id=${item.id} and user_id=${userId}`;
      await tx`delete from item_tags where item_id=${item.id} and user_id=${userId}`;
      await tx`delete from channel_listings where item_id=${item.id} and user_id=${userId}`;
      await tx`delete from listing_snapshots where item_id=${item.id} and user_id=${userId}`;
      await tx`delete from items where id=${item.id} and user_id=${userId}`;
    }
    return {deleted:items.length};
  });
}
