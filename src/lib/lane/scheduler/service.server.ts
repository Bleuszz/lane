import { PLAN_DEFS, TRIAL_ACTION_LIMIT } from "../plans.ts";
import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "../../db.ts";
import {
  MARKETPLACE_POLICIES,
  SYSTEM_CAPS,
  policyDenial,
  type Marketplace,
  type Operation,
  type Policy,
  type QueueMode,
} from "./policy.ts";
import {
  DEFAULT_SETTINGS,
  effectiveCaps,
  intervalSeconds,
  nextAllowed,
  permittedTime,
  retryAfterMs,
  settingsSchema,
  type SchedulerSettings,
} from "./settings.ts";
export type QueueInput = {
  accountId: string;
  itemIds: string[];
  operation: Operation;
  mode: QueueMode;
  startAt: string;
  approved: boolean;
  requestKey: string;
  largeApproved?: boolean;
};
type Job = {
  id: string;
  user_id: string;
  batch_id: string;
  marketplace: Marketplace;
  account_id: string;
  item_id: string;
  operation: Operation;
  mode: QueueMode;
  status: string;
  scheduled_at: string;
  attempt_count: number;
  remote_id: string | null;
  idempotency_key: string;
  snapshot_hash: string;
  lease_token: string | null;
  lease_expires_at: string | null;
  expires_at: string;
  started_at: string | null;
  last_error: string | null;
};
export type Health = {
  deviceOnline: boolean;
  session: "VALID" | "EXPIRED" | "CHALLENGE" | "UNKNOWN";
  identityMatches: boolean;
  remote: "ACTIVE" | "ENDED" | "SOLD" | "DELETED" | "NONE" | "UNKNOWN";
  checkedAt: string;
  remoteId?: string;
  requirementsReady: boolean;
  imagesReady: boolean;
  warning?: boolean;
};
export type Outcome = {
  kind:
    | "SUCCESS"
    | "SAFE_RETRY"
    | "RATE_LIMIT"
    | "CHALLENGE"
    | "AUTH_EXPIRED"
    | "WARNING"
    | "ACCOUNT_MISMATCH"
    | "AMBIGUOUS"
    | "PERMANENT_FAILURE";
  remoteId?: string;
  retryAfter?: string;
  noRemoteEffect?: boolean;
};
type Dependencies = {
  policy?: (marketplace: Marketplace) => Policy;
  inspect?: (
    job: Pick<Job, "user_id" | "account_id" | "item_id" | "operation">,
    signal: AbortSignal,
  ) => Promise<Health>;
  execute?: (job: Job, signal: AbortSignal) => Promise<Outcome>;
  clock?: () => Date;
  random?: () => number;
};
type Account = { id: string; marketplace: Marketplace; status: string };
const uuid = () => randomUUID(),
  hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"];
