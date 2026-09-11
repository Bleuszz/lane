const path = require("node:path");
const { createVault } = require("./security.cjs");
const directory = path.resolve(__dirname, "../artifacts/desktop-runtime");
if (process.versions.electron) {
  const { app, safeStorage } = require("electron");
  app
    .whenReady()
    .then(() => {
      const vault = createVault(directory, safeStorage);
      if (process.argv.includes("--write"))
        vault.write("restart-check", { value: "synthetic-restart-fixture" });
      else {
        require("node:assert/strict").equal(
          vault.read("restart-check").value,
          "synthetic-restart-fixture",
        );
        vault.remove("restart-check");
      }
      app.quit();
    })
    .catch(() => {
      console.error("Protected storage restart check failed.");
      app.exit(1);
    });
} else {
  const { spawnSync } = require("node:child_process");
  for (const mode of ["--write", "--read"]) {
    const result = spawnSync(require("electron"), [__filename, mode], {
      stdio: "inherit",
      windowsHide: true,
      timeout: 30000,
    });
    if (result.error || result.status !== 0) process.exit(1);
  }
  console.log(
    "PASS: Windows encrypted fixture survives a separate Electron process; fixture removed.",
  );
}
