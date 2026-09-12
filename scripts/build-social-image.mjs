import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(
  "<style>body{margin:0}</style>" + readFileSync("public/lane-social.svg", "utf8"),
);
await page.screenshot({ path: "public/lane-social.png" });
await browser.close();
