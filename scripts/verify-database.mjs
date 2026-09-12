import { Pool } from "pg";
import { readdirSync } from "node:fs";
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
try {
  const names = readdirSync("migrations").filter((n) => /^\d+.*\.sql$/.test(n));
  const applied = (await pool.query("select name from _migrations")).rows.map((r) => r.name);
  const missing = names.filter((n) => !applied.includes(n));
  const tables = [
    "user",
    "session",
    "account",
    "user_settings",
    "items",
    "desktop_devices",
    "desktop_pairings",
    "support_requests",
    "website_daily_events",
    "scheduler_settings",
    "scheduler_scopes",
    "schedule_batches",
    "scheduled_actions",
    "scheduler_attempts",
    "scheduler_events",
    "scheduler_notifications",
    "image_normalizations",
    "ai_wallets",
    "ai_batches",
    "ai_jobs",
    "ai_credit_ledger",
    "ai_cost_ledger",
    "ai_suggestions",
    "ai_generated_assets",
    "ai_job_events",
  ];
  const rows = await pool.query("select tablename from pg_tables where schemaname='public'");
  const present = new Set(rows.rows.map((r) => r.tablename));
  const missingTables = tables.filter((t) => !present.has(t));
  const tls = await pool.query("select ssl from pg_stat_ssl where pid=pg_backend_pid()");
  console.log(
    JSON.stringify(
      {
        connected: true,
        migrationsApplied: applied.length,
        missingMigrations: missing,
        missingTables,
        tls: tls.rows[0]?.ssl === true,
      },
      null,
      2,
    ),
  );
  const local = ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname);
  if (missing.length || missingTables.length || (!local && tls.rows[0]?.ssl !== true))
    process.exitCode = 1;
} catch {
  console.error("Database verification failed; check credentials, TLS and migrations privately.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
