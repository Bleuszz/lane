import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const origin = "https://localhost:8443";
const dir = "artifacts/website-qa";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const paths = [
  "/",
  "/features",
  "/pricing",
  "/how-it-works",
  "/download",
  "/signup",
  "/login",
  "/help",
  "/privacy",
  "/terms",
  "/security",
  "/contact",
  "/legal/cookies",
];
const result = {
  label: "LOCAL PRODUCTION BUILD",
  origin,
  at: new Date().toISOString(),
  pages: [],
  links: [],
  failures: [],
};
const links = new Set();
const titles = new Set(),
  descriptions = new Set();
try {
  // The local TLS proxy can listen while startup migrations/Node are still starting.
  // Do not mistake its deliberate 503 placeholder for a page rendering failure.
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const health = await ctx.request.get(origin + "/api/health").catch(() => null);
    if (health?.status() === 200) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, "Local production server must be healthy before browser QA");
  for (const path of paths) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto(origin + path, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, "Public page response: " + path);
    await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes("Segoe"));
    await page.waitForTimeout(150);
    const slug = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
    const status = response.status(),
      title = await page.title(),
      description = await page.locator('meta[name="description"]').last().getAttribute("content");
    if (status !== 200) result.failures.push(path + ": HTTP " + status);
    if (titles.has(title)) result.failures.push(path + ": duplicate title");
    titles.add(title);
    if (!["/login", "/signup"].includes(path)) {
      if (descriptions.has(description)) result.failures.push(path + ": duplicate description");
      descriptions.add(description);
    }
    if ((await page.locator("h1").count()) !== 1) result.failures.push(path + ": expected one h1");
    await page.screenshot({ path: dir + "/" + slug + "-desktop.png", fullPage: true });
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const violations = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    }));
    if (violations.length)
      result.failures.push(path + ": accessibility " + violations.map((v) => v.id).join(","));
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    for (const text of ld) {
      const json = JSON.parse(text);
      assert.equal(json["@context"], "https://schema.org");
      assert.ok(!text.includes("aggregateRating"));
    }
    for (const href of await page
      .locator("a[href]")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")))) {
      if (href?.startsWith("/") && !href.startsWith("//"))
        links.add(new URL(href, origin).pathname);
    }
    const widths = [];
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      widths.push({ width, overflow });
      if (overflow) result.failures.push(path + ": overflow " + width);
      if (width === 390 || (path === "/" && width === 320))
        await page.screenshot({ path: dir + "/" + slug + "-" + width + ".png", fullPage: true });
    }
    result.pages.push({
      path,
      status,
      title,
      description,
      violations,
      widths,
      structuredData: ld.length,
    });
  }
  for (const path of links) {
    const r = await ctx.request.get(origin + path);
    result.links.push({ path, status: r.status() });
    if (r.status() >= 400) result.failures.push("Broken link " + path + ": " + r.status());
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const missing = await page.goto(origin + "/this-lane-page-does-not-exist", {
    waitUntil: "networkidle",
  });
  assert.equal(missing.status(), 404);
  await page.screenshot({ path: dir + "/404-desktop.png", fullPage: true });
  assert.ok(await page.getByRole("heading", { name: "This one has moved on." }).count());
  const sitemap = await (await ctx.request.get(origin + "/sitemap.xml")).text();
  assert.ok(sitemap.includes(origin + "/features"));
  assert.ok(!sitemap.includes("<loc>" + origin + "/account"));
  const robots = await (await ctx.request.get(origin + "/robots.txt")).text();
  assert.ok(robots.includes("Disallow: /account"));
  assert.ok(robots.includes("Sitemap: " + origin));
  const health = await ctx.request.get(origin + "/api/health");
  assert.equal(health.status(), 200);
  const anon = await ctx.request.get(origin + "/api/auth/get-session");
  assert.equal(await anon.json(), null);
  const wrong = await ctx.request.post(origin + "/api/measurement", {
    headers: { origin: "https://wrong.example" },
    data: { event: "signup_completed" },
  });
  assert.equal(wrong.status(), 403);
  const extra = await ctx.request.post(origin + "/api/measurement", {
    headers: { origin },
    data: { event: "signup_completed", email: "must-not-be-stored" },
  });
  assert.equal(extra.status(), 400);
  const event = await ctx.request.post(origin + "/api/measurement", {
    headers: { origin },
    data: { event: "signup_started" },
  });
  assert.equal(event.status(), 204);
  result.passed = result.failures.length === 0;
  console.log(
    JSON.stringify(
      {
        passed: result.passed,
        pages: result.pages.length,
        links: result.links.length,
        failures: result.failures,
      },
      null,
      2,
    ),
  );
  if (!result.passed) process.exitCode = 1;
} finally {
  writeFileSync(dir + "/results.json", JSON.stringify(result, null, 2));
  await browser.close();
}
