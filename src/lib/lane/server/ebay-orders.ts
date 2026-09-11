import { randomUUID } from "node:crypto";
import type { Sql } from "../../db";
import { makeId } from "../ids";
import { saleEventKey } from "./operations";
import { EbayTemporaryError } from "./ebay-transport";

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid eBay order response.");
  return value as ObjectValue;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error("eBay order identifiers are missing or invalid.");
  return value;
}
function timestamp(value: unknown): number {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) throw new Error("eBay order date is missing or invalid.");
  return time;
}
function gbp(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const amount = value as ObjectValue;
  if (amount.currency !== "GBP" || typeof amount.value !== "string" || !/^\d+(\.\d{1,2})?$/.test(amount.value)) return null;
  const n = Number(amount.value);
  return Number.isFinite(n) && n <= 1_000_000 ? n : null;
}
export type OrderLine = {
  lineId: string; orderId: string; listingId: string; quantity: number | null;
  amount: number | null; createdAt: string; problem: string | null;
};

/** Full-page validation precedes any stock write. Never infer amount from an order total. */
export function parseEbayOrderPage(value: unknown, offset: number) {
  const page = object(value);
  if (!Number.isInteger(page.total) || Number(page.total) < 0 || !Array.isArray(page.orders) || page.orders.length > 100 || page.offset !== offset) throw new Error("Invalid eBay order pagination. Cursor retained.");
  if (page.orders.length === 0 && (Number(page.total) > offset || Boolean(page.next))) throw new Error("Incomplete eBay order page. Cursor retained.");
  const lines: OrderLine[] = [];
  for (const raw of page.orders) {
    const order = object(raw), orderId = id(order.orderId), createdAt = new Date(timestamp(order.creationDate)).toISOString();
    if (!Array.isArray(order.lineItems) || !order.lineItems.length || order.lineItems.length > 200) throw new Error("Invalid eBay order lines. Cursor retained.");
    const cancellation = order.cancelStatus && typeof order.cancelStatus === "object" ? (order.cancelStatus as ObjectValue).cancelState : null;
    for (const rawLine of order.lineItems) {
      const line = object(rawLine), quantity = Number.isInteger(line.quantity) && Number(line.quantity) > 0 && Number(line.quantity) <= 100_000 ? Number(line.quantity) : null;
      const amount = gbp(line.discountedLineItemCost ?? line.lineItemCost);
      const problem = order.orderPaymentStatus !== "PAID" ? "Payment is not PAID; check the order in eBay."
        : cancellation !== "NONE_REQUESTED" ? "Cancellation state requires review; stock was not restored."
        : line.legacyVariationId ? "Variation listings require manual matching."
        : quantity === null || amount === null ? "Quantity or GBP item amount needs review." : null;
      lines.push({ lineId:id(line.lineItemId), orderId, listingId:id(line.legacyItemId), quantity, amount, createdAt, problem });
    }
  }
  return { lines, count:page.orders.length, more:offset + page.orders.length < Number(page.total) || Boolean(page.next) };
}

type Sync = {user_id:string;account_id:string;environment:string;started_at:Date|string;cursor_at:Date|string;window_to:Date|string|null;page_offset:number};
type PollDependencies = {
  token:(sql:Sql,userId:string,accountId:string)=>Promise<{access:string}>;
  fetchPage:(access:string,path:string)=>Promise<{ok:boolean;status:number;json:unknown}>;
};

async function applyLine(tx:Sql, state:Sync, line:OrderLine) {
  const {user_id:userId,account_id:accountId,environment} = state;
  const matches = await tx<{id:string;item_id:string;created_at:Date|string}>`select id,item_id,created_at from channel_listings
    where user_id=${userId} and marketplace_account_id=${accountId} and marketplace='ebay_uk' and remote_id=${line.listingId}`;
  let reason = line.problem, outcome = "needs_review";
  const channel = matches.length === 1 ? matches[0] : null;
  if (!channel) reason = "No unique linked listing. Match and record the sale manually using this line reference.";
  else if (Date.parse(line.createdAt) < Math.max(new Date(state.started_at).getTime(), new Date(channel.created_at).getTime())) {
    outcome = "before_tracking"; reason = "Order predates tracking or this listing link; reconcile manually to avoid double-counting imported stock.";
  } else {
    const item = (await tx<{quantity:number;status:string;cost_price_gbp:string|null}>`select quantity,status,cost_price_gbp from items where id=${channel.item_id} and user_id=${userId} for update`)[0];
    if (!item) throw new Error("Linked inventory is unavailable.");
    const key = saleEventKey({marketplace:"ebay_uk",accountId,eventId:line.lineId,itemId:channel.item_id});
    const prior = (await tx<{item_id:string;quantity:number;sold_price_gbp:string}>`select item_id,quantity,sold_price_gbp from sales where user_id=${userId} and remote_event_key=${key}`)[0];
    if (prior) {
      if (prior.item_id !== channel.item_id || prior.quantity !== line.quantity || Number(prior.sold_price_gbp) !== line.amount) reason = "Recorded sale differs from this order line. Review it; no second stock change was made.";
      else if (!reason) outcome = "recorded";
    } else if (!reason && line.quantity !== null && line.amount !== null) {
      if (item.quantity < line.quantity || ["sold","archived"].includes(item.status)) reason = "Available stock differs from this sale. Reconcile before recording it.";
      else {
        const saleId = makeId("sal");
        const result = await tx<{recorded:boolean}>`select lane_record_sale(${userId},${channel.item_id},${channel.id},'ebay_uk',${accountId},${saleId},${key},${line.amount},null,null,'api_poll',${line.quantity}) as recorded`;
        if (!result[0]?.recorded) throw new Error("Sale changed concurrently. Page will be retried.");
        const cost = item.cost_price_gbp === null ? null : Number(item.cost_price_gbp);
        const costTotal = cost !== null && Number.isFinite(cost) && cost >= 0 ? Math.round(cost*line.quantity*100)/100 : null;
        await tx`update sales set reference=${line.lineId},amounts_basis='provider',cost_total_gbp=${costTotal},created_at=${line.createdAt} where id=${saleId} and user_id=${userId}`;
        outcome = "recorded";
      }
    }
  }
  await tx`insert into ebay_order_events(user_id,account_id,environment,line_id,order_id,listing_id,quantity,item_amount_gbp,order_created_at,outcome,reason)
    values(${userId},${accountId},${environment},${line.lineId},${line.orderId},${line.listingId},${line.quantity},${line.amount},${line.createdAt},${outcome},${reason})
    on conflict(user_id,account_id,environment,line_id) do update set outcome=excluded.outcome,reason=excluded.reason,observed_at=now()`;
}

