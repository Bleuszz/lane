import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSellerSettings, saveSellerSettings } from "@/lib/lane/server/seller-settings";
import { Button, Field, NativeSelect, Panel } from "./ui";

export function EbaySellerSettings({accountId,label}: {accountId:string;label:string}) {
  const [open,setOpen] = useState(false);
  const [choices,setChoices] = useState<Record<string,string>>({});
  const [saved,setSaved] = useState(false);
  const query = useQuery({queryKey:["seller-settings",accountId],queryFn:()=>getSellerSettings({data:{accountId}}),enabled:open,retry:false});
  const selected = (key:keyof NonNullable<typeof query.data>["selected"],options:{id:string}[]) => choices[key] ?? (options.some(o=>o.id === query.data?.selected[key]) ? query.data!.selected[key] : options.length === 1 ? options[0].id : "");
  const save = useMutation({mutationFn:()=>{
    const data = query.data!;
    return saveSellerSettings({data:{accountId,
      fulfillmentPolicyId:selected("fulfillmentPolicyId",data.policies.find(p=>p.kind==="fulfillment")!.options),
      paymentPolicyId:selected("paymentPolicyId",data.policies.find(p=>p.kind==="payment")!.options),
      returnPolicyId:selected("returnPolicyId",data.policies.find(p=>p.kind==="return")!.options),
      locationKey:selected("locationKey",data.locations)}});
  },onSuccess:()=>{setSaved(true);void query.refetch();}});
  return <Panel className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">eBay selling preferences</h2><p className="mt-1 text-sm text-muted">Choose delivery, payment, returns and dispatch settings for {label}.</p></div><Button variant="secondary" onClick={()=>setOpen(!open)}>{open?"Close settings":"Load this shop’s settings"}</Button></div>
    {open && query.isFetching && <p role="status" className="text-sm text-muted">Reading your eBay settings…</p>}
    {open && query.isError && <p role="alert" className="text-sm text-danger">{query.error.message}</p>}
    {open && query.data && <><div className="grid gap-4 sm:grid-cols-2">{query.data.policies.map(p=><Field key={p.kind} label={p.kind==="fulfillment"?"Delivery policy":p.kind==="payment"?"Payment policy":"Returns policy"}><NativeSelect value={selected(`${p.kind}PolicyId`,p.options)} onChange={e=>{setChoices(c=>({...c,[`${p.kind}PolicyId`]:e.target.value}));setSaved(false);}}><option value="">Choose a policy</option>{p.options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</NativeSelect></Field>)}<Field label="Dispatch location"><NativeSelect value={selected("locationKey",query.data.locations)} onChange={e=>{setChoices(c=>({...c,locationKey:e.target.value}));setSaved(false);}}><option value="">Choose a location</option>{query.data.locations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</NativeSelect></Field></div>
    <p className="text-xs text-muted">These choices come from this eBay account. If an option is missing, create or enable it in eBay first, then reload. Lane saves your choice without changing the policy itself.</p>
    <div className="flex gap-2"><Button disabled={save.isPending||query.isFetching} onClick={()=>save.mutate()}>{save.isPending?"Saving…":"Save selling preferences"}</Button><Button variant="ghost" onClick={()=>void query.refetch()}>Reload options</Button></div></>}
    {save.isError && <p role="alert" className="text-sm text-danger">{save.error.message}</p>}{saved && <p role="status" className="text-sm text-ok">Preferences saved for this shop.</p>}
  </Panel>;
}
