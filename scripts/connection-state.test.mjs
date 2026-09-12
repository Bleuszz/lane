import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { createConnectionManager, validated } = createRequire(import.meta.url)(
  "../desktop/connection-manager.cjs",
);
function fixture(overrides = {}) {
  const events = [];
  let time = 0;
  const evidence = {
    authenticated: true,
    protectedPage: true,
    identity: "owner",
    ownPage: true,
    listingStateKnown: true,
    links: [{ remoteId: "123", url: "https://example.invalid/123" }],
  };
  const adapter = {
    openLogin: async () => {
      events.push("open");
      return {};
    },
    inspectLogin: async () => evidence,
    hasSession: async () => true,
    validate: async () => evidence,
    persist: async () => {
      events.push("saved");
    },
    closeLogin: async () => {
      events.push("closed");
    },
    listings: async () => {
      events.push("listings");
      return evidence;
    },
    readItems: async () => [],
    clear: async () => {
      events.push("cleared");
    },
    delay: async (ms) => {
      time += ms;
    },
    ...overrides,
  };
  const p = { id: "p", status: "DISCONNECTED", links: [], items: [] };
  const manager = createConnectionManager(adapter, {
    changed: (p) => events.push(p.status),
    now: () => time,
    pollMs: 1,
    loginTimeout: 3,
  });
  return { p, manager, events, evidence };
}
test("connected requires identity, authenticated protected page and matching account", () => {
  for (const e of [
    {},
    { authenticated: true },
    { authenticated: true, identity: "owner" },
    { protectedPage: true, identity: "owner" },
  ])
    assert.equal(validated(e), false);
  assert.equal(
    validated({ authenticated: true, protectedPage: true, identity: "other" }, "owner"),
    false,
  );
});
test("fresh connect validates and persists before connected, closes login before listing sync", async () => {
  const { p, manager, events } = fixture();
  await manager.connect(p);
  assert.equal(p.status, "CONNECTED");
  assert.ok(events.indexOf("saved") < events.indexOf("CONNECTED"));
  assert.ok(events.indexOf("closed") < events.indexOf("listings"));
  assert.equal(p.listingCount, 1);
});
for (const [name, override, status] of [
  ["cancelled login", { inspectLogin: async () => ({ closed: true }) }, "DISCONNECTED"],
  ["uncompleted login", { inspectLogin: async () => ({ authenticated: false }) }, "DISCONNECTED"],
  ["404 login", { inspectLogin: async () => ({ pageError: true }) }, "ERROR"],
  [
    "invalid saved session",
    { validate: async () => ({ authenticated: false }) },
    "SESSION_EXPIRED",
  ],
  ["verification challenge", { validate: async () => ({ challenge: true }) }, "RECONNECT_REQUIRED"],
  [
    "storage failure",
    {
      persist: async () => {
        throw Error("private failure");
      },
    },
    "ERROR",
  ],
])
  test(name + " never becomes connected", async () => {
    const { p, manager, events } = fixture(override);
    await manager.connect(p);
    assert.equal(p.status, status);
    assert.ok(!events.includes("CONNECTED"));
    assert.ok(!p.connectionError.includes("private failure"));
  });
test("refresh/restart validates silently, and stale session loses connected state", async () => {
  const { p, manager, events } = fixture();
  p.status = "RECONNECT_REQUIRED";
  await manager.refresh(p);
  assert.equal(p.status, "CONNECTED");
  assert.ok(!events.includes("open"));
  const stale = fixture({ hasSession: async () => false });
  stale.p.status = "CONNECTED";
  await stale.manager.refresh(stale.p);
  assert.equal(stale.p.status, "SESSION_EXPIRED");
  assert.ok(!stale.events.includes("open"));
});
test("duplicate connect shares one operation and one login window", async () => {
  const { p, manager, events } = fixture();
  const a = manager.connect(p),
    b = manager.connect(p);
  assert.equal(a, b);
  await a;
  assert.equal(events.filter((e) => e === "open").length, 1);
});
test("disconnect invalidates in-flight validation and clears state without resurrection", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const f = fixture({
    validate: async () => {
      await gate;
      return f.evidence;
    },
  });
  const pending = f.manager.connect(f.p);
  await new Promise((resolve) => setImmediate(resolve));
  const disconnect = f.manager.disconnect(f.p);
  release();
  await Promise.all([pending, disconnect]);
  assert.equal(f.p.status, "DISCONNECTED");
  assert.equal(f.p.identity, null);
  assert.deepEqual(f.p.links, []);
  assert.ok(!f.events.includes("CONNECTED"));
});
test("account identity mismatch requires reconnect and does not overwrite owner", async () => {
  const { p, manager } = fixture();
  p.identity = "another-owner";
  await manager.refresh(p);
  assert.equal(p.status, "RECONNECT_REQUIRED");
  assert.equal(p.identity, "another-owner");
});

test("unavailable listing state cannot reuse stale owned links for detail reads", async () => {
  let reads = 0;
  const f = fixture({
    listings: async () => ({ ...f.evidence, listingStateKnown: false }),
    readItems: async () => {
      reads++;
      return [];
    },
  });
  f.p.links = f.evidence.links;
  await f.manager.read(f.p);
  assert.equal(f.p.status, "ERROR");
  assert.equal(f.p.diagnostic.lastErrorCode, "LISTING_STATE_UNKNOWN");
  assert.equal(f.p.listingCount, null);
  assert.deepEqual(f.p.links, []);
  assert.equal(reads, 0);
});

test("refresh/read during connect are explicitly blocked, never represented as a refresh", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const f = fixture({
    openLogin: async () => {
      await gate;
      return {};
    },
  });
  const connect = f.manager.connect(f.p);
  assert.equal(f.manager.operation(f.p.id), "connect");
  assert.deepEqual(await f.manager.refresh(f.p), { blocked: true, operation: "connect" });
  assert.deepEqual(await f.manager.read(f.p), { blocked: true, operation: "connect" });
  release();
  await connect;
  assert.equal(f.manager.operation(f.p.id), null);
});
test("nonzero marketplace count and no owned links is an extraction failure, never a zero sync", async () => {
  const f = fixture({
    listings: async () => ({
      ...f.evidence,
      visibleListingCount: 7,
      links: [],
      listingStateKnown: false,
    }),
  });
  await f.manager.refresh(f.p);
  assert.equal(f.p.status, "ERROR");
  assert.equal(f.p.diagnostic.lastErrorCode, "EXTRACTION_FAILED");
  assert.equal(f.p.lastSyncAt, undefined);
});
test("known empty account is distinct from unknown, and incomplete pagination fails clearly", async () => {
  const empty = fixture({
    listings: async () => ({ ...empty.evidence, visibleListingCount: 0, links: [] }),
  });
  await empty.manager.refresh(empty.p);
  assert.equal(empty.p.status, "CONNECTED");
  assert.equal(empty.p.listingCount, 0);
  const partial = fixture({
    listings: async () => ({ ...partial.evidence, visibleListingCount: 7 }),
  });
  await partial.manager.refresh(partial.p);
  assert.equal(partial.p.diagnostic.lastErrorCode, "LISTING_COUNT_MISMATCH");
  assert.equal(partial.p.links.length, 1);
  assert.equal(partial.p.lastSyncAt, undefined);
});
