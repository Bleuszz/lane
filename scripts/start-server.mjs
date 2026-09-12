import { spawn } from "node:child_process";
import { deploymentPolicy } from "../src/lib/auth/deployment.ts";
process.env.LANE_ENV ||= "staging";
process.env.NODE_ENV ||= "production";
try {
  deploymentPolicy(process.env);
} catch (error) {
  console.error(
    "[startup] " +
      (/^(Deployment requires|BETTER_AUTH_|DATABASE_URL|Remote PostgreSQL|TLS verification|Preview plans|Public indexing|Invalid LOG_LEVEL|Invalid Render)/.test(
        error.message,
      )
        ? error.message
        : "Invalid deployment configuration"),
  );
  process.exit(1);
}
const migrate = spawn(process.execPath, ["scripts/migrate.mjs"], {
  stdio: "inherit",
  env: process.env,
});
migrate.once("error", () => process.exit(1));
migrate.once("exit", (code) => {
  if (code !== 0) process.exit(code || 1);
  const server = spawn(process.execPath, [".output/server/index.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  server.once("error", () => process.exit(1));
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.kill(signal));
  server.once("exit", (code) => process.exit(code || 0));
});
