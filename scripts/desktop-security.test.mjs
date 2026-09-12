import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const {
  laneOrigin,
  marketplaceUrl,
  cookieAllowed,
  profileKey,
  createVault,
  diagnostics,
} = require("../desktop/security.cjs");
test("desktop rejects foreign/insecure origins, cookie suffix attacks and mixed account boundaries", () => {
  assert.equal(laneOrigin("https://lane.example/"), "https://lane.example");
  assert.equal(laneOrigin("http://127.0.0.1:8080", true), "http://127.0.0.1:8080");
  for (const u of [
    "http://lane.example",
    "https://user:secret@lane.example",
    "https://lane.example/path",
    "https://lane.example/?token=secret",
  ])
    assert.throws(() => laneOrigin(u));
  assert.equal(marketplaceUrl("https://www.vinted.co.uk/items/123", "vinted_uk"), true);
  assert.equal(marketplaceUrl("https://www.vinted.co.uk.attacker.test", "vinted_uk"), false);
  assert.equal(cookieAllowed({ domain: ".co.uk" }, "vinted_uk"), false);
  assert.notEqual(profileKey("owner", "ebay_uk", "a"), profileKey("other", "ebay_uk", "a"));
  assert.notEqual(profileKey("owner", "ebay_uk", "a"), profileKey("owner", "ebay_uk", "b"));
});
test("vault refuses unavailable protection, rejects traversal and diagnostics whitelist excludes secrets", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lane-vault-"));
  try {
    const closed = createVault(dir, { isEncryptionAvailable: () => false });
    assert.throws(() => closed.write("settings", { token: "x" }));
    const mock = {
      isEncryptionAvailable: () => true,
      encryptString: (s) => Buffer.from(s).reverse(),
      decryptString: (b) => Buffer.from(b).reverse().toString(),
    };
    const vault = createVault(dir, mock);
    vault.write("settings", { token: "test-only" });
    assert.equal(
      readFileSync(path.join(dir, "settings.vault"), "utf8").includes("test-only"),
      false,
    );
    assert.equal(vault.read("settings").token, "test-only");
    assert.throws(() => vault.read("../escape"));
    vault.remove("settings");
    assert.equal(vault.read("settings"), null);
    const copy = JSON.stringify(
      diagnostics(
        {
          deviceId: "device",
          deviceToken: "secret",
          accessToken: "secret",
          profiles: [
            {
              marketplace: "vinted_uk",
              status: "unknown",
              cookies: "secret",
              identity: "private-name",
            },
          ],
        },
        "0.3.0",
      ),
    );
    assert.equal(copy.includes("secret"), false);
    assert.equal(copy.includes("private-name"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
