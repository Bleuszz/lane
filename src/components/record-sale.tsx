import { useState } from "react";
import { Modal } from "./modal";
import { Button, Field, Input, NativeSelect as Select } from "./ui";
import { markSoldFn } from "@/lib/lane/server/fns";
import { manualSaleSchema } from "@/lib/lane/manual-sale";
import { formatMoney } from "@/lib/lane/format";
import type { ItemView } from "@/lib/lane/types";

export function RecordSale({item,channelId,onClose,onRecorded}: {item:ItemView;channelId?:string;onClose:()=>void;onRecorded:(result:{recorded:boolean;remainingQuantity:number})=>void}) {
  const channels=item.channels.filter(c=>c.marketplace==="ebay_uk" || c.marketplace==="vinted_uk");
  const [selected,setSelected]=useState(channelId ?? channels[0]?.id ?? "");
  const channel=channels.find(c=>c.id===selected);
  const [quantity,setQuantity]=useState("1");
  const [total,setTotal]=useState("");
  const [fees,setFees]=useState("");
  const [reference,setReference]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const remaining=item.quantity-Number(quantity);
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;setError(null);
    const amount = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;
    if(!amount.test(total.trim())) {setError("Enter the total in pounds, without a currency symbol and with up to two decimal places.");return;}
    if(fees.trim() && !amount.test(fees.trim())) {setError("Enter fees in pounds, or leave the field blank if unknown.");return;}
    const parsed=manualSaleSchema.safeParse({itemId:item.id,channelListingId:selected,quantity:Number(quantity),totalGbp:total.trim()?Number(total):NaN,feesGbp:fees.trim()?Number(fees):null,reference});
    if(!parsed.success){setError(parsed.error.issues[0]?.message ?? "Review the sale details.");return;}
    if(remaining<0){setError("Quantity exceeds available stock.");return;}
    setBusy(true);
    try {onRecorded(await markSoldFn({data:parsed.data}));}
    catch(e){setError(e instanceof Error?e.message:"Could not confirm the sale. Retry with the same reference.");setBusy(false);}
  }
  return <Modal label="Record a sale" onClose={onClose} canClose={!busy}>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-medium">Record a sale</h2><p className="mt-1 text-sm text-muted">{item.title} · {item.quantity} available</p></div><Button variant="ghost" disabled={busy} onClick={onClose}>Close</Button></div>
    {!channels.length ? <p className="mt-4 text-sm">Import or link this item's marketplace listing first so Lane can record the sale against the correct shop.</p> : <form onSubmit={submit} className="mt-5 space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Where it sold"><Select value={selected} onChange={e=>setSelected(e.target.value)}>{channels.map(c=><option key={c.id} value={c.id}>{c.accountLabel} · {c.marketplace==="ebay_uk"?"eBay UK":"Vinted UK"}</option>)}</Select></Field>
        <Field label="Quantity sold"><Input type="number" min="1" max={channel?.marketplace === "vinted_uk" ? 1 : item.quantity} step="1" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field>
        <Field label="Total item sale amount £" hint="Total for all units in this entry, excluding postage. Enter the agreed amount."><Input inputMode="decimal" required placeholder={formatMoney((channel?.channelPriceGbp ?? item.basePriceGbp)*Number(quantity||1))} value={total} onChange={e=>setTotal(e.target.value)}/></Field>
        <Field label="Fees paid £ (optional)"><Input inputMode="decimal" value={fees} onChange={e=>setFees(e.target.value)} placeholder="Leave blank if unknown"/></Field>
        <Field label="Order-line ID or unique sale reference" hint="One reference per order line in this shop. Use the marketplace’s order-line ID when available."><Input required maxLength={120} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Use the same reference if you retry"/></Field>
      </fieldset>
      <p className="text-xs text-muted">Recorded item cost: {item.costPriceGbp === null ? "unknown" : `${formatMoney(item.costPriceGbp)} per unit`}. Postage, refunds and tax are not included in this entry.</p>
      <p className="rounded-xl bg-raised p-3 text-sm">{Number.isInteger(remaining)&&remaining>=0?`${remaining} will remain in Lane. `:""}Other linked shops will be queued for stock updates or delisting. This records a sale; it does not collect payment.</p>
      {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy?"Recording…":"Record sale and update stock"}</Button>
    </form>}
  </Modal>;
}
