// Actual PostgreSQL, isolated schema, synthetic images and local executor only.
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import sharp from "sharp";
import { SchedulerService } from "../src/lib/lane/scheduler/service.server.ts";
import {
  DEFAULT_SETTINGS,
  settingsSchema,
  effectiveCaps,
  intervalSeconds,
  nextAllowed,
  permittedTime,
  retryAfterMs,
} from "../src/lib/lane/scheduler/settings.ts";
import {
  MARKETPLACE_POLICIES,
  OPERATIONS,
  policyDenial,
} from "../src/lib/lane/scheduler/policy.ts";
import { NormalizationService } from "../src/lib/lane/normalization/service.server.ts";
import { normalizeImage } from "../src/lib/lane/normalization/engine.server.ts";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:15439/lane"))
  throw Error("Isolated fixture required");
const schema = "schedule_test_" + randomUUID().replaceAll("-", "");
const admin = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
let pool, sql, image;
function wrap(client) {
  const run = async (strings, ...values) => {
    let text = strings[0];
    values.forEach((_, i) => (text += "$" + (i + 1) + strings[i + 1]));
    return (await client.query(text, values)).rows;
  };
  run.query = async (text, values) => (await client.query(text, values)).rows;
  run.transaction = async (fn) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      const value = await fn(wrap(c));
      await c.query("commit");
      return value;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
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
  for (const name of readdirSync("migrations")
    .filter((n) => /^\d+.*\.sql$/.test(n))
    .sort())
    await pool.query(readFileSync("migrations/" + name, "utf8"));
  image = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#bb8899" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
});
beforeEach(async () => {
  await sql`delete from scheduler_attempts`;
});
after(async () => {
  if (pool) await pool.end();
  if (!/^schedule_test_[a-f0-9]{32}$/.test(schema)) throw Error("Unsafe schema");
  await admin.query(`drop schema ${schema} cascade`);
  await admin.end();
});
const supported = {
  ...MARKETPLACE_POLICIES.ebay_uk,
  operations: Object.fromEntries(OPERATIONS.map((o) => [o, "SUPPORTED"])),
  automation: true,
  batch: true,
};
async function fixture(options = {}) {
  const user = randomUUID(),
    account = randomUUID(),
    items = [],
    photos = [];
  let now = new Date("2026-09-14T10:00:00Z"),
    calls = [];
  await sql`insert into user_settings(user_id,plan,billing_status) values(${user},'seller','active')`;
  await sql`insert into marketplace_accounts(id,user_id,marketplace,mode,label,status) values(${account},${user},'ebay_uk','extension','Synthetic account','green')`;
  for (let i = 0; i < (options.count ?? 2); i++) {
    const item = randomUUID(),
      photo = randomUUID();
    items.push(item);
    photos.push(photo);
    await sql`insert into items(id,user_id,title,description,base_price_gbp) values(${item},${user},${"Sample " + i},'Original condition described',20)`;
    await sql`insert into item_photos(id,user_id,item_id,url) values(${photo},${user},${item},${"data:image/jpeg;base64," + image.toString("base64")})`;
  }
  const healthy = () => ({
    deviceOnline: true,
    session: "VALID",
    identityMatches: true,
    remote: "NONE",
    checkedAt: now.toISOString(),
    requirementsReady: true,
    imagesReady: true,
  });
  const deps = {
    clock: () => now,
    random: () => 0,
    policy: () => supported,
    inspect: async () => healthy(),
    execute: async (j) => {
      calls.push(j);
      return { kind: "SUCCESS", remoteId: "remote_" + j.item_id };
    },
    ...options.deps,
  };
  const s = new SchedulerService(sql, { scheduler: true, bulk: true }, deps);
  await s.saveSettings(user, {
    ...DEFAULT_SETTINGS,
    enabled: true,
    timezone: "UTC",
    activeStart: "00:00",
    activeEnd: "23:59",
    ...options.settings,
  });
  const input = (extra = {}) => ({
    accountId: account,
    itemIds: items,
    operation: "PUBLISH",
    mode: "ASSISTED",
    startAt: now.toISOString(),
    approved: true,
    requestKey: randomUUID(),
    ...extra,
  });
  return {
    s,
    user,
    account,
    items,
    photos,
    calls,
    deps,
    healthy,
    input,
    now: () => now,
    advance: (ms) => (now = new Date(now.getTime() + ms)),
  };
}
const jobs = (a) =>
  sql`select * from scheduled_actions where user_id=${a.user} order by scheduled_at,queued_at,id`;
