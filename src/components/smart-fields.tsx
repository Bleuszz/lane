import { trackReview } from "@/lib/lane/server/activation";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { getEbayFields, suggestEbayFields } from "@/lib/lane/server/smart-fill";
import { applySuggestions, sourceAspects, validateAspects, type AspectSuggestion } from "@/lib/lane/aspects";
import type { ItemDraft } from "@/lib/lane/types";
import { Button, Field, Input, NativeSelect, Textarea } from "./ui";

export function SmartFields({ draft, onChange, aiEnabled }: { draft: ItemDraft; onChange: (draft: ItemDraft) => void; aiEnabled: boolean }) {
  const fields = useQuery({ queryKey: ["ebay-fields", draft.categoryCanonical], queryFn: () => getEbayFields({ data: { categoryCanonical: draft.categoryCanonical } }), enabled: Boolean(draft.categoryCanonical), staleTime: 3600000, retry: false });
  const [suggestions, setSuggestions] = useState<AspectSuggestion[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef(draft);
  latest.current = draft;
  const sourceKey = (d:ItemDraft) => JSON.stringify([d.categoryCanonical,d.title,d.description,d.notes,d.brand,d.sizeUk,d.colour,d.material]);
  const [suggestionCategory, setSuggestionCategory] = useState("");
  const current = sourceAspects(draft);
  const rules = fields.data?.rules ?? [];
  const required = rules.filter((r) => r.required);
  const remaining = required.filter((r) => !current[r.name]?.some((v) => v.trim()));
  const visibleSuggestions = suggestionCategory === sourceKey(draft) ? suggestions : [];
  const [showOptional, setShowOptional] = useState(false);

  async function fill() {
    const category = sourceKey(draft);
    setBusy(true); setMessage(""); setSuggestions([]);
    try {
      const result = await suggestEbayFields({ data: draft });
      if (sourceKey(latest.current) !== category) { setMessage("Your source details changed. Request fresh suggestions when ready."); return; }
      setSuggestionCategory(category); setSuggestions(result.suggestions); setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load suggestions."); }
    finally { setBusy(false); }
  }

  return <section className="smart-fields space-y-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-mark">Destination check</p><h2 className="mt-1 text-lg font-semibold">The details eBay needs</h2><p className="mt-1 text-sm text-muted">Your existing answers stay in place. Only fill the gaps.</p></div>
      {fields.data && <span className="rounded-full bg-raised px-3 py-1.5 text-xs">{remaining.length ? `${remaining.length} required ${remaining.length === 1 ? "detail" : "details"} left` : "Required fields filled"}</span>}
    </div>
    {fields.isFetching && <p role="status" className="text-sm text-muted">Checking this category’s eBay requirements…</p>}
    {fields.isError && <div className="space-y-2 text-sm"><p role="alert" className="text-warn">{fields.error.message}</p><Button variant="secondary" size="sm" onClick={() => void fields.refetch()}>Try field lookup again</Button></div>}
    {fields.data && <>
      <div className="grid gap-4 sm:grid-cols-2">{rules.filter((r) => r.required || showOptional || current[r.name]?.length).map((rule) => <Field key={rule.name} label={`${rule.name}${rule.required ? " *" : ""}`} hint={rule.multiple ? "One value per line" : undefined}>
        {rule.multiple ? <Textarea rows={2} value={(current[rule.name] ?? []).join("\n")} onChange={(e) => onChange({ ...draft, channelFields: { ...draft.channelFields, ebay_uk: { aspects: { ...draft.channelFields?.ebay_uk?.aspects, [rule.name]: e.target.value.split("\n") } } } })}/> : rule.selectionOnly ? <NativeSelect value={current[rule.name]?.[0] ?? ""} onChange={(e) => onChange({ ...draft, channelFields: { ...draft.channelFields, ebay_uk: { aspects: { ...draft.channelFields?.ebay_uk?.aspects, [rule.name]: [e.target.value] } } } })}><option value="">Choose {rule.name.toLowerCase()}</option>{current[rule.name]?.[0] && !rule.values.includes(current[rule.name][0]) && <option value={current[rule.name][0]}>Check: {current[rule.name][0]}</option>}{rule.values.map((v) => <option key={v}>{v}</option>)}</NativeSelect> : <Input value={current[rule.name]?.[0] ?? ""} maxLength={rule.maxLength} onChange={(e) => onChange({ ...draft, channelFields: { ...draft.channelFields, ebay_uk: { aspects: { ...draft.channelFields?.ebay_uk?.aspects, [rule.name]: [e.target.value] } } } })}/>}
      </Field>)}</div>
      <button type="button" className="text-sm text-mark underline underline-offset-4" onClick={() => setShowOptional(!showOptional)}>{showOptional ? "Hide empty optional fields" : "Show optional details"}</button>
      {validateAspects(rules, current).filter((e) => !e.includes("is required")).map((error) => <p key={error} className="text-sm text-danger">{error}</p>)}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4"><Button disabled={!aiEnabled || busy || fields.isFetching} onClick={() => void fill()}>{busy ? "Reading your listing…" : "Find missing details with AI"}</Button><p className="text-xs text-muted">{aiEnabled ? "1 credit when useful suggestions are returned. Review before applying." : "Optional on Seller and Pro. Enable AI in Billing."}</p></div>
    </>}
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    {visibleSuggestions.length > 0 && <div className="space-y-3 border-t border-line pt-4">{visibleSuggestions.map((s) => <div key={s.name}><p className="text-sm"><strong>{s.name}:</strong> {s.value}</p><p className="mt-1 text-xs text-muted">From your listing: “{s.evidence}”</p></div>)}<Button variant="secondary" onClick={() => { void trackReview({data:{event:"ai_suggestion_accepted"}}).catch(() => undefined); const now = latest.current; onChange({ ...now, channelFields: { ...now.channelFields, ebay_uk: { aspects: applySuggestions(sourceAspects(now), visibleSuggestions) } } }); setSuggestions([]); setMessage("Applied to empty fields. Review your draft before publishing."); }}>Apply these suggestions</Button><Button variant="ghost" onClick={() => {setSuggestions([]); void trackReview({data:{event:"ai_suggestion_rejected"}}).catch(() => undefined);}}>Dismiss suggestions</Button></div>}
  </section>;
}
