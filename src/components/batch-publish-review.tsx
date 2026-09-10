import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { preparePublishReview, publishItems } from "@/lib/lane/server/fns";
import { draftFromItem } from "./item-form";
import { PublishPreview } from "./publish-preview";
import { Modal } from "./modal";
import { Button } from "./ui";

export function BatchPublishReview({ itemIds, accountIds, onClose, onQueued }: {
  itemIds: string[]; accountIds: string[]; onClose: () => void; onQueued: (queued:number) => void;
}) {
  const batch = useQuery({queryKey:["publish-review",itemIds,accountIds],queryFn:()=>preparePublishReview({data:{itemIds,accountIds}}),retry:false,refetchOnWindowFocus:false,staleTime:0});
  const [approved,setApproved] = useState<Record<string,string>>({});
  const [active,setActive] = useState<string|null>(null);
  const data = batch.data;
  const reviewed = data?.items.filter(({item,hash})=>approved[item.id]===hash).length ?? 0;
  const publish = useMutation({mutationFn:async()=>{
    if (!data || reviewed !== data.items.length) throw new Error("Review every selected item first.");
    return publishItems({data:{itemIds:data.items.map(({item})=>item.id),accountIds:data.accounts.map(a=>a.id),reviewHashes:approved}});
  },onSuccess:r=>onQueued(r.queued)});
  const entry = data?.items.find(({item})=>item.id===active);
  if (entry && data) return <PublishPreview key={entry.item.id} draft={draftFromItem(entry.item)} accounts={data.accounts} rules={data.rules}
    confirmLabel="Approve this review" notice="This approves the details for the batch. Nothing is queued until you confirm the whole batch."
    onClose={()=>setActive(null)} onConfirm={async()=>{setApproved(previous=>({...previous,[entry.item.id]:entry.hash}));}}/>;
  return <Modal label="Review selected products" onClose={onClose} canClose={!publish.isPending}>
    <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Before you publish</p><h2 className="mt-1 text-xl font-semibold">Review your batch</h2></div><Button variant="ghost" disabled={publish.isPending} onClick={onClose}>Close</Button></div>
    {batch.isPending ? <p className="mt-4 text-sm text-muted" role="status">Loading saved details and destination prices…</p> : batch.isError ? <div role="alert" className="mt-4 text-sm text-danger"><p>{batch.error.message}</p><Button className="mt-3" variant="secondary" onClick={()=>void batch.refetch()}>Try again</Button></div> : data && <>
      <p className="mt-3 text-sm text-muted">{reviewed} of {data.items.length} reviewed. Open each item to check its photos, fields and prices.</p>
      <p className="mt-2 text-xs text-muted">Destinations: {data.accounts.map(a=>a.label).join(", ")}</p>
      <ul className="my-4 divide-y divide-line">{data.items.map(({item,hash})=><li key={item.id} className="flex items-center gap-3 py-3">
        {item.photos[0] && <img src={item.photos[0].url} alt="" className="h-14 w-11 shrink-0 rounded bg-raised object-cover"/>}
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted">{approved[item.id]===hash ? "Reviewed" : "Needs your review"}</p>{!publish.isPending && <Link to="/inventory/$id" params={{id:item.id}} onClick={onClose} className="mt-1 inline-flex min-h-8 items-center text-xs text-mark underline">Edit listing</Link>}</div>
        <Button variant="secondary" size="sm" disabled={publish.isPending} onClick={()=>setActive(item.id)} aria-label={`Review ${item.title}`}>Review</Button>
      </li>)}</ul>
      <p className="text-xs leading-relaxed text-muted">Confirming authorises publishing to the selected shops. Each new destination job uses one action when processing starts. Existing live or queued destinations are skipped.</p>
      <Button className="mt-4 w-full" disabled={publish.isPending || batch.isFetching || !data.items.length || reviewed!==data.items.length} onClick={()=>publish.mutate()}>{publish.isPending ? "Queueing…" : `Confirm and queue ${data.items.length} item(s)`}</Button>
      {publish.isError && <div role="alert" className="mt-3 text-sm text-danger"><p>{publish.error.message}</p><Button variant="secondary" className="mt-2" onClick={()=>{setApproved({});publish.reset();void batch.refetch();}}>Reload and review again</Button></div>}
    </>}
  </Modal>;
}
