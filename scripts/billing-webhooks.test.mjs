import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { reconcileBillingEvent, parseBillingEvent } from "../src/lib/lane/server/billing-webhooks.ts";
import { verifyStripeSignature } from "../src/lib/lane/server/stripe.ts";

test("signed webhooks reject malformed, old, future and tampered requests; rotating signatures work", () => {
  const before = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "local-signature-test-only";
  try {
    const raw = JSON.stringify({ id: "evt_test", type: "customer.subscription.updated", livemode: false, data: { object: { id: "sub_test" } } });
    const now = Math.floor(Date.now()/1000);
    const sign = t => `t=${t},v1=${createHmac("sha256",process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest("hex")}`;
    assert.equal(verifyStripeSignature(raw,sign(now)),true);
    assert.equal(verifyStripeSignature(raw,`${sign(now)},v1=${"0".repeat(64)}`),true);
    for (const t of ["NaN", "Infinity", "1e9", now-301, now+301]) assert.equal(verifyStripeSignature(raw,sign(t)),false);
    assert.equal(verifyStripeSignature(raw+" ",sign(now)),false);
    assert.equal(verifyStripeSignature(raw,`${sign(now)},t=${now}`),false);
    assert.equal(parseBillingEvent({ data: {} }),null);
    assert.equal(parseBillingEvent(JSON.parse(raw)).id,"evt_test");
  } finally { if (before === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = before; }
});

test("billing reconciliation is atomic, isolated, replay-safe and uses current paid subscription state", async () => {
  const db = new PGlite();
  const wrap = runner => {
    const sql = async (strings,...values) => (await runner.query(strings.reduce((s,p,i)=>s+(i?`$${i}`:"")+p,""),values)).rows;
    sql.transaction = fn => db.transaction(tx => fn(wrap(tx)));
    return sql;
  };
  const sql = wrap(db);
  try {
    for (const name of (await readdir(new URL("../migrations/",import.meta.url))).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),"utf8"));
    await sql`insert into user_settings(user_id) values ('owner'),('other')`;
    let current = { id:"sub_one", customer:"cus_one", livemode:false, metadata:{userId:"owner"}, status:"incomplete", items:{data:[{price:{id:"price_seller"},quantity:1}]}, latest_invoice:{status:"open"} };
    let calls = 0;
    const deps = { retrieve:async () => { calls++; return structuredClone(current); }, planForPrice:p=>p==="price_seller"?"seller":null };
    let sequence = 0;
    const event = (type="customer.subscription.updated",extra={}) => ({id:`evt_${++sequence}`,type,livemode:false,data:{object:{id:current.id,customer:current.customer,...extra}}});
    const row = async () => (await sql`select * from user_settings where user_id='owner'`)[0];
    const first = event("checkout.session.completed",{id:"cs_one",mode:"subscription",subscription:current.id,client_reference_id:"owner",metadata:{plan:"pro"},payment_status:"unpaid"});
    await reconcileBillingEvent(sql,first,deps);
    assert.equal((await row()).billing_status,"incomplete");
    const count = calls;
    assert.equal(await reconcileBillingEvent(sql,first,deps),"duplicate");
    assert.equal(calls,count);
    current.status = "active";
    await reconcileBillingEvent(sql,event(),deps);
    assert.equal((await row()).billing_status,"incomplete","active async subscription still needs a paid invoice");
    current.latest_invoice.status = "paid";
    const paid = event("invoice.paid",{id:"in_one",parent:{subscription_details:{subscription:current.id}}});
    await Promise.all([reconcileBillingEvent(sql,paid,deps),reconcileBillingEvent(sql,paid,deps)]);
    assert.equal((await row()).billing_status,"active");
    assert.equal((await row()).plan,"seller","ignore checkout tier metadata");
    await reconcileBillingEvent(sql,event("invoice.payment_failed",{id:"in_old",subscription:current.id,status:"open"}),deps);
    assert.equal((await row()).billing_status,"active","late failed invoice cannot override recovered subscription");
    for (const status of ["unpaid","incomplete","incomplete_expired","paused","trialing","canceled","past_due"]) {
      current.status = status;
      await reconcileBillingEvent(sql,event(),deps);
      assert.notEqual((await row()).billing_status,"active");
      assert.notEqual((await row()).billing_status,"trialing");
    }
    current.status = "active";
    current.items.data[0].price.id = "unknown";
    assert.equal(await reconcileBillingEvent(sql,event(),deps),"unknown_price");
    assert.equal((await row()).billing_status,"incomplete");
    current.items.data[0].price.id = "price_seller";
    const retry = event();
    await assert.rejects(reconcileBillingEvent(sql,retry,{...deps,retrieve:async()=>{throw Error("provider offline");}}),/offline/);
    assert.equal((await sql`select * from billing_webhook_events where event_id=${retry.id}`).length,0);
    await reconcileBillingEvent(sql,retry,deps);
    assert.equal((await row()).billing_status,"active");
    const wrongMode = {...event(),livemode:true};
    await assert.rejects(reconcileBillingEvent(sql,wrongMode,deps),/identity mismatch/);
    current.metadata.userId = "other";
    await assert.rejects(reconcileBillingEvent(sql,event(),deps),/unique/);
    assert.equal((await sql`select stripe_customer_id from user_settings where user_id='other'`)[0].stripe_customer_id,null);
    current.metadata.userId = "owner";
    current.id = "sub_older";
    current.status = "canceled";
    assert.equal(await reconcileBillingEvent(sql,event("customer.subscription.deleted"),deps),"binding_conflict");
    assert.equal((await row()).stripe_subscription_id,"sub_one");
    assert.equal((await row()).billing_status,"active");
    // A database failure cannot leave a dedup receipt while losing the update.
    current.id = "sub_one";
    const rollback = event();
    await db.exec(`create function break_billing_test() returns trigger language plpgsql as $$ begin raise exception 'write failed'; end; $$; create trigger break_billing before update on user_settings for each row execute function break_billing_test();`);
    await assert.rejects(reconcileBillingEvent(sql,rollback,deps),/write failed/);
    assert.equal((await sql`select * from billing_webhook_events where event_id=${rollback.id}`).length,0);
    assert.equal((await row()).billing_status,"active");
  } finally { await db.close(); }
});
