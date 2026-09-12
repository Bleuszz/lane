import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["scripts/with-app-env.mjs", "node", "node_modules/vite/bin/vite.js", "build"],
  { stdio: "inherit", env: { ...process.env, LANE_DEPLOY_TARGET: "node" } },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
