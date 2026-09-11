import { timingSafeEqual } from "node:crypto";
import type { Sql } from "../../db";

type WorkerDependencies = {
  pollOrders?: (sql:Sql)=>Promise<unknown>;
  recover: (sql:Sql,userId:string)=>Promise<unknown>;
  process: (sql:Sql,userId:string,jobId:string,source:"worker")=>Promise<{ok:boolean}>;
};

/** Host scheduler entry point; no scheduler or infrastructure is created here. */
export async function runWorker(request:Request,sql:Sql,secret:string|undefined,deps:WorkerDependencies):Promise<Response> {
  if (!secret || secret.length < 32) return Response.json({error:"Worker is not configured."},{status:503});
  const header = request.headers.get("authorization") ?? "";
  const supplied = Buffer.from(header), expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied,expected)) return Response.json({error:"Unauthorized"},{status:401});
  if (deps.pollOrders) await deps.pollOrders(sql);
  // Bounded work only. Atomic job claims handle overlapping scheduler requests.
  const users = await sql<{user_id:string}>`
    select j.user_id from jobs j join marketplace_accounts a on a.id=j.account_id and a.user_id=j.user_id
    where a.mode='oauth' and a.status in ('green','rate_limited') and j.marketplace='ebay_uk' and
      ((j.status='queued' and (j.retry_after is null or j.retry_after<=now())) or j.lease_expires_at<now())
    group by j.user_id order by min(j.created_at) limit 5`;
  for (const user of users) await deps.recover(sql,user.user_id);
  const jobs = await sql<{id:string;user_id:string}>`
    select j.id,j.user_id from jobs j join marketplace_accounts a on a.id=j.account_id and a.user_id=j.user_id
    where a.mode='oauth' and a.status in ('green','rate_limited') and j.marketplace='ebay_uk' and j.status='queued'
      and (j.retry_after is null or j.retry_after<=now()) order by j.created_at limit 3`;
  let completed=0;
  for (const job of jobs) if ((await deps.process(sql,job.user_id,job.id,"worker")).ok) completed++;
  return Response.json({attempted:jobs.length,completed},{headers:{"Cache-Control":"no-store"}});
}
