import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import assert from "node:assert/strict";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:15439/lane"))
  throw Error("Isolated local fixture required");
const base = "https://localhost:8443",
  dir = "artifacts/scheduler-qa/";
mkdirSync(dir, { recursive: true });
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
page.setDefaultTimeout(15000);
const email = "schedule-proof-" + Date.now() + "@example.invalid",
  external = [],
  jsErrors = [];
page.on("request", (r) => {
  if (!r.url().startsWith(base) && !r.url().startsWith("data:"))
    external.push(new URL(r.url()).origin);
});
page.on("pageerror", (e) => jsErrors.push(e.message));
async function audit(name) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.equal(
    result.violations.length,
    0,
    JSON.stringify(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ),
  );
  await page.screenshot({ path: dir + name + ".png", fullPage: true });
}
async function widths(name) {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Overflow at " + width,
    );
    await audit(name + "-" + width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  const guest=await context.request.get(base+'/automation',{maxRedirects:0});
  assert.ok([302,307].includes(guest.status()),'Private route must redirect before hydration');
  assert.ok(guest.headers().location.includes('/login'));
  await page.goto(base+'/automation');await page.waitForURL('**/login**');
  await page.goto(base + "/signup");
  await page.locator('input[autocomplete="name"]').fill("Lane scheduler local test");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(randomBytes(18).toString("hex"));
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL("**/account");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  const user = (await db.query('select id from "user" where email=$1', [email])).rows[0].id,
    item = randomUUID(),
    photo = randomUUID(),
    account = randomUUID();
  const image = await sharp({
      create: { width: 360, height: 240, channels: 3, background: "#bc8899" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer(),
    source = "data:image/jpeg;base64," + image.toString("base64");
  await db.query(
    "insert into items(id,user_id,title,description,base_price_gbp) values($1,$2,'QA source item','Original condition preserved',20)",
    [item, user],
  );
  await db.query("insert into item_photos(id,user_id,item_id,url) values($1,$2,$3,$4)", [
    photo,
    user,
    item,
    source,
  ]);
  await db.query(
    "insert into marketplace_accounts(id,user_id,marketplace,mode,label,status) values($1,$2,'vinted_uk','extension','Synthetic Vinted account','green')",
    [account, user],
  );
  await page.goto(base + "/automation");
  await page.getByRole("heading", { name: "Work at your pace." }).waitFor();
  await page.getByText("Scheduler test environment", { exact: true }).waitFor();
  if (!(await page.locator("details").evaluate((e) => e.open)))
    await page.locator("summary").click();
  await page.getByRole("checkbox", { name: /Enable scheduling/ }).check();
  await page.getByLabel("Timezone", { exact: true }).fill("UTC");
  await page.getByLabel("Active from", { exact: true }).fill("00:00");
  await page.getByLabel("Active until", { exact: true }).fill("23:59");
  await page.getByRole("button", { name: "Save scheduling settings", exact: true }).click();
  await page
    .getByText("Scheduling settings saved. Capability restrictions remain enforced.", {
      exact: true,
    })
    .waitFor();
  // Invalid transient timezone text must not crash the calendar while editing.
  await page.getByLabel("Timezone", { exact: true }).fill("Europe/");
  await page.getByRole("heading", { name: "Work at your pace." }).waitFor();
  await page.getByLabel("Timezone", { exact: true }).fill("UTC");
  await page.getByLabel("Schedule account", { exact: true }).selectOption(account);
  await page.getByRole("checkbox", { name: "QA source item", exact: true }).check();
  await page.getByRole("button", { name: "Validate full batch · no writes", exact: true }).click();
  await page.getByText("0 blocked · 1 warnings", { exact: true }).waitFor();
  await page.getByRole("checkbox", { name: /I approve this manual reminder batch/ }).check();
  await page.getByRole("button", { name: "Queue approved reminders", exact: true }).click();
  await page
    .getByText("Manual reminder batch queued. No marketplace actions performed.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Check due reminders", exact: true }).click();
  await page
    .getByText("Complete this action yourself in the marketplace. Lane has not performed it.", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "PAUSE ALL AUTOMATION", exact: true }).click();
  await page.getByText(/All scheduled automation: PAUSED/).waitFor();
  await page.getByRole("checkbox", { name: /I have reviewed the reason for the pause/ }).check();
  await page.getByRole("button", { name: "Resume selected", exact: true }).click();
  await page.getByText(/All scheduled automation: Not paused/).waitFor();
  await audit("scheduling-desktop");
  await widths("scheduling");
  await page.goto(base + "/image-tools");
  await page.getByRole("heading", { name: "A clean export. The same item." }).waitFor();
  await page.getByRole("checkbox", { name: "Select photo 1", exact: true }).check();
  await page.getByLabel("Export preset", { exact: true }).selectOption("CLEAN_EXPORT");
  await page.getByRole("button", { name: "Prepare separate copies", exact: true }).click();
  await page
    .getByRole("heading", { name: "CLEAN_EXPORT · SUCCEEDED · pending", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Load derivative preview", exact: true }).click();
  await page
    .getByRole("img", { name: "Normalized derivative for comparison", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Accept after comparison", exact: true }).click();
  await page
    .getByRole("heading", { name: "CLEAN_EXPORT · SUCCEEDED · accepted", exact: true })
    .waitFor();
  await audit("images-desktop");
  await widths("images");
  await page.getByRole("button", { name: "View original", exact: true }).click();
  await page.getByRole("img", { name: "Returned to original", exact: true }).waitFor();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page
    .getByRole("heading", { name: "CLEAN_EXPORT · SUCCEEDED · rejected", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Delete derivative only", exact: true }).click();
  await page
    .getByRole("heading", { name: "CLEAN_EXPORT · SUCCEEDED · rejected", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    (await db.query("select url from item_photos where id=$1", [photo])).rows[0].url,
    source,
  );
  assert.equal(
    (await db.query("select attempt_count,status from scheduled_actions where user_id=$1", [user]))
      .rows[0].attempt_count,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int n from jobs where user_id=$1", [user])).rows[0].n,
    0,
  );
  assert.deepEqual(external, []);
  assert.deepEqual(jsErrors, []);
  writeFileSync(
    dir + "result.json",
    JSON.stringify(
      {
        label: "LOCAL PRODUCTION BUILD — isolated scheduler/image QA enabled; bulk writes disabled",
        passed: true,
        scheduling: true,
        dryRun: true,
        manualReminder: true,
        pauseResume: true,
        imagePrepareCompareReviewDelete: true,
        originalPreserved: true,
        axeViolations: 0,
        widths: [320, 390, 768, 1440],
        externalRequests: 0,
        marketplaceWrites: 0,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: real local production UI, manual queue, pause/resume, images, originals, accessibility, responsive widths. Zero external requests/writes.",
  );
} catch (e) {
  await page.screenshot({ path: dir + "failure.png", fullPage: true }).catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await db.end();
}