/** One account/page per authenticated worker request. Off until explicitly configured. */
export async function pollEbayOrders(sql:Sql, environment:"sandbox"|"production", deps:PollDependencies) {
  await sql`insert into ebay_order_sync(user_id,account_id,environment)
    select user_id,id,${environment} from marketplace_accounts where marketplace='ebay_uk' and mode='oauth' and status='green' and sandbox=${environment === "sandbox"}
    on conflict do nothing`;
  const lease = randomUUID();
  const states = await sql<Sync>`update ebay_order_sync s set lease_token=${lease},lease_until=now()+interval '2 minutes'
    where (s.user_id,s.account_id,s.environment) in (
      select p.user_id,p.account_id,p.environment from ebay_order_sync p join marketplace_accounts a on a.user_id=p.user_id and a.id=p.account_id
      where p.environment=${environment} and a.marketplace='ebay_uk' and a.mode='oauth' and a.status='green' and a.sandbox=${environment === "sandbox"}
        and p.next_poll_at<=now() and (p.lease_until is null or p.lease_until<now())
      order by p.next_poll_at,p.account_id limit 1 for update of p skip locked) returning s.*`;
  const state = states[0];
  if (!state) return {attempted:0,processed:0};
  const {user_id:userId,account_id:accountId} = state;
  try {
    const cursor = new Date(state.cursor_at).getTime();
    if (cursor < Date.now()-89*86_400_000) throw new Error("Order tracking is outside the 89-day recovery window. Reconcile before resetting it.");
    const end = state.window_to ? new Date(state.window_to).toISOString() : new Date(Math.min(Date.now(),cursor+86_400_000)).toISOString();
    const start = new Date(Math.max(new Date(state.started_at).getTime(),cursor-300_000)).toISOString();
    const query = new URLSearchParams({filter:`lastmodifieddate:[${start}..${end}]`,limit:"100",offset:String(state.page_offset)});
    const token = await deps.token(sql,userId,accountId);
    const response = await deps.fetchPage(token.access,`/sell/fulfillment/v1/order?${query}`);
    if (!response.ok) throw new Error(`eBay order read failed (HTTP ${response.status}). Check connection and permissions.`);
    const page = parseEbayOrderPage(response.json,state.page_offset);
    await sql.transaction(async tx => {
      const current = await tx`select s.account_id from ebay_order_sync s join marketplace_accounts a on a.user_id=s.user_id and a.id=s.account_id
        where s.user_id=${userId} and s.account_id=${accountId} and s.environment=${environment} and s.lease_token=${lease} and s.lease_until>now()
          and a.status='green' and a.sandbox=${environment === "sandbox"} for update of s,a`;
      if (!current.length) throw new Error("Order poll lost its lease or the account was paused. Cursor retained.");
      // Deterministic processing; any database deadlock rolls the whole page back.
      for (const line of page.lines.sort((a,b)=>a.listingId.localeCompare(b.listingId)||a.lineId.localeCompare(b.lineId))) await applyLine(tx,state,line);
      await tx`update ebay_order_sync set cursor_at=${page.more ? new Date(state.cursor_at).toISOString() : end},
        window_to=${page.more ? end : null},page_offset=${page.more ? state.page_offset+page.count : 0},
        lease_token=null,lease_until=null,next_poll_at=now()+interval '60 seconds',last_success_at=now(),last_error=null
        where user_id=${userId} and account_id=${accountId} and environment=${environment} and lease_token=${lease}`;
    });
    return {attempted:1,processed:page.lines.length};
  } catch (error) {
    const delay = error instanceof EbayTemporaryError && Number.isFinite(error.retryAfterMs) ? Math.max(300_000,error.retryAfterMs) : 300_000;
    // Store only our own messages; never provider response bodies or buyer data.
    const message = error instanceof EbayTemporaryError ? "eBay order read temporarily unavailable; cursor retained."
      : error instanceof Error && /^(Invalid eBay|Incomplete eBay|eBay order|Order poll|Order tracking|Sale changed|Linked inventory)/.test(error.message) ? error.message : "Order processing failed; cursor retained for retry.";
    await sql`update ebay_order_sync set lease_token=null,lease_until=null,next_poll_at=${new Date(Date.now()+delay).toISOString()},last_error=${message}
      where user_id=${userId} and account_id=${accountId} and environment=${environment} and lease_token=${lease}`;
    return {attempted:1,processed:0,error:true};
  }
}
