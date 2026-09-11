import test from "node:test";
import assert from "node:assert/strict";
import { EbayTemporaryError, ebayRequest, ebayResponseText, ebayRetryAt } from "../src/lib/lane/server/ebay-transport.ts";

test("only temporary eBay transport errors get bounded backoff, respecting provider delays",()=>{
  const now=Date.parse("2026-09-11T00:00:00Z");
  for(const [attempt,delay] of [[1,30_000],[2,60_000],[3,120_000],[4,240_000]]) {
    assert.equal(Date.parse(ebayRetryAt(new EbayTemporaryError("timeout"),attempt,5,now,()=>0))-now,delay);
  }
  assert.equal(Date.parse(ebayRetryAt(new EbayTemporaryError("rate limit",600_000),1,5,now,()=>0))-now,600_000);
  assert.equal(ebayRetryAt(new Error("bad category"),1,5,now),null);
  assert.equal(ebayRetryAt({name:"EbayTemporaryError",retryAfterMs:0},1,5,now),null);
  assert.equal(ebayRetryAt(new EbayTemporaryError("down"),5,100,now),null);
  assert.equal(ebayRetryAt(new EbayTemporaryError("down"),2,2,now),null);
  assert.equal(ebayRetryAt(new EbayTemporaryError("hold",86_400_001),1,5,now),null);
});

test("transport classifies rate limits/timeouts but preserves permanent responses and refuses redirects",async()=>{
  const original=globalThis.fetch;
  let status=429,header="120";
  globalThis.fetch=async(_url,options)=>{
    assert.equal(options.redirect,"error");
    return new Response("Fixture response",{status,headers:{"Retry-After":header}});
  };
  try {
    await assert.rejects(ebayRequest("https://api.ebay.com/fixture",{}),e=>e instanceof EbayTemporaryError && e.retryAfterMs===120_000);
    header=new Date(Date.now()+300_000).toUTCString();
    await assert.rejects(ebayRequest("https://api.ebay.com/fixture",{}),e=>e instanceof EbayTemporaryError && e.retryAfterMs>290_000);
    for(status of [408,500,502,503,504]) await assert.rejects(ebayRequest("https://api.ebay.com/fixture",{}),EbayTemporaryError);
    for(status of [400,401,403,404,409,422,501]) assert.equal((await ebayRequest("https://api.ebay.com/fixture",{})).status,status);
    globalThis.fetch=async()=>{throw new TypeError("fetch failed: sensitive diagnostic omitted");};
    await assert.rejects(ebayRequest("https://api.ebay.com/fixture",{}),e=>e instanceof EbayTemporaryError && !e.message.includes("sensitive"));
    await assert.rejects(ebayResponseText(new Response(new ReadableStream({start(controller){controller.error(new Error("stream lost"));}}))),EbayTemporaryError);
  } finally {globalThis.fetch=original;}
});