export class SchedulerService {
  private sql: Sql;
  private flags: { scheduler: boolean; bulk: boolean };
  private deps: Dependencies;
  constructor(sql: Sql, flags: { scheduler: boolean; bulk: boolean }, deps: Dependencies = {}) {
    this.sql = sql;
    this.flags = flags;
    this.deps = deps;
  }
  private policy(m: Marketplace) {
    return this.deps.policy?.(m) ?? MARKETPLACE_POLICIES[m];
  }
  private async now(tx = this.sql) {
    if (this.deps.clock) return this.deps.clock();
    return new Date((await tx<{ now: string }>`select now() as now`)[0].now);
  }
  private async settings(tx: Sql, user: string, lock = false) {
    await tx`insert into scheduler_settings(user_id,config) values(${user},${JSON.stringify(DEFAULT_SETTINGS)}::jsonb) on conflict do nothing`;
    const [row] = await tx.query<{ config: SchedulerSettings; paused: boolean }>(
      `select config,paused from scheduler_settings where user_id=$1${lock ? " for update" : ""}`,
      [user],
    );
    return { ...row, config: settingsSchema.parse(row.config) };
  }
  async saveSettings(user: string, input: unknown) {
    const config = settingsSchema.parse(input);
    await this.sql.transaction(async (tx) => {
      await this.settings(tx, user, true);
      await tx`update scheduler_settings set config=${JSON.stringify(config)}::jsonb,updated_at=now() where user_id=${user}`;
    });
  }
  private async event(tx: Sql, j: Job, status: string, reason: string | null = null) {
    await tx`insert into scheduler_events(id,user_id,job_id,batch_id,marketplace,item_id,operation,status,attempt,reason) values(${uuid()},${j.user_id},${j.id},${j.batch_id},${j.marketplace},${j.item_id},${j.operation},${status},${j.attempt_count},${reason})`;
  }
  private async mark(tx: Sql, j: Job, status: string, reason: string | null, at?: Date) {
    await tx`update scheduled_actions set status=${status},last_error=${reason},scheduled_at=coalesce(${at?.toISOString() ?? null}::timestamptz,scheduled_at) where id=${j.id}`;
    await this.event(tx, j, status, reason);
  }
  private async notify(tx: Sql, j: Job, event: string) {
    await tx`insert into scheduler_notifications(id,user_id,batch_id,event,job_id) values(${uuid()},${j.user_id},${j.batch_id},${event},${j.id})`;
  }
  private async snapshot(tx: Sql, user: string, itemId: string) {
    const [item] = await tx<{
      id: string;
      title: string;
      description: string;
      base_price_gbp: string;
      quantity: number;
      status: string;
      updated_at: string;
    }>`select id,title,description,base_price_gbp,quantity,status,updated_at from items where id=${itemId} and user_id=${user}`;
    const photos = await tx<{
      id: string;
      url: string;
    }>`select id,url from item_photos where item_id=${itemId} and user_id=${user} order by sort_order,id`;
    return { item, photos, fingerprint: hash({ item, photos }) };
  }
  private async preview(tx: Sql, user: string, input: QueueInput) {
    const now = await this.now(tx),
      settings = await this.settings(tx, user);
    const [account] =
      await tx<Account>`select id,marketplace,status from marketplace_accounts where id=${input.accountId} and user_id=${user}`;
    if (!account || !Object.hasOwn(MARKETPLACE_POLICIES, account.marketplace))
      throw Error("ACCOUNT_NOT_FOUND");
    const policy = this.policy(account.marketplace),
      caps = effectiveCaps(settings.config, policy, account.marketplace);
    const common: string[] = [];
    if (!this.flags.scheduler) common.push("SCHEDULER_DISABLED");
    if (!settings.config.enabled) common.push("SCHEDULING_OFF");
    if (settings.paused) common.push("ALL_AUTOMATION_PAUSED");
    if (input.mode !== "MANUAL" && !this.flags.bulk) common.push("BULK_AUTOMATION_DISABLED");
    const denial = policyDenial(policy, input.operation, input.mode, input.itemIds.length);
    if (denial) common.push(denial);
    if (input.itemIds.length < 1 || input.itemIds.length > caps.batchSize)
      common.push("BATCH_LIMIT");
    if (new Set(input.itemIds).size !== input.itemIds.length) common.push("DUPLICATE_IN_BATCH");
    const start = new Date(input.startAt);
    if (!Number.isFinite(start.getTime()) || start.getTime() > now.getTime() + 7 * 86400000)
      throw Error("INVALID_SCHEDULE");
    const owner = (
      await tx<{
        plan: string;
        billing_status: string;
        trial_ends_at: string;
        trial_actions_used: number;
        actions_used_month: number;
        actions_month: string;
      }>`select plan,billing_status,trial_ends_at,trial_actions_used,actions_used_month,actions_month from user_settings where user_id=${user}`
    )[0];
    const limit =
      owner.billing_status === "active"
        ? Object.hasOwn(PLAN_DEFS, owner.plan)
          ? PLAN_DEFS[owner.plan as keyof typeof PLAN_DEFS].actions
          : 0
        : owner.billing_status === "trialing" && new Date(owner.trial_ends_at) > now
          ? TRIAL_ACTION_LIMIT
          : 0;
    const used =
      owner.billing_status === "active"
        ? owner.actions_month === now.toISOString().slice(0, 7)
          ? owner.actions_used_month
          : 0
        : owner.trial_actions_used;
    const pending = (
      await tx<{
        n: number;
      }>`select count(*)::int n from scheduled_actions where user_id=${user} and operation in('PUBLISH','RELIST') and status not in('SUCCEEDED','FAILED','CANCELLED')`
    )[0].n;
    if (
      ["PUBLISH", "RELIST"].includes(input.operation) &&
      input.itemIds.length > Math.max(0, limit - used - pending)
    )
      common.push("ACTION_ALLOWANCE");
    let at = nextAllowed(new Date(Math.max(start.getTime(), now.getTime())), settings.config);
    const occupied = (
      await tx<{
        scheduled_at: string;
      }>`select scheduled_at from scheduled_actions where user_id=${user} and account_id=${account.id} and status not in('FAILED','CANCELLED') and scheduled_at>=${new Date(now.getTime() - 86400000).toISOString()}::timestamptz`
    ).map((r) => new Date(r.scheduled_at).getTime());
    const rows: {
      itemId: string;
      title: string;
      status: "READY" | "WARNING" | "BLOCKED";
      reasons: string[];
      scheduledAt: string;
      fingerprint: string;
      photoCount: number;
      remoteId: string | null;
    }[] = [];
    for (const itemId of input.itemIds) {
      const snap = await this.snapshot(tx, user, itemId),
        reasons = [...common],
        warnings: string[] = [];
      if (!snap.item) reasons.push("ITEM_NOT_FOUND");
      else {
        if (
          ["PUBLISH", "RELIST"].includes(input.operation) &&
          (!snap.item.title.trim() ||
            !snap.item.description.trim() ||
            Number(snap.item.base_price_gbp) <= 0 ||
            snap.item.quantity < 1 ||
            ["sold", "archived"].includes(snap.item.status))
        )
          reasons.push("LISTING_NOT_READY");
        if (
          ["PUBLISH", "RELIST"].includes(input.operation) &&
          (!snap.photos.length ||
            snap.photos.some((p) => !/^data:image\/(jpeg|png);base64,|^https:\/\//.test(p.url)))
        )
          reasons.push("IMAGE_NOT_READY");
      }
      if (input.operation === "PRICE_UPDATE" && snap.item && Number(snap.item.base_price_gbp) <= 0)
        reasons.push("INVALID_PRICE");
      const live = await tx<{
        remote_id: string;
        remote_status: string;
      }>`select remote_id,remote_status from channel_listings where user_id=${user} and item_id=${itemId} and marketplace_account_id=${account.id}`;
      if (
        ["PUBLISH", "RELIST"].includes(input.operation) &&
        live.some((l) => ["live", "active", "sold"].includes(l.remote_status))
      )
        reasons.push("KNOWN_REMOTE_CONFLICT");
      if (input.operation !== "PUBLISH" && !live.some((l) => l.remote_id))
        reasons.push("REMOTE_ID_REQUIRED");
      if (new Set(live.filter((l) => l.remote_id).map((l) => l.remote_id)).size > 1)
        reasons.push("AMBIGUOUS_REMOTE_TARGET");
      if (
        (
          await tx`select id from scheduled_actions where user_id=${user} and account_id=${account.id} and item_id=${itemId} and (last_error in('AMBIGUOUS_REMOTE_RESULT','LEASE_EXPIRED') or status not in('FAILED','CANCELLED','SUCCEEDED') or (status='SUCCEEDED' and operation in('PUBLISH','RELIST') and completed_at>${new Date(now.getTime() - 86400000).toISOString()}::timestamptz)) limit 1`
        ).length
      )
        reasons.push("EXISTING_INTENT_OR_RECENT_SUCCESS");
      if (
        (
          await tx`select id from jobs where user_id=${user} and account_id=${account.id} and item_id=${itemId} and status in('queued','running','creating','uploading_photos','waiting_for_browser','error') limit 1`
        ).length
      )
        reasons.push("LEGACY_JOB_CONFLICT");
      if (account.status !== "green") warnings.push("ACCOUNT_REQUIRES_REVIEW");
      warnings.push("FRESH_SESSION_AND_REMOTE_CHECK_REQUIRED");
      if (input.mode === "MANUAL") warnings.push("MANUAL_ACTION_ONLY");
      else if (!this.deps.inspect || !this.deps.execute) reasons.push("TRANSPORT_NOT_REGISTERED");
      if (settings.config.imagePreset !== "ORIGINAL") {
        warnings.push("IMAGE_PREPARATION_REQUIRES_REVIEW");
        if (input.mode !== "MANUAL") reasons.push("DERIVATIVE_PUBLISH_INTEGRATION_NOT_ENABLED");
      }
      // Upper-bound interval planning; actual spacing is drawn once at dispatch and persisted.
      for (let n = 0; n < 400; n++) {
        const t = at.getTime(),
          hour = occupied.filter((x) => x > t - 3600000 && x <= t),
          day = occupied.filter((x) => x > t - 86400000 && x <= t);
        if (hour.length < caps.hourly && day.length < caps.daily) break;
        const until = Math.max(
          hour.length >= caps.hourly ? Math.min(...hour) + 3600001 : t,
          day.length >= caps.daily ? Math.min(...day) + 86400001 : t,
        );
        at = nextAllowed(new Date(until), settings.config);
      }
      rows.push({
        itemId,
        title: snap.item?.title ?? "Unavailable",
        status: reasons.length ? "BLOCKED" : warnings.length ? "WARNING" : "READY",
        reasons: [...reasons, ...warnings],
        scheduledAt: at.toISOString(),
        fingerprint: snap.fingerprint,
        photoCount: snap.photos.length,
        remoteId:
          input.operation === "PUBLISH" ? null : (live.find((l) => l.remote_id)?.remote_id ?? null),
      });
      occupied.push(at.getTime());
      at = nextAllowed(
        new Date(
          at.getTime() +
            caps.maxSeconds * 1000 +
            (rows.length % settings.config.batchPauseEvery === 0
              ? settings.config.batchPauseSeconds * 1000
              : 0),
        ),
        settings.config,
      );
    }
    return {
      account,
      caps,
      rows,
      settings: settings.config,
      confirmationRequired: input.itemIds.length > settings.config.confirmAbove,
      estimatedCompletion: rows.at(-1)?.scheduledAt ?? null,
      photoCount: rows.reduce((n, r) => n + r.photoCount, 0),
    };
  }
  async dryRun(user: string, input: QueueInput) {
    return this.preview(this.sql, user, input);
  }
  async queue(user: string, input: QueueInput) {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestKey)) throw Error("INVALID_KEY");
    return this.sql.transaction(async (tx) => {
      await this.settings(tx, user, true);
      const fingerprint = hash(input);
      const [old] = await tx<{
        id: string;
        fingerprint: string;
      }>`select id,fingerprint from schedule_batches where user_id=${user} and request_key=${input.requestKey}`;
      if (old) {
        if (old.fingerprint !== fingerprint) throw Error("IDEMPOTENCY_CONFLICT");
        return old.id;
      }
      const preview = await this.preview(tx, user, input);
      if (preview.rows.some((r) => r.status === "BLOCKED")) throw Error("BATCH_BLOCKED");
      if (!input.approved) throw Error("APPROVAL_REQUIRED");
      if (preview.confirmationRequired && !input.largeApproved)
        throw Error("LARGE_BATCH_CONFIRMATION_REQUIRED");
      const batch = uuid();
      await tx`insert into schedule_batches(id,user_id,request_key,fingerprint,mode) values(${batch},${user},${input.requestKey},${fingerprint},${input.mode})`;
      const now = await this.now(tx);
      for (const r of preview.rows) {
        const id = uuid(),
          state = new Date(r.scheduledAt) > now ? "SCHEDULED" : "QUEUED";
        await tx`insert into scheduled_actions(id,user_id,batch_id,marketplace,account_id,item_id,operation,mode,status,scheduled_at,idempotency_key,snapshot_hash,expires_at,remote_id) values(${id},${user},${batch},${preview.account.marketplace},${input.accountId},${r.itemId},${input.operation},${input.mode},${state},${r.scheduledAt}::timestamptz,${id},${r.fingerprint},${new Date(new Date(r.scheduledAt).getTime() + 7 * 86400000).toISOString()}::timestamptz,${r.remoteId})`;
        await this.event(
          tx,
          {
            id,
            user_id: user,
            batch_id: batch,
            marketplace: preview.account.marketplace,
            account_id: input.accountId,
            item_id: r.itemId,
            operation: input.operation,
            attempt_count: 0,
          } as Job,
          state,
        );
      }
      return batch;
    });
  }
  async pause(user: string, scope: string, paused: boolean, reviewed = false) {
    if (
      !["all", "marketplace:ebay_uk", "marketplace:vinted_uk"].includes(scope) &&
      !scope.startsWith("account:") &&
      !scope.startsWith("batch:")
    )
      throw Error("INVALID_SCOPE");
    await this.sql.transaction(async (tx) => {
      await this.settings(tx, user, true);
      if (!paused && !reviewed) throw Error("REVIEW_REQUIRED");
      if (scope === "all")
        await tx`update scheduler_settings set paused=${paused} where user_id=${user}`;
      else if (scope.startsWith("batch:")) {
        const r =
          await tx`update schedule_batches set paused=${paused} where id=${scope.slice(6)} and user_id=${user} returning id`;
        if (!r.length) throw Error("BATCH_NOT_FOUND");
      } else {
        if (
          scope.startsWith("account:") &&
          !(
            await tx`select id from marketplace_accounts where id=${scope.slice(8)} and user_id=${user}`
          ).length
        )
          throw Error("ACCOUNT_NOT_FOUND");
        const [old] = await tx<{
          hold_until: string | null;
        }>`select hold_until from scheduler_scopes where user_id=${user} and scope=${scope}`;
        if (!paused && old?.hold_until && new Date(old.hold_until) > (await this.now(tx)))
          throw Error("RETRY_AFTER_ACTIVE");
        await tx`insert into scheduler_scopes(user_id,scope,paused,reason) values(${user},${scope},${paused},${paused ? "USER_PAUSED" : null}) on conflict(user_id,scope) do update set paused=excluded.paused,reason=excluded.reason,failures=case when excluded.paused then scheduler_scopes.failures else 0 end,auth_failures=case when excluded.paused then scheduler_scopes.auth_failures else 0 end,warnings=case when excluded.paused then scheduler_scopes.warnings else 0 end`;
      }
      await tx`insert into scheduler_events(id,user_id,status,reason) values(${uuid()},${user},${paused ? "PAUSED" : "RESUMED"},${scope})`;
    });
  }
  async cancel(user: string, filter: { jobId?: string; batchId?: string; futureOnly?: boolean }) {
    await this.sql.transaction(async (tx) => {
      await this.settings(tx, user, true);
      const now = await this.now(tx);
      const rows = await tx.query<Job>(
        "select * from scheduled_actions where user_id=$1 and status not in('RUNNING','SUCCEEDED','FAILED','CANCELLED') and ($2::text is null or id=$2) and ($3::text is null or batch_id=$3) and ($4::boolean=false or scheduled_at>$5::timestamptz) for update",
        [
          user,
          filter.jobId ?? null,
          filter.batchId ?? null,
          filter.futureOnly ?? false,
          now.toISOString(),
        ],
      );
      for (const j of rows) {
        await this.mark(
          tx,
          j,
          "CANCELLED",
          ["AMBIGUOUS_REMOTE_RESULT", "LEASE_EXPIRED"].includes(j.last_error ?? "")
            ? j.last_error
            : "USER_CANCELLED",
        );
        await tx`update scheduled_actions set completed_at=${now.toISOString()}::timestamptz where id=${j.id}`;
      }
    });
  }
  async reschedule(user: string, jobId: string, at: string, reviewed: boolean) {
    if (!reviewed) throw Error("REVIEW_REQUIRED");
    await this.sql.transaction(async (tx) => {
      const s = await this.settings(tx, user, true),
        now = await this.now(tx);
      const t = new Date(at);
      if (!Number.isFinite(t.getTime()) || t < now || t.getTime() > now.getTime() + 7 * 86400000)
        throw Error("INVALID_SCHEDULE");
      const [j] =
        await tx<Job>`select * from scheduled_actions where user_id=${user} and id=${jobId} for update`;
      if (!j || j.status === "RUNNING" || terminal.includes(j.status))
        throw Error("JOB_NOT_RESCHEDULABLE");
      if (j.last_error === "AMBIGUOUS_REMOTE_RESULT" || j.last_error === "LEASE_EXPIRED")
        throw Error("REMOTE_RECONCILIATION_REQUIRED");
      const next = nextAllowed(t, s.config);
      await this.mark(tx, j, "SCHEDULED", null, next);
    });
  }
  private async recover(tx: Sql, user: string) {
    const now = await this.now(tx);
    const jobs =
      await tx<Job>`select * from scheduled_actions where user_id=${user} and status='RUNNING' and lease_expires_at<${now.toISOString()}::timestamptz for update`;
    for (const j of jobs) {
      await this.mark(tx, j, "REQUIRES_USER_ACTION", "LEASE_EXPIRED");
      await tx`update scheduled_actions set lease_token=null,lease_expires_at=null where id=${j.id}`;
      await this.scopeStop(tx, j, "account:" + j.account_id, "LEASE_EXPIRED");
      await this.notify(tx, j, "manual_action_required");
    }
  }
  private async scopeStop(tx: Sql, j: Job, scope: string, reason: string) {
    await tx`insert into scheduler_scopes(user_id,scope,paused,reason) values(${j.user_id},${scope},true,${reason}) on conflict(user_id,scope) do update set paused=true,reason=excluded.reason`;
  }
  private async recordSafetyFailure(tx: Sql, j: Job, s: SchedulerSettings, kind: string) {
    await tx`update schedule_batches set failures=failures+1 where id=${j.batch_id}`;
    const [b] = await tx<{
      failures: number;
    }>`select failures from schedule_batches where id=${j.batch_id}`;
    if (b.failures >= s.maxBatchFailures) {
      await tx`update schedule_batches set paused=true where id=${j.batch_id}`;
      await this.notify(tx, j, "batch_paused");
    }
    const scope = "marketplace:" + j.marketplace;
    await tx`insert into scheduler_scopes(user_id,scope,auth_failures,warnings) values(${j.user_id},${scope},${kind === "AUTH_EXPIRED" ? 1 : 0},${kind === "WARNING" ? 1 : 0}) on conflict(user_id,scope) do update set auth_failures=scheduler_scopes.auth_failures+excluded.auth_failures,warnings=scheduler_scopes.warnings+excluded.warnings`;
    const [m] = await tx<{
      auth_failures: number;
      warnings: number;
    }>`select auth_failures,warnings from scheduler_scopes where user_id=${j.user_id} and scope=${scope}`;
    if (m.auth_failures >= s.maxAuthFailures || m.warnings >= s.maxWarnings)
      await this.scopeStop(tx, j, scope, kind);
  }
  async runNext(user: string) {
    const claimed = await this.sql.transaction(async (tx) => {
      // Shared global ceiling across users/processes; xact lock works with pooled Postgres.
      await tx`select pg_advisory_xact_lock(721033)`;
      const settings = await this.settings(tx, user, true);
      await this.recover(tx, user);
      const now = await this.now(tx),
        s = settings.config;
      if (!this.flags.scheduler || !s.enabled || settings.paused) return null;
      const due =
        await tx<Job>`select j.* from scheduled_actions j join schedule_batches b on b.id=j.batch_id where j.user_id=${user} and b.paused=false and j.status in('QUEUED','SCHEDULED','WAITING','WAITING_FOR_DEVICE','RETRY_WAIT') and j.scheduled_at<=${now.toISOString()}::timestamptz order by j.scheduled_at,j.queued_at,j.id limit 20 for update of j skip locked`;
      for (const j of due) {
        const scopes = await tx<{
          scope: string;
          paused: boolean;
          hold_until: string | null;
          next_at: string | null;
        }>`select scope,paused,hold_until,next_at from scheduler_scopes where user_id=${user} and scope=any(${["account:" + j.account_id, "marketplace:" + j.marketplace]}::text[])`;
        if (scopes.some((x) => x.paused)) continue;
        const hold = Math.max(
          ...scopes.flatMap((x) => [
            x.hold_until ? new Date(x.hold_until).getTime() : 0,
            x.next_at ? new Date(x.next_at).getTime() : 0,
          ]),
          0,
        );
        if (hold > now.getTime()) {
          await this.mark(
            tx,
            j,
            "WAITING",
            "ACCOUNT_INTERVAL_OR_HOLD",
            nextAllowed(new Date(hold), s),
          );
          continue;
        }
        if (new Date(j.expires_at) <= now) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "JOB_EXPIRED");
          continue;
        }
        if (!permittedTime(now, s)) {
          await this.mark(tx, j, "SCHEDULED", "OUTSIDE_ACTIVE_HOURS", nextAllowed(now, s));
          continue;
        }
        const batchCount = (
          await tx<{
            n: number;
          }>`select count(*)::int n from scheduled_actions where batch_id=${j.batch_id}`
        )[0].n;
        const p = this.policy(j.marketplace),
          denial = policyDenial(p, j.operation, j.mode, batchCount),
          caps = effectiveCaps(s, p, j.marketplace);
        if (denial) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", denial);
          continue;
        }
        if (j.mode === "MANUAL") {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "MANUAL_ACTION_ONLY");
          await this.notify(tx, j, "manual_action_required");
          continue;
        }
        if (!this.flags.bulk || !this.deps.execute || !this.deps.inspect) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "TRANSPORT_NOT_REGISTERED");
          continue;
        }
        if (
          (
            await tx`select id from scheduled_actions where user_id=${user} and account_id=${j.account_id} and status='RUNNING' limit 1`
          ).length
        )
          continue;
        const snap = await this.snapshot(tx, user, j.item_id);
        if (snap.fingerprint !== j.snapshot_hash) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "LISTING_CHANGED");
          continue;
        }
        if (
          (
            await tx`select id from jobs where user_id=${user} and account_id=${j.account_id} and item_id=${j.item_id} and status in('queued','running','creating','uploading_photos','waiting_for_browser','error') limit 1`
          ).length
        ) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "LEGACY_JOB_CONFLICT");
          continue;
        }
        if (s.imagePreset !== "ORIGINAL") {
          await this.mark(
            tx,
            j,
            "REQUIRES_USER_ACTION",
            "DERIVATIVE_PUBLISH_INTEGRATION_NOT_ENABLED",
          );
          continue;
        }
        let health: Health;
        const readController = new AbortController();
        let readTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          health = await Promise.race([
            this.deps.inspect(j, readController.signal),
            new Promise<never>((_, reject) => {
              readTimer = setTimeout(() => {
                readController.abort();
                reject(Error("READ_TIMEOUT"));
              }, 5000);
            }),
          ]);
        } catch {
          await this.mark(
            tx,
            j,
            "WAITING",
            "HEALTH_CHECK_UNAVAILABLE",
            new Date(now.getTime() + 60000),
          );
          return null;
        } finally {
          if (readTimer) clearTimeout(readTimer);
        }
        if (!health.deviceOnline) {
          await this.mark(
            tx,
            j,
            "WAITING_FOR_DEVICE",
            "OPEN_LANE_DESKTOP",
            new Date(now.getTime() + 60000),
          );
          continue;
        }
        if (health.warning || health.session === "CHALLENGE") {
          await this.mark(
            tx,
            j,
            "REQUIRES_USER_ACTION",
            health.warning ? "MARKETPLACE_WARNING" : "CHALLENGE",
          );
          await this.scopeStop(tx, j, "account:" + j.account_id, "MARKETPLACE_ATTENTION");
          await this.recordSafetyFailure(tx, j, s, health.warning ? "WARNING" : "CHALLENGE");
          await this.notify(tx, j, "challenge_detected");
          continue;
        }
        if (health.session !== "VALID") {
          await this.mark(tx, j, "REQUIRES_RECONNECT", "SESSION_EXPIRED_OR_UNKNOWN");
          await this.scopeStop(tx, j, "account:" + j.account_id, "SESSION_EXPIRED");
          await this.recordSafetyFailure(tx, j, s, "AUTH_EXPIRED");
          await this.notify(tx, j, "session_expired");
          continue;
        }
        if (!health.identityMatches) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "ACCOUNT_MISMATCH");
          await this.scopeStop(tx, j, "account:" + j.account_id, "ACCOUNT_MISMATCH");
          await this.notify(tx, j, "manual_action_required");
          continue;
        }
        const age = now.getTime() - Date.parse(health.checkedAt);
        if (!Number.isFinite(age) || age < -5000 || age > 60000 || health.remote === "UNKNOWN") {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "FRESH_REMOTE_STATE_REQUIRED");
          continue;
        }
        if (!health.requirementsReady || !health.imagesReady) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "DESTINATION_REQUIREMENTS_NOT_READY");
          continue;
        }
        if (j.operation !== "PUBLISH" && (!j.remote_id || health.remoteId !== j.remote_id)) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "REMOTE_TARGET_CHANGED");
          continue;
        }
        const valid =
          j.operation === "PUBLISH"
            ? health.remote === "NONE"
            : j.operation === "RELIST"
              ? health.remote === "ENDED"
              : health.remote === "ACTIVE";
        if (!valid) {
          await this.mark(tx, j, "REQUIRES_USER_ACTION", "REMOTE_STATE_CONFLICT");
          continue;
        }
        const attempts = await tx<{
          account_id: string;
          marketplace: string;
          user_id: string;
          started_at: string;
        }>`select account_id,marketplace,user_id,started_at from scheduler_attempts where started_at>${new Date(now.getTime() - 86400000).toISOString()}::timestamptz and started_at<=${now.toISOString()}::timestamptz`;
        const groups = [
          { rows: attempts, h: SYSTEM_CAPS.hourly, d: SYSTEM_CAPS.daily },
          {
            rows: attempts.filter((a) => a.user_id === user && a.marketplace === j.marketplace),
            h: caps.hourly,
            d: caps.daily,
          },
          {
            rows: attempts.filter((a) => a.user_id === user && a.account_id === j.account_id),
            h: caps.hourly,
            d: caps.daily,
          },
        ];
        let wait = 0;
        for (const g of groups) {
          const times = g.rows.map((r) => Date.parse(r.started_at)).sort((a, b) => a - b),
            hour = times.filter((t) => t > now.getTime() - 3600000);
          if (times.length >= g.d) wait = Math.max(wait, times[times.length - g.d] + 86400001);
          if (hour.length >= g.h) wait = Math.max(wait, hour[hour.length - g.h] + 3600001);
        }
        if (wait) {
          await this.mark(tx, j, "WAITING", "ACTION_CAP", nextAllowed(new Date(wait), s));
          continue;
        }
        // Do not let retries bypass the existing server-side publish/relist allowance.
        if (["PUBLISH", "RELIST"].includes(j.operation)) {
          const reserved = await tx<{
            ok: boolean;
          }>`select lane_reserve_listing_action(${user},${"scheduled:" + j.id},${j.operation === "PUBLISH" ? "publish" : "relist"}) as ok`;
          if (!reserved[0]?.ok) {
            await this.mark(tx, j, "REQUIRES_USER_ACTION", "ACTION_ALLOWANCE");
            continue;
          }
        }
        const token = uuid(),
          attempt = j.attempt_count + 1,
          next = nextAllowed(
            new Date(
              now.getTime() +
                intervalSeconds(caps.minSeconds, caps.maxSeconds, this.deps.random) * 1000,
            ),
            s,
          );
        await tx`update scheduled_actions set status='RUNNING',attempt_count=${attempt},started_at=${now.toISOString()}::timestamptz,lease_token=${token},lease_expires_at=${new Date(now.getTime() + 120000).toISOString()}::timestamptz,last_error=null where id=${j.id}`;
        await tx`insert into scheduler_attempts(job_id,user_id,account_id,marketplace,attempt,started_at) values(${j.id},${user},${j.account_id},${j.marketplace},${attempt},${now.toISOString()}::timestamptz)`;
        await tx`insert into scheduler_scopes(user_id,scope,next_at) values(${user},${"account:" + j.account_id},${next.toISOString()}::timestamptz) on conflict(user_id,scope) do update set next_at=excluded.next_at`;
        const claim = { ...j, status: "RUNNING", attempt_count: attempt, lease_token: token };
        await this.event(tx, claim, "RUNNING");
        return claim;
      }
      return null;
    });
    if (!claimed) return { started: false };
    let result: Outcome;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      result = await Promise.race([
        this.deps.execute!(claimed, controller.signal),
        new Promise<Outcome>((resolve) => {
          timer = setTimeout(() => {
            controller.abort();
            resolve({ kind: "AMBIGUOUS" });
          }, 60000);
        }),
      ]);
    } catch {
      result = { kind: "AMBIGUOUS" };
    } finally {
      if (timer) clearTimeout(timer);
    }
    await this.settle(user, claimed, result);
    return { started: true };
  }
  private async settle(user: string, claim: Job, result: Outcome) {
    await this.sql.transaction(async (tx) => {
      const settings = await this.settings(tx, user, true),
        s = settings.config,
        now = await this.now(tx);
      const [j] =
        await tx<Job>`select * from scheduled_actions where id=${claim.id} and user_id=${user} for update`;
      if (!j || j.status !== "RUNNING" || j.lease_token !== claim.lease_token) return;
      if (!j.lease_expires_at || new Date(j.lease_expires_at) <= now) {
        await this.recover(tx, user);
        return;
      }
      const scope = "account:" + j.account_id,
        market = "marketplace:" + j.marketplace;
      if (
        result.kind === "SUCCESS" &&
        (!result.remoteId || /^[a-zA-Z0-9_-]{1,100}$/.test(result.remoteId))
      ) {
        if (["PUBLISH", "RELIST"].includes(j.operation) && !result.remoteId) {
          result = { kind: "AMBIGUOUS" };
        } else {
          await this.mark(tx, j, "SUCCEEDED", null);
          await tx`update scheduled_actions set completed_at=${now.toISOString()}::timestamptz,remote_id=${result.remoteId ?? j.remote_id},lease_token=null,lease_expires_at=null where id=${j.id}`;
          await tx`update scheduler_scopes set failures=0,completed=completed+1 where user_id=${user} and scope=${scope}`;
          const [c] = await tx<{
            completed: number;
          }>`select completed from scheduler_scopes where user_id=${user} and scope=${scope}`;
          if (c.completed % s.batchPauseEvery === 0)
            await tx`update scheduler_scopes set next_at=greatest(next_at,${new Date(now.getTime() + s.batchPauseSeconds * 1000).toISOString()}::timestamptz) where user_id=${user} and scope=${scope}`;
          if (
            !(
              await tx`select id from scheduled_actions where batch_id=${j.batch_id} and status not in('SUCCEEDED','FAILED','CANCELLED') limit 1`
            ).length
          )
            await this.notify(tx, j, "batch_completed");
          return;
        }
      }
      await tx`update scheduler_scopes set failures=failures+1 where user_id=${user} and scope=${scope}`;
      await tx`update schedule_batches set failures=failures+1 where id=${j.batch_id}`;
      const [f] = await tx<{
          failures: number;
        }>`select failures from scheduler_scopes where user_id=${user} and scope=${scope}`,
        [b] = await tx<{
          failures: number;
        }>`select failures from schedule_batches where id=${j.batch_id}`;
      let state = "REQUIRES_USER_ACTION",
        reason = "AMBIGUOUS_REMOTE_RESULT";
      if (result.kind === "AUTH_EXPIRED") {
        state = "REQUIRES_RECONNECT";
        reason = "SESSION_EXPIRED";
      } else if (["CHALLENGE", "WARNING", "ACCOUNT_MISMATCH"].includes(result.kind))
        reason = result.kind;
      else if (result.kind === "PERMANENT_FAILURE") {
        state = "FAILED";
        reason = "PERMANENT_FAILURE";
      } else if (
        ["SAFE_RETRY", "RATE_LIMIT"].includes(result.kind) &&
        result.noRemoteEffect === true
      ) {
        const retry = retryAfterMs(result.retryAfter ?? null, now.getTime()),
          delay = Math.max(s.retryBackoff[Math.min(j.attempt_count - 1, 2)] * 1000, retry);
        if (!Number.isFinite(delay) || delay > 86400000) {
          reason = "LONG_PROVIDER_HOLD";
          await tx`update scheduler_scopes set hold_until=${new Date(now.getTime() + Math.min(Number.isFinite(delay) ? delay : 86400000, 30 * 86400000)).toISOString()}::timestamptz where user_id=${user} and scope=${scope}`;
        } else if (j.attempt_count <= s.retryLimit) {
          state = "RETRY_WAIT";
          reason = result.kind;
          const retryAt = nextAllowed(new Date(now.getTime() + delay), s);
          await tx`update scheduled_actions set scheduled_at=${retryAt.toISOString()}::timestamptz where id=${j.id}`;
          if (result.kind === "RATE_LIMIT")
            await tx`update scheduler_scopes set hold_until=${new Date(now.getTime() + delay).toISOString()}::timestamptz where user_id=${user} and scope=${scope}`;
        } else {
          state = "FAILED";
          reason = "RETRY_LIMIT";
        }
      }
      await this.mark(tx, j, state, reason);
      if (state === "FAILED")
        await tx`update scheduled_actions set completed_at=${now.toISOString()}::timestamptz where id=${j.id}`;
      await tx`update scheduled_actions set lease_token=null,lease_expires_at=null where id=${j.id}`;
      if (state === "REQUIRES_USER_ACTION" || state === "REQUIRES_RECONNECT")
        await this.scopeStop(tx, j, scope, reason);
      if (result.kind === "AUTH_EXPIRED" || result.kind === "WARNING") {
        await tx`insert into scheduler_scopes(user_id,scope,auth_failures,warnings) values(${user},${market},${result.kind === "AUTH_EXPIRED" ? 1 : 0},${result.kind === "WARNING" ? 1 : 0}) on conflict(user_id,scope) do update set auth_failures=scheduler_scopes.auth_failures+excluded.auth_failures,warnings=scheduler_scopes.warnings+excluded.warnings`;
        const [m] = await tx<{
          auth_failures: number;
          warnings: number;
        }>`select auth_failures,warnings from scheduler_scopes where user_id=${user} and scope=${market}`;
        if (m.auth_failures >= s.maxAuthFailures || m.warnings >= s.maxWarnings)
          await this.scopeStop(tx, j, market, reason);
      }
      if (f.failures >= s.maxConsecutiveFailures) {
        await this.scopeStop(tx, j, scope, "FAILURE_THRESHOLD");
        await this.notify(tx, j, "too_many_failures");
      }
      if (b.failures >= s.maxBatchFailures) {
        await tx`update schedule_batches set paused=true where id=${j.batch_id}`;
        await this.notify(tx, j, "batch_paused");
      }
      if (state === "REQUIRES_RECONNECT") await this.notify(tx, j, "session_expired");
      else if (state === "REQUIRES_USER_ACTION") await this.notify(tx, j, "manual_action_required");
    });
  }
  async state(user: string) {
    await this.sql.transaction(async (tx) => {
      await this.settings(tx, user, true);
      await this.recover(tx, user);
    });
    const settings = await this.settings(this.sql, user);
    const jobs = await this
      .sql<Job>`select id,user_id,batch_id,marketplace,account_id,item_id,operation,mode,status,scheduled_at,attempt_count,remote_id,last_error,started_at,expires_at from scheduled_actions where user_id=${user} order by scheduled_at desc limit 200`;
    const scopes = await this.sql<{
      scope: string;
      paused: boolean;
      reason: string | null;
      hold_until: string | null;
    }>`select scope,paused,reason,hold_until from scheduler_scopes where user_id=${user}`;
    const batches = await this.sql<{
      id: string;
      paused: boolean;
      failures: number;
    }>`select id,paused,failures from schedule_batches where user_id=${user} order by created_at desc limit 100`;
    const events = await this.sql<{
      id: string;
      status: string;
      reason: string | null;
      item_id: string;
      operation: string;
      marketplace: string;
      attempt: number;
      created_at: string;
    }>`select id,status,reason,item_id,operation,marketplace,attempt,created_at from scheduler_events where user_id=${user} order by created_at desc limit 100`;
    const accounts = await this.sql<{
      id: string;
      marketplace: Marketplace;
      label: string;
    }>`select id,marketplace,label from marketplace_accounts where user_id=${user} and marketplace in('ebay_uk','vinted_uk')`;
    const items = await this.sql<{
      id: string;
      title: string;
    }>`select id,title from items where user_id=${user} order by updated_at desc limit 100`;
    return {
      settings,
      flags: this.flags,
      policies: MARKETPLACE_POLICIES,
      jobs,
      scopes,
      batches,
      events,
      accounts,
      items,
    };
  }
}
