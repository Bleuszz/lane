import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { PUBLIC_PAGES } from "../src/lib/lane/public-site.ts";
export async function freshBrowserProof({ base, db, dir, commit, restart }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.name));
  async function shot(name) {
    await page.evaluate(
      (label) => {
        document.getElementById("qa-label")?.remove();
        const el = document.createElement("div");
        el.id = "qa-label";
        el.textContent = label;
        el.style.cssText =
          "position:fixed;bottom:0;right:0;z-index:99999;background:#fff;color:#111;padding:5px;font:11px monospace;pointer-events:none";
        document.body.append(el);
      },
      "LOCAL PRODUCTION BUILD · " + commit.slice(0, 8) + " · " + new Date().toISOString(),
    );
    await page.screenshot({ path: join(dir, name + ".png"), fullPage: true });
  }
  const post = (path, data, headers = {}) =>
    context.request.post(base + path, { data, headers: { origin: base, ...headers } });
  try {
    const health = await (await context.request.get(base + "/api/health")).json();
    assert.equal(health.database, "ok");
    assert.equal(health.build.commit, commit);
    assert.ok(health.build.builtAt && health.build.version);
    const config = await (await context.request.get(base + "/api/auth/configuration")).json();
    assert.equal(config.enabled, true);
    assert.equal(config.passwordResetAvailable, false);
    assert.ok(config.providers.every((p) => !p.available));
    assert.deepEqual(config.features, { ai: false, scheduler: false, images: false });
    assert.equal(
      (
        await post("/api/auth/request-password-reset", { email: "unused@example.invalid" })
      ).status(),
      503,
    );
    assert.equal((await post("/api/auth/sign-in/social", { provider: "google" })).status(), 503);
    const titles = new Set(),
      descriptions = new Set(),
      links = new Set();
    for (const path of [...Object.keys(PUBLIC_PAGES), "/signup", "/login", "/forgot-password"]) {
      const response = await page.goto(base + path, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, path);
      assert.equal(response.headers()["x-robots-tag"], "noindex, nofollow");
      assert.equal(response.headers()["x-frame-options"], "DENY");
      assert.equal(response.headers()["x-content-type-options"], "nosniff");
      assert.ok(response.headers()["content-security-policy"]?.includes("frame-ancestors 'none'"));
      assert.ok(response.headers()["strict-transport-security"]);
      assert.ok(response.headers()["x-request-id"]);
      if (PUBLIC_PAGES[path]) {
        const title = await page.title(),
          description = await page.locator('meta[name="description"]').getAttribute("content");
        assert.ok(title && !titles.has(title), path + " title");
        titles.add(title);
        assert.ok(description && !descriptions.has(description));
        descriptions.add(description);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), base + path);
        assert.equal(
          await page.locator('meta[property="og:image"]').getAttribute("content"),
          base + "/lane-social.png",
        );
        const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
        schemas.forEach((s) => assert.ok(JSON.parse(s)["@context"]));
      }
      for (const href of await page
        .locator("a[href]")
        .evaluateAll((els) => els.map((a) => a.getAttribute("href")))) {
        assert.ok(
          !/^(file:|[A-Z]:\\)|localhost:8080|127\.0\.0\.1/i.test(href),
          "No development links",
        );
        if (href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0]);
      }
    }
    for (const path of links) {
      const response = await context.request.get(base + path);
      assert.ok(response.status() < 400, "Broken link " + path);
    }
    assert.equal((await context.request.get(base + "/robots.txt")).status(), 200);
    assert.match(
      await (await context.request.get(base + "/robots.txt")).text(),
      /Disallow: \/\s*$/,
    );
    const sitemap = await context.request.get(base + "/sitemap.xml");
    assert.equal(sitemap.status(), 200);
    assert.ok(!(await sitemap.text()).includes("/account"));
    assert.equal((await context.request.get(base + "/lane-social.png")).status(), 200);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base, { waitUntil: "networkidle" });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        "Overflow " + width,
      );
      await shot("home-" + width);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [path, name] of [
      ["/pricing", "pricing"],
      ["/signup", "signup"],
      ["/login", "login"],
      ["/download", "download"],
      ["/not-a-real-lane-page", "404"],
    ]) {
      const response = await page.goto(base + path, { waitUntil: "networkidle" });
      assert.equal(response.status(), name === "404" ? 404 : 200);
      await shot(name);
    }
    const email = "deploy-" + randomUUID() + "@example.invalid",
      password = randomBytes(18).toString("hex");
    await page.goto(base + "/signup");
    await page.locator('input[autocomplete="name"]').fill("Lane release fixture");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/account");
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    await page.getByText("active", { exact: true }).waitFor();
    const row = (
      await db.query(
        'select u.id,s.trial_started_at,s.trial_ends_at from "user" u join user_settings s on s.user_id=u.id where email=$1',
        [email],
      )
    ).rows[0];
    assert.ok(row);
    assert.equal((row.trial_ends_at - row.trial_started_at) / 3600000, 168);
    const cookie = (await context.cookies()).find(
      (c) => c.name === "__Host-grok-auth.session_token",
    );
    assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === "Lax");
    await shot("dashboard-trial");
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    writeFileSync(
      join(dir, "accessibility.json"),
      JSON.stringify(
        axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
        null,
        2,
      ),
    );
    assert.equal(axe.violations.length, 0, "Account accessibility");
    const verifier = randomBytes(32).toString("base64url");
    const pending = await (
      await post("/api/desktop/pair", {
        deviceId: randomUUID(),
        challenge: createHash("sha256").update(verifier).digest("hex"),
      })
    ).json();
    await page.goto(base + "/devices?pair=" + pending.id + "&code=" + pending.code);
    await page.getByRole("button", { name: "Approve this device", exact: true }).click();
    await page.getByRole("button", { name: "Approved — return to Desktop", exact: true }).waitFor();
    const exchange = await post("/api/desktop/exchange", { id: pending.id, verifier });
    assert.equal(exchange.status(), 200);
    const device = await exchange.json();
    assert.equal(device.userId, row.id);
    assert.notEqual(
      (await post("/api/desktop/exchange", { id: pending.id, verifier })).status(),
      200,
    );
    assert.equal(
      (
        await post(
          "/api/desktop/heartbeat",
          { version: "0.3.1", paused: false, vinted: "unknown", ebay: "unknown" },
          { authorization: "Bearer " + device.accessToken },
        )
      ).status(),
      200,
    );
    await page.goto(base + "/devices", { waitUntil: "networkidle" });
    await shot("devices");
    console.log(
      "PASS: fresh signup, secure cookies, seven-day trial and same-account desktop approval. Restarting server.",
    );
    await restart();
    await page.goto(base + "/account");
    await page.getByRole("heading", { name: "Welcome back." }).waitFor();
    assert.equal(
      (await post("/api/desktop/refresh", { refreshToken: device.refreshToken })).status(),
      200,
    );
    await page.goto(base + "/devices");
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent.trim() === "Revoke" && b.disabled,
      ),
    );
    assert.notEqual(
      (await post("/api/desktop/refresh", { refreshToken: device.refreshToken })).status(),
      200,
    );
    assert.notEqual(
      (
        await post(
          "/api/desktop/heartbeat",
          { version: "0.3.1", paused: false, vinted: "unknown", ebay: "unknown" },
          { authorization: "Bearer " + device.accessToken },
        )
      ).status(),
      200,
    );
    for (const route of ["/ai", "/automation", "/image-tools"]) {
      await page.goto(base + route);
      await page.getByRole("heading", { name: "This feature is not available yet." }).waitFor();
      assert.equal(
        await page.locator('a[href="/ai"],a[href="/automation"],a[href="/image-tools"]').count(),
        0,
      );
    }
    await page.goto(base + "/account");
    await page.getByRole("button", { name: "Sign out of Lane", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/login");
    assert.equal(await (await context.request.get(base + "/api/auth/get-session")).json(), null);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/account");
    assert.equal(
      (
        await db.query("select trial_started_at from user_settings where user_id=$1", [row.id])
      ).rows[0].trial_started_at.toISOString(),
      row.trial_started_at.toISOString(),
    );
    assert.equal(
      (await post("/api/auth/sign-out", {}, { origin: "https://untrusted.example" })).status(),
      403,
    );
    await db.query("insert into items(id,user_id,title,base_price_gbp) values($1,$2,$3,10)", [
      randomUUID(),
      row.id,
      "Synthetic retention fixture",
    ]);
    await db.query(
      "update user_settings set trial_ends_at=now()-interval '1 minute' where user_id=$1",
      [row.id],
    );
    await page.goto(base + "/account");
    await page.getByText("ended", { exact: true }).waitFor();
    assert.equal(
      (await db.query("select count(*)::int as n from items where user_id=$1", [row.id])).rows[0].n,
      1,
    );
    const abuse = await Promise.all(
      Array.from({ length: 12 }, () =>
        post("/api/auth/sign-in/email", {
          email: "absent@example.invalid",
          password: "wrong-password-for-fixture",
        }),
      ),
    );
    assert.ok(
      abuse.some((r) => r.status() === 429),
      "Login rate limit",
    );
    assert.equal(errors.length, 0, "Browser runtime errors");
    console.log(
      "PASS: restart persistence, revoke, logout/login, trial retention, feature gates, rate limits, CSRF, public routes/links/SEO and responsive screenshots.",
    );
  } finally {
    await browser.close();
  }
}
