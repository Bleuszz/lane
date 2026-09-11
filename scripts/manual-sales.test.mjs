import test from "node:test";
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { manualSaleSchema } from "../src/lib/lane/manual-sale.ts";
const hooks=registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith(".")&&!/\.[a-z]+$/i.test(specifier)&&context.parentURL?.includes("/src/"))return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const {recordManualSale}=await import("../src/lib/lane/server/manual-sales.ts");
hooks.deregister();
const input={itemId:"item",channelListingId:"source",quantity:2,totalGbp:44,feesGbp:2,reference:"order-line-one"};
function wrap(db){
  const sql=async(strings,...values)=>(await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  sql.transaction=run=>db.transaction(tx=>run(wrap(tx)));
  return sql;
}
async function fixture(){
  const db=new PGlite();
  for(const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
  await db.exec(`insert into marketplace_accounts(id,user_id,marketplace,mode,label) values ('a','owner','ebay_uk','oauth','Source'),('b','owner','ebay_uk','oauth','Destination');
    insert into items(id,user_id,title,base_price_gbp,cost_price_gbp,quantity,status) values ('item','owner','Fixture',22,5,4,'live');
    insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,remote_status,quantity_on_channel) values ('source','item','owner','ebay_uk','a','live',4),('other','item','owner','ebay_uk','b','live',4);`);
  return {db,sql:wrap(db)};
}
test("manual sale input requires whole quantities, penny precision and a stable reference; caller cannot impersonate webhook",()=>{
  assert.equal(manualSaleSchema.parse(input).totalGbp,44);
  for(const patch of [{quantity:0},{quantity:1.5},{totalGbp:1.234},{feesGbp:-1},{reference:"  "},{via:"webhook"}]) assert.equal(manualSaleSchema.safeParse({...input,...patch}).success,false);
});
test("concurrent manual sale replay changes stock once and preserves line totals, costs and durable follow-up",async()=>{
  const {db,sql}=await fixture();
  try {
    const results=await Promise.all([recordManualSale(sql,"owner",input),recordManualSale(sql,"owner",input)]);
    assert.equal(results.filter(r=>r.recorded).length,1);
    assert.ok(results.every(r=>r.remainingQuantity===2));
    let sale=(await sql`select * from sales`)[0];
    assert.equal(Number(sale.sold_price_gbp),44);assert.equal(Number(sale.fees_gbp),2);assert.equal(Number(sale.net_gbp),42);
    assert.equal(Number(sale.cost_total_gbp),10);assert.equal(sale.quantity,2);assert.equal(sale.amounts_basis,"entered");
    assert.equal(sale.reference,input.reference);assert.equal(sale.detected_via,"manual");
    assert.equal((await sql`select * from jobs where channel_listing_id='other'`).length,1);
    await sql`update items set cost_price_gbp=99 where id='item'`;
    assert.equal(Number((await sql`select cost_total_gbp from sales`)[0].cost_total_gbp),10);
    await assert.rejects(recordManualSale(sql,"owner",{...input,totalGbp:45}),/different details/);
    await assert.rejects(recordManualSale(sql,"foreign",{...input,reference:"foreign"}),/does not belong/);
    await assert.rejects(recordManualSale(sql,"owner",{...input,reference:"too-many",quantity:3}),/Not enough/);
    const last={...input,reference:"last-line",feesGbp:null};
    assert.deepEqual(await recordManualSale(sql,"owner",last),{recorded:true,remainingQuantity:0});
    assert.deepEqual(await recordManualSale(sql,"owner",last),{recorded:false,remainingQuantity:0});
    sale=(await sql`select * from sales where reference='last-line'`)[0];
    assert.equal(sale.fees_gbp,null);assert.equal(sale.net_gbp,null,"unknown fees never become zero");
    assert.equal((await sql`select count(*)::int as n from sales`)[0].n,2);
    assert.equal((await sql`select type from jobs where request_id=${sale.id+':other'}`)[0].type,"delist");
  } finally {await db.close();}
});
test("sale metadata failure rolls back sale, stock and outbox; Vinted quantities stay one",async()=>{
  const {db,sql}=await fixture();
  try {
    await db.exec(`create function test_fail_sale_metadata() returns trigger language plpgsql as $$ begin raise exception 'metadata write failed'; end; $$;
      create trigger fail_metadata before update on sales for each row execute function test_fail_sale_metadata();`);
    await assert.rejects(recordManualSale(sql,"owner",input),/metadata write failed/);
    assert.equal((await sql`select quantity from items where id='item'`)[0].quantity,4);
    assert.equal((await sql`select * from sales`).length,0);assert.equal((await sql`select * from jobs`).length,0);
    await sql`update channel_listings set marketplace='vinted_uk' where id='source'`;
    await assert.rejects(recordManualSale(sql,"owner",input),/one item/);
  } finally {await db.close();}
});
