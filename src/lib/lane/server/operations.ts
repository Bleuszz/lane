import type { Sql } from "@/lib/db";

export const JOB_LEASE_SECONDS = 300;

export function intentKey(type: string, accountId: string, itemId: string | null, channelId: string | null) {
  // Match PostgreSQL jsonb_build_array(... )::text for the transactional sale outbox.
  return `[${[type, accountId, itemId, itemId ? null : channelId].map((value) => JSON.stringify(value)).join(", ")}]`;
}

export type ClaimedJob = {
  id: string; type: string; status: string; marketplace: string | null;
  account_id: string | null; item_id: string | null; channel_listing_id: string | null;
  request_id: string; attempt: number; max_attempts: number; lease_token: string;
  needs_reconciliation: boolean;
  payload?: unknown;
};

/** A conditional UPDATE is atomic on both PostgreSQL and PGLite. No select-then-write race. */
export async function claimJob(sql: Sql, userId: string, jobId: string, leaseToken: string, source: "worker" | "extension") {
  let rows: ClaimedJob[];
  try { rows = await sql<ClaimedJob>`
    update jobs j set status = case when type in ('publish', 'relist') then 'creating' else 'running' end,
      lease_token = ${leaseToken}, lease_expires_at = now() + interval '300 seconds',
      started_at = coalesce(started_at, now()), attempt = attempt + 1, updated_at = now()
    where j.id = ${jobId} and j.user_id = ${userId}
      and j.status = ${source === "extension" ? "waiting_for_browser" : "queued"}
      and j.attempt < j.max_attempts
      and (j.retry_after is null or j.retry_after <= now())
      and exists (select 1 from marketplace_accounts a where a.id = j.account_id and a.user_id = j.user_id
        and a.status in ('green', 'rate_limited')
        and (${source} = 'worker' and a.mode = 'oauth' or ${source} = 'extension' and a.mode = 'extension'))
      and not exists (select 1 from jobs active where active.user_id = j.user_id
        and active.channel_listing_id = j.channel_listing_id and active.id <> j.id
        and active.lease_token is not null and active.lease_expires_at > now())
    returning j.*
  `; } catch (error) {
    // Two different intents for a channel may race. The unique active lease
    // constraint is the final arbiter, in addition to the convenient precheck.
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return null;
    throw error;
  }
  return rows[0] ?? null;
}

/** eBay has read-before-replay reconciliation; interrupted browser creates need human review. */
export async function recoverExpiredJobs(sql: Sql, userId: string) {
  return sql`
    update jobs set status = case
        when marketplace = 'ebay_uk' and attempt < max_attempts then 'queued' else 'error' end,
      needs_reconciliation = true, lease_token = null, lease_expires_at = null,
      error_message = 'Execution interrupted. Checking the marketplace before any retry.', updated_at = now()
    where user_id = ${userId} and status in ('creating', 'running', 'uploading_photos')
      and (lease_expires_at < now() or (lease_expires_at is null and updated_at < now() - interval '5 minutes'))
    returning id
  `;
}

/** Refresh immediately before remote mutations; a stale executor must stop. */
export async function renewJobLease(sql: Sql, userId: string, jobId: string, leaseToken: string) {
  const rows = await sql<{ id: string }>`update jobs set lease_expires_at = now() + interval '300 seconds'
    where id = ${jobId} and user_id = ${userId} and lease_token = ${leaseToken}
      and lease_expires_at > now() returning id`;
  if (!rows[0]) throw new Error("Job lease expired. Reconcile the marketplace before continuing.");
}

/** Never turn an active/done job back into a queued publish on repeated clicks. */
export async function queueJobRetry(sql: Sql, userId: string, jobId: string) {
  const rows = await sql<{ id: string }>`
    update jobs j set status = case when a.mode = 'oauth' then 'queued' else 'waiting_for_browser' end,
      error_message = null, error_body = null, finished_at = null, retry_after = null, updated_at = now()
    from marketplace_accounts a
    where j.id = ${jobId} and j.user_id = ${userId} and a.id = j.account_id and a.user_id = j.user_id
      and j.status = 'error' and j.attempt < j.max_attempts and j.lease_token is null
      and not (j.needs_reconciliation and j.marketplace <> 'ebay_uk' and j.type in ('publish', 'relist'))
    returning j.id
  `;
  if (!rows[0]) throw new Error("This job is active, finished, exhausted, or needs marketplace reconciliation before retrying.");
  return rows[0].id;
}

export function saleEventKey(opts: { marketplace: string; accountId: string | null; eventId?: string; remoteId?: string | null; itemId: string }) {
  // Explicit order-line IDs distinguish multiple units. A sold-listing poll is a
  // single terminal observation, never a new sale every time the browser polls.
  return JSON.stringify([opts.marketplace, opts.accountId, opts.eventId ? "event" : "listing", opts.eventId || opts.remoteId || opts.itemId]);
}
