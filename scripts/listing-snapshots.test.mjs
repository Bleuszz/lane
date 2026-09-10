import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { loadListingSnapshot, storeListingSnapshot } from "../src/lib/lane/server/listing-snapshots.ts";

const hooks = registerHooks({resolve(specifier,context,next){
  // The bridge route's Vite-owned global DB bootstrap is not used here: both
  // integration tests inject their own real PGlite connection into the executor.
  if (specifier === "@/lib/db") return {url:`data:text/javascript,${encodeURIComponent('export async function getSql(){throw new Error("Global database must not be used by this test")}')}`,shortCircuit:true};
  if (specifier.startsWith("@/")) return next(new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url).href,context);
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/src/")) return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const {enqueueJob,isSaleStockJob} = await import("../src/lib/lane/server/process.ts");
const {loadItem} = await import("../src/lib/lane/server/map.ts");
const {claimJob} = await import("../src/lib/lane/server/operations.ts");
const {pendingJobs} = await import("../src/lib/lane/server/bridge.ts");
hooks.deregister();

test("real enqueue/claim retains the approved revision on retry, with live stock and owner isolation", async()=>{
  const db=new PGlite();
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  try {
    for(const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
    await sql`insert into user_settings(user_id) values ('owner')`;
    await sql`insert into marketplace_accounts(id,user_id,marketplace,mode,label,status) values ('shop','owner','ebay_uk','oauth','Test shop','green')`;
    await sql`insert into items(id,user_id,title,description,base_price_gbp,quantity,notes,cost_price_gbp,channel_fields) values ('item','owner','Approved title','Original flaws noted',20,3,'Private supplier note',5,'{"ebay_uk":{"aspects":{"Size":["S"]}}}'::jsonb)`;
    await sql`insert into item_photos(id,item_id,user_id,url,sort_order,is_primary) values ('photo','item','owner','https://example.test/original.jpg',0,true)`;
    await sql`insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,channel_price_gbp,remote_status) values ('channel','item','owner','ebay_uk','shop',22,'queued')`;
    // The database sale outbox has no content snapshot: its update is stock-only.
    await sql`select lane_record_sale('owner','item',null,'vinted_uk',null,'sale-test','event-test',20,0,20,'manual',1)`;
    const stockJob=(await sql`select * from jobs where request_id='sale-test:channel'`)[0];
    assert.equal(await isSaleStockJob(sql,"owner",stockJob),true);
    assert.equal(await isSaleStockJob(sql,"other",stockJob),false);
    assert.equal(await isSaleStockJob(sql,"owner",{...stockJob,request_id:"unrelated"}),false);
    await sql`delete from jobs where id=${stockJob.id}`;
    await sql`update items set quantity=3 where id='item'`;
    const original=await loadItem(sql,"owner","item");
    const opts={userId:"owner",type:"publish",marketplace:"ebay_uk",accountId:"shop",itemId:"item",channelListingId:"channel"};
    const first=await enqueueJob(sql,opts);
    assert.equal(await enqueueJob(sql,opts),first);
    assert.equal((await sql`select * from listing_snapshots`).length,1,"identical content is shared");
    const snapshot=(await sql`select content from listing_snapshots`)[0].content;
    assert.equal(snapshot.item.notes,undefined);
    assert.equal(snapshot.item.costPriceGbp,undefined);
    await sql`update items set title='Later edit',description='Changed',quantity=2,base_price_gbp=30,channel_fields='{"ebay_uk":{"aspects":{"Size":["L"]}}}'::jsonb where id='item'`;
    await sql`update item_photos set url='https://example.test/new.jpg' where id='photo'`;
    await sql`update channel_listings set channel_price_gbp=99 where id='channel'`;
    assert.equal(await enqueueJob(sql,opts),first,"retry keeps original job and snapshot reference");
    const claimed=await claimJob(sql,"owner",first,"lease","worker");
    assert.ok(JSON.parse(claimed.payload).listingSnapshotId);
    let current=await loadItem(sql,"owner","item");
    const frozen=await loadListingSnapshot(sql,"owner",claimed.payload,current);
    assert.equal(frozen.item.title,original.title);
    assert.equal(frozen.item.description,original.description);
    assert.deepEqual(frozen.item.channelFields,original.channelFields);
    assert.equal(frozen.item.photos[0].url,original.photos[0].url);
    assert.equal(frozen.priceGbp,22);
    assert.equal(frozen.item.quantity,2,"stock reductions apply");
    current={...current,quantity:10};
    assert.equal((await loadListingSnapshot(sql,"owner",claimed.payload,current)).item.quantity,3,"later increases cannot exceed approved quantity");
    for(const status of ["sold","archived"]) {
      const stopped=await loadListingSnapshot(sql,"owner",claimed.payload,{...current,status,quantity:0});
      assert.equal(stopped.item.status,status);
      assert.equal(stopped.item.quantity,0);
    }
    await assert.rejects(loadListingSnapshot(sql,"other",claimed.payload,current),/unavailable/);
    await assert.rejects(loadListingSnapshot(sql,"owner",claimed.payload,{...current,id:"another"}),/unavailable/);
    await assert.rejects(loadListingSnapshot(sql,"owner",{},current),/legacy job/);
    await assert.rejects(storeListingSnapshot(sql,"owner",original,NaN),/positive price/);
    await assert.rejects(loadListingSnapshot(sql,"owner",claimed.payload,{...current,quantity:-1}),/quantity needs review/);
  } finally {await db.close();}
});

test("bridge dispatch sends frozen fields and price, and sends nothing after stock is sold", async()=>{
  const db=new PGlite();
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  try {
    for(const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
    await sql`insert into user_settings(user_id) values ('owner')`;
    await sql`insert into marketplace_accounts(id,user_id,marketplace,mode,label,status) values ('vinted','owner','vinted_uk','extension','Local fixture','green')`;
    for(const id of ["frozen","sold-later"]) {
      await sql`insert into items(id,user_id,title,description,base_price_gbp,quantity) values (${id},'owner','Reviewed title','Reviewed description',20,1)`;
      await sql`insert into item_photos(id,item_id,user_id,url) values (${`photo-${id}`},${id},'owner','https://example.test/reviewed.jpg')`;
      await sql`insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,channel_price_gbp,remote_status) values (${id},${id},'owner','vinted_uk','vinted',23,'waiting_for_browser')`;
    }
    const queue=id=>enqueueJob(sql,{userId:"owner",type:"publish",marketplace:"vinted_uk",accountId:"vinted",itemId:id,channelListingId:id});
    const first=await queue("frozen"), sold=await queue("sold-later");
    await sql`update items set title='Edited after queue',base_price_gbp=50 where id='frozen'`;
    await sql`update channel_listings set channel_price_gbp=70 where id='frozen'`;
    await sql`update item_photos set url='https://example.test/edited.jpg' where item_id='frozen'`;
    await sql`update items set quantity=0,status='sold' where id='sold-later'`;
    const before=(await sql`select trial_actions_used from user_settings where user_id='owner'`)[0].trial_actions_used;
    assert.deepEqual(await pendingJobs(sql,"owner",sold),[]);
    assert.equal((await sql`select trial_actions_used from user_settings where user_id='owner'`)[0].trial_actions_used,before);
    const dispatched=await pendingJobs(sql,"owner",first);
    assert.equal(dispatched.length,1);
    assert.equal(dispatched[0].item.title,"Reviewed title");
    assert.equal(dispatched[0].item.priceGbp,23);
    assert.equal(dispatched[0].item.photos[0].url,"https://example.test/reviewed.jpg");
    assert.ok(dispatched[0].claimToken);
    assert.deepEqual(await pendingJobs(sql,"owner",first),[],"claimed jobs cannot be dispatched twice");
  } finally {await db.close();}
});
