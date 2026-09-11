// One read-only diagnostic of installed Lane's existing encrypted session. No values/logged page text.
const { app, safeStorage, BrowserWindow } = require("electron");
const path = require("node:path");
const { createVault } = require("./security.cjs");
const { createSessionTransport } = require("./session-transport.cjs");
const { profileDiagnostics } = require("./session-diagnostics.cjs");
const trace = [];
const snapshots = [];
if (process.argv.includes("--vinted-trace"))
  setTimeout(() => {
    console.log("TRACE_DEADLINE: bounded Vinted diagnostic stopped; no vault changes.");
    app.exit(2);
  }, 35000).unref();
if (process.argv.includes("--vinted-trace"))
  app.on("web-contents-created", (_event, wc) => {
    for (const name of [
      "did-start-navigation",
      "did-navigate",
      "did-navigate-in-page",
      "dom-ready",
      "did-finish-load",
    ])
      wc.on(name, () => {
        try {
          const u = new URL(wc.getURL());
          if (!/(^|\.)vinted\.co\.uk$/.test(u.hostname)) return;
          trace.push({ event: name, path: u.pathname.replace(/\d+[^/]*/g, ":id"), at: Date.now() });
          console.log(JSON.stringify(trace.at(-1)));
          if (name === "dom-ready")
            setTimeout(async () => {
              try {
                const menu = await wc.mainFrame.executeJavaScript(
                  `(()=>{const b=document.querySelector('[data-testid="user-menu-button"]');return {button:b?{tag:b.tagName,expanded:b.getAttribute('aria-expanded'),controls:b.getAttribute('aria-controls'),attempted:b.dataset.laneIdentityOpened==='true',children:[...b.querySelectorAll('button,a')].map(n=>({tag:n.tagName,role:n.getAttribute('role')}))}:null,profileLinks:[...document.querySelectorAll('a[href]')].filter(a=>/^\\/member\\/\\d+/.test(a.pathname)).slice(0,10).map(a=>({path:a.pathname.replace(/\\d+[^/]*/g,':id'),inHeader:!!a.closest('header'),parents:[a.parentElement,a.parentElement?.parentElement].map(n=>({tag:n?.tagName,testid:n?.getAttribute('data-testid'),role:n?.getAttribute('role')}))})),menus:[...document.querySelectorAll('[role="menu"],[data-testid*="menu"]')].slice(0,20).map(n=>({tag:n.tagName,testid:n.getAttribute('data-testid'),role:n.getAttribute('role')}))}})()`,
                );
                console.log(JSON.stringify({ postClick: menu }));
              } catch {
                console.log("Post-click metadata unavailable");
              }
            }, 1200);
          if (name === "dom-ready")
            snapshots.push(
              wc.mainFrame
                .executeJavaScript(
                  `(()=>({ready:document.readyState,headers:document.querySelectorAll('header,[data-testid="header"]').length,accountPaths:[...document.querySelectorAll('a[href]')].filter(a=>/^\\/(member|inbox|settings|notifications)/.test(a.pathname)).slice(0,25).map(a=>({path:a.pathname.replace(/\\d+[^/]*/g,':id'),inHeader:!!a.closest('header,[data-testid="header"]')})),testIds:[...document.querySelectorAll('[data-testid]')].map(n=>n.getAttribute('data-testid')).filter(s=>/header|profile|account|user-menu/.test(s)&&/^[a-z-]+$/.test(s)).slice(0,25)}))()`,
                )
                .then((snapshot) => {
                  console.log(JSON.stringify({ snapshot }));
                  return { snapshot };
                })
                .catch(() => ({ snapshotUnavailable: true })),
            );
        } catch {}
      });
  });
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
        if (process.argv.includes("--saved-only")) {
          console.log(JSON.stringify(profileDiagnostics(original)));
          continue;
        }
        if (process.argv.includes("--ebay-only") && original.marketplace !== "ebay_uk") continue;
        if (process.argv.includes("--vinted-only") && original.marketplace !== "vinted_uk")
          continue;
        const p = { ...original, identity: null, diagnostic: {}, status: "DIAGNOSTIC_ONLY" };
        const result = await transport.probe(p, AbortSignal.timeout(30000));
        delete result.cookies;
        console.log(JSON.stringify(result));
        if (process.argv.includes("--vinted-read-proof") && p.marketplace === "vinted_uk") {
          const signal = AbortSignal.timeout(60000);
          const first = await transport.validate(p, signal);
          if (!first.authenticated || !first.protectedPage || !first.identity)
            throw Error("Identity gate");
          p.identity = first.identity;
          p.wardrobeUrl = first.wardrobeUrl;
          const second = await transport.validate(p, signal);
          if (!second.authenticated || second.identity !== p.identity)
            throw Error("Validation gate");
          const wardrobe = await transport.listings(p, second, signal);
          const targets = ["9912534056", "9912518964"];
          const links = (wardrobe.links || []).filter((a) => targets.includes(a.remoteId));
          console.log(
            JSON.stringify({
              proof: "wardrobe",
              sameIdentity: wardrobe.identity === p.identity,
              ownPage: wardrobe.ownPage,
              known: wardrobe.listingStateKnown,
              linksFound: wardrobe.links?.length,
              targetsFound: links.map((a) => a.remoteId),
              page: require("./session-diagnostics.cjs").pageSummary(wardrobe),
            }),
          );
          if (wardrobe.ownPage && wardrobe.identity === p.identity && links.length) {
            const items = await transport.readItems(p, links, signal);
            console.log(
              JSON.stringify({
                proof: "details",
                items: items.map((item) => ({
                  remoteId: item.remoteId,
                  fields: Object.fromEntries(
                    Object.entries(item).map(([k, v]) => [
                      k,
                      Array.isArray(v) ? v.length : v !== null && v !== undefined && v !== "",
                    ]),
                  ),
                })),
              }),
            );
          }
        }
      }
      if (process.argv.includes("--vinted-trace"))
        console.log(
          JSON.stringify({
            navigation: trace.slice(0, 30),
            snapshots: await Promise.all(snapshots),
          }),
        );
      console.log(
        "Saved-session diagnostic complete. Original vault unchanged; no visible login or writes.",
      );
      app.quit();
    })
    .catch(() => {
      console.error("Saved-session probe unavailable; no private exception details emitted.");
      app.exit(1);
    });
