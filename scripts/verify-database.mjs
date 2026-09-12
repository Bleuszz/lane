import { Pool } from "pg";
import { postgresOptions } from "../src/lib/postgres-options.ts";
import { migrationFiles } from "./migrate.mjs";
let pool;
try {
  pool = new Pool(postgresOptions(process.env.DATABASE_URL, 1));
  const files = await migrationFiles(),
    names = files.map((f) => f.name);
  const records = (await pool.query("select name,sha256 from _migrations")).rows;
  const applied = records.map((r) => r.name);
  const checksumMismatches = files.filter((f) => {
    const r = records.find((r) => r.name === f.name);
    return r && r.sha256 !== f.sha256;
  }).length;
  const extra = applied.filter((n) => !names.includes(n));
  const missing = names.filter((n) => !applied.includes(n));
  const tables = [
    "request_limits",
    "user",
    "session",
    "account",
    "user_settings",
    "items",
    "item_photos",
    "marketplace_accounts",
    "channel_listings",
    "remote_listings",
    "jobs",
    "sales",
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
        extraMigrations: extra,
        checksumMismatches,
        missingTables,
        tls: tls.rows[0]?.ssl === true,
      },
      null,
      2,
    ),
  );
  const local = ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL).hostname);
  if (
    extra.length ||
    checksumMismatches ||
    missing.length ||
    missingTables.length ||
    (!local && tls.rows[0]?.ssl !== true)
  )
    process.exitCode = 1;
} catch {
  console.error("Database verification failed; check credentials, TLS and migrations privately.");
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
