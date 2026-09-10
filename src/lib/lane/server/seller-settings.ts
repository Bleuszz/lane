import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ebayFetch } from "./ebay";
import { liveEbayToken } from "./process";
import { selectSellerPolicy } from "./ebay-operations";

const kinds = ["fulfillment", "payment", "return"] as const;
async function optionsFor(userId: string, accountId: string) {
  const sql = await getSql();
  const rows = await sql<{connector_settings: Record<string,string>; merchant_location_key:string|null}>`
    select connector_settings, merchant_location_key from marketplace_accounts
    where user_id = ${userId} and id = ${accountId} and marketplace = 'ebay_uk' and oauth_connected = true`;
  if (!rows[0]) throw new Error("Connect this eBay account before choosing its settings.");
  const {access} = await liveEbayToken(sql,userId,accountId);
  const policies = await Promise.all(kinds.map(async kind => {
    const response = await ebayFetch<Record<string,Record<string,unknown>[]>>(access,"GET",`/sell/account/v1/${kind}_policy?marketplace_id=EBAY_GB`);
    if (!response.ok) throw new Error(`Could not load this shop's ${kind} policies. Reconnect if its permission expired.`);
    const raw = response.json[`${kind}Policies`] ?? [];
    return {kind, raw, options:raw.flatMap(p => {
      const id = p[`${kind}PolicyId`];
      if (typeof id !== "string") return [];
      try { selectSellerPolicy([p],`${kind}PolicyId`,id); }
      catch { return []; }
      return [{id,name:typeof p.name === "string" ? p.name : id}];
    })};
  }));
  const response = await ebayFetch<{locations?: {merchantLocationKey?:string; merchantLocationStatus?:string; name?:string}[]}>(access,"GET","/sell/inventory/v1/location?limit=100");
  if (!response.ok) throw new Error("Could not load this shop's dispatch locations.");
  const locations = (response.json.locations ?? []).flatMap(l => l.merchantLocationStatus === "ENABLED" && l.merchantLocationKey ? [{id:l.merchantLocationKey,name:l.name || l.merchantLocationKey}] : []);
  return {sql,policies,locations,saved:rows[0]};
}

export const getSellerSettings = createServerFn({method:"POST"}).middleware([authMiddleware])
  .validator((d:unknown)=>z.object({accountId:z.string().min(1).max(100)}).parse(d))
  .handler(async ({context,data})=>{
    const {policies,locations,saved} = await optionsFor(context.userId,data.accountId);
    return {policies:policies.map(p=>({kind:p.kind,options:p.options})),locations,
      selected:{fulfillmentPolicyId:saved.connector_settings?.fulfillmentPolicyId ?? "",paymentPolicyId:saved.connector_settings?.paymentPolicyId ?? "",returnPolicyId:saved.connector_settings?.returnPolicyId ?? "",locationKey:saved.merchant_location_key ?? ""}};
  });

export const saveSellerSettings = createServerFn({method:"POST"}).middleware([authMiddleware])
  .validator((d:unknown)=>z.object({accountId:z.string().min(1).max(100),fulfillmentPolicyId:z.string().min(1).max(100),paymentPolicyId:z.string().min(1).max(100),returnPolicyId:z.string().min(1).max(100),locationKey:z.string().min(1).max(100)}).parse(d))
  .handler(async ({context,data})=>{
    const {sql,policies,locations} = await optionsFor(context.userId,data.accountId);
    for (const p of policies) selectSellerPolicy(p.raw,`${p.kind}PolicyId`,data[`${p.kind}PolicyId`]);
    if (!locations.some(l=>l.id === data.locationKey)) throw new Error("Choose an enabled dispatch location belonging to this shop.");
    const settings = {fulfillmentPolicyId:data.fulfillmentPolicyId,paymentPolicyId:data.paymentPolicyId,returnPolicyId:data.returnPolicyId};
    await sql`update marketplace_accounts set connector_settings = connector_settings || ${JSON.stringify(settings)}::jsonb,
      merchant_location_key = ${data.locationKey},updated_at = now() where id = ${data.accountId} and user_id = ${context.userId} and marketplace = 'ebay_uk'`;
    return {ok:true};
  });
