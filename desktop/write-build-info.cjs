const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (git("status", "--porcelain"))
  throw Error("Commit source changes before producing a fingerprinted build.");
const build = {
  commit: git("rev-parse", "HEAD"),
  shortCommit: git("rev-parse", "--short", "HEAD"),
  branch: git("branch", "--show-current"),
  builtAt: new Date().toISOString(),
  diagnostic: process.argv.includes("--diagnostic"),
};
fs.writeFileSync(path.join(__dirname, "build-info.json"), JSON.stringify(build, null, 2) + "\n");
console.log("Build fingerprint: " + build.shortCommit + " " + build.builtAt);
