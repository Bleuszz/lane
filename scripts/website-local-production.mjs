import { spawn } from "node:child_process";
import https from "node:https";
import http from "node:http";
import { readFileSync } from "node:fs";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:15439/lane"))
  throw Error("Isolated fixture required");
const child = spawn(process.execPath, ["scripts/start-server.mjs"], {
  windowsHide: true,
  env: {
    ...process.env,
    PORT: "8093",
    HOST: "127.0.0.1",
    LANE_ENV: process.env.LANE_LOCAL_AI_QA === "true" ? "staging" : "production",
    AI_PROVIDER: "mock",
    AI_TEXT_PROVIDER: "mock",
    AI_IMAGE_PROVIDER: "mock",
    AI_MOCK_DEVELOPMENT: process.env.LANE_LOCAL_AI_QA === "true" ? "true" : "false",
    AI_LISTING_ENABLED: process.env.LANE_LOCAL_AI_QA === "true" ? "true" : "false",
    AI_IMAGE_ENABLED: process.env.LANE_LOCAL_AI_QA === "true" ? "true" : "false",
    BETTER_AUTH_URL: "https://localhost:8443",
    LANE_SUPPORT_ENABLED: "true",
    LANE_ANALYTICS_ENABLED: "true",
  },
  stdio: "inherit",
});
const proxy = https.createServer(
  {
    key: readFileSync("artifacts/website-local-key.pem"),
    cert: readFileSync("artifacts/website-local-cert.pem"),
  },
  (req, res) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 8093,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: "localhost:8443", "x-forwarded-proto": "https" },
      },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(503);
      res.end("Local build starting");
    });
    req.pipe(upstream);
  },
);
proxy.listen(8443, "127.0.0.1", () =>
  console.log("LOCAL PRODUCTION BUILD: https://localhost:8443 (isolated self-signed test TLS)"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    proxy.close();
    child.kill(signal);
    process.exit();
  });
