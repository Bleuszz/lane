import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../src/lib/auth/return-path.ts";
test("desktop pairing survives login and rejects external redirect targets", () => {
  assert.equal(safeReturnPath("/devices?pair=abc&code=123"), "/devices?pair=abc&code=123");
  for (const value of [
    undefined,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/login?returnTo=/login",
    "/api/desktop/pair",
    "/\r\nevil",
  ]) {
    assert.equal(safeReturnPath(value), "/onboarding");
  }
});
