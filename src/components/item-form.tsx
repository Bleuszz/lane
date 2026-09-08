import { CATEGORIES } from "@/lib/lane/categories";
import { CHANNELS } from "@/lib/lane/channels";
import { compareTakeHome } from "@/lib/lane/fees";
import { formatMoney } from "@/lib/lane/format";
import { applyPricingRule } from "@/lib/lane/pricing";
import { convertSize, sizeKindForCategory } from "@/lib/lane/sizes";
import { CONDITION_LABELS, CONDITIONS, type AiVoice, type ItemDraft, type PricingRuleView } from "@/lib/lane/types";
import { generateListingCopy } from "@/lib/lane/server/fns";
import { Button, Field, Input, NativeSelect, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const EMPTY_DRAFT: ItemDraft = {
  title: "",
  description: "",
  brand: "",
  categoryCanonical: "menswear.tops.tshirts",
  condition: "good",
  sizeUk: "",
  sizeEu: "",
  sizeUs: "",
  colour: "",
  material: "",
  gender: "men",
  era: "",
  costPriceGbp: "",
  basePriceGbp: "",
  quantity: "1",
  weightG: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  postageProfileId: "",
  notes: "",
  tags: "",
  sku: "",
  photos: [],
};

export function ItemForm({
  draft,
  onChange,
  ebaySelected,
  vintedSelected,
  rules,
  aiEnabled,
}: {
  draft: ItemDraft;
  onChange: (next: ItemDraft) => void;
  ebaySelected: boolean;
  vintedSelected: boolean;
  rules: PricingRuleView[];
  aiEnabled: boolean;
}) {
  const set = (patch: Partial<ItemDraft>) => onChange({ ...draft, ...patch });
  const price = Number(draft.basePriceGbp) || 0;
  const take = compareTakeHome({ listPriceGbp: price, categoryCanonical: draft.categoryCanonical });
  const ebayPrice = applyPricingRule(price, rules.find((r) => r.marketplace === "ebay_uk"));
  const vintedPrice = applyPricingRule(price, rules.find((r) => r.marketplace === "vinted_uk"));
  const [voice, setVoice] = useState<AiVoice>("short");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function onUkSize(value: string) {
    const kind = sizeKindForCategory(draft.categoryCanonical);
    const row = convertSize(value, "uk", kind);
    set({ sizeUk: value, sizeEu: row?.eu ?? draft.sizeEu, sizeUs: row?.us ?? draft.sizeUs });
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const next = [...draft.photos];
    for (const file of Array.from(files)) {
      if (next.length >= 8) break;
      if (file.size > 900_000) continue;
      const url = await readFile(file);
      next.push({ url });
    }
    set({ photos: next });
  }

  async function fillAi() {
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await generateListingCopy({
        data: {
          voice,
          notes: [draft.notes, draft.title, draft.brand, draft.colour, draft.material].filter(Boolean).join("\n"),
          brand: draft.brand,
          categoryCanonical: draft.categoryCanonical,
        },
      });
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      set({
        title: res.draft.title,
        description: res.draft.description,
        brand: res.draft.brand,
        categoryCanonical: res.draft.categoryCanonical,
        condition: res.draft.condition,
        colour: res.draft.colour,
        material: res.draft.material,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Photos</h2>
          <div className="flex flex-wrap gap-2">
            {draft.photos.map((p, i) => (
              <div key={`${p.url}-${i}`} className="relative h-24 w-20 overflow-hidden rounded-[var(--radius-sm)] border border-line bg-raised">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex">
                  <button type="button" className="flex-1 bg-ink/70 py-0.5 text-[10px] text-paper" onClick={() => {
                    const photos = [...draft.photos];
                    const [moved] = photos.splice(i, 1);
                    if (moved) photos.unshift(moved);
                    set({ photos });
                  }}>Primary</button>
                  <button type="button" className="flex-1 bg-danger/80 py-0.5 text-[10px] text-white" onClick={() => set({ photos: draft.photos.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              </div>
            ))}
            <label className="grid h-24 w-20 cursor-pointer place-items-center rounded-[var(--radius-sm)] border border-dashed border-line-strong text-xs text-muted">
              Add
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            </label>
          </div>
          <p className="text-[11px] text-subtle">
            File uploads become data URLs and work for Vinted (the extension re-uploads them). eBay Inventory API requires
            publicly reachable http(s) URLs — paste those below.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("photoUrl") as HTMLInputElement | null);
              const value = input?.value.trim() ?? "";
              if (!/^https?:\/\//i.test(value)) return;
              if (draft.photos.length >= 8) return;
              set({ photos: [...draft.photos, { url: value }] });
              if (input) input.value = "";
            }}
          >
            <Input name="photoUrl" placeholder="https://… photo URL for eBay" className="flex-1" />
            <Button type="submit" size="sm" variant="secondary">
              Add URL
            </Button>
          </form>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="SKU">
            <Input value={draft.sku} onChange={(e) => set({ sku: e.target.value })} className="font-mono" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={6} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Brand">
            <Input value={draft.brand} onChange={(e) => set({ brand: e.target.value })} />
          </Field>
          <Field label="Category" hint="Mapped per channel. Confirm the leaf if the ID is unverified.">
            <NativeSelect value={draft.categoryCanonical} onChange={(e) => set({ categoryCanonical: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.path}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Condition">
            <NativeSelect value={draft.condition} onChange={(e) => set({ condition: e.target.value as ItemDraft["condition"] })}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Size UK">
            <Input value={draft.sizeUk} onChange={(e) => onUkSize(e.target.value)} />
          </Field>
          <Field label="Size EU">
            <Input value={draft.sizeEu} onChange={(e) => set({ sizeEu: e.target.value })} />
          </Field>
          <Field label="Size US">
            <Input value={draft.sizeUs} onChange={(e) => set({ sizeUs: e.target.value })} />
          </Field>
          <Field label="Colour">
            <Input value={draft.colour} onChange={(e) => set({ colour: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Material">
            <Input value={draft.material} onChange={(e) => set({ material: e.target.value })} />
          </Field>
          <Field label="Gender">
            <NativeSelect value={draft.gender} onChange={(e) => set({ gender: e.target.value })}>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="unisex">Unisex</option>
              <option value="kids">Kids</option>
            </NativeSelect>
          </Field>
          <Field label="Era">
            <Input value={draft.era} onChange={(e) => set({ era: e.target.value })} />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input value={draft.tags} onChange={(e) => set({ tags: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="List price £">
            <Input inputMode="decimal" value={draft.basePriceGbp} onChange={(e) => set({ basePriceGbp: e.target.value })} />
          </Field>
          <Field label="Cost £ (optional)">
            <Input inputMode="decimal" value={draft.costPriceGbp} onChange={(e) => set({ costPriceGbp: e.target.value })} />
          </Field>
          <Field label="Qty" hint={vintedSelected ? "Vinted is always 1." : undefined}>
            <Input inputMode="numeric" value={draft.quantity} onChange={(e) => set({ quantity: e.target.value })} />
          </Field>
          <Field label="Weight g">
            <Input inputMode="numeric" value={draft.weightG} onChange={(e) => set({ weightG: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="L cm">
            <Input value={draft.lengthCm} onChange={(e) => set({ lengthCm: e.target.value })} />
          </Field>
          <Field label="W cm">
            <Input value={draft.widthCm} onChange={(e) => set({ widthCm: e.target.value })} />
          </Field>
          <Field label="H cm">
            <Input value={draft.heightCm} onChange={(e) => set({ heightCm: e.target.value })} />
          </Field>
        </div>
        <Field label="Internal notes">
          <Textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} />
        </Field>

        {ebaySelected || vintedSelected ? (
          <div className="rounded-[var(--radius-md)] border border-line bg-raised p-3 text-xs text-muted">
            {ebaySelected ? (
              <p>
                eBay maps to {CATEGORIES.find((c) => c.id === draft.categoryCanonical)?.ebayUk.name ?? "picker"}{" "}
                {CATEGORIES.find((c) => c.id === draft.categoryCanonical)?.ebayUk.confirmed ? "" : "— confirm this leaf, ID not verified."}
              </p>
            ) : null}
            {vintedSelected ? (
              <p className="mt-1">
                Vinted path: {CATEGORIES.find((c) => c.id === draft.categoryCanonical)?.vintedUk.path ?? "confirm in picker"}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-line bg-raised p-3">
          <p className="text-xs font-medium text-ink">You receive at this list price</p>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{CHANNELS.ebay_uk.short} {formatMoney(ebayPrice)}</span>
              <span className="tabular">{formatMoney(take.ebay.youReceiveGbp)}</span>
            </div>
            <p className="text-[11px] text-subtle">{take.ebay.note}</p>
            <div className="flex justify-between pt-2 border-t border-line">
              <span className="text-muted">{CHANNELS.vinted_uk.short} {formatMoney(vintedPrice)}</span>
              <span className="tabular">{formatMoney(take.vinted.youReceiveGbp)}</span>
            </div>
            <p className="text-[11px] text-subtle">{take.vinted.note}</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-line bg-raised p-3 space-y-2">
          <p className="text-xs font-medium">AI fill</p>
          <p className="text-[11px] text-subtle">Lands in this form. Never auto-publishes.</p>
          <NativeSelect value={voice} onChange={(e) => setVoice(e.target.value as AiVoice)}>
            <option value="short">Short</option>
            <option value="detailed">Detailed</option>
            <option value="vintage">Vintage</option>
            <option value="streetwear">Streetwear</option>
          </NativeSelect>
          <Button variant="secondary" size="sm" className="w-full" disabled={aiBusy || !aiEnabled} onClick={() => void fillAi()}>
            {aiBusy ? "Writing…" : aiEnabled ? "Fill from notes" : "Enable AI pack in Billing"}
          </Button>
          {aiError ? <p className="text-xs text-danger">{aiError}</p> : null}
        </div>
      </aside>
    </div>
  );
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export function draftFromItem(item: {
  title: string;
  description: string;
  brand: string | null;
  categoryCanonical: string | null;
  condition: ItemDraft["condition"];
  sizeUk: string | null;
  sizeEu: string | null;
  sizeUs: string | null;
  colour: string | null;
  material: string | null;
  gender: string | null;
  era: string | null;
  costPriceGbp: number | null;
  basePriceGbp: number;
  quantity: number;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  postageProfileId: string | null;
  notes: string | null;
  tags: string[];
  sku: string | null;
  photos: { url: string; phash: string | null }[];
}): ItemDraft {
  return {
    title: item.title,
    description: item.description,
    brand: item.brand ?? "",
    categoryCanonical: item.categoryCanonical ?? "menswear.tops.tshirts",
    condition: item.condition,
    sizeUk: item.sizeUk ?? "",
    sizeEu: item.sizeEu ?? "",
    sizeUs: item.sizeUs ?? "",
    colour: item.colour ?? "",
    material: item.material ?? "",
    gender: item.gender ?? "men",
    era: item.era ?? "",
    costPriceGbp: item.costPriceGbp != null ? String(item.costPriceGbp) : "",
    basePriceGbp: String(item.basePriceGbp),
    quantity: String(item.quantity),
    weightG: item.weightG != null ? String(item.weightG) : "",
    lengthCm: item.lengthCm != null ? String(item.lengthCm) : "",
    widthCm: item.widthCm != null ? String(item.widthCm) : "",
    heightCm: item.heightCm != null ? String(item.heightCm) : "",
    postageProfileId: item.postageProfileId ?? "",
    notes: item.notes ?? "",
    tags: item.tags.join(","),
    sku: item.sku ?? "",
    photos: item.photos.map((p) => ({ url: p.url, phash: p.phash ?? undefined })),
  };
}

export function ChannelPicker({
  accounts,
  selected,
  onToggle,
}: {
  accounts: { id: string; marketplace: keyof typeof CHANNELS; label: string; mode: "oauth" | "extension" }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (accounts.length === 0) {
    return <p className="text-sm text-muted">Connect Vinted or eBay first.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {accounts.map((a) => {
        const on = selected.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onToggle(a.id)}
            className={cn(
              "h-10 rounded-[var(--radius-sm)] border px-3 text-sm",
              on ? "border-mark bg-ok-bg text-ink" : "border-line bg-raised text-muted",
            )}
          >
            {CHANNELS[a.marketplace]?.short} · {a.mode === "oauth" ? "API" : "EXT"}
          </button>
        );
      })}
    </div>
  );
}
