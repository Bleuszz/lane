import { createHmac } from "node:crypto";
import type { Sql } from "./db.ts";
export async function consumeLimit(
  sql: Sql,
  key: string,
  rule: { window: number; max: number },
  secret: string,
) {
  const digest = createHmac("sha256", secret).update(key).digest("hex");
  await sql`delete from request_limits where key in(select key from request_limits where expires_at<now() order by expires_at limit 200)`;
  const [row] = await sql<{
    count: number;
    retry: number;
  }>`insert into request_limits(key,count,expires_at)
 values(${digest},1,now()+${rule.window}*interval '1 second') on conflict(key) do update
 set count=case when request_limits.expires_at<=now() then 1 else request_limits.count+1 end,
 expires_at=case when request_limits.expires_at<=now() then excluded.expires_at else request_limits.expires_at end
 returning count,greatest(1,ceil(extract(epoch from(expires_at-now()))))::int as retry`;
  return { allowed: row.count <= rule.max, retryAfter: row.count <= rule.max ? null : row.retry };
}
