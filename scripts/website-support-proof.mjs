import { Pool } from "pg";
import { saveSupport } from "../src/lib/lane/server/support.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:15439/lane"))
  throw Error("Isolated fixture required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const wrap = (client) => {
  const fn = async (strings, ...values) => {
    let text = strings[0];
    values.forEach((v, i) => (text += "$" + (i + 1) + strings[i + 1]));
    return (await client.query(text, values)).rows;
  };
  return fn;
};
const sql = wrap(pool);
sql.transaction = async (run) => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await run(wrap(client));
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
};
try {
  const owner = "support-proof-" + randomUUID(),
    other = "support-proof-" + randomUUID();
  await pool.query("insert into user_settings(user_id) values($1),($2)", [owner, other]);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      saveSupport(
        sql,
        owner,
        "account",
        "Synthetic support validation message, no real customer data.",
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  assert.equal(results.filter((r) => r.status === "rejected").length, 2);
  assert.ok(
    (await saveSupport(sql, other, "privacy", "Synthetic independent account support request.")).id,
  );
  const rows = await pool.query(
    "select user_id,count(*)::int as n from support_requests where user_id in ($1,$2) group by user_id",
    [owner, other],
  );
  assert.equal(rows.rows.find((r) => r.user_id === owner).n, 3);
  console.log(
    "PASS: durable support receipts, concurrent per-account cap, independent account allowance.",
  );
} finally {
  await pool.end();
}
