import type Stripe from "stripe";
import type { Sql } from "../../db";
import type { PlanId } from "../types";

type ObjectData = Record<string, unknown>;
const object = (value: unknown): ObjectData => value && typeof value === "object" ? value as ObjectData : {};
const id = (value: unknown): string => typeof value === "string" ? value : typeof object(value).id === "string" ? String(object(value).id) : "";
export type BillingEvent = { id: string; type: string; livemode: boolean; data: { object: ObjectData } };

export function parseBillingEvent(value: unknown): BillingEvent | null {
  const event = object(value);
  if (typeof event.id !== "string" || !event.id.startsWith("evt_") || typeof event.type !== "string" || typeof event.livemode !== "boolean" || !object(object(event.data).object).id) return null;
  return event as BillingEvent;
}

function subscriptionId(event: BillingEvent): string {
  const obj = event.data.object;
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"].includes(event.type)) return id(obj);
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type)) return obj.mode === "subscription" ? id(obj.subscription) : "";
  if (["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required", "invoice.voided", "invoice.marked_uncollectible"].includes(event.type)) {
    return id(object(object(obj.parent).subscription_details).subscription) || id(obj.subscription);
  }
  return "";
}

export async function reconcileBillingEvent(sql: Sql, event: BillingEvent, deps: {
  retrieve: (id: string) => Promise<Stripe.Subscription>;
  planForPrice: (id: string) => PlanId | null;
}): Promise<string> {
  return sql.transaction(async tx => {
    const inserted = await tx`insert into billing_webhook_events(event_id,event_type) values (${event.id},${event.type}) on conflict do nothing returning event_id`;
    if (!inserted.length) return "duplicate";
    const finish = async (outcome: string) => {
      await tx`update billing_webhook_events set outcome=${outcome},processed_at=now() where event_id=${event.id}`;
      return outcome;
    };
    const subId = subscriptionId(event);
    if (!subId) return finish("unhandled");
    // Serialize reads as well as writes: two concurrent deliveries cannot commit
    // an older provider snapshot after a newer one. The provider call is bounded.
    await tx`insert into billing_subscription_locks(subscription_id) values (${subId}) on conflict do nothing`;
    await tx`select subscription_id from billing_subscription_locks where subscription_id=${subId} for update`;
    const sub = await deps.retrieve(subId);
    const customer = id(sub.customer);
    if (sub.id !== subId || sub.livemode !== event.livemode || !customer) throw new Error("Billing subscription identity mismatch");
    const eventCustomer = id(event.data.object.customer);
    if (eventCustomer && eventCustomer !== customer) throw new Error("Billing customer mismatch");
    const metadataUser = sub.metadata?.userId;
    const rows = metadataUser
      ? await tx`select user_id,stripe_customer_id,stripe_subscription_id from user_settings where user_id=${metadataUser} for update`
      : await tx`select user_id,stripe_customer_id,stripe_subscription_id from user_settings where stripe_subscription_id=${subId} for update`;
    const user = rows[0];
    if (!user) throw new Error("Billing owner unavailable; retry after reconciliation");
    if ((user.stripe_customer_id && user.stripe_customer_id !== customer) || (user.stripe_subscription_id && user.stripe_subscription_id !== subId)) return finish("binding_conflict");
    const checkoutUser = event.type.startsWith("checkout.") ? event.data.object.client_reference_id : undefined;
    if (checkoutUser && checkoutUser !== user.user_id) throw new Error("Billing checkout owner mismatch");
    const lines = sub.items.data;
    const plan = lines.length === 1 && lines[0].quantity === 1 ? deps.planForPrice(lines[0].price.id) : null;
    // Subscription status alone does not prove payment for asynchronous methods.
    // Never turn Stripe trials into Lane's separate, lifetime-limited no-card trial.
    const invoice = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const paid = invoice?.status === "paid";
    const status = plan && sub.status === "active" && paid && !sub.pause_collection
      ? "active"
      : sub.status === "canceled" ? "canceled"
        : sub.status === "past_due" ? "past_due" : "incomplete";
    await tx`update user_settings set billing_status=${status},plan=${plan ?? "starter"},ai_pack=false,
      stripe_customer_id=${customer},stripe_subscription_id=${subId} where user_id=${user.user_id}`;
    return finish(plan ? "reconciled" : "unknown_price");
  });
}
