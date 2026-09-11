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
    const page = () =>
      signedIn
        ? '<title>Manage active listings - eBay Seller Hub</title><header id="gh"><span id="gh_user">Hi Fixture!</span><a href="https://www.ebay.co.uk/logout">Sign out</a></header><main id="shlistings-cntr"><h1>Manage active listings</h1><a href="https://www.ebay.co.uk/itm/123456789012">Fixture sweater</a></main>'
        : '<title>Sign in</title><main><input type="password"></main>';
    r.session.protocol.handle("https", (request) => {
      return new Response(page(), { headers: { "Content-Type": "text/html" } });
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
    await new Promise((resolve) => setTimeout(resolve, 200));
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
    assert.equal(p.listingCount, 1);
    assert.equal(login.isDestroyed(), true);
    assert.ok(vault.read(p.key).cookies.length);
    await manager.refresh(p);
    assert.equal(p.status, "CONNECTED");
    assert.equal(r.window, null);
    assert.equal(r.windows.size, 0);
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
