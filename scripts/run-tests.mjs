import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Avoid shell-specific glob quoting silently selecting no script tests on Windows.
const scripts = readdirSync(new URL("./", import.meta.url), { recursive: true })
  .filter(name => name.endsWith(".test.mjs")).sort().map(name => `scripts/${name}`);
if (!scripts.length) throw new Error("No script tests were discovered.");
const result = spawnSync(process.execPath, ["--test", "--test-concurrency=2", ...scripts,
  "src/lib/app-data/app-data.test.ts", "src/lib/app-data/readiness-schedule.test.ts",
  "src/lib/auth/gate-identity.test.ts", "src/lib/auth/sign-in-gate.test.ts"], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
