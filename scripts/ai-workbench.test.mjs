// Real PostgreSQL concurrency tests, isolated schema; no provider calls or user data.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { AiService } from "../src/lib/lane/ai/service.server.ts";
import { aiConfig } from "../src/lib/lane/ai/config.server.ts";
import { providerFor } from "../src/lib/lane/ai/providers/registry.server.ts";

if (!process.env.DATABASE_URL?.includes("127.0.0.1:15439/lane"))
  throw Error("Isolated local PostgreSQL fixture required");
const schema = "ai_test_" + randomUUID().replaceAll("-", "");
const admin = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
let pool, sql;
const cfg = () =>
  aiConfig({
    AI_LISTING_ENABLED: "true",
    AI_IMAGE_ENABLED: "true",
    AI_MOCK_DEVELOPMENT: "true",
    LANE_ENV: "test",
  });
function wrap(client) {
  const run = async (strings, ...values) => {
    let text = strings[0];
    values.forEach((_, i) => (text += "$" + (i + 1) + strings[i + 1]));
    return (await client.query(text, values)).rows;
  };
  run.query = async (text, params) => (await client.query(text, params)).rows;
  run.transaction = async (fn) => {
    const conn = await pool.connect();
    try {
      await conn.query("begin");
      const result = await fn(wrap(conn));
      await conn.query("commit");
      return result;
    } catch (e) {
      await conn.query("rollback");
      throw e;
    } finally {
      conn.release();
    }
  };
  return run;
}
before(async () => {
  await admin.query(`create schema ${schema}`);
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
    options: `-c search_path=${schema}`,
  });
  sql = wrap(pool);
  await pool.query(`create table user_settings(user_id text primary key,plan text,billing_status text);
 create table ai_credit_usage(user_id text,month text,used int);
 create table items(id text primary key,user_id text,title text,description text,brand text,colour text,material text,category_canonical text,size_uk text,condition text,updated_at timestamptz default now());
 create table item_photos(id text primary key,item_id text,user_id text,url text,sort_order int default 0);
 create table channel_listings(id text primary key,item_id text,user_id text,source_data jsonb,created_at timestamptz default now());`);
  await pool.query(
    readFileSync(new URL("../migrations/0020_ai_workbench.sql", import.meta.url), "utf8"),
  );
});
after(async () => {
  if (pool) await pool.end();
  if (!/^ai_test_[a-f0-9]{32}$/.test(schema)) throw Error("Unsafe fixture schema");
  await admin.query(`drop schema ${schema} cascade`);
  await admin.end();
});
async function account(plan = "seller", status = "active") {
  const user = randomUUID(),
    item = randomUUID(),
    photo = randomUUID();
  await sql`insert into user_settings values(${user},${plan},${status})`;
  await sql`insert into items(id,user_id,title,description,brand,condition) values(${item},${user},'Original seller title','Visible wear disclosed','Ralph Lauren','good')`;
  await sql`insert into item_photos(id,item_id,user_id,url) values(${photo},${item},${user},'/lane-social.png')`;
  await sql`insert into channel_listings(id,item_id,user_id,source_data) values(${randomUUID()},${item},${user},'{"brand":"Ralph Lauren","title":"Imported title"}')`;
  return { user, item, photo };
}
const request = (a, extra = {}) => ({
  itemId: a.item,
  operation: "listing_complete",
  destination: "ebay_uk",
  ...extra,
});
const queue = (s, a, extra = {}, key = randomUUID()) =>
  s.queueBatch(a.user, key, [request(a, extra)]);

