import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:15439/lane"))
  throw Error("Local fixture required");
const base = "https://localhost:8443",
  dir = "artifacts/ai-qa/";
mkdirSync(dir, { recursive: true });
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const email = "ai-proof-" + Date.now() + "@example.invalid",
  password = randomBytes(18).toString("hex");
const external = [];
page.on("request", (r) => {
  if (!r.url().startsWith(base) && !r.url().startsWith("data:"))
    external.push(new URL(r.url()).origin);
});
try {
  for (let i = 0; i < 30; i++) {
    const h = await context.request.get(base + "/api/health").catch(() => null);
    if (h?.status() === 200) break;
    await page.waitForTimeout(1000);
  }
  await page.goto(base + "/signup");
  await page.locator('input[autocomplete="name"]').fill("Lane AI local test");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL("**/account");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  const user = (await db.query('select id from "user" where email=$1', [email])).rows[0].id;
  await page.goto(base + "/ai");
  await page.getByRole("heading", { name: "AI Studio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Generate development preview" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Generate development preview" }).isDisabled(),
    true,
  );
  // Synthetic test account only; no checkout, billing request or owner plan change.
  await db.query(
    "update user_settings set plan='seller',billing_status='active' where user_id=$1",
    [user],
  );
  const item = randomUUID(),
    photo = randomUUID();
  await db.query(
    "insert into items(id,user_id,title,description,brand,base_price_gbp) values($1,$2,'QA sample item','Known original description','Original brand',20)",
    [item, user],
  );
  await db.query(
    "insert into item_photos(id,item_id,user_id,url) values($1,$2,$3,'/lane-social.png')",
    [photo, item, user],
  );
  await page.reload();
  await page.getByLabel("Saved listing", { exact: true }).selectOption(item);
  await page.getByRole("button", { name: "Generate development preview" }).click();
  await page.getByText("[MOCK] Improved listing title", { exact: true }).waitFor();
  const titleCard = page.getByRole("heading", { name: "title", exact: true }).locator("..");
  await titleCard.getByRole("checkbox").check();
  await titleCard.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByText("Review: accepted", { exact: true }).waitFor();
  await page.screenshot({ path: dir + "listing-desktop.png", fullPage: true });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.equal(
    axe.violations.length,
    0,
    JSON.stringify(
      axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  );
  await page.getByRole("button", { name: "Image Studio", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select source photo 1" }).check();
  await page.getByRole("button", { name: "Generate development preview" }).click();
  await page.getByText("No image was generated or transformed.", { exact: true }).waitFor();
  await page.screenshot({ path: dir + "images-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Return to original", exact: true }).click();
  await page.getByAltText("Returned to unmodified original").waitFor();
  await page.getByRole("button", { name: "Delete generated version" }).click();
  await page
    .getByText("No image was generated or transformed.", { exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    (await db.query("select url from item_photos where id=$1", [photo])).rows[0].url,
    "/lane-social.png",
  );
  await page.getByLabel("Mock test outcome").selectOption("RATE_LIMIT");
  await page.getByRole("button", { name: "Generate development preview" }).click();
  await page.getByText("Failed — credits restored", { exact: true }).waitFor();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    if (!fits)
      console.log(
        JSON.stringify(
          await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .map((e) => ({
                tag: e.tagName,
                cls: e.className,
                right: e.getBoundingClientRect().right,
                width: e.getBoundingClientRect().width,
              }))
              .filter((e) => e.right > innerWidth + 1 && e.width > 0)
              .slice(0, 12),
          ),
        ),
      );
    assert.ok(fits, "Overflow at " + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: dir + "images-mobile.png", fullPage: true });
  const rows = (await db.query("select reserved,consumed from ai_wallets where user_id=$1", [user]))
    .rows;
  assert.equal(rows[0].reserved, 0);
  assert.equal(rows[0].consumed, 3);
  assert.equal(
    (await db.query("select title from items where id=$1", [item])).rows[0].title,
    "QA sample item",
  );
  assert.deepEqual(external, []);
  writeFileSync(
    dir + "result.json",
    JSON.stringify(
      {
        label: "LOCAL PRODUCTION BUILD — MOCK AI ENABLED FOR ISOLATED TEST",
        passed: true,
        signup: true,
        trialZero: true,
        listingReview: true,
        imagePreview: true,
        originalPreserved: true,
        failureRefund: true,
        consumed: 3,
        axeViolations: 0,
        widths: [320, 390, 768],
        externalBrowserRequests: external,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: local mock listing/image UX, trial gate, review, refund, original preservation, accessibility and mobile widths. No external requests.",
  );
} catch (e) {
  await page.screenshot({ path: dir + "/failure.png", fullPage: true }).catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await db.end();
}
