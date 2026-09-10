import type { Sql } from "../../db";

export type AiRequestType = "field_autofill" | "listing_copy";
export type ProviderUsage = { prompt_tokens?: number; completion_tokens?: number };
type Settlement = { outcome: "consumed" | "restored"; usage?: ProviderUsage; failureCode?: "provider_error" | "invalid_response" | "no_suggestions" | "request_failed" };

export function estimateTokenCost(model: string, usage?: ProviderUsage) {
  const valid = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  const input = valid(usage?.prompt_tokens) ? usage.prompt_tokens : null;
  const output = valid(usage?.completion_tokens) ? usage.completion_tokens : null;
  // Standard token list rate in USD. Cache discounts/other provider charges and
  // actual invoice amount are unknown; never present this as actual billed cost.
  const estimatedUsd = model === "grok-4.3" && input !== null && output !== null
    ? (input * 1.25 + output * 2.5) / 1_000_000 : null;
  return { input, output, estimatedUsd, basis: estimatedUsd === null ? "unknown" : "standard_token_rate_estimate" };
}

/** DB injection enables local Postgres tests, never client-supplied entitlements. */
export async function reserveAiCredit(userId: string, options: { requestType: AiRequestType; model: string }, injectedSql?: Sql) {
  if (options.model !== "grok-4.3") throw new Error("This AI model has not passed Lane's cost limits. Manual fields remain available.");
  const sql = injectedSql ?? await (await import("@/lib/db")).getSql();
  if (!injectedSql) await (await import("./map")).ensureUser(sql, userId);
  const month = new Date().toISOString().slice(0, 7);
  const id = crypto.randomUUID();
  // Trialing is NEVER eligible, even with a Seller/Pro plan in the database.
  const rows = await sql<{ used: number; allowance: number }>`
    with eligible as (
      select user_id, plan, case plan when 'seller' then 150 when 'pro' then 500 else 0 end as allowance, case plan when 'seller' then 3 else 8 end as budget
      from user_settings where user_id = ${userId} and billing_status = 'active'
        and ai_autofill_enabled = true and plan in ('seller','pro') for update
    ), reserved as (
      insert into ai_credit_usage (user_id,month,used,attempts,budget_used_usd)
      select user_id,${month},1,1,0.10 from eligible
      on conflict(user_id,month) do update set used = ai_credit_usage.used + 1, attempts = ai_credit_usage.attempts + 1, budget_used_usd = ai_credit_usage.budget_used_usd + 0.10
      where ai_credit_usage.used < (select allowance from eligible)
        and ai_credit_usage.attempts < (select allowance * 2 from eligible)
        and ai_credit_usage.budget_used_usd + 0.10 <= (select budget from eligible)
      returning used
    ), logged as (
      insert into ai_action_ledger(id,user_id,tier,request_type,model,month)
      select ${id},eligible.user_id,eligible.plan,${options.requestType},${options.model},${month}
      from eligible,reserved returning id
    ) select reserved.used,eligible.allowance from reserved,eligible,logged
  `;
  if (!rows.length) throw new Error("AI needs an active Seller or Pro plan, AI assistance turned on, and available credits/retry cost budget. Monthly safety limits pause AI without overage charges. Trials include no AI credits. Manual fields remain available.");
  const remaining = Number(rows[0]!.allowance) - Number(rows[0]!.used);
  async function settle(result: Settlement) {
    const cost = estimateTokenCost(options.model, result.usage);
    // Database idempotency survives retries. Restoring a credit does not erase cost.
    await sql`
      with settled as (
        update ai_action_ledger set status = ${result.outcome}, settled_at = now(),
          credits_consumed = ${result.outcome === "consumed" ? 1 : 0}, credits_restored = ${result.outcome === "restored" ? 1 : 0},
          input_tokens = ${cost.input}, output_tokens = ${cost.output}, estimated_token_cost_usd = ${cost.estimatedUsd},
          cost_basis = ${cost.basis}, budget_charge_usd = ${cost.estimatedUsd ?? 0.10}, failure_code = ${result.failureCode ?? null}
        where id = ${id} and user_id = ${userId} and status = 'reserved'
        returning user_id,month,credits_restored,cost_reserved_usd,budget_charge_usd
      ) update ai_credit_usage set used = greatest(0,used - settled.credits_restored),
        budget_used_usd = greatest(0,budget_used_usd - settled.cost_reserved_usd + settled.budget_charge_usd)
        from settled where ai_credit_usage.user_id = settled.user_id and ai_credit_usage.month = settled.month
    `;
  }
  return { id, remaining, settle, release: (usage?: ProviderUsage) => settle({ outcome: "restored", usage, failureCode: "request_failed" }) };
}
