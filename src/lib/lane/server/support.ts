import type { Sql } from "@/lib/db";
import { randomUUID } from "node:crypto";
export async function saveSupport(sql: Sql, userId: string, topic: string, message: string) {
  return sql.transaction(async (tx) => {
    // Serialise per-account submissions so simultaneous requests cannot evade the daily cap.
    const owner = await tx`select user_id from user_settings where user_id=${userId} for update`;
    if (!owner.length) throw Error("Account unavailable");
    const recent = await tx<{
      n: number;
    }>`select count(*)::int as n from support_requests where user_id=${userId} and created_at>now()-interval '24 hours'`;
    if (recent[0].n >= 3)
      throw Error("You can send up to three requests in 24 hours. Please try later.");
    const id = randomUUID();
    await tx`insert into support_requests(id,user_id,topic,message) values(${id},${userId},${topic},${message})`;
    return { id };
  });
}
