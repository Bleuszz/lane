// Actual Electron, isolated synthetic pages: delayed hydration and a resource that never finishes.
const { app, BrowserWindow, safeStorage } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createVault, profileKey } = require("./security.cjs");
const { createSessionTransport } = require("./session-transport.cjs");
const { createConnectionManager } = require("./connection-manager.cjs");
const { safeRoute } = require("./vinted-readiness.cjs");
const directory = fs.mkdtempSync(path.resolve(__dirname, "../artifacts/vinted-readiness-"));
app.setPath("userData", directory);
setTimeout(() => app.exit(2), 45000).unref();
app
  .whenReady()
  .then(async () => {
    const keepAlive = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    const vault = createVault(path.join(directory, "protected"), safeStorage);
    const transport = createSessionTransport({
      vault,
      runtimes: new Map(),
      showLoginWindows: false,
    });
    const p = {
      id: "vinted-fixture",
      key: profileKey("fixture", "vinted_uk", "readiness"),
      marketplace: "vinted_uk",
      status: "DISCONNECTED",
      links: [],
      items: [],
    };
    const r = await transport.runtime(p);
    let mode = "signed-in",
      windows = 0,
      finished = 0;
    app.on("browser-window-created", (_e, w) => {
      windows++;
      w.webContents.on("did-finish-load", () => finished++);
    });
    r.session.protocol.handle("https", (request) => {
      const u = new URL(request.url);
      if (u.pathname === "/pending.png")
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
            },
          }),
          { headers: { "Content-Type": "image/png" } },
        );
      const owner = mode === "mismatch" ? "999" : "456";
      let html =
        mode === "expired"
          ? '<input type="password">'
          : mode === "challenge"
            ? "<h1>Verify you are human</h1>"
            : `<header><a href="/inbox">Inbox</a><button data-testid="user-menu-button">Account</button><span id="menu"></span></header><script>setTimeout(()=>{document.querySelector('button').onclick=()=>{document.getElementById('menu').innerHTML='<a href="/member/${owner}-fixture">My profile</a>';};history.replaceState({},'',location.pathname);},900);</script>`;
      html += "<main></main>";
      if (u.pathname.startsWith("/member/"))
        html += `<script>setTimeout(()=>document.querySelector('main').innerHTML='<a href="/items/123-fixture">Fixture</a>',2200);</script>`;
      if (u.pathname.startsWith("/items/"))
        html += `<script>setTimeout(()=>{const s=document.createElement('script');s.type='application/ld+json';s.textContent=JSON.stringify({'@type':'Product',name:'Fixture',offers:{price:'12',priceCurrency:'GBP'},image:['https://www.vinted.co.uk/photo-a.jpg','https://www.vinted.co.uk/photo-b.jpg']});document.body.appendChild(s);},2200);</script>`;
      return new Response(html + '<img src="/pending.png">', {
        headers: { "Content-Type": "text/html" },
      });
    });
    await r.session.cookies.set({
      url: "https://www.vinted.co.uk",
      name: "fixture_session",
      value: "synthetic-only",
      secure: true,
      httpOnly: true,
    });
    const manager = createConnectionManager(transport, { pollMs: 20, loginTimeout: 10000 });
    await manager.connect(p);
    assert.equal(p.status, "CONNECTED");
    assert.equal(p.identity, "vinted:456");
    assert.equal(p.listingCount, 1);
    assert.equal(p.diagnostic.visibleSessionMatches, true);
    assert.equal(p.diagnostic.backgroundSessionMatches, true);
    assert.equal(p.diagnostic.cookiesAfterLoginClosed, 1);
    assert.equal(r.window, null);
    assert.equal(r.windows.size, 0);
    assert.equal(finished, 0, "fixture must genuinely keep did-finish-load pending");
    assert.ok(vault.read(p.key).cookies.length);
    await manager.refresh(p);
    assert.equal(p.status, "CONNECTED");
    assert.equal(r.window, null);
    await manager.read(p);
    assert.equal(p.items.length, 1);
    assert.deepEqual(p.items[0].photoUrls, [
      "https://www.vinted.co.uk/photo-a.jpg",
      "https://www.vinted.co.uk/photo-b.jpg",
    ]);
    assert.equal(p.items[0].sizeLabel, null);
    mode = "mismatch";
    await manager.refresh(p);
    assert.equal(p.diagnostic.lastErrorCode, "ACCOUNT_CHANGED");
    mode = "challenge";
    await manager.refresh(p);
    assert.equal(p.status, "RECONNECT_REQUIRED");
    mode = "expired";
    await manager.refresh(p);
    assert.equal(p.status, "SESSION_EXPIRED");
    assert.equal(r.window, null);
    await manager.disconnect(p);
    assert.equal(vault.read(p.key), null);
    assert.equal((await r.session.cookies.get({})).length, 0);
    assert.equal(safeRoute("https://www.vinted.co.uk/inbox/123?token=secret"), "/inbox/:id");
    assert.equal(safeRoute("https://example.com/private"), "outside_marketplace");
    console.log(
      "PASS: Vinted delayed hydration + never-finished load; validated same-session identity, auto-close, hidden wardrobe/detail reads, photo order, unknown fields, account mismatch, challenge, expiry, disconnect (" +
        windows +
        " fixture windows).",
    );
    app.quit();
  })
  .catch((e) => {
    console.error("FAIL Vinted readiness fixture: " + e.stack);
    app.exit(1);
  });
