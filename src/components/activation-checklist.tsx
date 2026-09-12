import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getActivation } from "@/lib/lane/server/activation";
import type { BootstrapPayload } from "@/lib/lane/types";
import { Panel } from "./ui";
import { Check, ArrowUpRight } from "lucide-react";

export function ActivationChecklist({data}: {data: BootstrapPayload}) {
  const events = useQuery({ queryKey:["activation"], queryFn:()=>getActivation() });
  const occurred = (name:string) => events.data?.includes(name) ?? false;
  const steps = [
    { title:"Connect your source shop", detail:"Start with your existing Vinted wardrobe.", to:"/settings/channels" as const, done:data.accounts.some(a => a.marketplace === "vinted_uk" && a.status === "green") },
    { title:"Bring in your first item", detail:"Keep its photos, price and original details together.", to:"/import" as const, done:occurred("first_import") },
    { title:"Connect eBay", detail:"Link the account where you want to crosslist.", to:"/settings/channels" as const, done:data.accounts.some(a => a.marketplace === "ebay_uk" && a.status === "green") },
    { title:"Review and publish one item", detail:"Check the destination preview before you publish.", to:"/inventory" as const, done:occurred("first_publish") },
  ];
  if (steps.every(s=>s.done)) return null;
  const next = steps.findIndex(s=>!s.done);
  const settings = data.settings;
  return <Panel className="overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-6"><div><p className="eyebrow">Your first crosslist</p><h2 className="mt-1 text-2xl font-semibold">One item. Two shopfronts.</h2><p className="mt-2 text-sm text-muted">{steps.filter(s=>s.done).length} of 4 steps complete. Pick up where you left off.</p></div><Link to="/help" className="text-sm text-mark underline underline-offset-4">A little help</Link></div>
    <ol className="grid sm:grid-cols-2">{steps.map((s,i)=><li key={s.title} className={`border-b border-line p-6 ${i===next ? "bg-mark/5" : ""}`}><Link to={s.to} className="flex items-start gap-3"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${s.done ? "bg-mark text-white" : "border border-line text-muted"}`}>{s.done ? <Check size={15}/> : i+1}</span><div><p className="font-medium">{s.title}<ArrowUpRight className="ml-2 inline h-3.5 w-3.5 text-muted"/></p><p className="mt-1 text-sm text-muted">{s.detail}</p></div></Link></li>)}</ol>
    {settings.billingStatus === "trialing" && <p className="p-5 text-sm text-muted">{settings.trialActive ? `Your no-card trial ends ${new Date(settings.trialEndsAt!).toLocaleDateString("en-GB")}. ${settings.actionsRemaining} of ${settings.trialActionsLimit} publish/relist actions remain.` : "Your trial has ended. Saved inventory and editing remain available."} AI is not included in the trial.</p>}
  </Panel>;
}
