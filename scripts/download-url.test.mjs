import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("download page gates an unreleased installer and excludes legacy portable links", () => {
  const metadata = readFileSync("src/lib/lane/download.ts", "utf8"),
    page = readFileSync("src/routes/download.tsx", "utf8");
  assert.doesNotMatch(metadata, /drive.google.com/);
  assert.match(metadata, /WINDOWS_INSTALLER_URL: string \| null = null/);
  assert.match(page, /WINDOWS_INSTALLER_URL\s*\?/);
  assert.match(page, /Installer release pending/);
  assert.match(page, /unsigned/);
});
