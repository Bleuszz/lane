#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const fail = [];
const warn = [];

function read(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const download = read("src/lib/lane/download.ts");
if (!/WINDOWS_FILE_ID = "[^"]+"/.test(download)) fail.push("download.ts missing FILE_ID");
if (/1xA-AdbuV1fZMP9XpfUui6JccytpRS7Vk/.test(download)) fail.push("download.ts still points at the old Drive file");
if (!existsSync("src/routes/download.tsx")) fail.push("missing /download page");
if (!existsSync("src/routes/legal.privacy.tsx") || !existsSync("src/routes/legal.terms.tsx")) fail.push("missing legal pages");
if (!existsSync("public/robots.txt")) fail.push("missing robots.txt");
if (!existsSync("desktop/main.cjs") || !read("desktop/main.cjs").includes("signedInUi")) {
  fail.push("desktop/main.cjs missing signed-in capture");
}
if (read("desktop/main.cjs").includes("This copy of Lane runs on your PC")) {
  fail.push("desktop still ships the old local HTML app copy");
}

const created = spawnSync("grep", ["-R", "-n", "insert into marketplace_accounts", "src"], { encoding: "utf8" });
if (created.status === 0 && /london_rails|lane_uk_shop/.test(created.stdout || "")) {
  fail.push("placeholder shops still created");
}

if (existsSync("node_modules/typescript")) {
  const tsc = spawnSync("npx", ["tsc", "--noEmit"], { encoding: "utf8" });
  if (tsc.status !== 0) fail.push("typecheck failed");
} else {
  warn.push("typescript not installed — skipped typecheck");
}

console.log("Lane prelaunch");
for (const w of warn) console.log("WARN", w);
if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
console.log("PASS");
