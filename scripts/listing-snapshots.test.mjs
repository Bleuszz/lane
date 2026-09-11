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
const {enqueueJob,isSaleStockJob,processJob,tickOauthJobs} = await import("../src/lib/lane/server/process.ts");
const {loadItem} = await import("../src/lib/lane/server/map.ts");
const {claimJob,guardEbayStockWrite,queueJobRetry} = await import("../src/lib/lane/server/operations.ts");
const {pendingJobs} = await import("../src/lib/lane/server/bridge.ts");
const {seal} = await import("../src/lib/lane/server/secret.ts");
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


test("slow photo delivery stops stale stock, retry uses current quantity and successful work preserves an account pause",async()=>{
  const db=new PGlite();
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  const originalFetch=globalThis.fetch;
  const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=";
  let uploads=0,writes=0;
  globalThis.fetch=async(url,options)=>{
    const path=new URL(url).pathname;
    if(path.endsWith("create_image_from_file")) {
      uploads++;
      // A sale is recorded while the provider is handling the image.
      await sql`select lane_record_sale('owner','item',null,'vinted_uk',null,'during-upload','sale-during-upload',22,0,22,'manual',1)`;
      return Response.json({imageUrl:"https://i.ebayimg.com/images/fixture.jpg",expirationDate:new Date(Date.now()+86_400_000).toISOString()},{status:201});
    }
    if(options.method==="GET" && path.includes("inventory_item/")) return Response.json({product:{title:"Before",description:"Before"}});
    if(options.method==="GET" && path.endsWith("/offer/offer")) return Response.json({offerId:"offer",availableQuantity:2});
    if(options.method==="PUT") {
      writes++;
      const body=JSON.parse(options.body);
      if(path.includes("inventory_item/")) {
        assert.equal(body.availability.shipToLocationAvailability.quantity,1);
        assert.equal(body.product.title,"Approved title");
        assert.deepEqual(body.product.imageUrls,["https://i.ebayimg.com/images/fixture.jpg"]);
      } else {
        assert.equal(body.availableQuantity,1);
        // Pause after the final remote request: completion must not reactivate it.
        await sql`update marketplace_accounts set status='paused' where id='shop'`;
      }
      return new Response(null,{status:204});
    }
    throw new Error(`Unexpected fixture request: ${options.method} ${path}`);
  };
  try {
    for(const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
    await sql`insert into user_settings(user_id) values ('owner')`;
    await sql`insert into marketplace_accounts(id,user_id,marketplace,mode,label,status,oauth_access_token,oauth_refresh_token,oauth_expires_at) values ('shop','owner','ebay_uk','oauth','Test shop','green',${seal("fixture-access")},${seal("fixture-refresh")},'2100-01-01')`;
    await sql`insert into items(id,user_id,title,description,condition,base_price_gbp,quantity) values ('item','owner','Approved title','Original flaws retained','good',20,2)`;
    await sql`insert into item_photos(id,item_id,user_id,url) values ('photo','item','owner',${png})`;
    await sql`insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,channel_price_gbp,remote_status,ebay_offer_id,ebay_sku,quantity_on_channel) values ('channel','item','owner','ebay_uk','shop',22,'live','offer','sku',2)`;
    const job=await enqueueJob(sql,{userId:"owner",type:"update",marketplace:"ebay_uk",accountId:"shop",itemId:"item",channelListingId:"channel"});
    const first=await processJob(sql,"owner",job,"worker");
    assert.equal(first.ok,false);
    assert.match(first.error,/Stock changed/);
    assert.equal(writes,0,"a slow upload must not be followed by a stale inventory write");
    assert.equal(uploads,1);
    assert.equal((await sql`select status from jobs where id='during-upload:channel'`)[0].status,"queued","the real sale outbox survives the active content update");
    await sql`update items set title='Later unapproved edit' where id='item'`;
    await queueJobRetry(sql,"owner",job);
    assert.deepEqual(await processJob(sql,"owner",job,"worker"),{ok:true});
    assert.equal(writes,2);
    assert.equal(uploads,1,"retry reuses the completed photo receipt");
    assert.equal((await sql`select quantity_on_channel from channel_listings where id='channel'`)[0].quantity_on_channel,1);
    assert.equal((await sql`select status from marketplace_accounts where id='shop'`)[0].status,"paused");
    assert.equal((await sql`select status from jobs where id=${job}`)[0].status,"done");
  } finally {globalThis.fetch=originalFetch;await db.close();}
});

test("outward stock guards reject sold, archived, paused, foreign and expired work without enlarging approved stock",async()=>{
  const db=new PGlite();
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  try {
    for(const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
    await sql`insert into marketplace_accounts(id,user_id,marketplace,mode,label,status) values ('shop','owner','ebay_uk','oauth','Test','green')`;
    await sql`insert into items(id,user_id,title,base_price_gbp,quantity) values ('item','owner','Test',20,3)`;
    const id=await enqueueJob(sql,{userId:"owner",type:"update",marketplace:"ebay_uk",accountId:"shop",itemId:"item",channelListingId:null});
    await claimJob(sql,"owner",id,"lease","worker");
    const guard=(quantity,stockOnly=false)=>guardEbayStockWrite(sql,"owner",id,"lease",quantity,stockOnly);
    await guard(2); // Approved stock remains capped even when more exists now.
    await guard(3,true);
    await assert.rejects(guard(2,true),/Stock changed/);
    await assert.rejects(guard(4),/Stock changed/);
    await assert.rejects(guardEbayStockWrite(sql,"foreign",id,"lease",2),/lease expired/);
    await sql`update marketplace_accounts set status='paused' where id='shop'`;
    await assert.rejects(guard(2),/paused or disconnected/);
    await sql`update marketplace_accounts set status='green' where id='shop'`;
    for(const status of ["sold","archived"]) {
      await sql`update items set status=${status} where id='item'`;
      await assert.rejects(guard(1),/Stock changed/);
      await guard(0,true); // Ending availability is safe even with a stale stored count.
    }
    await sql`update jobs set lease_expires_at=now()-interval '1 second' where id=${id}`;
    await assert.rejects(guard(0,true),/lease expired/);
  } finally {await db.close();}
});


test("automatic retry reconciles a lost publish receipt after cooldown without duplicate listings or action charges",async()=>{
  const db=new PGlite();
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  const originalFetch=globalThis.fetch;
  const oldId=process.env.EBAY_CLIENT_ID,oldSecret=process.env.EBAY_CLIENT_SECRET;
  process.env.EBAY_CLIENT_ID="fixture-id";process.env.EBAY_CLIENT_SECRET="fixture-secret";
  let offer=null,creates=0,publishes=0,requests=0,forceStatus=null;
  globalThis.fetch=async(url,options)=>{
    requests++;
    const path=new URL(url).pathname;
    if(forceStatus) return Response.json({errors:[{message:"fixture failure"}]},{status:forceStatus,headers:{"Retry-After":"60"}});
    if(path.endsWith("oauth2/token")) return Response.json({access_token:"fixture-token"});
    if(path.endsWith("get_default_category_tree_id")) return Response.json({categoryTreeId:"3"});
    if(path.endsWith("get_item_aspects_for_category")) return Response.json({aspects:[]});
    if(path.includes("/location/")) return Response.json({});
    if(path.endsWith("/offer/offer") && options.method==="GET") return Response.json(offer);
    if(path.endsWith("/offer") && options.method==="GET") return Response.json({offers:offer?[offer]:[]});
    if(path.includes("/inventory_item/")) return new Response(null,{status:204});
    for(const kind of ["fulfillment","payment","return"]) if(path.endsWith(`/${kind}_policy`)) return Response.json({[`${kind}Policies`]:[{marketplaceId:"EBAY_GB",[`${kind}PolicyId`]:`fixture-${kind}`,categoryTypes:[{name:"ALL_EXCLUDING_MOTORS_VEHICLES"}]}]});
    if(path.endsWith("/offer") && options.method==="POST") {
      creates++;offer={...JSON.parse(options.body),offerId:"offer",status:"UNPUBLISHED"};
      return Response.json({offerId:"offer"},{status:201});
    }
    if(path.endsWith("/publish")) {
      publishes++;offer={...offer,status:"PUBLISHED",listing:{listingId:"listing"}};
      throw new Error("mock connection lost after remote success");
    }
    throw new Error(`Unexpected fixture request ${options.method} ${path}`);
  };
  try {
    for(const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
    await sql`insert into user_settings(user_id) values ('owner')`;
    await sql`insert into marketplace_accounts(id,user_id,marketplace,mode,label,status,oauth_access_token,oauth_refresh_token,oauth_expires_at) values ('shop','owner','ebay_uk','oauth','Test','green',${seal("fixture-access")},${seal("fixture-refresh")},'2100-01-01')`;
    await sql`insert into items(id,user_id,title,description,condition,category_canonical,base_price_gbp,quantity) values ('item','owner','Approved title','Flaw retained','good','menswear.tops.tshirts',20,1)`;
    await sql`insert into item_photos(id,item_id,user_id,url) values ('photo','item','owner','https://example.test/source.jpg')`;
    await sql`insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,channel_price_gbp,remote_status) values ('channel','item','owner','ebay_uk','shop',22,'queued')`;
    const opts={userId:"owner",type:"publish",marketplace:"ebay_uk",accountId:"shop",itemId:"item",channelListingId:"channel"};
    const id=await enqueueJob(sql,opts);
    assert.equal((await processJob(sql,"owner",id,"worker")).ok,false);
    let saved=(await sql`select * from jobs where id=${id}`)[0];
    assert.equal(saved.status,"queued");assert.equal(saved.attempt,1);
    assert.ok(new Date(saved.retry_after).getTime()>Date.now());
    assert.equal(saved.needs_reconciliation,true);
    assert.equal(saved.finished_at,null);
    assert.equal(saved.lease_token,null);
    assert.equal((await sql`select count(*)::int as n from listing_action_usage`)[0].n,1);
    const count=requests;
    assert.equal((await processJob(sql,"owner",id,"worker")).ok,false);
    assert.deepEqual(await tickOauthJobs(sql,"owner"),[],"cooling jobs must not occupy the ready batch");
    assert.equal(requests,count,"no early external call");
    await sql`update jobs set retry_after=now()-interval '1 second' where id=${id}`;
    assert.deepEqual(await processJob(sql,"owner",id,"worker"),{ok:true});
    saved=(await sql`select * from jobs where id=${id}`)[0];
    assert.equal(saved.status,"done");assert.equal(saved.attempt,2);assert.equal(saved.retry_after,null);
    assert.equal(creates,1);assert.equal(publishes,1);
    assert.equal((await sql`select count(*)::int as n from listing_action_usage`)[0].n,1);
    assert.equal((await sql`select publishes_this_hour from marketplace_accounts where id='shop'`)[0].publishes_this_hour,1);
    // A permanent provider response requires review; a later temporary error is bounded.
    const update=await enqueueJob(sql,{...opts,type:"update"});
    forceStatus=400;
    await processJob(sql,"owner",update,"worker");
    assert.equal((await sql`select status from jobs where id=${update}`)[0].status,"error");
    await sql`update jobs set max_attempts=3 where id=${update}`;
    await queueJobRetry(sql,"owner",update);
    forceStatus=503;
    await processJob(sql,"owner",update,"worker");
    saved=(await sql`select * from jobs where id=${update}`)[0];
    assert.equal(saved.status,"queued");assert.equal(saved.attempt,2);
    assert.ok(new Date(saved.retry_after).getTime()>=Date.now()+59_000);
    await sql`update jobs set retry_after=now()-interval '1 second' where id=${update}`;
    await processJob(sql,"owner",update,"worker");
    saved=(await sql`select * from jobs where id=${update}`)[0];
    assert.equal(saved.status,"dead");assert.equal(saved.attempt,3);assert.equal(saved.retry_after,null);
  } finally {
    globalThis.fetch=originalFetch;
    if(oldId===undefined) delete process.env.EBAY_CLIENT_ID; else process.env.EBAY_CLIENT_ID=oldId;
    if(oldSecret===undefined) delete process.env.EBAY_CLIENT_SECRET; else process.env.EBAY_CLIENT_SECRET=oldSecret;
    await db.close();
  }
});
