import test from "node:test";
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { PGlite } from "@electric-sql/pglite";
const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith(".")&&!/\.[a-z]+$/i.test(specifier)&&context.parentURL?.includes("/src/"))return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const {pollEbayOrders,parseEbayOrderPage}=await import("../src/lib/lane/server/ebay-orders.ts");
const {recordManualSale}=await import("../src/lib/lane/server/manual-sales.ts");
const {EbayTemporaryError}=await import("../src/lib/lane/server/ebay-transport.ts");
hooks.deregister();
function wrap(db){
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  sql.transaction=run=>db.transaction(tx=>run(wrap(tx)));return sql;
}
function order(lineId="line-one",quantity=2){return {
  orderId:`order-${lineId}`,creationDate:new Date(Date.now()-300_000).toISOString(),orderPaymentStatus:"PAID",cancelStatus:{cancelState:"NONE_REQUESTED"},
  buyer:{username:"MUST NOT BE STORED"},lineItems:[{lineItemId:lineId,legacyItemId:"listing",quantity,lineItemCost:{currency:"GBP",value:String(20*quantity)},discountedLineItemCost:{currency:"GBP",value:String(18*quantity)}}],
};}
function page(orders,offset=0,total=orders.length){return {ok:true,status:200,json:{orders,offset,total}};}
async function fixture(){
  const db=new PGlite();
  for(const n of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort())await db.exec(await readFile(new URL(`../migrations/${n}`,import.meta.url),"utf8"));
  await db.exec(`insert into marketplace_accounts(id,user_id,marketplace,mode,label,status,sandbox) values
    ('account','owner','ebay_uk','oauth','eBay','green',true),('vinted','owner','vinted_uk','extension','Vinted','green',false),('foreign','other','ebay_uk','oauth','Other','paused',true),('production','owner','ebay_uk','oauth','Production','green',false);
    insert into items(id,user_id,title,base_price_gbp,cost_price_gbp,quantity,status) values('item','owner','Fixture',20,5,4,'live');
    insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,remote_id,remote_status,quantity_on_channel,created_at) values
    ('source','item','owner','ebay_uk','account','listing','live',4,now()-interval '20 minutes'),('other','item','owner','vinted_uk','vinted','vinted-listing','live',1,now()-interval '20 minutes');
    insert into ebay_order_sync(user_id,account_id,environment,started_at,cursor_at) values('owner','account','sandbox',now()-interval '10 minutes',now()-interval '10 minutes');`);
  const sql=wrap(db),seen=[];
  const token=async(_,u,a)=>{assert.equal(u,"owner");assert.equal(a,"account");seen.push(a);return {access:"mock"};};
  const due=()=>sql`update ebay_order_sync set next_poll_at=now() where account_id='account'`;
  return {db,sql,token,seen,due};
}
test("order parser distinguishes discounted line totals, unknown currency and unsafe statuses; rejects partial pages",()=>{
  const good=order();assert.equal(parseEbayOrderPage(page([good]).json,0).lines[0].amount,36);
  const nonGbp=order();nonGbp.lineItems[0].discountedLineItemCost.currency="USD";
  assert.match(parseEbayOrderPage(page([nonGbp]).json,0).lines[0].problem,/GBP/);
  for(const o of [{...order(),orderPaymentStatus:"PENDING"},{...order(),cancelStatus:{cancelState:"CANCELED"}}])assert.ok(parseEbayOrderPage(page([o]).json,0).lines[0].problem);
  assert.throws(()=>parseEbayOrderPage({orders:[],offset:0,total:3},0),/Incomplete/);
  assert.throws(()=>parseEbayOrderPage({...page([good]).json,offset:4},0),/pagination/);
  assert.throws(()=>parseEbayOrderPage(page([good,{...order(),lineItems:[{}]}]).json,0),/identifiers/);
});
test("persisted pagination, duplicate delivery and manual-reference reconciliation change stock once without buyer data",async()=>{
  const {db,sql,token,due}=await fixture();
  try {
    const paths=[];
    await pollEbayOrders(sql,"sandbox",{token,fetchPage:async(_,p)=>{paths.push(p);return {...page([order()],0,2),json:{...page([order()],0,2).json,next:"https://untrusted.invalid/steal-token"}};}});
    let state=(await sql`select * from ebay_order_sync`)[0];assert.equal(state.page_offset,1);assert.ok(state.window_to);
    assert.equal((await sql`select quantity from items`)[0].quantity,2);
    let sale=(await sql`select * from sales`)[0];assert.equal(Number(sale.sold_price_gbp),36);assert.equal(sale.fees_gbp,null);assert.equal(sale.net_gbp,null);assert.equal(Number(sale.cost_total_gbp),10);assert.equal(sale.amounts_basis,"provider");
    assert.equal(JSON.stringify(await sql`select * from ebay_order_events`).includes("MUST NOT BE STORED"),false);
    await due();await pollEbayOrders(sql,"sandbox",{token,fetchPage:async(_,p)=>{paths.push(p);return page([order("line-two",1)],1,2);}});
    state=(await sql`select * from ebay_order_sync`)[0];assert.equal(state.page_offset,0);assert.equal(state.window_to,null);
    assert.equal((await sql`select quantity from items`)[0].quantity,1);
    assert.equal(new URL(`https://api.test${paths[1]}`).searchParams.get("offset"),"1");
    assert.ok(paths.every(p=>p.startsWith("/sell/fulfillment/v1/order?")));
    await due();const overlap=await Promise.all([pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>page([order()])}),pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>page([order()])})]);
    assert.equal(overlap.reduce((n,r)=>n+r.attempted,0),1,"overlapping workers claim the account once");
    assert.equal((await sql`select quantity from items`)[0].quantity,1);assert.equal((await sql`select * from sales`).length,2);
    assert.deepEqual(await recordManualSale(sql,"owner",{itemId:"item",channelListingId:"source",quantity:2,totalGbp:36,feesGbp:null,reference:"line-one"}),{recorded:false,remainingQuantity:1});
    await recordManualSale(sql,"owner",{itemId:"item",channelListingId:"source",quantity:1,totalGbp:18,feesGbp:1,reference:"manual-first"});
    await due();await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>page([order("manual-first",1)])});
    assert.equal((await sql`select * from sales`).length,3);assert.equal((await sql`select quantity from items`)[0].quantity,0);
    assert.equal((await sql`select * from jobs where marketplace='vinted_uk'`).length,1,"final unit retains a delist outbox event");
    assert.equal((await sql`select * from ebay_order_sync where environment='production'`).length,0);
    await due();await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>page([{...order(),cancelStatus:{cancelState:"CANCELED"}}])});
    assert.equal((await sql`select quantity from items`)[0].quantity,0,"a later cancellation cannot silently restore stock");
    assert.equal((await sql`select outcome from ebay_order_events where line_id='line-one'`)[0].outcome,"needs_review");
  } finally {await db.close();}
});
test("page failure rolls back stock, receipts, outbox and cursor; temporary errors retain provider cooldown",async()=>{
  const {db,sql,token,due}=await fixture();
  try {
    const cursor=(await sql`select cursor_at from ebay_order_sync`)[0].cursor_at;
    await db.exec(`create function fail_event() returns trigger language plpgsql as $$begin raise exception 'buyer-sensitive detail'; end;$$;
      create trigger fail_event before insert on ebay_order_events for each row execute function fail_event();`);
    assert.equal((await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>page([order()])})).error,true);
    assert.equal((await sql`select quantity from items`)[0].quantity,4);assert.equal((await sql`select * from sales`).length,0);assert.equal((await sql`select * from jobs`).length,0);
    let state=(await sql`select * from ebay_order_sync`)[0];assert.equal(String(state.cursor_at),String(cursor));assert.equal(state.lease_token,null);assert.equal(state.last_error.includes("buyer-sensitive"),false);
    await due();const before=Date.now();await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>{throw new EbayTemporaryError("provider body",900_000);}});
    state=(await sql`select * from ebay_order_sync`)[0];assert.ok(new Date(state.next_poll_at).getTime()>=before+900_000);assert.equal(String(state.cursor_at),String(cursor));
  } finally {await db.close();}
});
test("pause, expired lease, pre-tracking orders and foreign/unmatched listings never decrement stock",async()=>{
  const {db,sql,token,due,seen}=await fixture();
  try {
    await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>{await sql`update marketplace_accounts set status='paused' where id='account'`;return page([order()]);}});
    assert.equal((await sql`select quantity from items`)[0].quantity,4);
    await due();assert.equal((await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>{throw new Error("must not read paused account");}})).attempted,0);
    await sql`update marketplace_accounts set status='green' where id='account'`;
    await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>{await sql`update ebay_order_sync set lease_until=now()-interval '1 second'`;return page([order()]);}});
    assert.equal((await sql`select * from sales`).length,0);
    const old={...order("old"),creationDate:new Date(Date.now()-3_600_000).toISOString()},unlinked=order("unlinked"),pending={...order("pending"),orderPaymentStatus:"PENDING"};unlinked.lineItems[0].legacyItemId="foreign-listing";
    await due();await pollEbayOrders(sql,"sandbox",{token,fetchPage:async()=>page([old,unlinked,pending])});
    assert.equal((await sql`select quantity from items`)[0].quantity,4);const events=await sql`select * from ebay_order_events`;
    assert.equal(events.length,3);assert.equal(events.find(e=>e.line_id==="old").outcome,"before_tracking");assert.equal(events.find(e=>e.line_id==="unlinked").outcome,"needs_review");assert.ok(seen.every(a=>a==="account"));
  } finally {await db.close();}
});
