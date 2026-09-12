import test from "node:test";
import assert from "node:assert/strict";
import { authConfiguration } from "../src/lib/auth/configuration.ts";
import { waitForAuthPopup } from "../src/lib/auth/popup-wait.ts";
test("preview credentials cannot enable Google on a local or unrelated deployment URL", () => {
  assert.equal(authConfiguration({}, "http://localhost:8080").providers[0].available, false);
  assert.equal(authConfiguration({}, "https://lane.example").providers[0].available, false);
  assert.equal(
    authConfiguration({}, "https://preview.grok-sandbox.com").providers[0].available,
    true,
  );
});
test("direct Google requires credentials and an exact configured callback origin", () => {
  const env = {
    GOOGLE_CLIENT_ID: "fixture",
    GOOGLE_CLIENT_SECRET: "secret",
    BETTER_AUTH_URL: "https://lane.example",
  };
  assert.equal(authConfiguration(env, "https://wrong.example").providers[0].available, false);
  const good = authConfiguration(env, "https://lane.example");
  assert.equal(good.providers[0].providerId, "google");
  assert.equal(good.providers[0].available, true);
  assert.equal(good.providers[1].available, false);
  assert.ok(!JSON.stringify(good).includes("secret"));
});
function popupFixture() {
  const listeners = new Set();
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    },
  };
  const host = {
    location: { origin: "https://lane.example" },
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
    addEventListener: (_t, fn) => listeners.add(fn),
    removeEventListener: (_t, fn) => listeners.delete(fn),
  };
  return { popup, host, listeners, send: (event) => [...listeners].forEach((fn) => fn(event)) };
}
test("popup times out and closes; no infinite spinner or leftover listener", async () => {
  const f = popupFixture();
  await assert.rejects(waitForAuthPopup(f.popup, f.host, 10), /timed out/);
  assert.equal(f.popup.closed, true);
  assert.equal(f.listeners.size, 0);
});
test("popup accepts only same-origin messages from its actual window", async () => {
  const f = popupFixture();
  const promise = waitForAuthPopup(f.popup, f.host, 100);
  const data = { source: "grok-auth-popup", token: "synthetic" };
  f.send({ origin: "https://evil.example", source: f.popup, data });
  f.send({ origin: f.host.location.origin, source: {}, data });
  assert.equal(f.listeners.size, 1);
  f.send({ origin: f.host.location.origin, source: f.popup, data });
  assert.equal(await promise, "synthetic");
  assert.equal(f.listeners.size, 0);
});
test("provider failure and cancellation surface a retryable error", async () => {
  const f = popupFixture();
  const promise = waitForAuthPopup(f.popup, f.host, 100);
  f.send({
    origin: f.host.location.origin,
    source: f.popup,
    data: { source: "grok-auth-popup", token: null, error: "denied" },
  });
  await assert.rejects(promise, /failed or was cancelled/);
});
