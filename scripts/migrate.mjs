import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { Pool } from "pg";
import { postgresOptions } from "../src/lib/postgres-options.ts";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
export async function migrationFiles(directory = root) {
  const names = (await readdir(directory)).filter((n) => /^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort();
  if (!names.length) throw Error("MIGRATION_FILES_MISSING");
  return Promise.all(
    names.map(async (name) => {
      const text = await readFile(join(directory, name), "utf8");
      return {
        name,
        text,
        sha256: createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex"),
      };
    }),
  );
}
export async function migrateDatabase(pool, directory = root) {
  const files = await migrationFiles(directory),
    client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(721034)");
    await client.query(
      "create table if not exists _migrations(name text primary key,applied_at timestamptz not null default now(),sha256 text)",
    );
    await client.query("alter table _migrations add column if not exists sha256 text");
    const rows = (await client.query("select name,sha256 from _migrations")).rows;
    if (rows.some((r) => !files.some((f) => f.name === r.name)))
      throw Error("MIGRATION_HISTORY_AHEAD_OF_CODE");
    let applied = 0,
      baselined = 0;
    for (const f of files) {
      const old = rows.find((r) => r.name === f.name);
      if (old?.sha256 && old.sha256 !== f.sha256) throw Error("MIGRATION_CHECKSUM_MISMATCH");
      if (old) {
        if (!old.sha256) {
          await client.query("update _migrations set sha256=$1 where name=$2", [f.sha256, f.name]);
          baselined++;
        }
        continue;
      }
      await client.query(f.text);
      await client.query("insert into _migrations(name,sha256) values($1,$2)", [f.name, f.sha256]);
      applied++;
    }
    await client.query("commit");
    return { applied, baselined, total: files.length };
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    pool = new Pool({
      ...postgresOptions(process.env.DATABASE_URL, 1),
      statement_timeout: 60000,
      query_timeout: 65000,
    });
    const result = await migrateDatabase(pool);
    console.log("[migrate] " + JSON.stringify(result));
  } catch (e) {
    console.error(
      "[migrate] failed: " +
        (/^(DATABASE_URL|Remote PostgreSQL|MIGRATION_)/.test(e.message)
          ? e.message
          : "DATABASE_UNAVAILABLE_OR_MIGRATION_FAILED"),
    );
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
