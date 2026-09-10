import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { assertPublishReviews, publishReviewHash, withPublishItems } from "../src/lib/lane/server/publish-review.ts";

const item = {id:"one",title:"Reviewed jumper",status:"draft",updatedAt:"2026-09-11",photos:[{url:"https://example.test/original.jpg"}],basePriceGbp:20,channelFields:{ebay_uk:{aspects:{Size:["S"]}}}};
const accounts = [{id:"shop",marketplace:"ebay_uk",label:"My shop",mode:"oauth",sandbox:true,status:"green",lastHeartbeatAt:null}];
const rules = [{id:"rule",marketplace:"ebay_uk",kind:"flat",amount:2,undercutMarketplace:null}];

test("batch reviews cover every item and invalidate changed photos, fields, prices or destinations", () => {
  const second = {...item,id:"two"};
  const hashes = {one:publishReviewHash(item,accounts,rules),two:publishReviewHash(second,accounts,rules)};
  assert.doesNotThrow(()=>assertPublishReviews([item,second],accounts,rules,hashes));
  assert.throws(()=>assertPublishReviews([item,second],accounts,rules),/Review each/);
  assert.throws(()=>assertPublishReviews([item,second],accounts,rules,{one:hashes.one}),/nothing has been queued/);
  for (const changed of [
    {...item,photos:[{url:"https://example.test/different.jpg"}]},
    {...item,basePriceGbp:25},
    {...item,channelFields:{ebay_uk:{aspects:{Size:["L"]}}}},
    {...item,title:"New title"},
  ]) assert.throws(()=>assertPublishReviews([changed,second],accounts,rules,hashes),/changed/);
  assert.throws(()=>assertPublishReviews([item,second],accounts,[{...rules[0],amount:3}],hashes),/changed/);
  assert.throws(()=>assertPublishReviews([item,second],[{...accounts[0],sandbox:false}],rules,hashes),/changed/);
  assert.doesNotThrow(()=>assertPublishReviews([item,second],[{...accounts[0],lastHeartbeatAt:"later"}],rules,hashes));
  assert.equal(publishReviewHash(item,accounts,rules),publishReviewHash(Object.fromEntries(Object.entries(item).reverse()),accounts,rules));
});

test("batch locks enforce ownership and all queue writes roll back on a late failure", async () => {
  const db = new PGlite();
  const wrap = runner => {
    const sql = async (strings,...values)=>(await runner.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
    sql.transaction = fn=>db.transaction(tx=>fn(wrap(tx)));
    return sql;
  };
  const sql=wrap(db);
  try {
    await db.exec("create table items(id text primary key,user_id text,status text); create table queued(item_id text primary key); insert into items values ('one','owner','draft'),('two','owner','draft'),('foreign','other','draft');");
    const load = async(tx,user,id)=>(await tx`select * from items where id=${id} and user_id=${user}`)[0];
    const write = async(tx,items)=>{for(const i of items) await tx`insert into queued values (${i.id})`;return items.length;};
    await assert.rejects(withPublishItems(sql,"owner",["one","foreign"],load,write),/unavailable/);
    assert.equal((await sql`select * from queued`).length,0);
    await assert.rejects(withPublishItems(sql,"owner",["one","two"],load,async(tx,items)=>{await write(tx,items);throw Error("late destination failure");}),/late destination/);
    assert.equal((await sql`select * from queued`).length,0);
    await sql`update items set status='sold' where id='two'`;
    await assert.rejects(withPublishItems(sql,"owner",["one","two"],load,write),/Sold, archived/);
    assert.equal((await sql`select * from queued`).length,0);
    await sql`update items set status='draft' where id='two'`;
    assert.equal(await withPublishItems(sql,"owner",["two","one","one"],load,write),2);
    assert.equal((await sql`select * from queued`).length,2);
  } finally {await db.close();}
});
