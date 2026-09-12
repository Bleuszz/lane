import type { Sql } from "../../db";
import { manualSaleSchema, type ManualSaleInput } from "../manual-sale";
import { makeId } from "../ids";
import { saleEventKey } from "./operations";

export async function recordManualSale(sql: Sql, userId: string, data: ManualSaleInput) {
  const input = manualSaleSchema.parse(data);
  return sql.transaction(async tx => {
    const rows = await tx<{quantity:number;status:string;cost_price_gbp:string|null;marketplace:string;marketplace_account_id:string;remote_id:string|null}>`
      select i.quantity,i.status,i.cost_price_gbp,c.marketplace,c.marketplace_account_id,c.remote_id
      from items i join channel_listings c on c.item_id=i.id and c.user_id=i.user_id
      where i.id=${input.itemId} and i.user_id=${userId} and c.id=${input.channelListingId}
        and c.marketplace in ('vinted_uk','ebay_uk') for update of i`;
    const item = rows[0];
    if (!item) throw new Error("This linked listing is unavailable or does not belong to you.");
    if (item.marketplace === "vinted_uk" && input.quantity !== 1) throw new Error("Vinted listings contain one item. Record one unit for this sale.");
    const event = saleEventKey({marketplace:item.marketplace,accountId:item.marketplace_account_id,eventId:input.reference,itemId:input.itemId});
    const existing = () => tx<{item_id:string;quantity:number;sold_price_gbp:string;fees_gbp:string|null;detected_via:string}>`select item_id,quantity,sold_price_gbp,fees_gbp,detected_via from sales where user_id=${userId} and remote_event_key=${event}`;
    const verify = (sale: Awaited<ReturnType<typeof existing>>[number]) => {
      if (sale.item_id !== input.itemId || sale.quantity !== input.quantity || Number(sale.sold_price_gbp) !== input.totalGbp ||
        (sale.detected_via === "manual" && (sale.fees_gbp === null ? null : Number(sale.fees_gbp)) !== input.feesGbp)) {
        throw new Error("This reference already belongs to a sale with different details. Review that sale; do not create another reference to retry it.");
      }
    };
    const prior = (await existing())[0];
    if (prior) { verify(prior); return {recorded:false,remainingQuantity:item.quantity}; }
    if (["sold","archived"].includes(item.status) || input.quantity > item.quantity) throw new Error("Not enough available stock. Refresh the item before recording this sale.");
    const id = makeId("sal");
    const net = input.feesGbp === null ? null : Math.round((input.totalGbp-input.feesGbp)*100)/100;
    const result = await tx<{recorded:boolean}>`select lane_record_sale(${userId},${input.itemId},${input.channelListingId},${item.marketplace},${item.marketplace_account_id},${id},${event},${input.totalGbp},${input.feesGbp},${net},'manual',${input.quantity}) as recorded`;
    if (!result[0]?.recorded) {
      const other = (await existing())[0];
      if (!other) throw new Error("Stock changed. Refresh the item before retrying with the same reference.");
      verify(other);
      return {recorded:false,remainingQuantity:item.quantity};
    }
    const cost = item.cost_price_gbp === null ? null : Number(item.cost_price_gbp);
    const costTotal = cost !== null && Number.isFinite(cost) && cost >= 0 ? Math.round(cost*input.quantity*100)/100 : null;
    await tx`update sales set reference=${input.reference},amounts_basis='entered',cost_total_gbp=${costTotal} where id=${id} and user_id=${userId}`;
    return {recorded:true,remainingQuantity:item.quantity-input.quantity};
  });
}
