import { recordPublishActivation } from "../src/lib/lane/server/events.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { claimJob, recoverExpiredJobs, queueJobRetry, intentKey, saleEventKey } from "../src/lib/lane/server/operations.ts";
import { selectEbayOffer, liveEbayReceipt, selectSellerPolicy } from "../src/lib/lane/server/ebay-operations.ts";

async function fixture() {
  const db = new PGlite();
  for (const name of (await readdir(new URL("../migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  const sql = async (strings, ...values) => {
    const text = strings.reduce((text, fragment, index) => text + (index ? `$${index}` : "") + fragment, "");
    return (await db.query(text, values)).rows;
  };
  sql.query = async (text, values = []) => (await db.query(text, values)).rows;
  await db.exec(`insert into user_settings(user_id) values ('u');
    insert into marketplace_accounts(id,user_id,marketplace,mode,label) values
      ('a','u','ebay_uk','oauth','eBay'), ('v','u','vinted_uk','extension','Vinted');
    insert into items(id,user_id,title,base_price_gbp,quantity,status) values ('i','u','Coat',20,2,'live');
    insert into channel_listings(id,item_id,user_id,marketplace,marketplace_account_id,remote_id,remote_status,quantity_on_channel)
      values ('c','i','u','ebay_uk','a','remote-e','live',2), ('vc','i','u','vinted_uk','v','remote-v','live',1);`);
  return { db, sql };
}

test("one durable claim wins racing workers; user and executor boundaries hold", async () => {
  const { db, sql } = await fixture();
  try {
    await db.exec(`insert into jobs(id,user_id,type,status,marketplace,account_id,item_id,channel_listing_id,request_id)
      values ('j','u','publish','queued','ebay_uk','a','i','c','request');`);
    assert.equal(await claimJob(sql, "someone-else", "j", "evil", "worker"), null);
    assert.equal(await claimJob(sql, "u", "j", "browser", "extension"), null);
    await db.exec("update marketplace_accounts set status = 'paused' where id = 'a'");
    assert.equal(await claimJob(sql,"u","j","paused","worker"),null);
    await db.exec("update marketplace_accounts set status = 'green' where id = 'a'");
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => claimJob(sql, "u", "j", `lease-${i}`, "worker")));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await sql`select attempt from jobs where id = 'j'`)[0].attempt, 1);
    await assert.rejects(queueJobRetry(sql, "u", "j"), /active/);
    await db.exec(`update jobs set lease_expires_at = now() - interval '1 second' where id = 'j';`);
    await recoverExpiredJobs(sql, "u");
    const recovered = await claimJob(sql, "u", "j", "restarted", "worker");
    assert.equal(recovered.attempt, 2);
    assert.equal(recovered.needs_reconciliation, true);
    await db.exec("update jobs set status='done' where id='j'; update channel_listings set remote_status='ended' where id='c'");
    await recordPublishActivation(sql,"u","j");
    assert.equal((await sql`select count(*)::int as n from activation_events where event_name='first_publish'`)[0].n,0);
    await db.exec("update channel_listings set remote_status='live' where id='c'");
    await recordPublishActivation(sql,"u","j");
    await recordPublishActivation(sql,"u","j");
    assert.equal((await sql`select count(*)::int as n from activation_events where event_name='first_publish'`)[0].n,1);
  } finally { await db.close(); }
});

test("interrupted browser create requires reconciliation instead of duplicating a remote listing", async () => {
  const { db, sql } = await fixture();
  try {
    await db.exec(`insert into jobs(id,user_id,type,status,marketplace,account_id,item_id,channel_listing_id,request_id)
      values ('j','u','publish','waiting_for_browser','vinted_uk','v','i','vc','request');`);
    await claimJob(sql, "u", "j", "browser", "extension");
    await db.exec(`update jobs set lease_expires_at = now() - interval '1 second';`);
    await recoverExpiredJobs(sql, "u");
    await assert.rejects(queueJobRetry(sql, "u", "j"), /reconciliation/);
    assert.equal((await sql`select status from jobs where id = 'j'`)[0].status, "error");
  } finally { await db.close(); }
});

test("remote event replay cannot decrement twice; distinct order lines sell separate units and commit delist outbox", async () => {
  const { db, sql } = await fixture();
  try {
    const sell = (sale, event) => sql`select lane_record_sale('u','i','c','ebay_uk','a',${sale},${event},20,2,18,'webhook',1) as recorded`;
    const repeated = await Promise.all([sell("sale1", "order1-line1"), sell("sale2", "order1-line1")]);
    assert.equal(repeated.filter((rows) => rows[0].recorded).length, 1);
    assert.equal((await sql`select quantity from items where id = 'i'`)[0].quantity, 1);
    await sell("sale3", "order2-line1");
    assert.equal((await sql`select quantity from items where id = 'i'`)[0].quantity, 0);
    assert.equal((await sql`select count(*)::int as count from sales`)[0].count, 2);
    const outbox = await sql`select * from jobs where type = 'delist'`;
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].status, "waiting_for_browser");
    assert.equal(outbox[0].idempotency_key, intentKey("delist", "v", "i", "vc"));
    await sell("late", "order3-line1");
    assert.equal((await sql`select count(*)::int as count from sales`)[0].count, 2);
  } finally { await db.close(); }
});

test("sale and inventory rollback together when durable delist insertion fails", async () => {
  const { db, sql } = await fixture();
  try {
    await db.exec(`update items set quantity = 1;
      create function test_break_outbox() returns trigger language plpgsql as $$ begin raise exception 'simulated disk failure'; end; $$;
      create trigger break_outbox before insert on jobs for each row execute function test_break_outbox();`);
    await assert.rejects(sql`select lane_record_sale('u','i','c','ebay_uk','a','sale','event',20,2,18,'webhook',1)`, /simulated disk failure/);
    assert.equal((await sql`select quantity from items where id = 'i'`)[0].quantity, 1);
    assert.equal((await sql`select count(*)::int as count from sales`)[0].count, 0);
  } finally { await db.close(); }
});

test("reconciliation returns remote success, rejects ambiguity and never substitutes another seller policy", () => {
  const published = { sku: "sku", marketplaceId: "EBAY_GB", format: "FIXED_PRICE", offerId: "offer", status: "PUBLISHED", listing: { listingId: "listing" } };
  assert.equal(liveEbayReceipt(selectEbayOffer([published], "sku")).listingId, "listing");
  assert.throws(() => selectEbayOffer([published, published], "sku"), /Several/);
  assert.throws(() => liveEbayReceipt({ ...published, listing: {} }), /complete receipt/);
  const policy = { marketplaceId: "EBAY_GB", fulfillmentPolicyId: "mine", categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }] };
  assert.equal(selectSellerPolicy([policy], "fulfillmentPolicyId"), "mine");
  assert.throws(() => selectSellerPolicy([policy], "fulfillmentPolicyId", "other-shop"), /belonging/);
  assert.notEqual(saleEventKey({ marketplace: "ebay_uk", accountId: "a", itemId: "i", eventId: "one" }), saleEventKey({ marketplace: "ebay_uk", accountId: "a", itemId: "i", eventId: "two" }));
});
