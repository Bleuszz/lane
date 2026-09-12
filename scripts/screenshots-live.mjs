// Read-only; no account creation, provider access or marketplace actions.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const base = new URL(process.env.BASE_URL || "");
if (
  base.protocol !== "https:" ||
  base.username ||
  base.password ||
  base.search ||
  base.hash ||
  base.pathname !== "/" ||
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
)
  throw Error("BASE_URL must be a public HTTPS origin");
const response = await fetch(new URL("/api/health", base), { signal: AbortSignal.timeout(90000) });
if (!response.ok) throw Error("Live health failed");
const health = await response.json();
const at = new Date().toISOString(),
  dir = join("artifacts", "live-staging", at.replaceAll(":", "-"));
mkdirSync(dir, { recursive: true });
const storageState = process.env.SCREENSHOT_FIXTURE_STATE;
if (storageState && process.env.SCREENSHOT_FIXTURE_CONFIRMED !== "true")
  throw Error("Only use explicitly confirmed synthetic-test-account browser state");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  ...(storageState ? { storageState } : {}),
});
const page = await context.newPage(),
  records = [];
try {
  for (const [path, name, width] of [
    ["/", "home-desktop", 1440],
    ["/", "home-mobile", 390],
    ["/pricing", "pricing", 1440],
    ["/signup", "signup", 1280],
    ["/login", "login", 1280],
    ["/account", "dashboard", 1280],
    ["/devices", "devices", 1280],
    ["/download", "download", 1280],
    ["/missing-lane-page", "404", 1280],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(new URL(path, base).href, { waitUntil: "networkidle", timeout: 90000 });
    const actual = new URL(page.url());
    if (actual.origin !== base.origin) throw Error("Unexpected cross-origin redirect");
    const matched = actual.pathname === path;
    if (!matched && ["/account", "/devices"].includes(path)) {
      records.push({ path, captured: false, reason: "Authenticated synthetic fixture required" });
      continue;
    }
    // Never export input contents (including passwords) or actual account identifiers.
    await page.locator("input,textarea").evaluateAll((els) =>
      els.forEach((el) => {
        el.value = "";
      }),
    );
    await page.evaluate(
      (label) => {
        const div = document.createElement("div");
        div.textContent = label;
        div.style.cssText =
          "position:fixed;bottom:0;right:0;z-index:99999;background:white;color:#111;padding:6px;font:11px monospace";
        document.body.append(div);
      },
      "LIVE STAGING · " + base.hostname + " · " + health.build?.commit?.slice(0, 8) + " · " + at,
    );
    await page.screenshot({
      path: join(dir, name + ".png"),
      fullPage: true,
      mask: storageState ? [page.locator("[data-private]")] : [],
    });
    records.push({ path, captured: true, name });
  }
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      { label: "LIVE STAGING", origin: base.origin, at, build: health.build, records },
      null,
      2,
    ),
  );
  console.log("Live screenshots saved: " + dir);
  if (records.some((r) => !r.captured))
    console.log(
      "Dashboard/device screenshots still need a synthetic signed-in fixture; no claim of authenticated acceptance.",
    );
} finally {
  await browser.close();
}
