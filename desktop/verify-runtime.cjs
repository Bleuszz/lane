const { app, BrowserWindow, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createVault } = require("./security.cjs");
app
  .whenReady()
  .then(async () => {
    const dir = path.resolve(__dirname, "../artifacts/desktop-runtime");
    const vault = createVault(dir, safeStorage);
    assert.equal(safeStorage.isEncryptionAvailable(), true);
    vault.write("verification", { cookie: "synthetic-secret-only" });
    assert.equal(
      fs
        .readFileSync(path.join(dir, "verification.vault"))
        .includes(Buffer.from("synthetic-secret-only")),
      false,
    );
    assert.equal(
      createVault(dir, safeStorage).read("verification").cookie,
      "synthetic-secret-only",
    );
    vault.remove("verification");
    const win = new BrowserWindow({
      show: false,
      width: 256,
      height: 256,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    await win.loadURL(
      "data:text/html," +
        encodeURIComponent(
          '<html><body style="margin:0;background:#243f35;display:grid;place-items:center;height:100vh"><svg width="170" height="170" viewBox="0 0 20 20"><rect x="4" y="2.5" width="2.4" height="15" fill="#f4f2ed"/><rect x="13.6" y="2.5" width="2.4" height="15" fill="#f4f2ed"/></svg></body></html>',
        ),
    );
    const png = (await win.webContents.capturePage()).resize({ width: 256, height: 256 }).toPNG();
    fs.mkdirSync(path.join(__dirname, "assets"), { recursive: true });
    fs.writeFileSync(path.join(__dirname, "assets/lane.png"), png);
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(22, 18);
    fs.writeFileSync(path.join(__dirname, "assets/lane.ico"), Buffer.concat([header, png]));
    console.log(
      "PASS: Windows protected storage round trip; plaintext absent; existing Lane vector mark packaged as icon.",
    );
    win.destroy();
    app.quit();
  })
  .catch(() => {
    console.error("FAIL: desktop runtime verification");
    app.exit(1);
  });
