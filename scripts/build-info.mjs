import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
export function buildInfo() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  let commit = process.env.LANE_BUILD_COMMIT ?? process.env.RENDER_GIT_COMMIT,
    dirty = process.env.LANE_BUILD_DIRTY === "true";
  if (!commit)
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      dirty = Boolean(
        execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
          encoding: "utf8",
        }).trim(),
      );
    } catch {}
  return {
    version: pkg.version ?? "0.1.0-staging.1",
    commit: /^[a-f0-9]{40}$/.test(commit ?? "") ? commit : "unknown",
    builtAt: new Date().toISOString(),
    dirty,
  };
}
