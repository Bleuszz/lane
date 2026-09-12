// Actual Electron transport against isolated synthetic responses; no marketplace network calls.
const { app, safeStorage, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { createVault, profileKey } = require("./security.cjs");
const { createSessionTransport } = require("./session-transport.cjs");
const { createConnectionManager } = require("./connection-manager.cjs");
const directory = fs.mkdtempSync(path.resolve(__dirname, "../artifacts/session-flow-"));
app.setPath("userData", directory);
app
  .whenReady()
  .then(async () => {
    const keepAlive = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    const vault = createVault(path.join(directory, "protected"), safeStorage),
      runtimes = new Map();
    const transport = createSessionTransport({ vault, runtimes, showLoginWindows: false });
    const p = {
      id: "fixture",
      marketplace: "ebay_uk",
      key: profileKey("fixture", "ebay_uk", "fixture"),
      status: "DISCONNECTED",
      links: [],
      items: [],
    };
    const r = await transport.runtime(p);
    let signedIn = false;
    const page = (url) =>
      signedIn
        ? `<title>Manage active listings - eBay Seller Hub</title><header id="gh"><span class="gh-identity"><span class="gh-identity__greeting" onmouseover="this.parentElement.querySelector('.gh-identity__dialog').innerHTML='&lt;a href=https://www.ebay.co.uk/usr/fixture-seller&gt;Profile&lt;/a&gt;&lt;a href=https://www.ebay.co.uk/logout&gt;Sign out&lt;/a&gt;'">Hello Fixture</span><div class="gh-identity__dialog"></div></span><div id="gh_user"></div></header><main id="shlistings-cntr"><h2>Manage active listings(2)</h2><a href="https://www.ebay.co.uk/itm/${url.includes("page=2") ? "123456789013" : "123456789012"}">Fixture sweater</a>${url.includes("page=2") ? "" : '<a rel="next" href="https://www.ebay.co.uk/sh/lst/active?page=2">Next</a>'}</main>`
        : '<title>Sign in</title><main><input type="password"></main>';
    r.session.protocol.handle("https", (request) => {
      const detail = request.url.includes("/itm/")
        ? '<script type="application/ld+json">{"@type":"Product","name":"Fixture sweater","offers":{"price":"10","priceCurrency":"GBP"}}</script>'
        : "";
      return new Response(page(request.url) + detail, { headers: { "Content-Type": "text/html" } });
    });
    for (const [name, fn] of Object.entries(transport))
      if (typeof fn === "function")
        transport[name] = async (...args) => {
          try {
            return await fn(...args);
          } catch (e) {
            console.error("Fixture transport " + name + ": " + e.message);
            throw e;
          }
        };
    const states = [];
    const manager = createConnectionManager(transport, {
      changed: (profile) => states.push(profile.status),
      pollMs: 20,
      loginTimeout: 10000,
    });
    const pending = manager.connect(p);
    for (let i = 0; i < 100 && !r.window; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(r.window);
    const login = r.window;
    for (let i = 0; i < 100 && p.status !== "WAITING_FOR_USER_LOGIN"; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(p.status, "WAITING_FOR_USER_LOGIN");
    assert.notEqual(p.status, "CONNECTED");
    await r.session.cookies.set({
      url: "https://www.ebay.co.uk",
      name: "fixture_session",
      value: "synthetic-only",
      secure: true,
      httpOnly: true,
    });
    signedIn = true;
    await login.loadURL("https://www.ebay.co.uk/sh/lst/active");
    await pending;
    assert.equal(p.status, "CONNECTED");
    assert.equal(p.listingCount, 2);
    assert.equal(p.identity, "ebay:fixture-seller");
    assert.equal(p.diagnostic.visibleSessionMatches, true);
    assert.equal(p.diagnostic.backgroundSessionMatches, true);
    assert.equal(p.diagnostic.cookiesAfterLoginClosed, 1);
    assert.equal(r.session, require("electron").session.fromPartition(p.diagnostic.sessionId));
    assert.equal(login.isDestroyed(), true);
    assert.ok(vault.read(p.key).cookies.length);
    await manager.refresh(p);
    assert.equal(p.status, "CONNECTED");
    assert.equal(r.window, null);
    assert.equal(r.windows.size, 0);
    await manager.read(p);
    assert.equal(p.items.length, 2);
    assert.deepEqual(
      p.items.map((i) => i.remoteId),
      ["123456789012", "123456789013"],
    );
    assert.equal(r.window, null);
    signedIn = false;
    await manager.refresh(p);
    assert.equal(p.status, "SESSION_EXPIRED");
    assert.equal(r.window, null);
    await manager.disconnect(p);
    assert.equal(p.status, "DISCONNECTED");
    assert.equal(vault.read(p.key), null);
    assert.equal((await r.session.cookies.get({})).length, 0);
    console.log(
      "PASS: actual Electron windows/cookies validate before connected, auto-close, refresh invisibly, reject expired auth and disconnect cleanly (synthetic responses only).",
    );
    app.quit();
  })
  .catch((error) => {
    console.error("FAIL: Electron session-flow check: " + error.stack);
    app.exit(1);
  });