test("optional config, separate provider slots, zero trial/Starter and configurable costs", () => {
  const c = aiConfig({});
  assert.equal(c.textProvider, "mock");
  assert.equal(c.imageProvider, "mock");
  assert.equal(c.listing, false);
  assert.equal(c.image, false);
  assert.equal(c.allowances.trial, 0);
  assert.equal(c.allowances.starter, 0);
  assert.equal(c.allowances.seller, 500);
  assert.equal(c.allowances.pro, 1500);
  const changed = aiConfig({
    AI_OPERATION_COSTS_JSON: '{"flat_lay":7}',
    AI_PLAN_ALLOWANCES_JSON: '{"seller":700,"trial":99}',
  });
  assert.equal(changed.costs.flat_lay, 7);
  assert.equal(changed.allowances.seller, 700);
  assert.equal(changed.allowances.trial, 0);
  assert.equal(
    aiConfig({ AI_TEXT_PROVIDER: "openai", AI_IMAGE_PROVIDER: "google" }).imageProvider,
    "google",
  );
  assert.throws(() => aiConfig({ AI_OPERATION_COSTS_JSON: '{"flat_lay":-1}' }));
  assert.throws(() => providerFor("openai"), /PROVIDER_UNAVAILABLE/);
  assert.equal(
    aiConfig({ AI_MOCK_DEVELOPMENT: "true", LANE_ENV: "production" }).development,
    false,
  );
});
test("feature/provider failures reserve nothing, without any API key", async () => {
  const a = await account();
  await assert.rejects(queue(new AiService(sql, aiConfig({})), a), /FEATURE_DISABLED/);
  await assert.rejects(
    queue(new AiService(sql, { ...cfg(), development: false }), a),
    /DEVELOPMENT_ONLY/,
  );
  await assert.rejects(
    queue(new AiService(sql, { ...cfg(), textProvider: "google" }), a),
    /PROVIDER_UNAVAILABLE/,
  );
  assert.equal((await sql`select count(*)::int n from ai_jobs where user_id=${a.user}`)[0].n, 0);
});
test("trial, Starter, inactive plan have zero; Seller and Pro limits are server-owned", async () => {
  const s = new AiService(sql, cfg());
  for (const [plan, status] of [
    ["seller", "trialing"],
    ["starter", "active"],
    ["pro", "past_due"],
  ]) {
    const a = await account(plan, status);
    await assert.rejects(queue(s, a), /PLAN_HAS_NO_AI_CREDITS/);
    assert.equal((await s.state(a.user)).allowance, 0);
  }
  for (const [plan, limit] of [
    ["seller", 500],
    ["pro", 1500],
  ]) {
    const a = await account(plan);
    assert.equal((await s.state(a.user)).allowance, limit);
  }
});
test("atomic reserve, consume and cost ledger; provider receives only selected listing context", async () => {
  const a = await account(),
    s = new AiService(sql, cfg()),
    [job] = await queue(s, a);
  let state = await s.state(a.user);
  assert.equal(state.remaining, 499);
  assert.equal(state.reserved, 1);
  assert.equal(state.consumed, 0);
  await s.run(a.user, job);
  await s.run(a.user, job);
  state = await s.state(a.user);
  assert.equal(state.reserved, 0);
  assert.equal(state.consumed, 1);
  assert.equal(state.jobs[0].status, "SUCCEEDED");
  assert.ok(
    state.suggestions.find((s) => s.field === "title").suggested_value.startsWith("[MOCK]"),
  );
  assert.equal(state.suggestions.find((s) => s.field === "material").suggested_value, null);
  assert.equal(state.suggestions.find((s) => s.field === "brand").source_value, "Ralph Lauren");
  const [cost] = await sql`select * from ai_cost_ledger where job_id=${job}`;
  assert.equal(Number(cost.actual_cost), 0);
  assert.equal(cost.credits_charged, 1);
  assert.equal(cost.provider, "mock");
  const [stored] = await sql`select input from ai_jobs where id=${job}`;
  assert.deepEqual(
    Object.keys(stored.input).sort(),
    ["operation", "fields", "destination", "category", "photoIds", "settings"].sort(),
  );
  assert.ok(!JSON.stringify(state).includes("actual_cost"));
  assert.ok(!JSON.stringify(state).includes("input_usage"));
});
test("duplicate clicks and duplicate processing charge once; changed body conflicts", async () => {
  const a = await account(),
    s = new AiService(sql, cfg()),
    key = randomUUID();
  const results = await Promise.all(Array.from({ length: 8 }, () => queue(s, a, {}, key)));
  assert.equal(new Set(results.flat()).size, 1);
  await assert.rejects(queue(s, a, { operation: "listing_improve" }, key), /IDEMPOTENCY_CONFLICT/);
  await Promise.all(results.map(([job]) => s.run(a.user, job)));
  assert.equal((await s.state(a.user)).consumed, 1);
  assert.equal(
    (
      await sql`select count(*)::int n from ai_credit_ledger where user_id=${a.user} and event='consume'`
    )[0].n,
    1,
  );
});
test("concurrent independent reservations cannot overspend", async () => {
  const a = await account(),
    s = new AiService(sql, cfg());
  await sql`insert into ai_wallets(user_id,month,consumed) values(${a.user},${new Date().toISOString().slice(0, 7)},499)`;
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => queue(s, a)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await s.state(a.user)).remaining, 0);
});
for (const mode of ["TIMEOUT", "RATE_LIMIT", "PROVIDER_ERROR", "INVALID_OUTPUT"])
  test(`mock ${mode} restores credits once and records a sanitised failure`, async () => {
    const a = await account(),
      s = new AiService(sql, cfg()),
      [job] = await queue(s, a, { mode });
    await s.run(a.user, job);
    await s.run(a.user, job);
    await s.cancel(a.user, job);
    const state = await s.state(a.user);
    assert.equal(state.remaining, 500);
    assert.equal(state.consumed, 0);
    assert.equal(state.jobs[0].status, "REFUNDED");
    assert.equal(state.jobs[0].error_code, mode);
    assert.equal(
      (
        await sql`select count(*)::int n from ai_credit_ledger where job_id=${job} and event='refund'`
      )[0].n,
      1,
    );
  });
