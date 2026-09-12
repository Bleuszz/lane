import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import { parse } from "yaml";
import { postgresOptions } from "../src/lib/postgres-options.ts";
import { deploymentPolicy } from "../src/lib/auth/deployment.ts";
import { releaseFeatures } from "../src/lib/release-features.ts";
import { limitedBody } from "../src/lib/request-body.ts";
import { safeLog } from "../src/lib/safe-log.ts";
import { databaseError } from "../src/lib/database-error.ts";
test("database failures preserve only conflict codes, not SQL or private detail", () => {
  const error = databaseError({
    message: "postgres://private-password@host/db",
    detail: "customer secret",
    query: "select private",
    code: "23505",
  });
  assert.equal(error.code, "23505");
  assert.ok(!error.message.includes("private"));
  assert.equal(error.detail, undefined);
});
test("remote database TLS cannot be downgraded or redirected through URL parameters", () => {
  for (const suffix of [
    "?sslmode=disable",
    "?sslmode=no-verify",
    "?host=evil.example",
    "?sslrootcert=/secret",
  ])
    assert.throws(() => postgresOptions("postgres://u:p@db.example/lane" + suffix));
  const config = postgresOptions("postgres://u:p@db.example/lane?sslmode=require");
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(new URL(config.connectionString).searchParams.get("sslmode"), "verify-full");
  for (const invalid of [undefined, "secret-value", "https://example.com/a"])
    assert.throws(
      () => postgresOptions(invalid),
      (e) => !e.message.includes("secret-value"),
    );
});
test("production rejects placeholder secrets, unsafe TLS and indexing on staging", () => {
  const valid = {
    LANE_ENV: "production",
    BETTER_AUTH_URL: "https://lane.example",
    DATABASE_URL: "postgres://localhost/lane",
    BETTER_AUTH_SECRET: "1586eb1f019a49f2abe4c37d72508ade81964222e1d4936f5a4873dcb0991248",
    VITE_AUTH_ENABLED: "true",
  };
  for (const secret of [
    "x".repeat(40),
    "change-me-to-a-long-secret-before-production",
    "development-only-secret-123456789",
  ])
    assert.throws(() => deploymentPolicy({ ...valid, BETTER_AUTH_SECRET: secret }));
  assert.throws(() => deploymentPolicy({ ...valid, NODE_TLS_REJECT_UNAUTHORIZED: "0" }));
  assert.throws(() =>
    deploymentPolicy({
      ...valid,
      PUBLIC_INDEXING: "true",
      BETTER_AUTH_URL: "https://lane.onrender.com",
    }),
  );
  assert.throws(() => deploymentPolicy({ ...valid, PUBLIC_INDEXING: "true", LANE_ENV: "staging" }));
  assert.equal(deploymentPolicy({ ...valid, PUBLIC_INDEXING: "true" }).deployed, true);
});
test("all unfinished controls default off; production cannot expose mock AI", () => {
  assert.deepEqual(releaseFeatures({}), { ai: false, scheduler: false, images: false });
  assert.equal(
    releaseFeatures({
      LANE_ENV: "production",
      AI_MOCK_DEVELOPMENT: "true",
      AI_IMAGE_ENABLED: "true",
    }).ai,
    false,
  );
  assert.equal(
    releaseFeatures({
      LANE_ENV: "staging",
      AI_MOCK_DEVELOPMENT: "true",
      AI_LISTING_ENABLED: "true",
    }).ai,
    true,
  );
});
test("request limits bound streamed bytes, not characters or a trusted length header", async () => {
  assert.equal(
    await limitedBody(new Request("https://lane.example", { method: "POST", body: "abc" }), 3),
    "abc",
  );
  await assert.rejects(
    limitedBody(new Request("https://lane.example", { method: "POST", body: "££" }), 3),
    /REQUEST_TOO_LARGE/,
  );
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(4097));
      c.close();
    },
  });
  await assert.rejects(
    limitedBody(
      new Request("https://lane.example", { method: "POST", body, duplex: "half" }),
      4096,
    ),
    /REQUEST_TOO_LARGE/,
  );
});
test("structured logger rejects arbitrary secret context", () => {
  const prior = console.error;
  let output = "";
  console.error = (s) => (output = s);
  try {
    safeLog("BAD_URL https://secret.example", "error", {
      category: "cookie=secret",
      password: "private",
      status: 503,
    });
  } finally {
    console.error = prior;
  }
  assert.ok(!output.includes("secret") && !output.includes("private"));
  assert.equal(JSON.parse(output).code, "INTERNAL_ERROR");
});
test("Render Blueprint validates against pinned public schema and requires no optional secrets", () => {
  const schema = JSON.parse(readFileSync("scripts/schemas/render.json", "utf8"));
  const ajv = new Ajv({ strict: false, validateFormats: false });
  const validate = ajv.compile(schema);
  const blueprint = parse(readFileSync("render.yaml", "utf8"));
  assert.ok(validate(blueprint), JSON.stringify(validate.errors));
  assert.equal(blueprint.services.length, 1);
  const service = blueprint.services[0];
  assert.equal(service.plan, "free");
  assert.equal(service.runtime, "node");
  assert.equal(service.rootDir, ".");
  assert.equal(service.branch, "codex/lane-smart-crosslisting");
  assert.equal(service.healthCheckPath, "/api/health");
  assert.equal(service.buildCommand, "npm ci && npm run build:node");
  assert.equal(service.startCommand, "node scripts/start-server.mjs");
  const vars = Object.fromEntries(service.envVars.map((v) => [v.key, v]));
  for (const k of [
    "AI_LISTING_ENABLED",
    "AI_IMAGE_ENABLED",
    "AI_MOCK_DEVELOPMENT",
    "SCHEDULER_ENABLED",
    "BULK_AUTOMATION_ENABLED",
    "IMAGE_NORMALIZATION_ENABLED",
    "LANE_BILLING_V2_READY",
    "PUBLIC_INDEXING",
  ])
    assert.equal(vars[k].value, "false", k);
  assert.equal(vars.DATABASE_URL.sync, false);
  assert.equal(vars.BETTER_AUTH_SECRET.generateValue, true);
  assert.deepEqual(
    service.envVars.filter((v) => v.sync === false).map((v) => v.key),
    ["DATABASE_URL"],
  );
});