test("conservative defaults, capability denial and effective lower-only caps", () => {
  assert.equal(DEFAULT_SETTINGS.enabled, false);
  assert.equal(DEFAULT_SETTINGS.imagePreset, "ORIGINAL");
  for (const p of Object.values(MARKETPLACE_POLICIES))
    for (const op of OPERATIONS) {
      assert.equal(policyDenial(p, op, "MANUAL"), null);
      assert.ok(policyDenial(p, op, "AUTOMATIC"));
    }
  const s = {
    ...DEFAULT_SETTINGS,
    hourly: 2,
    daily: 4,
    overrides: { ebay_uk: { hourly: 1 }, vinted_uk: {} },
  };
  assert.equal(effectiveCaps(s, supported, "ebay_uk").hourly, 1);
  assert.equal(
    intervalSeconds(300, 600, () => 0),
    300,
  );
  assert.equal(
    intervalSeconds(300, 600, () => 1),
    600,
  );
  assert.throws(() => settingsSchema.parse({ ...DEFAULT_SETTINGS, minSeconds: 0 }));
  assert.throws(() => settingsSchema.parse({ ...DEFAULT_SETTINGS, timezone: "not/a-zone" }));
});
test("timezone, DST skipped/repeated hours, weekdays and quiet windows", () => {
  const s = {
    ...DEFAULT_SETTINGS,
    timezone: "Europe/London",
    activeStart: "01:30",
    activeEnd: "03:00",
  };
  assert.equal(
    nextAllowed(new Date("2026-03-29T00:50:00Z"), s).toISOString(),
    "2026-03-29T01:00:00.000Z",
  );
  assert.equal(permittedTime(new Date("2026-10-25T00:45:00Z"), s), true);
  assert.equal(permittedTime(new Date("2026-10-25T01:45:00Z"), s), true);
  const q = {
    ...DEFAULT_SETTINGS,
    timezone: "UTC",
    weekdays: [1, 2, 3, 4, 5],
    activeStart: "07:00",
    activeEnd: "23:00",
    quietEnabled: true,
    quietStart: "20:00",
    quietEnd: "09:00",
  };
  assert.equal(
    nextAllowed(new Date("2026-09-11T20:30:00Z"), q).toISOString(),
    "2026-09-14T09:00:00.000Z",
  );
  assert.equal(retryAfterMs("120", 0), 120000);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:02:00 GMT", 0), 120000);
});
test("dry run validates complete batch with no writes, disabled flags and manual-only execution", async () => {
  const a = await fixture();
  const prod = new SchedulerService(sql, { scheduler: true, bulk: true }, { clock: a.deps.clock });
  assert.ok((await prod.dryRun(a.user, a.input())).rows.every((r) => r.status === "BLOCKED"));
  await sql`update items set title='' where id=${a.items[1]}`;
  const preview = await a.s.dryRun(a.user, a.input());
  assert.equal(preview.rows[1].status, "BLOCKED");
  assert.equal((await jobs(a)).length, 0);
  assert.equal(a.calls.length, 0);
  const off = new SchedulerService(sql, { scheduler: false, bulk: false });
  await assert.rejects(() => off.queue(a.user, a.input()), /BATCH_BLOCKED/);
  await prod.queue(a.user, a.input({ mode: "MANUAL", itemIds: [a.items[0]] }));
  await prod.runNext(a.user);
  assert.equal((await jobs(a))[0].last_error, "MANUAL_ACTION_ONLY");
  assert.equal(a.calls.length, 0);
});
test("batch limits, server approval, duplicate requests and changed-payload conflict", async () => {
  const a = await fixture({ settings: { confirmAbove: 1 } });
  await assert.rejects(() => a.s.queue(a.user, a.input()), /LARGE_BATCH_CONFIRMATION/);
  await assert.rejects(() => a.s.queue(a.user, a.input({ approved: false })), /APPROVAL/);
  const input = a.input({ largeApproved: true });
  const ids = await Promise.all(Array.from({ length: 6 }, () => a.s.queue(a.user, input)));
  assert.equal(new Set(ids).size, 1);
  assert.equal((await jobs(a)).length, 2);
  await assert.rejects(
    () => a.s.queue(a.user, { ...input, operation: "RELIST" }),
    /IDEMPOTENCY_CONFLICT/,
  );
  const b = await fixture({ settings: { batchSize: 1 } });
  assert.equal((await b.s.dryRun(b.user, b.input())).rows[0].status, "BLOCKED");
});
test("saved delays, ordering, duplicate worker, per-account serial execution and restart instance", async () => {
  const a = await fixture({ settings: { minSeconds: 300, maxSeconds: 600 } });
  await a.s.queue(a.user, a.input());
  const first = await jobs(a);
  assert.equal(Date.parse(first[1].scheduled_at) - Date.parse(first[0].scheduled_at), 600000);
  await Promise.all([a.s.runNext(a.user), a.s.runNext(a.user)]);
  assert.equal(a.calls.length, 1);
  a.advance(600000);
  const restarted = new SchedulerService(sql, { scheduler: true, bulk: true }, a.deps);
  await restarted.runNext(a.user);
  assert.equal(a.calls.length, 2);
  assert.deepEqual(
    a.calls.map((j) => j.item_id),
    a.items,
  );
});
test("rolling hourly and daily limits include retries and survive timezone changes", async () => {
  for (const settings of [{ hourly: 1 }, { daily: 1 }]) {
    const a = await fixture({ settings });
    await a.s.queue(a.user, a.input());
    await a.s.runNext(a.user);
    a.advance(300000);
    await sql`update scheduled_actions set scheduled_at=${a.now().toISOString()}::timestamptz where user_id=${a.user} and status='SCHEDULED'`;
    await a.s.runNext(a.user);
    const pending = (await jobs(a)).find((j) => j.status !== "SUCCEEDED");
    assert.equal(pending.last_error, "ACTION_CAP");
    assert.equal(a.calls.length, 1);
    a.advance(settings.daily ? 86400001 : 3600001);
    await a.s.runNext(a.user);
    assert.equal(a.calls.length, 2);
  }
});
test("system ceiling spans owners even when each owner has spare capacity", async () => {
  const a = await fixture({ count: 1 }),
    b = await fixture({ count: 1 });
  await a.s.queue(a.user, a.input());
  await a.s.runNext(a.user);
  const [j] = await jobs(a);
  for (let i = 2; i <= 30; i++)
    await sql`insert into scheduler_attempts(job_id,user_id,account_id,marketplace,attempt,started_at) values(${j.id},${a.user},${a.account},'ebay_uk',${i},${a.now().toISOString()}::timestamptz)`;
  await b.s.queue(b.user, b.input());
  await b.s.runNext(b.user);
  assert.equal((await jobs(b))[0].last_error, "ACTION_CAP");
  assert.equal(b.calls.length, 0);
});
test("kill switch, scope pauses, reviewed resume, future cancellation and rescheduling", async () => {
  const a = await fixture();
  await a.s.queue(a.user, a.input());
  await a.s.pause(a.user, "all", true);
  await a.s.runNext(a.user);
  assert.equal(a.calls.length, 0);
  await assert.rejects(() => a.s.pause(a.user, "all", false), /REVIEW_REQUIRED/);
  await a.s.pause(a.user, "all", false, true);
  await a.s.pause(a.user, "marketplace:ebay_uk", true);
  await a.s.runNext(a.user);
  assert.equal(a.calls.length, 0);
  await a.s.pause(a.user, "marketplace:ebay_uk", false, true);
  await a.s.pause(a.user, "account:" + a.account, true);
  await a.s.runNext(a.user);
  assert.equal(a.calls.length, 0);
  await a.s.pause(a.user, "account:" + a.account, false, true);
  await a.s.cancel(a.user, { futureOnly: true });
  assert.equal((await jobs(a)).filter((j) => j.status === "CANCELLED").length, 1);
  await a.s.runNext(a.user);
  assert.equal(a.calls.length, 1);
  const b = await fixture();
  const batch = await b.s.queue(b.user, b.input());
  await b.s.pause(b.user, "batch:" + batch, true);
  await b.s.runNext(b.user);
  assert.equal(b.calls.length, 0);
  await b.s.pause(b.user, "batch:" + batch, false, true);
  const [j] = await jobs(b);
  await b.s.reschedule(b.user, j.id, new Date(b.now().getTime() + 600000).toISOString(), true);
  await b.s.cancel(b.user, { jobId: j.id });
  assert.equal((await jobs(b)).find((x) => x.id === j.id).status, "CANCELLED");
});
test("device offline waits without charging, expiry reconnects, challenge and identity mismatch pause", async () => {
  for (const [change, state, error] of [
    [{ deviceOnline: false, identityMatches: false }, "WAITING_FOR_DEVICE", "OPEN_LANE_DESKTOP"],
    [
      { session: "EXPIRED", identityMatches: false },
      "REQUIRES_RECONNECT",
      "SESSION_EXPIRED_OR_UNKNOWN",
    ],
    [{ session: "CHALLENGE" }, "REQUIRES_USER_ACTION", "CHALLENGE"],
    [{ identityMatches: false }, "REQUIRES_USER_ACTION", "ACCOUNT_MISMATCH"],
    [{ warning: true }, "REQUIRES_USER_ACTION", "MARKETPLACE_WARNING"],
  ]) {
    const a = await fixture({ count: 1 });
    a.deps.inspect = async () => ({ ...a.healthy(), ...change });
    await a.s.queue(a.user, a.input());
    await a.s.runNext(a.user);
    const [j] = await jobs(a);
    assert.equal(j.status, state);
    assert.equal(j.last_error, error);
    assert.equal(j.attempt_count, 0);
    assert.equal(a.calls.length, 0);
    if (state !== "WAITING_FOR_DEVICE")
      assert.equal(
        (await a.s.state(a.user)).scopes.find((s) => s.scope === "account:" + a.account).paused,
        true,
      );
    else {
      a.advance(60000);
      a.deps.inspect = async () => a.healthy();
      await a.s.runNext(a.user);
      assert.equal(a.calls.length, 1);
    }
  }
});
test("fresh remote state, required destination fields, changed local data and legacy conflicts stop dispatch", async () => {
  for (const change of [
    { remote: "ACTIVE" },
    { remote: "UNKNOWN" },
    { checkedAt: "2000-01-01T00:00:00Z" },
    { requirementsReady: false },
    { imagesReady: false },
  ]) {
    const a = await fixture({ count: 1 });
    a.deps.inspect = async () => ({ ...a.healthy(), ...change });
    await a.s.queue(a.user, a.input());
    await a.s.runNext(a.user);
    assert.equal((await jobs(a))[0].status, "REQUIRES_USER_ACTION");
    assert.equal(a.calls.length, 0);
  }
  const a = await fixture({ count: 1 });
  await a.s.queue(a.user, a.input());
  await sql`update items set title='Changed by seller' where id=${a.items[0]}`;
  await a.s.runNext(a.user);
  assert.equal((await jobs(a))[0].last_error, "LISTING_CHANGED");
  const b = await fixture({ count: 1 });
  await b.s.queue(b.user, b.input());
  await sql`insert into jobs(id,user_id,type,status,marketplace,account_id,item_id,request_id) values(${randomUUID()},${b.user},'publish','queued','ebay_uk',${b.account},${b.items[0]},${randomUUID()})`;
  await b.s.runNext(b.user);
  assert.equal((await jobs(b))[0].last_error, "LEGACY_JOB_CONFLICT");
});
test("Retry-After is honored, resume cannot shorten it, retry reuses idempotency and allowance", async () => {
  const a = await fixture({ count: 1 });
  let calls = 0;
  a.deps.execute = async (j) => {
    a.calls.push(j);
    return ++calls === 1
      ? { kind: "RATE_LIMIT", retryAfter: "900", noRemoteEffect: true }
      : { kind: "SUCCESS", remoteId: "confirmed_id" };
  };
  await a.s.queue(a.user, a.input());
  await a.s.runNext(a.user);
  let [j] = await jobs(a);
  assert.equal(j.status, "RETRY_WAIT");
  assert.equal(Date.parse(j.scheduled_at) - a.now().getTime(), 900000);
  await assert.rejects(
    () => a.s.pause(a.user, "account:" + a.account, false, true),
    /RETRY_AFTER_ACTIVE/,
  );
  a.advance(899000);
  await a.s.runNext(a.user);
  assert.equal(calls, 1);
  a.advance(1000);
  await a.s.runNext(a.user);
  assert.equal(calls, 2);
  assert.equal(a.calls[0].idempotency_key, a.calls[1].idempotency_key);
  assert.equal(
    (await sql`select actions_used_month from user_settings where user_id=${a.user}`)[0]
      .actions_used_month,
    1,
  );
});
test("failure thresholds pause account and batch; retry count stops", async () => {
  const a = await fixture({
    count: 1,
    settings: { maxConsecutiveFailures: 2, maxBatchFailures: 2 },
  });
  a.deps.execute = async () => ({ kind: "SAFE_RETRY", noRemoteEffect: true });
  await a.s.queue(a.user, a.input());
  await a.s.runNext(a.user);
  a.advance(300000);
  await a.s.runNext(a.user);
  const state = await a.s.state(a.user);
  assert.equal(state.scopes.find((x) => x.scope === "account:" + a.account).paused, true);
  assert.equal(state.batches[0].paused, true);
  assert.equal(state.batches[0].failures, 2);
  const b = await fixture({ count: 1, settings: { retryLimit: 0 } });
  b.deps.execute = a.deps.execute;
  await b.s.queue(b.user, b.input());
  await b.s.runNext(b.user);
  assert.equal((await jobs(b))[0].last_error, "RETRY_LIMIT");
});
test("ambiguous timeout never replays, even after cancel; running cancellation is non-destructive", async () => {
  const a = await fixture({ count: 1 });
  let release, started;
  const began = new Promise((r) => (started = r));
  a.deps.execute = async () => {
    started();
    return new Promise((r) => (release = r));
  };
  await a.s.queue(a.user, a.input());
  const running = a.s.runNext(a.user);
  await began;
  const [j] = await jobs(a);
  await a.s.cancel(a.user, { jobId: j.id });
  assert.equal((await jobs(a))[0].status, "RUNNING");
  await a.s.pause(a.user, "all", true);
  release({ kind: "AMBIGUOUS" });
  await running;
  await assert.rejects(
    () => a.s.reschedule(a.user, j.id, a.now().toISOString(), true),
    /REMOTE_RECONCILIATION/,
  );
  await a.s.cancel(a.user, { jobId: j.id });
  await a.s.pause(a.user, "all", false, true);
  assert.equal((await a.s.dryRun(a.user, a.input())).rows[0].status, "BLOCKED");
});
test("expired worker lease becomes review on restart and late result cannot claim success", async () => {
  const a = await fixture({ count: 1 });
  a.deps.execute = async () => {
    a.advance(121000);
    return { kind: "SUCCESS", remoteId: "late" };
  };
  await a.s.queue(a.user, a.input());
  await a.s.runNext(a.user);
  assert.equal((await jobs(a))[0].last_error, "LEASE_EXPIRED");
  assert.equal((await jobs(a))[0].status, "REQUIRES_USER_ACTION");
  const restarted = new SchedulerService(sql, { scheduler: true, bulk: true }, a.deps);
  await restarted.runNext(a.user);
  assert.equal((await jobs(a))[0].attempt_count, 1);
});
test("ownership isolation includes queues, settings, batches, jobs and audit output", async () => {
  const a = await fixture({ count: 1 }),
    b = await fixture({ count: 1 });
  const batch = await a.s.queue(a.user, a.input());
  const [j] = await jobs(a);
  await assert.rejects(() => a.s.dryRun(b.user, a.input()), /ACCOUNT_NOT_FOUND/);
  await assert.rejects(() => a.s.pause(b.user, "batch:" + batch, true), /BATCH_NOT_FOUND/);
  await a.s.cancel(b.user, { jobId: j.id });
  assert.equal((await jobs(a))[0].status, "QUEUED");
  assert.equal((await a.s.state(b.user)).jobs.length, 0);
  assert.ok(!JSON.stringify(await a.s.state(a.user)).includes("lease_token"));
});
test("database guard stops retained legacy write claims while paused and leaves active lease alone", async () => {
  const a = await fixture({ count: 1 }),
    id = randomUUID();
  await sql`insert into jobs(id,user_id,type,status,marketplace,account_id,item_id,request_id) values(${id},${a.user},'publish','queued','ebay_uk',${a.account},${a.items[0]},${randomUUID()})`;
  await a.s.pause(a.user, "all", true);
  assert.equal(
    (
      await sql`update jobs set lease_token='test-lease',status='creating' where id=${id} returning id`
    ).length,
    0,
  );
  await a.s.pause(a.user, "all", false, true);
  assert.equal(
    (
      await sql`update jobs set lease_token='test-lease',status='creating' where id=${id} returning id`
    ).length,
    1,
  );
  await a.s.pause(a.user, "all", true);
  assert.equal((await sql`update jobs set status='done' where id=${id} returning id`).length, 1);
});
test("normalization preserves original bytes, fixes orientation and removes private metadata deterministically", async () => {
  const original = Buffer.from(image),
    unchanged = await normalizeImage(image, { preset: "ORIGINAL" });
  assert.deepEqual(unchanged.data, image);
  const out = await normalizeImage(image, { preset: "CLEAN_EXPORT" }),
    meta = await sharp(out.data).metadata();
  assert.equal(out.width, 80);
  assert.equal(out.height, 120);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.xmp, undefined);
  assert.equal(meta.orientation, undefined);
  assert.equal(meta.space, "srgb");
  assert.deepEqual(image, original);
  assert.deepEqual((await normalizeImage(image, { preset: "CLEAN_EXPORT" })).data, out.data);
});

