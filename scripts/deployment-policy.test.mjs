import test from "node:test";
import assert from "node:assert/strict";
import { deploymentPolicy } from "../src/lib/auth/deployment.ts";
const valid = {
  LANE_ENV: "staging",
  DATABASE_URL: "postgresql://fixture@localhost/lane",
  BETTER_AUTH_URL: "https://lane.example",
  BETTER_AUTH_SECRET: "x".repeat(40),
  VITE_AUTH_ENABLED: "true",
};
test("hosted Lane fails closed without durable DB, auth or a stable secret", () => {
  for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "VITE_AUTH_ENABLED"])
    assert.throws(() => deploymentPolicy({ ...valid, [key]: "" }));
  for (const url of [
    "http://lane.example",
    "https://lane.example/redirect",
    "https://user:pass@lane.example",
    "https://lane.example?x=1",
  ])
    assert.throws(() => deploymentPolicy({ ...valid, BETTER_AUTH_URL: url }));
  assert.throws(() => deploymentPolicy({ ...valid, LANE_ALLOW_PREVIEW_PLANS: "true" }));
  assert.deepEqual(deploymentPolicy(valid), { deployed: true, origin: "https://lane.example" });
  assert.equal(deploymentPolicy({}).deployed, false);
});
