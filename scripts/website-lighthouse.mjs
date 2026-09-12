import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("artifacts/website-qa", { recursive: true });
mkdirSync("artifacts/website-lighthouse-profile", { recursive: true });
const chrome = await launch({
  chromeFlags: [
    "--headless",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--no-default-browser-check",
  ],
});
try {
  const scores = [];
  for (const mode of ["mobile", "desktop"]) {
    const result = await lighthouse("https://localhost:8443/", {
      port: chrome.port,
      output: ["html", "json"],
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      ...(mode === "desktop"
        ? {
            formFactor: "desktop",
            throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 },
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1,
              disabled: false,
            },
          }
        : {}),
    });
    writeFileSync("artifacts/website-qa/lighthouse-" + mode + ".html", result.report[0]);
    writeFileSync("artifacts/website-qa/lighthouse-" + mode + ".json", result.report[1]);
    scores.push({
      label: "LOCAL PRODUCTION BUILD",
      mode,
      scores: Object.fromEntries(
        Object.entries(result.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]),
      ),
      lcp: result.lhr.audits["largest-contentful-paint"].numericValue,
      tbt: result.lhr.audits["total-blocking-time"].numericValue,
      cls: result.lhr.audits["cumulative-layout-shift"].numericValue,
      inp: "Not measured: requires real interaction/field data",
    });
  }
  writeFileSync("artifacts/website-qa/performance.json", JSON.stringify(scores, null, 2));
  console.log(JSON.stringify(scores, null, 2));
} finally {
  try {
    await chrome.kill();
  } catch {
    console.log("Lighthouse browser cleanup needs checking; report generation completed.");
  }
}