test("relist/update/delist/price jobs retain their target and reject a changed remote ID", async () => {
  for (const operation of ["RELIST", "UPDATE", "DELIST", "PRICE_UPDATE"]) {
    const a = await fixture({ count: 1 }),
      remoteId = "known_123";
    await sql`insert into channel_listings(id,user_id,item_id,marketplace,marketplace_account_id,remote_id,remote_status) values(${randomUUID()},${a.user},${a.items[0]},'ebay_uk',${a.account},${remoteId},${operation === "RELIST" ? "ended" : "live"})`;
    a.deps.inspect = async () => ({
      ...a.healthy(),
      remote: operation === "RELIST" ? "ENDED" : "ACTIVE",
      remoteId,
    });
    await a.s.queue(a.user, a.input({ operation }));
    assert.equal((await jobs(a))[0].remote_id, remoteId);
    await a.s.runNext(a.user);
    assert.equal(a.calls.length, 1);
    assert.equal(a.calls[0].remote_id, remoteId);
  }
  const a = await fixture({ count: 1 });
  await sql`insert into channel_listings(id,user_id,item_id,marketplace,marketplace_account_id,remote_id,remote_status) values(${randomUUID()},${a.user},${a.items[0]},'ebay_uk',${a.account},'old_target','live')`;
  await a.s.queue(a.user, a.input({ operation: "UPDATE" }));
  a.deps.inspect = async () => ({ ...a.healthy(), remote: "ACTIVE", remoteId: "different_target" });
  await a.s.runNext(a.user);
  assert.equal((await jobs(a))[0].last_error, "REMOTE_TARGET_CHANGED");
  assert.equal(a.calls.length, 0);
});
test("bounded resize preserves aspect; PNG alpha retained; unsupported and unapproved edits rejected", async () => {
  const png = await sharp({
    create: { width: 2400, height: 1200, channels: 4, background: "#ccbbbb80" },
  })
    .png()
    .toBuffer();
  const out = await normalizeImage(png, { preset: "MARKETPLACE_READY" });
  assert.equal(out.width, 1600);
  assert.equal(out.height, 800);
  assert.equal((await sharp(out.data).metadata()).hasAlpha, true);
  const thumb = await normalizeImage(png, { preset: "THUMBNAIL" });
  assert.equal(thumb.width, 320);
  assert.equal(thumb.height, 160);
  await assert.rejects(
    () => normalizeImage(png, { preset: "CUSTOM", format: "jpeg" }),
    /TRANSPARENCY/,
  );
  await assert.rejects(() => normalizeImage(image, { preset: "WHITE_BACKGROUND" }), /UNSUPPORTED/);
  await assert.rejects(() => normalizeImage(image, { preset: "CUSTOM", brightness: 2 }));
  const custom = await normalizeImage(png, {
    preset: "CUSTOM",
    format: "jpeg",
    fillTransparencyWhite: true,
    maxDimension: 800,
  });
  assert.equal(custom.format, "jpeg");
  assert.equal(custom.width, 800);
});
test("durable image jobs, duplicate claim, review, delete, source hash and ownership", async () => {
  const a = await fixture({ count: 1 }),
    b = await fixture({ count: 1 }),
    s = new NormalizationService(sql, true),
    original = (await sql`select url from item_photos where id=${a.photos[0]}`)[0].url,
    key = randomUUID();
  const batches = await Promise.all([
    s.queue(a.user, a.photos, { preset: "CLEAN_EXPORT" }, key),
    s.queue(a.user, a.photos, { preset: "CLEAN_EXPORT" }, key),
  ]);
  assert.deepEqual(batches[0], batches[1]);
  const [id] = batches[0];
  await Promise.all([s.run(a.user, id), s.run(a.user, id)]);
  let state = await s.state(a.user);
  assert.equal(state.jobs[0].status, "SUCCEEDED");
  assert.equal(state.jobs[0].source_photo_id, a.photos[0]);
  assert.notEqual(state.jobs[0].derivative_photo_id, a.photos[0]);
  await assert.rejects(() => s.image(b.user, id), /NOT_FOUND/);
  await assert.rejects(() => s.review(b.user, id, "accepted"), /NOT_FOUND/);
  await s.review(a.user, id, "accepted");
  assert.equal((await s.state(a.user)).jobs[0].review, "accepted");
  await s.review(a.user, id, "rejected");
  assert.equal((await sql`select url from item_photos where id=${a.photos[0]}`)[0].url, original);
  await s.review(a.user, id, "deleted");
  await assert.rejects(() => s.image(a.user, id), /NOT_FOUND/);
  assert.equal(
    (await sql`select output_data from image_normalizations where id=${id}`)[0].output_data,
    null,
  );
  const [changed] = await s.queue(a.user, a.photos, { preset: "CLEAN_EXPORT" }, randomUUID());
  await sql`update item_photos set url='https://example.invalid/original.jpg' where id=${a.photos[0]}`;
  await s.run(a.user, changed);
  assert.equal(
    (await s.state(a.user)).jobs.find((j) => j.id === changed).last_error,
    "SOURCE_CHANGED",
  );
  await assert.rejects(
    () => s.queue(a.user, a.photos, { preset: "CLEAN_EXPORT" }, randomUUID()),
    /LOCAL_ORIGINAL_REQUIRED/,
  );
});
test("disabled images fail closed; cancelled job cannot resurrect; restart recovers interrupted normalization", async () => {
  const a = await fixture({ count: 1 });
  await assert.rejects(
    () =>
      new NormalizationService(sql, false).queue(
        a.user,
        a.photos,
        { preset: "CLEAN_EXPORT" },
        randomUUID(),
      ),
    /DISABLED/,
  );
  const s = new NormalizationService(sql, true);
  const [id] = await s.queue(a.user, a.photos, { preset: "CLEAN_EXPORT" }, randomUUID());
  await s.review(a.user, id, "deleted");
  await s.run(a.user, id);
  assert.equal(
    (await sql`select status,output_data from image_normalizations where id=${id}`)[0].status,
    "CANCELLED",
  );
  const [stale] = await s.queue(a.user, a.photos, { preset: "CLEAN_EXPORT" }, randomUUID());
  await sql`update image_normalizations set status='RUNNING',lease_expires_at=now()-interval '1 minute' where id=${stale}`;
  assert.equal(
    (await new NormalizationService(sql, true).state(a.user)).jobs[0].last_error,
    "PROCESS_INTERRUPTED",
  );
});
