// Local real PostgreSQL + actual browser forms. No production accounts or emails.
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { Pool } from "pg";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = process.env.LANE_PROOF_ORIGIN || "http://localhost:8080";
if (!["http://localhost:8080", "https://localhost:8443"].includes(base))
  throw Error("Only isolated local proof origins allowed");
if (!process.env.DATABASE_URL?.includes("127.0.0.1:15439/lane"))
  throw Error("This proof requires the isolated local PostgreSQL fixture");
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
  ignoreHTTPSErrors: base === "https://localhost:8443",
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) console.log("Navigation:", new URL(f.url()).pathname);
});
page.on("pageerror", (e) => console.log("Browser runtime error:", e.name, e.message.slice(0, 180)));
page.on("response", (r) => {
  if (new URL(r.url()).pathname === "/api/auth/sign-out")
    console.log("Sign-out response:", r.status());
});
const email = "lane-proof-" + Date.now() + "@example.invalid",
  password = randomBytes(18).toString("hex");
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes("Segoe"));
  await page.screenshot({ path: "artifacts/phase2-home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/phase2-home-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/signup");
  await page.locator('input[autocomplete="name"]').fill("Lane local acceptance");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL("**/account", { timeout: 30000 });
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.getByText("active", { exact: true }).waitFor();
  if (base.startsWith("https"))
    await page.screenshot({ path: "artifacts/website-qa/account-created.png", fullPage: true });
  const saved = await db.query(
    'select u.id,s.trial_started_at,s.trial_ends_at from "user" u join user_settings s on s.user_id=u.id where email=$1',
    [email],
  );
  assert.equal(saved.rows.length, 1);
  const user = saved.rows[0];
  assert.equal((user.trial_ends_at - user.trial_started_at) / 3600000, 168);
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "__Host-grok-auth.session_token");
  assert.ok(session?.secure && session.httpOnly && session.sameSite === "Lax");
  const verifier = randomBytes(32).toString("base64url");
  const pair = await context.request.post(base + "/api/desktop/pair", {
    data: {
      deviceId: randomUUID(),
      challenge: createHash("sha256").update(verifier).digest("hex"),
    },
  });
  assert.equal(pair.status(), 200);
  const pending = await pair.json();
  await page.goto(base + "/devices?pair=" + pending.id + "&code=" + pending.code);
  await page.getByRole("button", { name: "Approve this device", exact: true }).click();
  await page.getByRole("button", { name: "Approved — return to Desktop", exact: true }).waitFor();
  const exchange = await context.request.post(base + "/api/desktop/exchange", {
    data: { id: pending.id, verifier },
  });
  assert.equal(exchange.status(), 200);
  const device = await exchange.json();
  assert.equal(device.userId, user.id);
  const again = await context.request.post(base + "/api/desktop/exchange", {
    data: { id: pending.id, verifier },
  });
  assert.notEqual(again.status(), 200);
  await page.goto(base + "/devices");
  if (base.startsWith("https"))
    await page.screenshot({ path: "artifacts/website-qa/devices.png", fullPage: true });
  await page.getByRole("button", { name: "Revoke", exact: true }).click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (b) => b.textContent.trim() === "Revoke" && b.disabled,
    ),
  );
  const refresh = await context.request.post(base + "/api/desktop/refresh", {
    data: { refreshToken: device.refreshToken },
  });
  assert.notEqual(refresh.status(), 200);
  await page.goto(base + "/account");
  console.log("Stage: sign out");
  await page.getByRole("button", { name: "Sign out of Lane", exact: true }).click();
  await page.waitForTimeout(1500);
  console.log(
    "Session remains after logout:",
    Boolean((await (await context.request.get(base + "/api/auth/get-session")).json())?.user),
  );
  console.log(
    "Cookie metadata:",
    JSON.stringify(
      (await context.cookies()).map((c) => ({ name: c.name, path: c.path, secure: c.secure })),
    ),
  );
  await page.waitForURL((u) => u.pathname === "/login", { waitUntil: "domcontentloaded" });
  const after = await context.request.get(base + "/api/auth/get-session");
  assert.equal(await after.json(), null);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  console.log("Stage: sign in again");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/account");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  const unchanged = await db.query(
    "select trial_started_at,trial_ends_at from user_settings where user_id=$1",
    [user.id],
  );
  assert.equal(
    unchanged.rows[0].trial_started_at.toISOString(),
    user.trial_started_at.toISOString(),
  );
  const csrf = await context.request.post(base + "/api/auth/sign-out", {
    headers: { origin: "https://untrusted.example" },
    data: {},
  });
  assert.equal(csrf.status(), 403);
  await page.screenshot({ path: "artifacts/phase2-account.png", fullPage: true });
  if (base.startsWith("https")) {
    await page.screenshot({ path: "artifacts/website-qa/account-trial.png", fullPage: true });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    writeFileSync(
      "artifacts/website-qa/account-accessibility.json",
      JSON.stringify(
        axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        null,
        2,
      ),
    );
    await page.goto(base + "/contact");
    await page
      .getByRole("textbox", { name: "Your message" })
      .fill("Synthetic support flow verification. No real customer data.");
    await page.getByRole("button", { name: "Send support request" }).click();
    await page.getByRole("heading", { name: "Your request has been saved." }).waitFor();
    await page.screenshot({ path: "artifacts/website-qa/contact-saved.png", fullPage: true });
    await db.query("insert into items(id,user_id,title,base_price_gbp) values($1,$2,$3,$4)", [
      randomUUID(),
      user.id,
      "Synthetic expiry retention fixture",
      10,
    ]);
    await db.query(
      "update user_settings set trial_ends_at=now()-interval '1 minute' where user_id=$1",
      [user.id],
    );
    await page.goto(base + "/account");
    await page.getByText("ended", { exact: true }).waitFor();
    assert.equal(
      (await db.query("select count(*)::int as n from items where user_id=$1", [user.id])).rows[0]
        .n,
      1,
    );
    await page.screenshot({
      path: "artifacts/website-qa/trial-ended-data-retained.png",
      fullPage: true,
    });
  }
  writeFileSync(
    "artifacts/phase2-account-result.json",
    JSON.stringify(
      {
        passed: true,
        storage: "isolated local PostgreSQL 16 with persistent Docker volume",
        signup: true,
        login: true,
        logout: true,
        trialHours: 168,
        trialNotReset: true,
        sameUserDeviceApproval: true,
        singleUseExchange: true,
        revoke: true,
        secureHttpOnlyCookie: true,
        csrfRejected: true,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: real PostgreSQL/browser signup, login, logout, seven-day trial persistence, same-user device approval, single-use exchange, revocation, secure cookies and CSRF. Local only.",
  );
} catch (e) {
  console.error("Failed page path: " + new URL(page.url()).pathname);
  await page
    .screenshot({ path: "artifacts/phase2-proof-failure.png", fullPage: true, timeout: 5000 })
    .catch(() => {});
  console.error("FAIL: " + e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await db.end();
}
