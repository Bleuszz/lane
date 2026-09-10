import { Modal } from "./modal";
import { trackReview } from "@/lib/lane/server/activation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEbayFields } from "@/lib/lane/server/smart-fill";
import { sourceAspects, validateAspects } from "@/lib/lane/aspects";
import { validateListing } from "@/lib/lane/listing-fields";
import { CHANNELS } from "@/lib/lane/channels";
import { findCategory } from "@/lib/lane/categories";
import { applyPricingRule } from "@/lib/lane/pricing";
import { formatMoney } from "@/lib/lane/format";
import type { AccountView, ItemDraft, PricingRuleView } from "@/lib/lane/types";
import { Button } from "./ui";

export function PublishPreview({ draft, accounts, rules, onConfirm, onClose, confirmLabel = "Confirm and queue publish", notice }: {
  draft: ItemDraft; accounts: AccountView[]; rules: PricingRuleView[];
  onConfirm: () => Promise<unknown>; onClose: () => void;
  confirmLabel?: string; notice?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ebay = accounts.some(a => a.marketplace === "ebay_uk");
  const schema = useQuery({ queryKey: ["ebay-fields", draft.categoryCanonical], queryFn: () => getEbayFields({ data: { categoryCanonical: draft.categoryCanonical } }), enabled: ebay, staleTime: 3600000, retry: false });
  useEffect(() => { void trackReview({data:{event:"destination_preview"}}).catch(() => undefined); }, []);
  const values = sourceAspects(draft);
  const problems = [...new Set(accounts.flatMap(a => [
    ...validateListing(draft, a.marketplace === "ebay_uk" ? "ebay" : "vinted"),
    ...(a.status === "green" ? [] : [`Reconnect ${a.label} before publishing.`]),
  ]))];
  if (!accounts.length) problems.push("Select a connected account.");
  if (ebay && !findCategory(draft.categoryCanonical)?.ebayUk.confirmed) problems.push("This category mapping still needs verification before eBay publishing is enabled.");
  if (ebay && schema.isError) problems.push(schema.error.message);
  if (ebay && schema.data) problems.push(...validateAspects(schema.data.rules, values));
  async function confirm() {
    setBusy(true); setError("");
    try { await onConfirm(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not queue this listing. Your draft is still available."); }
    finally { setBusy(false); }
  }
  return <Modal label="Listing review" onClose={onClose} canClose={!busy} className="flex max-h-[92dvh] w-[min(900px,94vw)] flex-col overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl">
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-4 sm:p-6"><div><p className="eyebrow">One final look</p><h2 id="publish-preview-title" className="mt-1 text-2xl font-semibold">Ready for another shopfront?</h2><p className="mt-2 text-sm text-muted">Check the exact photos, details and destination prices before queueing.</p></div><Button variant="ghost" disabled={busy} onClick={onClose}>Close</Button></div>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
      <div className="grid min-w-0 gap-6 sm:grid-cols-[240px_1fr]"><div><img src={draft.photos[0]?.url} alt={draft.title} className="aspect-square w-full rounded-lg bg-raised object-contain"/><div className="mt-2 flex flex-wrap gap-1">{draft.photos.slice(1).map((p,i) => <img key={i} src={p.url} alt={`Photo ${i+2}`} className="h-12 w-12 rounded object-cover"/>)}</div><p className="mt-2 text-xs text-muted">{draft.photos.length} photos selected</p></div><div className="min-w-0 break-words"><h3 className="text-xl font-semibold">{draft.title || "Untitled listing"}</h3><p className="mt-2 text-sm text-muted">{findCategory(draft.categoryCanonical)?.label ?? "Category needs review"}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{draft.description}</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2">{accounts.map(a => <div key={a.id} className="rounded-xl border border-line p-4"><p className="font-semibold">{CHANNELS[a.marketplace].label}</p><p className="mt-1 text-xs text-muted">{a.label}</p><p className="mt-3 text-2xl">{formatMoney(applyPricingRule(Number(draft.basePriceGbp), rules.find(r => r.marketplace === a.marketplace)))}</p><p className="mt-1 text-xs text-muted">{a.marketplace === "vinted_uk" ? 1 : draft.quantity} unit(s) · {draft.condition.replaceAll("_", " ")}</p></div>)}</div>
      {ebay && <div><h3 className="font-semibold">eBay item specifics</h3><dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{Object.entries(values).filter(([,v]) => v.length).map(([name,v]) => <div key={name} className="flex justify-between gap-4 border-b border-line py-2 text-sm"><dt className="text-muted">{name}</dt><dd className="min-w-0 break-words text-right">{v.join(", ")}</dd></div>)}</dl></div>}
      {problems.length > 0 && <div role="alert" className="rounded-lg bg-warn-bg p-4 text-sm text-warn"><p className="font-semibold">A few details need attention</p><ul className="mt-2 list-disc space-y-1 pl-5">{problems.map((p,i) => <li key={i}>{p}</li>)}</ul></div>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-line p-4 sm:p-6"><p className="max-w-md text-xs text-muted">{notice ?? "Queueing authorises Lane to publish to these accounts. Each destination uses one publishing action when processing starts."}</p><Button disabled={busy || problems.length > 0 || (ebay && schema.isPending)} onClick={() => void confirm()}>{busy ? "Saving…" : ebay && schema.isPending ? "Checking eBay…" : confirmLabel}</Button></div>
  </Modal>;
}
