// Release gate: tracked source snapshot, lockfile install, no local .env, fresh disposable PostgreSQL.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
  createWriteStream,
  unlinkSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer as tcpServer } from "node:net";
import https from "node:https";
import http from "node:http";
import selfsigned from "selfsigned";
import { Pool } from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const id = Date.now() + "-" + randomBytes(3).toString("hex"),
  dir = join(root, "artifacts", "deploy-check", id),
  source = join(dir, "source");
mkdirSync(source, { recursive: true });
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SystemRoot|WINDIR|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|HOME|COMSPEC|PROGRAMFILES|PROGRAMFILES\(X86\)|NUMBER_OF_PROCESSORS)$/i.test(
      key,
    ),
  ),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim() !== "";
const env = {
  ...baseEnv,
  VITE_AUTH_ENABLED: "true",
  LANE_BUILD_COMMIT: commit,
  LANE_BUILD_DIRTY: String(dirty),
};
const npm = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
if (!existsSync(npm)) throw Error("Use the standard Node 24 installation containing npm.");
function run(label, args, options = {}) {
  console.log("[check:deploy] " + label);
  return new Promise((res, rej) => {
    const log = createWriteStream(join(dir, label.replace(/[^a-z0-9]/gi, "-") + ".log"));
    const child = spawn(process.execPath, args, {
      cwd: source,
      env,
      windowsHide: true,
      ...options,
    });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.once("error", rej);
    child.once("exit", (code) => {
      log.end();
      code === 0 ? res() : rej(Error(label + " failed; see its local log."));
    });
  });
}
async function freePort() {
  const s = tcpServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return port;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const name = "lane-deploy-check-" + id;
let container = false,
  server,
  proxy,
  db,
  appEnv;
function docker(args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
async function stopServer() {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  else server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), sleep(5000)]);
}
async function startServer() {
  server = spawn(process.execPath, ["scripts/start-server.mjs"], {
    cwd: source,
    env: appEnv,
    windowsHide: true,
  });
  const log = createWriteStream(join(dir, "server.log"), { flags: "a" });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.once("exit", () => log.end());
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw Error("Production startup failed; see server.log");
    const ok = await new Promise((r) => {
      https
        .get(appEnv.BETTER_AUTH_URL + "/api/health", { rejectUnauthorized: false }, (response) => {
          response.resume();
          r(response.statusCode === 200);
        })
        .on("error", () => r(false));
    });
    if (ok) return;
    await sleep(500);
  }
  throw Error("Production startup health timed out");
}
try {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  for (const file of files) {
    if (!existsSync(join(root, file))) continue;
    const target = join(source, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
  // Required scripts must be tracked (stage new files before checking an in-progress change).
  if (!existsSync(join(source, "scripts/deployment-hardening.test.mjs")))
    throw Error("Stage the new release files before checking the source snapshot.");
  await run("clean npm ci", [npm, "ci", "--no-audit", "--no-fund"]);
  await run("typecheck", [npm, "run", "typecheck"]);
  await run("focused release tests", [
    "--test",
    ...[
      "deployment-policy",
      "deployment-hardening",
      "auth-configuration",
      "desktop-security",
      "desktop-pairing",
      "desktop-return-path",
      "download-url",
      "connection-state",
      "entitlements",
      "migration-plan",
      "website-measurement",
      "sign-out-plan",
      "reliable-operations",
    ].map((n) => "scripts/" + n + ".test.mjs"),
  ]);
  await run("production build", [npm, "run", "build:node"]);
  await run("install test browser", ["node_modules/playwright/cli.js", "install", "chromium"]);
  const pgPort = await freePort(),
    appPort = await freePort(),
    tlsPort = await freePort();
  const password = randomBytes(24).toString("hex"),
    secret = randomBytes(32).toString("hex");
  const envFile = join(dir, "postgres.env");
  writeFileSync(envFile, "POSTGRES_DB=lane_deploy_check\nPOSTGRES_PASSWORD=" + password + "\n", {
    mode: 0o600,
  });
  try {
    docker([
      "run",
      "--detach",
      "--name",
      name,
      "--label",
      "lane.fixture=" + id,
      "--env-file",
      envFile,
      "-p",
      "127.0.0.1:" + pgPort + ":5432",
      "postgres:16-bookworm",
    ]);
    container = true;
  } finally {
    unlinkSync(envFile);
  }
  const url = "postgresql://postgres:" + password + "@127.0.0.1:" + pgPort + "/lane_deploy_check";
  db = new Pool({ connectionString: url, max: 2 });
  for (let i = 0; ; i++) {
    try {
      await db.query("select 1");
      break;
    } catch {
      if (i === 60) throw Error("Fresh PostgreSQL did not start");
      await sleep(500);
    }
  }
  const { databaseProof } = await import(
    pathToFileURL(join(source, "scripts/deployment-database-proof.mjs")).href
  );
  await databaseProof(url, dir);
  appEnv = {
    ...env,
    NODE_ENV: "production",
    LANE_ENV: "staging",
    HOST: "127.0.0.1",
    PORT: String(appPort),
    BETTER_AUTH_URL: "https://localhost:" + tlsPort,
    DATABASE_URL: url,
    BETTER_AUTH_SECRET: secret,
    LOG_LEVEL: "info",
    PUBLIC_INDEXING: "false",
  };
  await run("database verify", ["scripts/verify-database.mjs"], { env: appEnv });
  const cert = await selfsigned.generate([{ name: "commonName", value: "localhost" }], {
    days: 1,
    keySize: 2048,
    extensions: [{ name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }] }],
  });
  proxy = https.createServer({ key: cert.private, cert: cert.cert }, (req, res) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: appPort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: "localhost:" + tlsPort,
          "x-forwarded-proto": "https",
          "x-forwarded-for": "127.0.0.1",
        },
      },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(503);
      res.end("Starting");
    });
    req.pipe(upstream);
  });
  proxy.listen(tlsPort, "127.0.0.1");
  await once(proxy, "listening");
  await startServer();
  const { freshBrowserProof } = await import(
    pathToFileURL(join(source, "scripts/deploy-browser-proof.mjs")).href
  );
  await freshBrowserProof({
    base: appEnv.BETTER_AUTH_URL,
    db,
    dir,
    commit,
    restart: async () => {
      await stopServer();
      await startServer();
    },
  });
  await stopServer();
  const logs = readFileSync(join(dir, "server.log"), "utf8");
  if (
    logs.includes(password) ||
    logs.includes(secret) ||
    logs.includes(url) ||
    /cookie:|authorization:|password=/i.test(logs)
  )
    throw Error("Sensitive logging detected");
  writeFileSync(
    join(dir, "result.json"),
    JSON.stringify(
      {
        passed: true,
        commit,
        dirty,
        label: "LOCAL PRODUCTION BUILD",
        freshPostgres: true,
        cleanInstall: true,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: deployment readiness. Evidence: " +
      dir +
      "\nExternal Render/Neon TLS and live acceptance still required.",
  );
} catch (error) {
  console.error("FAIL: " + error.message);
  process.exitCode = 1;
} finally {
  await stopServer();
  if (proxy) {
    proxy.closeAllConnections();
    await new Promise((r) => proxy.close(r));
  }
  if (db) await db.end();
  if (container) {
    const label = docker(["inspect", "--format", '{{index .Config.Labels "lane.fixture"}}', name]);
    if (label !== id) throw Error("Fixture cleanup identity mismatch");
    docker(["rm", "-f", "-v", name]);
  }
}
