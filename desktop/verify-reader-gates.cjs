// Rendered DOM fixtures in actual Electron; no marketplace traffic or real credentials.
const { app, BrowserWindow, session } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { readScript } = require("./session-reader.cjs");
app.setPath("userData", fs.mkdtempSync(path.resolve(__dirname, "../artifacts/reader-gates-")));
app
  .whenReady()
  .then(async () => {
    const s = session.fromPartition("reader-gates");
    let html = "";
    s.protocol.handle(
      "https",
      () => new Response(html, { headers: { "Content-Type": "text/html" } }),
    );
    const win = new BrowserWindow({
      show: false,
      webPreferences: { session: s, sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    async function read(market, url, page, identity = null) {
      html = page;
      await win.loadURL(url);
      return win.webContents.executeJavaScript(readScript(market, identity));
    }
    let e = await read(
      "ebay_uk",
      "https://www.ebay.co.uk/sh/lst/active",
      '<title>Manage active listings</title><header id="gh"><span id="gh_user">Hi Fixture!</span></header><main id="shlistings-cntr"><h2>Manage active listings(7)</h2><a href="https://www.ebay.co.uk/itm/123456789012">Item</a></main>',
    );
    assert.equal(e.identity, null);
    assert.equal(e.authenticated, false);
    assert.equal(e.visibleListingCount, 7);
    e = await read(
      "ebay_uk",
      "https://www.ebay.co.uk/sh/lst/active",
      '<title>Manage active listings</title><header id="gh"><a href="/usr/seller-fixture">Profile</a><a href="/logout">Sign out</a></header><main id="shlistings-cntr"><h2>Manage active listings(0)</h2></main>',
    );
    assert.equal(e.identity, "ebay:seller-fixture");
    assert.equal(e.authenticated, true);
    assert.equal(e.listingStateKnown, true);
    assert.equal(e.links.length, 0);
    const header =
      '<header><a href="/member/456-fixture">My profile</a><a href="/inbox">Inbox</a></header>';
    e = await read("vinted_uk", "https://www.vinted.co.uk/inbox", header + "<main>Messages</main>");
    assert.equal(e.identity, "vinted:456");
    assert.equal(e.protectedPage, true);
    e = await read(
      "vinted_uk",
      "https://www.vinted.co.uk/member/456-fixture",
      header + '<main><a href="/items/123-fixture">Item</a></main>',
      "vinted:456",
    );
    assert.equal(e.ownPage, true);
    assert.equal(e.links[0].remoteId, "123");
    e = await read(
      "vinted_uk",
      "https://www.vinted.co.uk/member/789-foreign",
      header + '<main><a href="/items/123-fixture">Item</a></main>',
      "vinted:456",
    );
    assert.equal(e.ownPage, false);
    assert.equal(e.links.length, 0);
    console.log(
      "PASS: Electron DOM gates reject greeting identity, distinguish empty eBay listings, and enforce Vinted wardrobe ownership (fixtures only).",
    );
    app.quit();
  })
  .catch(() => {
    console.error("FAIL: reader gate fixture");
    app.exit(1);
  });
