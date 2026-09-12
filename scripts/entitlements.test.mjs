import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { entitlements } from "../src/lib/lane/entitlements.ts";
import { reserveAiCredit, estimateTokenCost } from "../src/lib/lane/server/ai-credits.ts";
import { reserveListingAction, recordActivation } from "../src/lib/lane/server/events.ts";

test("trial and billing gates fail closed while inventory stays manageable", () => {
  const base = { plan: "pro", billingStatus: "trialing", trialEndsAt: "2026-10-01", trialActionsUsed: 0, actionsUsedMonth: 0 };
  const live = entitlements(base, Date.parse("2026-09-30"));
  assert.equal(live.aiCreditsLimit, 0);
  assert.equal(live.actionsLimit, 25);
  assert.equal(live.canPublish, true);
  for (const status of ["canceled", "past_due", "incomplete", "unpaid"]) {
    const gated = entitlements({ ...base, billingStatus: status }, 0);
    assert.equal(gated.canPublish, false);
    assert.equal(gated.aiCreditsLimit, 0);
    assert.equal(gated.canManageInventory, true);
  }
  assert.equal(entitlements(base, Date.parse("2026-10-01")).canPublish, false);
  assert.equal(entitlements({ ...base, trialActionsUsed: 25 }, 0).canPublish, false);
  assert.equal(entitlements({ ...base, plan: "starter", billingStatus: "active" }, 0).aiCreditsLimit, 0);
});

test("real Postgres reservations, lifetime trial cap, refunds, and supplier budget", async () => {
  const pg = new PGlite();
  try {
    for (const name of readdirSync(new URL("../migrations/", import.meta.url)).filter(n => /^000[2-7]_.*\.sql$/.test(n)).sort()) {
      await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    }
    await pg.exec(readFileSync(new URL("../migrations/0009_entitlements_usage.sql", import.meta.url), "utf8"));
    const sql = async (strings, ...values) => {
      let query = strings[0];
      for (let i = 0; i < values.length; i++) query += `$${i + 1}${strings[i + 1]}`;
      return (await pg.query(query, values)).rows;
    };
    await sql`insert into user_settings(user_id,plan,ai_autofill_enabled) values ('trial','pro',true)`;
    const trial = (await sql`select * from user_settings where user_id='trial'`)[0];
    assert.equal(trial.billing_status, "trialing");
    assert.equal((new Date(trial.trial_ends_at) - new Date(trial.trial_started_at)) / 86400000, 7);
    const opts = { model: "grok-4.3", requestType: "field_autofill" };
    await assert.rejects(reserveAiCredit("trial", opts, sql), /Trials include no AI/);
    const actions = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => reserveListingAction(sql, "trial", `trial-${i}`, "publish")));
    assert.equal(actions.filter(r => r.status === "fulfilled").length, 25);
    await reserveListingAction(sql, "trial", "trial-0", "publish");
    await sql`update user_settings set actions_month = '2020-01', actions_used_month = 0 where user_id='trial'`;
    await assert.rejects(reserveListingAction(sql, "trial", "next-month", "relist"), /allowance unavailable/);
    assert.equal((await sql`select trial_actions_used from user_settings where user_id='trial'`)[0].trial_actions_used, 25);
    await sql`update user_settings set trial_ends_at=now()-interval '1 second' where user_id='trial'`;
    await assert.rejects(reserveListingAction(sql, "trial", "trial-0", "publish"), /allowance unavailable/);

    await sql`insert into user_settings(user_id,plan,billing_status,ai_autofill_enabled) values ('paid','seller','active',true),('starter','starter','active',true),('canceled','pro','canceled',true)`;
    await assert.rejects(reserveAiCredit("starter", opts, sql));
    await assert.rejects(reserveAiCredit("canceled", opts, sql));
    const month = new Date().toISOString().slice(0, 7);
    await sql`insert into ai_credit_usage(user_id,month,used,attempts) values ('paid',${month},149,149)`;
    const batch = await Promise.allSettled(Array.from({ length: 10 }, () => reserveAiCredit("paid", opts, sql)));
    assert.equal(batch.filter(r => r.status === "fulfilled").length, 1);
    const reservation = batch.find(r => r.status === "fulfilled").value;
    await reservation.release({ prompt_tokens: 1000, completion_tokens: 200 });
    await reservation.release({ prompt_tokens: 1000, completion_tokens: 200 });
    const usage = (await sql`select * from ai_credit_usage where user_id='paid'`)[0];
    assert.equal(usage.used, 149);
    assert.equal(usage.attempts, 150);
    assert.equal(Number(usage.budget_used_usd), 0.00175);
    const ledger = (await sql`select * from ai_action_ledger where id=${reservation.id}`)[0];
    assert.equal(ledger.credits_restored, 1);
    assert.equal(ledger.input_tokens, 1000);
    assert.equal(Number(ledger.estimated_token_cost_usd), 0.00175);
    assert.equal(ledger.cost_basis, "standard_token_rate_estimate");
    const unknown = await reserveAiCredit("paid", opts, sql);
    await unknown.release();
    const unpriced = (await sql`select * from ai_action_ledger where id=${unknown.id}`)[0];
    assert.equal(unpriced.estimated_token_cost_usd, null);
    assert.equal(Number(unpriced.budget_charge_usd), 0.1);
    const successful = await reserveAiCredit("paid", opts, sql);
    await successful.settle({ outcome: "consumed", usage: { prompt_tokens: 100, completion_tokens: 10 } });
    await successful.release(); // Late error handling must not undo a completed charge.
    assert.equal((await sql`select used from ai_credit_usage where user_id='paid'`)[0].used, 150);
    assert.equal((await sql`select credits_consumed from ai_action_ledger where id=${successful.id}`)[0].credits_consumed, 1);
    await sql`update ai_credit_usage set used=149 where user_id='paid'`;
    await sql`update ai_credit_usage set budget_used_usd=2.95 where user_id='paid'`;
    await assert.rejects(reserveAiCredit("paid", opts, sql), /cost budget/);
    await sql`update ai_credit_usage set budget_used_usd=0, attempts=300 where user_id='paid'`;
    await assert.rejects(reserveAiCredit("paid", opts, sql));
    await recordActivation(sql, "paid", "first_import", "vinted_uk");
    await recordActivation(sql, "paid", "first_import", "ebay_uk");
    assert.equal((await sql`select * from activation_events where user_id='paid'`).length, 1);
    assert.equal(estimateTokenCost("other", { prompt_tokens: 100, completion_tokens: 10 }).estimatedUsd, null);
  } finally { await pg.close(); }
});
