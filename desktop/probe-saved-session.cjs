// One read-only diagnostic of installed Lane's existing encrypted session. No values/logged page text.
const { app, safeStorage, BrowserWindow } = require("electron");
const path = require("node:path");
const { createVault } = require("./security.cjs");
const { createSessionTransport } = require("./session-transport.cjs");
app.setPath("userData", path.join(app.getPath("appData"), "Lane"));
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else
  app
    .whenReady()
    .then(async () => {
      const keepAlive = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, nodeIntegration: false },
      });
      const vault = createVault(path.join(app.getPath("userData"), "protected"), safeStorage);
      const state = vault.read("settings");
      const transport = createSessionTransport({ vault, runtimes: new Map(), supportMode: true });
      for (const original of state?.profiles || []) {
        if (process.argv.includes("--ebay-only") && original.marketplace !== "ebay_uk") continue;
        const p = { ...original, identity: null, diagnostic: {}, status: "DIAGNOSTIC_ONLY" };
        const result = await transport.probe(p, AbortSignal.timeout(30000));
        delete result.cookies;
        console.log(JSON.stringify(result));
      }
      console.log(
        "Saved-session diagnostic complete. Original vault unchanged; no visible login or writes.",
      );
      app.quit();
    })
    .catch(() => {
      console.error("Saved-session probe unavailable; no private exception details emitted.");
      app.exit(1);
    });
