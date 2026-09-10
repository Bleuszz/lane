import type { Sql } from "../../db";

export type ActivationEvent = "user_signup" | "trial_started" | "source_connected" | "first_import" | "first_publish" | "destination_connected" | "destination_preview" | "ai_suggestion_accepted" | "ai_suggestion_rejected" | "publish_requested";
/** First-occurrence funnel only: no listing text, photos, credentials, or customer PII. */
export async function recordActivation(sql: Sql, userId: string, event: ActivationEvent, marketplace?: string) {
  await sql`insert into activation_events(id,user_id,event_name,marketplace)
    values(${crypto.randomUUID()},${userId},${event},${marketplace ?? null}) on conflict(user_id,event_name) do nothing`;
}

/** Call for publish/relist jobs only; use the stable job/request id on every retry. */
export async function reserveListingAction(sql: Sql, userId: string, requestId: string, type: "publish" | "relist") {
  const rows = await sql<{ allowed: boolean }>`select lane_reserve_listing_action(${userId},${requestId},${type}) as allowed`;
  if (!rows[0]?.allowed) throw Object.assign(new Error("Publishing allowance unavailable. Check your trial, billing status, or action limit. Your inventory, edits, exports, and delisting remain available."), { code: "cap" });
}
