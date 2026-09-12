import assert from "node:assert/strict";
import { Pool } from "pg";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { migrateDatabase, migrationFiles } from "./migrate.mjs";
import { consumeLimit } from "../src/lib/request-limits.ts";
export async function databaseProof(url, directory) {
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/lane_deploy_check")
    throw Error("ISOLATED_FIXTURE_REQUIRED");
  const pool = new Pool({ connectionString: url, max: 10 });
  try {
    const results = await Promise.all([migrateDatabase(pool), migrateDatabase(pool)]);
    const files = await migrationFiles();
    assert.equal(
      results.reduce((n, r) => n + r.applied, 0),
      files.length,
    );
    assert.equal((await migrateDatabase(pool)).applied, 0);
    // Tampered historical SQL is rejected; no new migration can run after it.
    const modified = await mkdtemp(join(directory, "changed-"));
    for (const file of files)
      await writeFile(
        join(modified, file.name),
        file.text + (file === files[0] ? "\n-- tampered fixture" : ""),
      );
    await assert.rejects(migrateDatabase(pool, modified), /MIGRATION_CHECKSUM_MISMATCH/);
    const broken = await mkdtemp(join(directory, "broken-"));
    for (const file of files) await writeFile(join(broken, file.name), file.text);
    await writeFile(
      join(broken, "9999_broken.sql"),
      "create table must_rollback(id int); select * from table_that_does_not_exist;",
    );
    await assert.rejects(migrateDatabase(pool, broken));
    assert.equal((await pool.query("select to_regclass('must_rollback') as t")).rows[0].t, null);
    assert.equal(
      (await pool.query("select count(*)::int as n from _migrations")).rows[0].n,
      files.length,
    );
    const sql = async (parts, ...values) =>
      (
        await pool.query(
          parts.reduce((s, p, i) => s + (i ? "$" + i : "") + p, ""),
          values,
        )
      ).rows;
    const attempts = await Promise.all(
      Array.from({ length: 30 }, () =>
        consumeLimit(sql, "192.0.2.10/sign-in", { window: 60, max: 10 }, "fixture-key"),
      ),
    );
    assert.equal(attempts.filter((r) => r.allowed).length, 10);
    assert.ok(attempts.filter((r) => !r.allowed).every((r) => r.retryAfter > 0));
    assert.ok(
      (await pool.query("select key from request_limits")).rows.every((r) =>
        /^[0-9a-f]{64}$/.test(r.key),
      ),
    );
    await pool.query("update request_limits set expires_at=now()-interval '1 second'");
    assert.equal(
      (await consumeLimit(sql, "192.0.2.10/sign-in", { window: 60, max: 10 }, "fixture-key"))
        .allowed,
      true,
    );
    console.log(
      "PASS: fresh PostgreSQL migrations, concurrent starts, repeat runs, checksum rejection, rollback and atomic request limits.",
    );
  } finally {
    await pool.end();
  }
}
