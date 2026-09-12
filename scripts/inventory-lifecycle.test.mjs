import test from "node:test";
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { archiveInventoryItem,deleteInventoryDrafts } from "../src/lib/lane/server/inventory-lifecycle.ts";
function wrap(db){const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;sql.transaction=run=>db.transaction(tx=>run(wrap(tx)));return sql;}
async function fixture(){
  const db=new PGlite();
  for(const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort())await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
  await db.exec(`insert into items(id,user_id,title,base_price_gbp,status,quantity) values ('draft','owner','Draft',20,'draft',1),('history','owner','History',20,'sold',0),('foreign','other','Other',20,'draft',1);
    insert into item_photos(id,item_id,user_id,url) values ('p','draft','owner','https://example.test/photo');
    insert into listing_snapshots(id,user_id,item_id,content) values ('snapshot','owner','draft','{}');
    insert into sales(id,user_id,item_id,marketplace,sold_price_gbp,detected_via) values ('sale','owner','history','ebay_uk',20,'manual');`);
  return {db,sql:wrap(db)};
}
test("deletion rejects mixed history/foreign selections atomically and removes only clean drafts",async()=>{
  const {db,sql}=await fixture();
  try {
    for(const id of ['history','foreign']) await assert.rejects(deleteInventoryDrafts(sql,'owner',['draft',id]),/Nothing|Nothing was|unavailable/);
    assert.equal((await sql`select * from item_photos`).length,1);
    assert.equal((await sql`select * from listing_snapshots`).length,1);
    assert.equal((await sql`select * from sales`).length,1);
    // Failure after child removal must restore both parent and children.
    await db.exec(`create function fail_item_delete() returns trigger language plpgsql as $$ begin raise exception 'delete storage failed'; end; $$;
      create trigger fail_delete before delete on items for each row execute function fail_item_delete();`);
    await assert.rejects(deleteInventoryDrafts(sql,'owner',['draft']),/delete storage failed/);
    assert.equal((await sql`select * from item_photos`).length,1);
    assert.equal((await sql`select * from listing_snapshots`).length,1);
    await db.exec('drop trigger fail_delete on items');
    assert.deepEqual(await deleteInventoryDrafts(sql,'owner',['draft','draft']),{deleted:1});
    assert.equal((await sql`select * from item_photos`).length,0);
    assert.equal((await sql`select * from listing_snapshots`).length,0);
    assert.equal((await sql`select * from sales`).length,1);
  } finally {await db.close();}
});
test("archive preserves history, blocks live/unresolved jobs and restores sold state without resurrecting stock",async()=>{
  const {db,sql}=await fixture();
  try {
    await db.exec(`insert into marketplace_accounts(id,user_id,marketplace,mode,label) values ('shop','owner','ebay_uk','oauth','Shop');
      insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,remote_status) values ('listing','draft','owner','ebay_uk','shop','live');`);
    await assert.rejects(archiveInventoryItem(sql,'owner','draft'),/End live listings/);
    await sql`update channel_listings set remote_status='ended' where id='listing'`;
    await sql`insert into jobs(id,user_id,type,status,marketplace,account_id,item_id,channel_listing_id,request_id) values ('job','owner','publish','error','ebay_uk','shop','draft','listing','ref')`;
    await assert.rejects(archiveInventoryItem(sql,'owner','draft'),/reconcile/);
    await sql`update jobs set status='done',needs_reconciliation=true where id='job'`;
    await assert.rejects(archiveInventoryItem(sql,'owner','draft'),/reconcile/);
    await sql`update jobs set needs_reconciliation=false where id='job'`;
    await archiveInventoryItem(sql,'owner','draft');
    assert.equal((await sql`select status from items where id='draft'`)[0].status,'archived');
    await assert.rejects(deleteInventoryDrafts(sql,'owner',['draft']),/history/);
    await sql`update jobs set status='error' where id='job'`;
    await assert.rejects(archiveInventoryItem(sql,'owner','draft',true),/reconcile/);
    await sql`update jobs set status='done' where id='job'`;
    await archiveInventoryItem(sql,'owner','draft',true);
    assert.equal((await sql`select status from items where id='draft'`)[0].status,'draft');
    await archiveInventoryItem(sql,'owner','history');
    await archiveInventoryItem(sql,'owner','history',true);
    assert.equal((await sql`select status from items where id='history'`)[0].status,'sold');
    assert.equal((await sql`select * from sales`).length,1);
    assert.equal((await sql`select * from jobs`).length,1);
    await assert.rejects(archiveInventoryItem(sql,'other','draft'),/unavailable/);
  } finally {await db.close();}
});
test("database parent guards stop raced/foreign child writes and bypass deletion without erasing legacy data",async()=>{
  const {db,sql}=await fixture();
  try {
    await assert.rejects(sql`delete from items where id='history'`,/foreign key/);
    await assert.rejects(sql`insert into item_photos(id,item_id,user_id,url) values ('bad','draft','other','https://example.test/photo')`,/foreign key/);
    await deleteInventoryDrafts(sql,'owner',['draft']);
    await assert.rejects(sql`insert into jobs(id,user_id,type,status,item_id,request_id) values ('late','owner','update','queued','draft','late')`,/foreign key/);
    assert.equal((await sql`select * from jobs`).length,0);
    assert.equal((await sql`select * from sales`).length,1);
  } finally {await db.close();}
});
