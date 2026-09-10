import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { localPhoto, ebayPhotoError, MAX_LOCAL_PHOTO_BYTES } from "../src/lib/lane/photos.ts";
import { validateListing } from "../src/lib/lane/listing-fields.ts";

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/src/")) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { prepareEbayPhotos } = await import("../src/lib/lane/server/ebay-photos.ts");
const { ebayUpdateOffer, ebayPublish } = await import("../src/lib/lane/server/ebay.ts");
hooks.deregister();
// Small valid PNG, plus a JPEG-signature fixture (provider decoding is mocked).
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=";
const jpg = `data:image/jpeg;base64,${Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,255,217]).toString("base64")}`;
const https = "https://images.example.test/original.jpg";
const receipt = n => ({imageUrl:`https://i.ebayimg.com/images/test-${n}.jpg`,expirationDate:new Date(Date.now()+86_400_000).toISOString()});

test("photo validation bounds files and rejects non-image, HTTP, credential URLs and incomplete sets", () => {
  assert.equal(localPhoto(png).mime,"image/png");
  assert.equal(localPhoto(jpg).mime,"image/jpeg");
  assert.equal(ebayPhotoError([https,png,jpg]),null);
  for (const url of ["http://example.test/photo", "https://secret:password@example.test/a", "blob:https://lane.test/a", "data:image/svg+xml;base64,PHN2Zz4=", png.replace("image/png","image/jpeg"), "data:image/png;base64,%%%%", `data:image/jpeg;base64,${Buffer.alloc(MAX_LOCAL_PHOTO_BYTES+1,255).toString("base64")}`]) {
    assert.match(ebayPhotoError([png,url]),/Photo 2/);
  }
  assert.ok(ebayPhotoError([]));
  assert.ok(ebayPhotoError(Array(13).fill(https)));
  const errors=validateListing({title:"Test",description:"Flaws retained",condition:"good",categoryCanonical:"menswear.tops.tshirts",basePriceGbp:"20",quantity:"1",photos:[{url:jpg},{url:"http://local.test/original.svg"}]},"ebay");
  assert.equal(errors.length,1);
  assert.match(errors[0],/Photo 2/); // Edited JPEG accepted; original is not silently dropped.
});

