import { randomUUID, createHash } from "node:crypto";
import type { Sql } from "../../db.ts";
import {
  AI_FIELDS,
  AI_OPERATIONS,
  MOCK_MODES,
  type AiOperation,
  type AiField,
  type MockMode,
} from "./catalog.ts";
import type { AiConfig } from "./config.server.ts";
import type { AiInput, AiOutput, FieldValue } from "./types.ts";
import { providerFor } from "./providers/registry.server.ts";

export type AiRequest = {
  itemId: string;
  operation: AiOperation;
  photoId?: string;
  destination: "ebay_uk" | "vinted_uk";
  category?: string;
  userValues?: Partial<Record<AiField, string>>;
  settings?: Partial<AiInput["settings"]>;
  mode?: MockMode;
};
type Job = {
  id: string;
  user_id: string;
  batch_id: string;
  item_id: string;
  source_photo_id: string | null;
  operation: AiOperation;
  provider: string;
  model: string;
  tier: string;
  month: string;
  credit_cost: number;
  status: string;
  input: AiInput;
  mock_mode: MockMode;
  lease_token: string | null;
  error_code: string | null;
  created_at: string;
  expires_at: string;
};
const columns: Partial<Record<AiField, string>> = {
  title: "title",
  description: "description",
  brand: "brand",
  colour: "colour",
  material: "material",
  category: "category_canonical",
  size: "size_uk",
  condition: "condition",
};
const clean = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.slice(0, 10000) : null;
const id = () => randomUUID();
const failureCodes = new Set([
  "TIMEOUT",
  "RATE_LIMIT",
  "PROVIDER_ERROR",
  "INVALID_OUTPUT",
  "PROVIDER_UNAVAILABLE",
  "FEATURE_DISABLED",
  "DEVELOPMENT_ONLY",
]);
export class AiService {
  private sql: Sql;
  private config: AiConfig;
  private clock: () => Date;
  constructor(sql: Sql, config: AiConfig, clock = () => new Date()) {
    this.sql = sql;
    this.config = config;
    this.clock = clock;
  }
  private async lock(tx: Sql, user: string) {
    const [owner] = await tx<{
      plan: string;
      billing_status: string;
    }>`select plan,billing_status from user_settings where user_id=${user} for update`;
    if (!owner) throw Error("ACCOUNT_UNAVAILABLE");
    return owner;
  }
  private enabled(operation: AiOperation) {
    if (!Object.hasOwn(AI_OPERATIONS, operation)) throw Error("INVALID_OPERATION");
    const family = AI_OPERATIONS[operation].family;
    if (!this.config[family]) throw Error("FEATURE_DISABLED");
    if (!this.config.development) throw Error("DEVELOPMENT_ONLY");
    return family;
  }
  private async event(tx: Sql, job: string, state: string) {
    await tx`insert into ai_job_events(id,job_id,state) values(${id()},${job},${state})`;
  }
  private async restore(tx: Sql, job: Job, state: "REFUNDED" | "CANCELLED", code: string) {
    if (!["RESERVED", "PROCESSING"].includes(job.status)) return;
    await tx`update ai_wallets set reserved=reserved-${job.credit_cost} where user_id=${job.user_id} and month=${job.month}`;
    await tx`insert into ai_credit_ledger(id,job_id,user_id,month,event,credits) values(${id()},${job.id},${job.user_id},${job.month},'refund',${job.credit_cost})`;
    if (state === "REFUNDED") await this.event(tx, job.id, "FAILED");
    await tx`update ai_jobs set status=${state},error_code=${code},finished_at=now(),lease_token=null where id=${job.id}`;
    await this.event(tx, job.id, state);
  }
  private async recoverLocked(tx: Sql, user: string) {
    const expired =
      await tx<Job>`select * from ai_jobs where user_id=${user} and status in ('RESERVED','PROCESSING') and expires_at<=now() for update`;
    for (const job of expired) await this.restore(tx, job, "REFUNDED", "LEASE_EXPIRED");
  }
  async recover(user: string) {
    await this.sql.transaction(async (tx) => {
      await this.lock(tx, user);
      await this.recoverLocked(tx, user);
    });
  }
  private async snapshot(tx: Sql, user: string, request: AiRequest): Promise<AiInput> {
    const [item] = await tx<
      Record<string, unknown>
    >`select title,description,brand,colour,material,category_canonical,size_uk,condition from items where id=${request.itemId} and user_id=${user}`;
    if (!item) throw Error("ITEM_NOT_FOUND");
    const sources = await tx<{
      source_data: Record<string, unknown>;
    }>`select source_data from channel_listings where item_id=${request.itemId} and user_id=${user} order by created_at limit 2`;
    // Multiple imported sources may disagree. Never arbitrarily pick one as truth.
    const source = sources.length === 1 ? sources[0].source_data : {};
    const fields = Object.fromEntries(
      AI_FIELDS.map((field) => [
        field,
        {
          source: clean(source[field === "category" ? "categoryName" : field]),
          saved: clean(item[columns[field] || ""]),
          user: clean(request.userValues?.[field]),
        },
      ]),
    ) as Record<AiField, FieldValue>;
    if (request.photoId) {
      const found =
        await tx`select id from item_photos where id=${request.photoId} and item_id=${request.itemId} and user_id=${user}`;
      if (!found.length) throw Error("PHOTO_NOT_FOUND");
    }
    if (AI_OPERATIONS[request.operation].family === "image" && !request.photoId)
      throw Error("PHOTO_REQUIRED");
    return {
      operation: request.operation,
      fields,
      destination: request.destination,
      category: request.category?.slice(0, 200) || "",
      photoIds: request.photoId ? [request.photoId] : [],
      settings: {
        ratio: request.settings?.ratio || "original",
        scene: request.settings?.scene || "white studio",
        presentation: request.settings?.presentation || "neutral",
        prompt: request.settings?.prompt || "",
      },
    };
  }
  async queueBatch(user: string, requestKey: string, requests: AiRequest[]) {
    if (
      !/^[A-Za-z0-9_-]{8,100}$/.test(requestKey) ||
      requests.length < 1 ||
      requests.length > 20 ||
      JSON.stringify(requests).length > 40000
    )
      throw Error("INVALID_REQUEST");
    for (const r of requests) {
      this.enabled(r.operation);
      if (
        !MOCK_MODES.includes(r.mode || "SUCCESS") ||
        !["ebay_uk", "vinted_uk"].includes(r.destination)
      )
        throw Error("INVALID_REQUEST");
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(requests)).digest("hex");
    return this.sql.transaction(async (tx) => {
      const owner = await this.lock(tx, user);
      await this.recoverLocked(tx, user);
      const [existing] = await tx<{
        id: string;
        fingerprint: string;
      }>`select id,fingerprint from ai_batches where user_id=${user} and request_key=${requestKey}`;
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw Error("IDEMPOTENCY_CONFLICT");
        return (
          await tx<{
            id: string;
          }>`select id from ai_jobs where batch_id=${existing.id} and user_id=${user} order by position`
        ).map((j) => j.id);
      }
      const allowance =
        owner.billing_status === "active" && Object.hasOwn(this.config.allowances, owner.plan) ? this.config.allowances[owner.plan] : 0;
      if (!allowance) throw Error("PLAN_HAS_NO_AI_CREDITS");
      const month = this.clock().toISOString().slice(0, 7);
      await tx`insert into ai_wallets(user_id,month) values(${user},${month}) on conflict do nothing`;
      const [wallet] = await tx<{
        reserved: number;
        consumed: number;
      }>`select reserved,consumed from ai_wallets where user_id=${user} and month=${month} for update`;
      const total = requests.reduce((sum, r) => sum + this.config.costs[r.operation], 0);
      if (wallet.reserved + wallet.consumed + total > allowance)
        throw Error("INSUFFICIENT_CREDITS");
      const batch = id();
      await tx`insert into ai_batches(id,user_id,request_key,fingerprint) values(${batch},${user},${requestKey},${fingerprint})`;
      const ids: string[] = [];
      for (const [position, r] of requests.entries()) {
        const family = AI_OPERATIONS[r.operation].family;
        const provider = providerFor(
          family === "listing" ? this.config.textProvider : this.config.imageProvider,
        );
        const model = family === "listing" ? this.config.textModel : this.config.imageModel;
        const input = await this.snapshot(tx, user, r);
        const estimate = provider.estimateCost(input, model);
        const job = id(),
          credits = this.config.costs[r.operation];
        ids.push(job);
        await tx`insert into ai_jobs(id,user_id,batch_id,position,item_id,source_photo_id,operation,provider,model,tier,month,credit_cost,status,input,settings,mock_mode,expires_at) values(${job},${user},${batch},${position},${r.itemId},${r.photoId || null},${r.operation},${provider.id},${model},${owner.plan},${month},${credits},'RESERVED',${JSON.stringify(input)}::jsonb,${JSON.stringify(input.settings)}::jsonb,${r.mode || "SUCCESS"},now()+interval '10 minutes')`;
        await this.event(tx, job, "QUEUED");
        await this.event(tx, job, "RESERVED");
        await tx`insert into ai_credit_ledger(id,job_id,user_id,month,event,credits) values(${id()},${job},${user},${month},'reserve',${credits})`;
        await tx`insert into ai_cost_ledger(job_id,user_id,provider,model,operation,tier,estimated_cost,actual_cost,currency) values(${job},${user},${provider.id},${model},${r.operation},${owner.plan},${estimate.amount},0,${estimate.currency})`;
      }
      await tx`update ai_wallets set reserved=reserved+${total} where user_id=${user} and month=${month}`;
      return ids;
    });
  }
  async run(user: string, jobId: string) {
    const claimed = await this.sql.transaction(async (tx) => {
      await this.lock(tx, user);
      await this.recoverLocked(tx, user);
      const [job] =
        await tx<Job>`select * from ai_jobs where id=${jobId} and user_id=${user} for update`;
      if (!job) throw Error("JOB_NOT_FOUND");
      if (job.status !== "RESERVED") return null;
      const lease = id();
      await tx`update ai_jobs set status='PROCESSING',lease_token=${lease},expires_at=now()+interval '30 seconds' where id=${jobId}`;
      await this.event(tx, jobId, "PROCESSING");
      return { ...job, lease_token: lease };
    });
    if (!claimed) return;
    let result: AiOutput | undefined, errorCode: string | undefined;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const family = this.enabled(claimed.operation);
      const provider = providerFor(claimed.provider);
      const work =
        family === "listing"
          ? provider.listingSuggestion.bind(provider)
          : provider.imageTransform.bind(provider);
      const raw = await Promise.race([
        work(claimed.input, {
          model: claimed.model,
          mode: claimed.mock_mode,
          signal: controller.signal,
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(Error("TIMEOUT"));
          }, 15000);
        }),
      ]);
      result = validateOutput(raw, family);
    } catch (e) {
      errorCode = e instanceof Error && failureCodes.has(e.message) ? e.message : "PROVIDER_ERROR";
    } finally {
      if (timer) clearTimeout(timer);
    }
    await this.sql.transaction(async (tx) => {
      await this.lock(tx, user);
      const [job] =
        await tx<Job>`select * from ai_jobs where id=${jobId} and user_id=${user} for update`;
      // A cancelled/expired lease cannot resurrect an output or charge a second time.
      if (!job || job.status !== "PROCESSING" || job.lease_token !== claimed.lease_token) return;
      if (new Date(job.expires_at).getTime() <= Date.now()) {
        await this.restore(tx, job, "REFUNDED", "LEASE_EXPIRED");
        return;
      }
      if (!result || errorCode) {
        await this.restore(tx, job, "REFUNDED", errorCode || "INVALID_OUTPUT");
        return;
      }
      for (const suggestion of result.suggestions || []) {
        const field = job.input.fields[suggestion.field];
        const safe =
          suggestion.safe &&
          suggestion.confidence === "high" &&
          !field.saved &&
          !field.source &&
          !field.user;
        await tx`insert into ai_suggestions(id,job_id,user_id,field,source_value,saved_value,user_value,suggested_value,confidence,evidence,safe) values(${id()},${jobId},${user},${suggestion.field},${field.source},${field.saved},${field.user},${suggestion.value},${suggestion.confidence},${suggestion.evidence},${safe})`;
      }
      if (result.image)
        await tx`insert into ai_generated_assets(id,job_id,user_id,source_photo_id,operation,provider,model,settings,preview_kind,credit_cost,provider_cost) values(${id()},${jobId},${user},${job.source_photo_id},${job.operation},${job.provider},${job.model},${JSON.stringify(job.input.settings)}::jsonb,'development_placeholder',${job.credit_cost},${result.cost.actual})`;
      await tx`update ai_wallets set reserved=reserved-${job.credit_cost},consumed=consumed+${job.credit_cost} where user_id=${user} and month=${job.month}`;
      await tx`insert into ai_credit_ledger(id,job_id,user_id,month,event,credits) values(${id()},${jobId},${user},${job.month},'consume',${job.credit_cost})`;
      await tx`update ai_cost_ledger set input_usage=${result.usage.input},output_usage=${result.usage.output},images_generated=${result.usage.images},estimated_cost=${result.cost.estimated},actual_cost=${result.cost.actual},currency=${result.cost.currency},credits_charged=${job.credit_cost} where job_id=${jobId}`;
      await tx`update ai_jobs set status='SUCCEEDED',finished_at=now(),lease_token=null where id=${jobId}`;
      await this.event(tx, jobId, "SUCCEEDED");
    });
  }
  async cancel(user: string, jobId: string) {
    await this.sql.transaction(async (tx) => {
      await this.lock(tx, user);
      const [job] =
        await tx<Job>`select * from ai_jobs where id=${jobId} and user_id=${user} for update`;
      if (!job) throw Error("JOB_NOT_FOUND");
      await this.restore(tx, job, "CANCELLED", "CANCELLED_BY_USER");
    });
  }
  async retry(user: string, jobId: string, requestKey: string) {
    const [job] = await this.sql<Job>`select * from ai_jobs where id=${jobId} and user_id=${user}`;
    if (!job) throw Error("JOB_NOT_FOUND");
    if (!["REFUNDED", "CANCELLED"].includes(job.status)) throw Error("JOB_NOT_RETRYABLE");
    return this.queueBatch(user, requestKey, [
      {
        itemId: job.item_id,
        operation: job.operation,
        photoId: job.source_photo_id || undefined,
        destination: job.input.destination,
        category: job.input.category,
        settings: job.input.settings,
        userValues: Object.fromEntries(
          AI_FIELDS.filter((f) => job.input.fields[f].user).map((f) => [
            f,
            job.input.fields[f].user!,
          ]),
        ),
        mode: job.mock_mode,
      },
    ]);
  }
  async review(
    user: string,
    suggestionId: string,
    decision: "accepted" | "rejected",
    confirm = false,
  ) {
    await this.sql.transaction(async (tx) => {
      await this.lock(tx, user);
      const [s] = await tx<{
        id: string;
        field: AiField;
        source_value: string | null;
        saved_value: string | null;
        user_value: string | null;
        suggested_value: string | null;
        state: string;
        item_id: string;
      }>`select s.*,j.item_id from ai_suggestions s join ai_jobs j on j.id=s.job_id where s.id=${suggestionId} and s.user_id=${user} for update of s`;
      if (!s) throw Error("SUGGESTION_NOT_FOUND");
      if (s.state === decision) return;
      if (s.state !== "pending") throw Error("SUGGESTION_ALREADY_REVIEWED");
      if (decision === "accepted") {
        if (!s.suggested_value) throw Error("UNKNOWN_CANNOT_BE_ACCEPTED");
        const [current] = await tx<
          Record<string, unknown>
        >`select title,description,brand,colour,material,category_canonical,size_uk,condition from items where id=${s.item_id} and user_id=${user} for update`;
        if (!current) throw Error("ITEM_NOT_FOUND");
        const now = clean(current[columns[s.field] || ""]);
        if (now !== s.saved_value) throw Error("SAVED_VALUE_CHANGED");
        if ((now || s.source_value || s.user_value) && !confirm) throw Error("CONFIRM_KNOWN_VALUE");
      }
      // A review-only mock overlay. NEVER write mock values into items/channel listings.
      await tx`update ai_suggestions set state=${decision},decided_at=now() where id=${suggestionId} and user_id=${user}`;
    });
  }
  async reviewSafe(user: string, jobId: string) {
    // Each field is rechecked at decision time; changed inventory is never overwritten.
    const rows = await this.sql<{
      id: string;
    }>`select id from ai_suggestions where user_id=${user} and job_id=${jobId} and state='pending' and safe=true and suggested_value is not null`;
    for (const row of rows) await this.review(user, row.id, "accepted");
    return rows.length;
  }
  async reviewAsset(user: string, assetId: string, status: "accepted" | "rejected" | "deleted") {
    const rows = await this
      .sql`update ai_generated_assets set status=${status} where id=${assetId} and user_id=${user} and status<>'deleted' returning id`;
    if (!rows.length) throw Error("ASSET_NOT_FOUND");
    // Deletion tombstones only the derivative. Source photo rows/bytes remain untouched.
  }
  async state(user: string) {
    await this.recover(user);
    const [owner] = await this.sql<{
      plan: string;
      billing_status: string;
    }>`select plan,billing_status from user_settings where user_id=${user}`;
    const month = this.clock().toISOString().slice(0, 7),
      allowance = owner.billing_status === "active" && Object.hasOwn(this.config.allowances, owner.plan) ? this.config.allowances[owner.plan] : 0;
    const [wallet] = await this.sql<{
      reserved: number;
      consumed: number;
    }>`select reserved,consumed from ai_wallets where user_id=${user} and month=${month}`;
    const jobs = await this.sql<{
      id: string;
      item_id: string;
      operation: AiOperation;
      status: string;
      credit_cost: number;
      error_code: string | null;
      created_at: string;
      source_photo_id: string | null;
    }>`select id,item_id,operation,status,credit_cost,error_code,created_at,source_photo_id from ai_jobs where user_id=${user} order by created_at desc limit 50`;
    const suggestions = await this.sql<{
      id: string;
      job_id: string;
      field: AiField;
      source_value: string | null;
      saved_value: string | null;
      user_value: string | null;
      suggested_value: string | null;
      confidence: string;
      evidence: string;
      safe: boolean;
      state: string;
    }>`select id,job_id,field,source_value,saved_value,user_value,suggested_value,confidence,evidence,safe,state from ai_suggestions where user_id=${user} and job_id=any(${jobs.map((j) => j.id)}::text[])`;
    const assets = await this.sql<{
      id: string;
      job_id: string;
      source_photo_id: string;
      operation: AiOperation;
      status: string;
      created_at: string;
    }>`select id,job_id,source_photo_id,operation,status,created_at from ai_generated_assets where user_id=${user} and status<>'deleted' and job_id=any(${jobs.map((j) => j.id)}::text[])`;
    const items = await this.sql<{
      id: string;
      title: string;
    }>`select id,title from items where user_id=${user} order by updated_at desc limit 100`;
    const photos = await this.sql<{
      id: string;
      item_id: string;
      url: string;
    }>`select id,item_id,url from item_photos where user_id=${user} and item_id=any(${items.map((i) => i.id)}::text[]) order by sort_order limit 1200`;
    const next = new Date(month + "-01T00:00:00Z");
    next.setUTCMonth(next.getUTCMonth() + 1);
    return {
      development: this.config.development,
      flags: { listing: this.config.listing, image: this.config.image },
      costs: this.config.costs,
      allowance,
      reserved: wallet?.reserved || 0,
      consumed: wallet?.consumed || 0,
      remaining: Math.max(0, allowance - (wallet?.reserved || 0) - (wallet?.consumed || 0)),
      resetsAt: next.toISOString(),
      jobs,
      suggestions,
      assets,
      items,
      photos,
    };
  }
}
function validateOutput(raw: unknown, family: string): AiOutput {
  const r = raw as AiOutput;
  if (
    !r ||
    r.mock !== true ||
    !r.usage ||
    !r.cost ||
    [r.usage.input, r.usage.output, r.usage.images, r.cost.estimated, r.cost.actual].some(
      (v) => v !== 0,
    ) ||
    r.cost.currency !== "GBP"
  )
    throw Error("INVALID_OUTPUT");
  if (family === "listing") {
    if (
      !Array.isArray(r.suggestions) ||
      r.suggestions.length > AI_FIELDS.length ||
      new Set(r.suggestions.map((s) => s.field)).size !== r.suggestions.length
    )
      throw Error("INVALID_OUTPUT");
    for (const s of r.suggestions)
      if (
        !AI_FIELDS.includes(s.field) ||
        (s.value !== null &&
          (typeof s.value !== "string" ||
            !s.value.startsWith("[MOCK]") ||
            s.value.length > 10000)) ||
        typeof s.evidence !== "string" ||
        s.evidence.length > 2000 ||
        !["high", "medium", "low", "unknown"].includes(s.confidence) ||
        typeof s.safe !== "boolean"
      )
        throw Error("INVALID_OUTPUT");
  } else if (
    r.image?.kind !== "development_placeholder" ||
    r.image.label !== "AI PROVIDER NOT CONFIGURED — DEVELOPMENT PREVIEW"
  )
    throw Error("INVALID_OUTPUT");
  return r;
}