test("crash leases expire, never replay; cancelled jobs cannot charge", async () => {
  const a = await account(),
    s = new AiService(sql, cfg()),
    [job] = await queue(s, a);
  await sql`update ai_jobs set status='PROCESSING',lease_token='lost-process',expires_at=now()-interval '1 second' where id=${job}`;
  await s.recover(a.user);
  await s.run(a.user, job);
  assert.equal((await s.state(a.user)).remaining, 500);
  const [cancelled] = await queue(s, a);
  await s.cancel(a.user, cancelled);
  await s.run(a.user, cancelled);
  assert.equal((await s.state(a.user)).remaining, 500);
  const [retry] = await s.retry(a.user, job, randomUUID());
  assert.notEqual(retry, job);
  await s.run(a.user, retry);
  assert.equal((await s.state(a.user)).consumed, 1);
});
test("monthly reset and old-month refund stay in their own wallet", async () => {
  const a = await account();
  let now = new Date("2026-01-31T23:59:00Z");
  const s = new AiService(sql, cfg(), () => now);
  const [job] = await queue(s, a);
  assert.equal((await s.state(a.user)).remaining, 499);
  now = new Date("2026-02-01T00:00:00Z");
  assert.equal((await s.state(a.user)).remaining, 500);
  assert.equal((await s.state(a.user)).resetsAt, "2026-03-01T00:00:00.000Z");
  await s.cancel(a.user, job);
  assert.equal((await s.state(a.user)).remaining, 500);
  assert.equal(
    (await sql`select reserved from ai_wallets where user_id=${a.user} and month='2026-01'`)[0]
      .reserved,
    0,
  );
});
test("batch insufficiency is all-or-nothing; one failed job does not refund successful siblings", async () => {
  const a = await account(),
    s = new AiService(sql, cfg());
  const jobs = await s.queueBatch(a.user, randomUUID(), [
    request(a),
    request(a, { mode: "RATE_LIMIT" }),
  ]);
  await Promise.all(jobs.map((job) => s.run(a.user, job)));
  assert.equal((await s.state(a.user)).consumed, 1);
  assert.equal((await s.state(a.user)).remaining, 499);
  const expensive = new AiService(sql, {
    ...cfg(),
    costs: { ...cfg().costs, listing_complete: 300 },
  });
  await assert.rejects(
    expensive.queueBatch(a.user, randomUUID(), [request(a), request(a)]),
    /INSUFFICIENT_CREDITS/,
  );
  assert.equal((await s.state(a.user)).jobs.length, 2);
});
test("ownership isolation for items, photos, jobs, reviews and assets", async () => {
  const a = await account(),
    b = await account(),
    s = new AiService(sql, cfg());
  await assert.rejects(s.queueBatch(b.user, randomUUID(), [request(a)]), /ITEM_NOT_FOUND/);
  await assert.rejects(
    queue(s, b, { operation: "background_remove", photoId: a.photo }),
    /PHOTO_NOT_FOUND/,
  );
  const [job] = await queue(s, a);
  await s.run(a.user, job);
  const state = await s.state(a.user);
  await assert.rejects(s.run(b.user, job), /JOB_NOT_FOUND/);
  await assert.rejects(s.cancel(b.user, job), /JOB_NOT_FOUND/);
  await assert.rejects(
    s.review(b.user, state.suggestions[0].id, "rejected"),
    /SUGGESTION_NOT_FOUND/,
  );
  await assert.rejects(s.retry(b.user, job, randomUUID()), /JOB_NOT_FOUND/);
  assert.equal((await s.state(b.user)).jobs.length, 0);
  const [image] = await queue(s, a, { operation: "background_remove", photoId: a.photo });
  await s.run(a.user, image);
  await assert.rejects(
    s.reviewAsset(b.user, (await s.state(a.user)).assets[0].id, "deleted"),
    /ASSET_NOT_FOUND/,
  );
});
test("individual suggestion decisions preserve source, user values and actual listing", async () => {
  const a = await account(),
    s = new AiService(sql, cfg()),
    [job] = await queue(s, a, { userValues: { title: "Seller override" } });
  await s.run(a.user, job);
  let state = await s.state(a.user);
  const title = state.suggestions.find((s) => s.field === "title"),
    desc = state.suggestions.find((s) => s.field === "description");
  assert.equal(title.user_value, "Seller override");
  await assert.rejects(s.review(a.user, title.id, "accepted"), /CONFIRM_KNOWN_VALUE/);
  await s.review(a.user, title.id, "accepted", true);
  await s.review(a.user, title.id, "accepted", true);
  await s.review(a.user, desc.id, "rejected");
  assert.equal(
    (await sql`select title from items where id=${a.item}`)[0].title,
    "Original seller title",
  );
  assert.equal(await s.reviewSafe(a.user, job), 0);
  const material = state.suggestions.find((s) => s.field === "material");
  await assert.rejects(s.review(a.user, material.id, "accepted"), /UNKNOWN_CANNOT_BE_ACCEPTED/);
  const [fresh] = await queue(s, a);
  await s.run(a.user, fresh);
  const next = (await s.state(a.user)).suggestions.find(
    (s) => s.job_id === fresh && s.field === "title",
  );
  await sql`update items set title='New seller edit' where id=${a.item}`;
  await assert.rejects(s.review(a.user, next.id, "accepted", true), /SAVED_VALUE_CHANGED/);
});
test("image mock, settings, lineage, acceptance/deletion never mutate originals", async () => {
  const a = await account(),
    s = new AiService(sql, cfg());
  const before = await sql`select * from item_photos where id=${a.photo}`;
  const [job] = await queue(s, a, {
    operation: "virtual_model",
    photoId: a.photo,
    settings: { ratio: "4:5", scene: "linen", presentation: "neutral", prompt: "" },
  });
  await s.run(a.user, job);
  const state = await s.state(a.user),
    asset = state.assets[0];
  assert.equal(asset.source_photo_id, a.photo);
  assert.equal(state.consumed, 25);
  const [stored] = await sql`select * from ai_generated_assets where id=${asset.id}`;
  assert.equal(stored.preview_kind, "development_placeholder");
  assert.equal(stored.settings.ratio, "4:5");
  assert.equal(stored.provider, "mock");
  await s.reviewAsset(a.user, asset.id, "accepted");
  await s.reviewAsset(a.user, asset.id, "rejected");
  await s.reviewAsset(a.user, asset.id, "deleted");
  assert.deepEqual(await sql`select * from item_photos where id=${a.photo}`, before);
  assert.equal((await s.state(a.user)).assets.length, 0);
  assert.equal((await s.state(a.user)).consumed, 25);
});
test("retired live endpoints contain no AI network dispatch", () => {
  for (const file of ["fns.ts", "smart-fill.ts"]) {
    const text = readFileSync(new URL("../src/lib/lane/server/" + file, import.meta.url), "utf8");
    assert.ok(!text.includes("api.x.ai"));
    assert.ok(!text.includes("XAI_API_KEY"));
  }
});
