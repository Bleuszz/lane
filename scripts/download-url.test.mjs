import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("download.ts points at a Drive file id and a /download route exists", () => {
  const src = readFileSync("src/lib/lane/download.ts", "utf8");
  const id = /WINDOWS_FILE_ID = "([^"]+)"/.exec(src)?.[1];
  assert.ok(id && id.length > 20, "FILE_ID");
  assert.match(src, /uc\?export=download/);
  assert.doesNotMatch(src, /1xA-AdbuV1fZMP9XpfUui6JccytpRS7Vk/);
  const page = readFileSync("src/routes/download.tsx", "utf8");
  assert.match(page, /Download Lane for Windows/);
  assert.match(page, /WINDOWS_DOWNLOAD_URL/);
});
