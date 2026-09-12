import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { PGlite } from "@electric-sql/pglite";
const hooks = registerHooks({resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/src/")) return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const {insertItem} = await import("../src/lib/lane/server/items.ts");
hooks.deregister();

const draft = {
  title:"Source jumper", description:"Original description\nSmall pull at hem", brand:"Example", categoryCanonical:"womenswear.knitwear.knitted", condition:"very_good",
  sizeUk:"S / UK 8-10", sizeEu:"", sizeUs:"", colour:"White, Red", material:"", gender:"women", era:"", costPriceGbp:"", basePriceGbp:"35.99", quantity:"1",
  weightG:"", lengthCm:"", widthCm:"", heightCm:"", postageProfileId:"", notes:"", tags:"knitwear, Knitwear", sku:"",
  photos:Array.from({length:7},(_,i)=>({url:`https://example.test/photo-${i}.jpg`})),
  channelFields:{ebay_uk:{aspects:{Size:["S"],Department:["Women"]}}},
};

test("atomic source insert preserves all seven photos and manual fields, concurrent retry never overwrites edits", async () => {
  const db = new PGlite();
  try {
    for (const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
    const sql = async (strings,...values) => (await db.query(strings.reduce((s,p,i)=>s+(i?`$${i}`:"")+p,""),values)).rows;
    await Promise.all([insertItem(sql,"u",draft,"stable-source"),insertItem(sql,"u",draft,"stable-source")]);
    assert.equal((await sql`select count(*)::int as n from items`)[0].n,1);
    assert.equal((await sql`select count(*)::int as n from item_photos`)[0].n,7);
    assert.equal((await sql`select count(*)::int as n from item_tags`)[0].n,1);
    const row = (await sql`select * from items`)[0];
    assert.equal(row.description,draft.description);
    assert.equal(row.size_uk,draft.sizeUk);
    assert.equal(row.colour,draft.colour);
    assert.equal(row.material,null);
    assert.deepEqual(row.channel_fields,draft.channelFields);
    await sql`update items set title = 'User edited title'`;
    await insertItem(sql,"u",draft,"stable-source");
    assert.equal((await sql`select title from items`)[0].title,"User edited title");
    // A photo write failure must roll back the parent item too.
    await db.exec(`create function test_break_photo() returns trigger language plpgsql as $$ begin raise exception 'photo write failed'; end; $$;
      create trigger break_photo before insert on item_photos for each row execute function test_break_photo();`);
    await assert.rejects(insertItem(sql,"u",draft,"failed-source"),/photo write failed/);
    assert.equal((await sql`select count(*)::int as n from items where id = 'failed-source'`)[0].n,0);
  } finally { await db.close(); }
});
