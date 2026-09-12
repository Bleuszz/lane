import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const hooks = registerHooks({
  resolve(s, c, n) {
    if (s.startsWith(".") && !/\.[a-z]+$/i.test(s) && c.parentURL?.includes("/src/"))
      return n(s + ".ts", c);
    return n(s, c);
  },
});
const {
  beginPair,
  approvePair,
  exchangePair,
  refreshDevice,
  resolveDevice,
  heartbeatDevice,
  revokeDeviceToken,
} = await import("../src/lib/lane/server/desktop-devices.ts");
hooks.deregister();
function wrap(db) {
  const sql = async (strings, ...v) =>
    (
      await db.query(
        strings.reduce((q, p, i) => q + (i ? "$" + i : "") + p, ""),
        v,
      )
    ).rows;
  sql.transaction = (fn) => db.transaction((tx) => fn(wrap(tx)));
  return sql;
}
test("device pairing is owner-bound, verifier-protected, single use, expiring and revocable; tokens stored only as hashes", async () => {
  const db = new PGlite();
  try {
    for (const n of (await readdir(new URL("../migrations/", import.meta.url)))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL("../migrations/" + n, import.meta.url), "utf8"));
    const sql = wrap(db),
      verifier = randomBytes(32).toString("base64url");
    const pair = await beginPair(sql, {
      deviceId: randomUUID(),
      challenge: createHash("sha256").update(verifier).digest("hex"),
    });
    assert.deepEqual(await exchangePair(sql, pair.id, verifier), { pending: true });
    await assert.rejects(approvePair(sql, "owner", pair.id, "WRONGCODE"));
    await approvePair(sql, "owner", pair.id, pair.code);
    await assert.rejects(approvePair(sql, "foreign", pair.id, pair.code));
    await assert.rejects(exchangePair(sql, pair.id, randomBytes(32).toString("base64url")));
    const result = await exchangePair(sql, pair.id, verifier);
    assert.equal(result.userId, "owner");
    await assert.rejects(exchangePair(sql, pair.id, verifier));
    assert.equal((await resolveDevice(sql, result.accessToken)).user_id, "owner");
    const stored = JSON.stringify(await sql`select * from desktop_devices`);
    assert.equal(stored.includes(result.accessToken), false);
    assert.equal(stored.includes(result.refreshToken), false);
    await heartbeatDevice(sql, result.accessToken, {
      version: "0.3.0",
      paused: false,
      vinted: "unknown",
      ebay: "needs_reauth",
    });
    await assert.rejects(
      heartbeatDevice(sql, result.accessToken, {
        version: "0.3.0",
        paused: false,
        vinted: "unknown",
        ebay: "unknown",
        cookies: "secret",
      }),
    );
    const next = await refreshDevice(sql, result.refreshToken);
    assert.equal(await resolveDevice(sql, result.accessToken), null);
    assert.ok(await resolveDevice(sql, next.accessToken));
    await revokeDeviceToken(sql, result.refreshToken);
    await revokeDeviceToken(sql, result.refreshToken);
    assert.equal(await resolveDevice(sql, next.accessToken), null);
    await assert.rejects(refreshDevice(sql, result.refreshToken));
    const expired = await beginPair(sql, {
      deviceId: randomUUID(),
      challenge: createHash("sha256").update(verifier).digest("hex"),
    });
    await sql`update desktop_pairings set expires_at=now()-interval '1 second' where id=${expired.id}`;
    await assert.rejects(approvePair(sql, "owner", expired.id, expired.code));
  } finally {
    await db.close();
  }
});