test("multipart receipts survive partial failure, preserve order, expire, and stay owner/account/environment scoped", async () => {
  const db = new PGlite();
  const sql = async (strings,...values) => (await db.query(strings.reduce((q,p,i)=>q+(i?`$${i}`:"")+p,""),values)).rows;
  const originalFetch=globalThis.fetch, originalEnv=process.env.EBAY_ENV;
  process.env.EBAY_ENV="sandbox";
  let calls=0, renewals=0, failSecond=true;
  globalThis.fetch=async (url,options) => {
    calls++;
    assert.equal(new URL(url).origin,process.env.EBAY_ENV==="sandbox"?"https://api.sandbox.ebay.com":"https://api.ebay.com");
    assert.equal(new URL(url).pathname,"/commerce/media/v1_beta/image/create_image_from_file");
    assert.equal(options.method,"POST");
    assert.equal(options.redirect,"error");
    assert.equal(options.headers.Authorization,"Bearer fixture-token");
    assert.equal(options.headers["Content-Type"],undefined,"fetch must supply multipart boundary");
    assert.deepEqual([...options.body.keys()],["image"]);
    const file=options.body.get("image");
    assert.ok(["image/jpeg","image/png"].includes(file.type));
    const expected=file.type==="image/png"?png:jpg;
    assert.equal(Buffer.from(await file.arrayBuffer()).toString("base64"),localPhoto(expected).base64);
    assert.equal(renewals,calls,"each upload renews its lease first");
    if(calls===2 && failSecond) return new Response("Provider unavailable",{status:503});
    return Response.json(receipt(calls),{status:201});
  };
  const run=(urls,user="owner",account="shop")=>prepareEbayPhotos(sql,user,account,"fixture-token",urls,async()=>{renewals++;});
  try {
    await db.exec(await readFile(new URL("../migrations/0013_ebay_photo_uploads.sql",import.meta.url),"utf8"));
    await assert.rejects(run([png,"http://invalid.test/photo"]),/Photo 2/);
    assert.equal(calls,0,"validate every photo before uploading any");
    const sources=[https,png,jpg,png];
    await assert.rejects(run(sources),/HTTP 503/);
    assert.equal((await sql`select * from ebay_photo_uploads`).length,1);
    failSecond=false;
    const result=await run(sources);
    assert.deepEqual(result,[https,receipt(1).imageUrl,receipt(3).imageUrl,receipt(1).imageUrl]);
    assert.deepEqual(sources,[https,png,jpg,png],"canonical sources are never replaced");
    assert.equal(calls,3,"reuse successful uploads and duplicate photos");
    await run(sources); assert.equal(calls,3);
    await run([png],"other"); assert.equal(calls,4);
    await run([png],"owner","other-shop"); assert.equal(calls,5);
    process.env.EBAY_ENV="production";
    await run([png]); assert.equal(calls,6);
    await sql`update ebay_photo_uploads set expires_at=now()+interval '1 minute' where environment='production'`;
    await run([png]); assert.equal(calls,7,"near expiry must upload again");
    await assert.rejects(prepareEbayPhotos(sql,"fresh","shop","fixture-token",[png],async()=>{throw new Error("lease lost");}),/lease lost/);
    assert.equal(calls,7);
    for(const bad of [{imageUrl:"http://unsafe.test/photo",expirationDate:receipt(1).expirationDate},{imageUrl:https},{imageUrl:https,expirationDate:"2000-01-01T00:00:00Z"}]) {
      globalThis.fetch=async()=>Response.json(bad,{status:201});
      await assert.rejects(run([png],"invalid"),/incomplete or expired/);
    }
    assert.equal((await sql`select * from ebay_photo_uploads where user_id='invalid'`).length,0);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalEnv===undefined) delete process.env.EBAY_ENV; else process.env.EBAY_ENV=originalEnv;
    await db.close();
  }
});

test("listing adapter awaits all resolved photos, rejects omissions and skips uploads for reconciled live offers",async()=>{
  const originalFetch=globalThis.fetch;
  const item={id:"item",title:"Original",description:"Visible flaw described",condition:"good",photos:[{url:https},{url:png}],channelFields:{}};
  let writes=0;
  globalThis.fetch=async(url,options)=>{
    if(options.method==="GET") return Response.json({product:{},offers:[{offerId:"offer",sku:`LANE_${Buffer.from("item").toString("base64url")}`,marketplaceId:"EBAY_GB",format:"FIXED_PRICE",status:"PUBLISHED",listing:{listingId:"live"}}]});
    writes++;
    if(new URL(url).pathname.includes("inventory_item")) assert.deepEqual(JSON.parse(options.body).product.imageUrls,[https,receipt(1).imageUrl]);
    return new Response(null,{status:204});
  };
  try {
    await ebayUpdateOffer("token","offer","sku",item,20,1,undefined,async()=>[https,receipt(1).imageUrl]);
    assert.equal(writes,2);
    await assert.rejects(ebayUpdateOffer("token","offer","sku",item,20,1,undefined,async()=>[https]),/every selected photo/);
    await assert.rejects(ebayUpdateOffer("token","offer","sku",item,20,1,undefined,async()=>{throw new Error("upload unavailable");}),/upload unavailable/);
    assert.equal(writes,2,"failed photo delivery cannot mutate listing content");
    const live=await ebayPublish("token","location",item,20,1,null,{},undefined,undefined,async()=>{throw new Error("already live: never upload again");});
    assert.equal(live.listingId,"live");
    assert.equal(writes,2);
  } finally {globalThis.fetch=originalFetch;}
});
