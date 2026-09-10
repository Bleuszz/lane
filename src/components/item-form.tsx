import { isHttpsPhoto, localPhoto, MAX_LOCAL_PHOTO_BYTES } from "@/lib/lane/photos";
import { SmartFields } from "./smart-fields";
import { PhotoStudio } from "./photo-studio";
import { CATEGORIES } from "@/lib/lane/categories";
import { CHANNELS } from "@/lib/lane/channels";
import { formatMoney } from "@/lib/lane/format";
import {
  COLOURS,
  LISTING_TARGETS,
  VINTED_PARCELS,
  departmentOf,
  fieldsFor,
  genderFromCategory,
  needsSize,
  type ListingTarget,
} from "@/lib/lane/listing-fields";
import { applyPricingRule } from "@/lib/lane/pricing";
import { CLOTHING_SIZES, FOOTWEAR_SIZES, convertSize, sizeKindForCategory } from "@/lib/lane/sizes";
import { CONDITION_LABELS, CONDITIONS, type AiVoice, type ItemDraft, type PricingRuleView } from "@/lib/lane/types";
import { generateListingCopy } from "@/lib/lane/server/fns";
import { Button, Field, Input, NativeSelect, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

export const EMPTY_DRAFT: ItemDraft = {
  title: "",
  description: "",
  brand: "",
  categoryCanonical: "",
  condition: "unknown",
  sizeUk: "",
  sizeEu: "",
  sizeUs: "",
  colour: "",
  material: "",
  gender: "",
  era: "",
  costPriceGbp: "",
  basePriceGbp: "",
  quantity: "1",
  weightG: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  postageProfileId: "vinted_medium",
  notes: "",
  tags: "",
  sku: "",
  photos: [],
};

export function ListingTargetPicker({
  value,
  onChange,
}: {
  value: ListingTarget | null;
  onChange: (next: ListingTarget) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {LISTING_TARGETS.map((opt) => {
        const on = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "min-h-11 rounded-[var(--radius-sm)] border px-3 py-3 text-left",
              on ? "border-mark bg-ok-bg text-ink" : "border-line bg-raised text-muted hover:border-line-strong",
            )}
          >
            <span className="block text-sm font-medium text-ink">{opt.title}</span>
            <span className="mt-1 block text-[11px] leading-snug">{opt.body}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ItemForm({
  draft,
  onChange,
  target,
  rules,
  aiEnabled,
}: {
  draft: ItemDraft;
  onChange: (next: ItemDraft) => void;
  target: ListingTarget;
  rules: PricingRuleView[];
  aiEnabled: boolean;
}) {
  const f = fieldsFor(target);
  const set = (patch: Partial<ItemDraft>) => onChange({ ...draft, ...patch });
  const price = Number(draft.basePriceGbp) || 0;
  const ebayPrice = applyPricingRule(price, rules.find((r) => r.marketplace === "ebay_uk"));
  const vintedPrice = applyPricingRule(price, rules.find((r) => r.marketplace === "vinted_uk"));
  const [voice, setVoice] = useState<AiVoice>("short");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [extras, setExtras] = useState(false);
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [dept, setDept] = useState<"all" | "men" | "women" | "kids" | "other">("all");
  const kind = sizeKindForCategory(draft.categoryCanonical);
  const sizeTable = kind === "footwear" ? FOOTWEAR_SIZES : CLOTHING_SIZES;
  const cats = CATEGORIES.filter((c) => (dept === "all" ? true : departmentOf(c.id) === dept));
  const [photoError, setPhotoError] = useState<string | null>(null);

  function onUkSize(value: string) {
    const row = convertSize(value, "uk", kind);
    set({ sizeUk: value, sizeEu: row?.eu ?? draft.sizeEu, sizeUs: row?.us ?? draft.sizeUs });
  }

  function onCategory(id: string) {
    set({ categoryCanonical: id, gender: genderFromCategory(id), channelFields: { ...draft.channelFields, ebay_uk: { aspects: {} } } });
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const next = [...draft.photos];
    setPhotoError(null);
    for (const file of Array.from(files)) {
      if (next.length >= 12) break;
      if (file.size > MAX_LOCAL_PHOTO_BYTES) { setPhotoError("Choose JPEG or PNG files up to 2 MB each."); continue; }
      const url = await readFile(file);
      if (!localPhoto(url)) { setPhotoError("Choose JPEG or PNG files up to 2 MB each."); continue; }
      next.push({ url });
    }
    set({ photos: next });
  }

  const latestDraft = useRef(draft);
  latestDraft.current = draft;

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
      const current = latestDraft.current;
      onChange({ ...current, title: current.title || res.draft.title, description: current.description || res.draft.description });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiBusy(false);
    }
  }

  const titleMax = f.titleMax;
  const descMax = f.descriptionMax;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      {editPhoto && <PhotoStudio source={editPhoto} onClose={() => setEditPhoto(null)} onSave={(url) => { set({ photos: [{ url }, ...draft.photos].slice(0, 12) }); setEditPhoto(null); }} />}
      <div className="space-y-5">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Photos (1–12)</h2>
          <div className="flex flex-wrap gap-2">
            {draft.photos.map((p, i) => (
              <div key={`${p.url}-${i}`} className="relative h-36 w-28 overflow-hidden rounded-[var(--radius-sm)] border border-line bg-raised">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <button type="button" className="absolute right-1 top-1 rounded bg-surface px-2 py-1 text-xs text-ink" disabled={draft.photos.length >= 12} onClick={() => setEditPhoto(p.url)}>Edit photo</button>
                <div className="absolute inset-x-0 bottom-0 flex">
                  <button
                    type="button"
                    className="flex-1 bg-ink/70 py-0.5 text-[10px] text-paper"
                    onClick={() => {
                      const photos = [...draft.photos];
                      const [moved] = photos.splice(i, 1);
                      if (moved) photos.unshift(moved);
                      set({ photos });
                    }}
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    className="flex-1 bg-danger/80 py-0.5 text-[10px] text-white"
                    onClick={() => set({ photos: draft.photos.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <label className="grid h-24 w-20 cursor-pointer place-items-center rounded-[var(--radius-sm)] border border-dashed border-line-strong text-xs text-muted">
              Add
              <input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            </label>
          </div>
          {photoError && <p role="alert" className="text-xs text-danger">{photoError}</p>}
          {f.httpsPhotos ? (
            <>
              <p className="text-[11px] text-subtle">
                JPEG/PNG files up to 2 MB and Photo studio copies upload to eBay when you publish. Public HTTPS photos work too. Originals stay in Lane.
              </p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem("photoUrl") as HTMLInputElement | null;
                  const value = input?.value.trim() ?? "";
                  if (!isHttpsPhoto(value)) { setPhotoError("Use a public HTTPS photo URL."); return; }
                  setPhotoError(null);
                  if (draft.photos.length >= 12) return;
                  set({ photos: [...draft.photos, { url: value }] });
                  if (input) input.value = "";
                }}
              >
                <Input name="photoUrl" placeholder="https://… photo URL for eBay" className="flex-1" />
                <Button type="submit" size="sm" variant="secondary">
                  Add URL
                </Button>
              </form>
            </>
          ) : (
            <p className="text-[11px] text-subtle">Vinted accepts the files you add here. Lane Bridge re-uploads them from your browser.</p>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Title · ${draft.title.length}/${titleMax}`}>
            <Input
              value={draft.title}
              maxLength={titleMax}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={f.vinted ? "Brand, item, colour, size" : "Clear title, 80 characters"}
            />
          </Field>
          {f.sku ? (
            <Field label="SKU" hint="Optional stock reference for your own records. Lane creates the eBay reference automatically.">
              <Input value={draft.sku} onChange={(e) => set({ sku: e.target.value })} className="font-mono" />
            </Field>
          ) : null}
        </div>
        <Field label={`Description · ${draft.description.length}/${descMax}`}>
          <Textarea
            value={draft.description}
            maxLength={descMax}
            onChange={(e) => set({ description: e.target.value })}
            rows={6}
            placeholder="What it is, size/fit, condition, flaws."
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {(["all", "men", "women", "kids"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDept(d)}
              className={cn(
                "h-8 rounded-full px-3 text-xs",
                dept === d ? "bg-mark text-mark-fg" : "bg-secondary text-muted",
              )}
            >
              {d === "all" ? "All categories" : d[0]!.toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Category"
            hint={
              f.ebay && !CATEGORIES.find((c) => c.id === draft.categoryCanonical)?.ebayUk.confirmed
                ? "eBay leaf not verified — publish will be blocked until it is."
                : undefined
            }
          >
            <NativeSelect value={draft.categoryCanonical} onChange={(e) => onCategory(e.target.value)}>
              <option value="">Choose the destination category</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Condition">
            <NativeSelect value={draft.condition} onChange={(e) => set({ condition: e.target.value as ItemDraft["condition"] })}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {CONDITION_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Brand" hint={f.vinted ? "Vinted requires a brand, or No brand." : "eBay item specific."}>
            <Input aria-label="Brand" value={draft.brand === "No brand" ? "" : draft.brand} onChange={(e) => set({ brand: e.target.value })} disabled={draft.brand === "No brand"} />
            {f.vinted ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={draft.brand === "No brand"}
                  onChange={(e) => set({ brand: e.target.checked ? "No brand" : "" })}
                />
                No brand
              </label>
            ) : null}
          </Field>
          <Field label="Colour">
            <NativeSelect value={draft.colour} onChange={(e) => set({ colour: e.target.value })}>
              <option value="">Select colour</option>
              {draft.colour && !COLOURS.includes(draft.colour as typeof COLOURS[number]) && <option value={draft.colour}>{draft.colour} (imported)</option>}
              {COLOURS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        {needsSize(draft.categoryCanonical) ? (
          <div className={cn("grid gap-3", f.ebay ? "sm:grid-cols-3" : "sm:grid-cols-1")}>
            <Field label="Size (UK)">
              <NativeSelect value={draft.sizeUk} onChange={(e) => onUkSize(e.target.value)}>
                <option value="">Select size</option>
                {draft.sizeUk && !sizeTable.some((s) => s.uk === draft.sizeUk) && <option value={draft.sizeUk}>{draft.sizeUk} (imported)</option>}
                {sizeTable.map((s) => (
                  <option key={s.uk} value={s.uk}>
                    UK {s.uk}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {f.ebay ? (
              <>
                <Field label="Size EU">
                  <Input value={draft.sizeEu} onChange={(e) => set({ sizeEu: e.target.value })} />
                </Field>
                <Field label="Size US">
                  <Input value={draft.sizeUs} onChange={(e) => set({ sizeUs: e.target.value })} />
                </Field>
              </>
            ) : null}
          </div>
        ) : null}

        {f.material ? (
          <Field label="Material" hint="Vinted lets you pick up to 3. One main fibre is enough here.">
            <Input value={draft.material} onChange={(e) => set({ material: e.target.value })} placeholder="Cotton, wool, leather…" />
          </Field>
        ) : null}

        {f.parcel ? (
          <Field label="Parcel size" hint="Vinted shipping. Buyer pays the carrier rate for this size.">
            <div className="grid gap-2 sm:grid-cols-3">
              {VINTED_PARCELS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set({ postageProfileId: p.id })}
                  className={cn(
                    "min-h-11 rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm",
                    draft.postageProfileId === p.id ? "border-mark bg-ok-bg" : "border-line bg-raised text-muted",
                  )}
                >
                  <span className="block font-medium text-ink">{p.label}</span>
                  <span className="block text-[11px]">{p.hint}</span>
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        <div className={cn("grid gap-3", f.quantity ? "sm:grid-cols-3" : "sm:grid-cols-1")}>
          <Field label="List price £">
            <Input inputMode="decimal" value={draft.basePriceGbp} onChange={(e) => set({ basePriceGbp: e.target.value })} />
          </Field>
          {f.quantity ? (
            <Field label="Qty" hint="Vinted is always 1 if you also list there.">
              <Input inputMode="numeric" value={draft.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            </Field>
          ) : null}
          {f.sku && f.ebay && !f.vinted ? null : null}
        </div>

        {f.weight || f.dimensions ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {f.weight ? (
              <Field label="Weight g" hint="eBay package weight.">
                <Input inputMode="numeric" value={draft.weightG} onChange={(e) => set({ weightG: e.target.value })} />
              </Field>
            ) : null}
            {f.dimensions ? (
              <>
                <Field label="L cm">
                  <Input value={draft.lengthCm} onChange={(e) => set({ lengthCm: e.target.value })} />
                </Field>
                <Field label="W cm">
                  <Input value={draft.widthCm} onChange={(e) => set({ widthCm: e.target.value })} />
                </Field>
                <Field label="H cm">
                  <Input value={draft.heightCm} onChange={(e) => set({ heightCm: e.target.value })} />
                </Field>
              </>
            ) : null}
          </div>
        ) : null}

        <button type="button" className="text-xs text-muted underline-offset-4 hover:underline" onClick={() => setExtras((v) => !v)}>
          {extras ? "Hide Lane-only fields" : "Show Lane-only fields (cost, notes, tags)"}
        </button>
        {extras ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cost £">
              <Input inputMode="decimal" value={draft.costPriceGbp} onChange={(e) => set({ costPriceGbp: e.target.value })} />
            </Field>
            <Field label="Tags" hint="Comma separated, Lane only">
              <Input value={draft.tags} onChange={(e) => set({ tags: e.target.value })} />
            </Field>
            <Field label="Internal notes">
              <Textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} />
            </Field>
          </div>
        ) : null}

        {f.ebay && <SmartFields draft={draft} onChange={onChange} aiEnabled={aiEnabled} />}
        <div className="rounded-[var(--radius-md)] border border-line bg-raised p-3 text-xs text-muted">
          {f.ebay ? (
            <p>
              eBay → {CATEGORIES.find((c) => c.id === draft.categoryCanonical)?.ebayUk.name ?? "picker"}
              {CATEGORIES.find((c) => c.id === draft.categoryCanonical)?.ebayUk.confirmed ? "" : " — confirm this leaf, ID not verified."}
            </p>
          ) : null}
          {f.vinted ? (
            <p className={f.ebay ? "mt-1" : undefined}>
              Vinted → {CATEGORIES.find((c) => c.id === draft.categoryCanonical)?.vintedUk.path ?? "confirm in picker"}
            </p>
          ) : null}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-line bg-raised p-3">
          <p className="text-xs font-medium text-ink">Your destination prices</p>
          <div className="mt-2 space-y-2 text-sm">
            {f.ebay ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted">
                    {CHANNELS.ebay_uk.short}
                  </span>
                  <span className="tabular">{price > 0 ? formatMoney(ebayPrice) : "—"}</span>
                </div>
                <p className="text-[11px] text-subtle">Before marketplace fees, postage and any tax. Your pricing rule is included.</p>
              </>
            ) : null}
            {f.vinted ? (
              <>
                <div className={cn("flex justify-between", f.ebay && "border-t border-line pt-2")}>
                  <span className="text-muted">
                    {CHANNELS.vinted_uk.short}
                  </span>
                  <span className="tabular">{price > 0 ? formatMoney(vintedPrice) : "—"}</span>
                </div>
                <p className="text-[11px] text-subtle">Your pricing rule is included. Check postage separately.</p>
              </>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-[var(--radius-md)] border border-line bg-raised p-3">
          <p className="text-xs font-medium">Listing copy</p>
          <p className="text-[11px] text-subtle">Fills empty title and description only. Your edits stay in place. Uses 1 AI credit.</p>
          <NativeSelect value={voice} onChange={(e) => setVoice(e.target.value as AiVoice)}>
            <option value="short">Short</option>
            <option value="detailed">Detailed</option>
            <option value="vintage">Vintage</option>
            <option value="streetwear">Streetwear</option>
          </NativeSelect>
          <Button variant="secondary" size="sm" className="w-full" disabled={aiBusy || !aiEnabled} onClick={() => void fillAi()}>
            {aiBusy ? "Writing…" : aiEnabled ? "Fill from notes" : "Enable AI in Billing"}
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
  channelFields?: ItemDraft["channelFields"];
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
    channelFields: item.channelFields,
    description: item.description,
    brand: item.brand ?? "",
    categoryCanonical: item.categoryCanonical ?? "",
    condition: item.condition,
    sizeUk: item.sizeUk ?? "",
    sizeEu: item.sizeEu ?? "",
    sizeUs: item.sizeUs ?? "",
    colour: item.colour ?? "",
    material: item.material ?? "",
    gender: item.gender ?? "",
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
    return <p className="text-sm text-muted">Connect this channel in Settings first.</p>;
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
              "min-h-11 rounded-[var(--radius-sm)] border px-3 text-sm",
              on ? "border-mark bg-ok-bg text-ink" : "border-line bg-raised text-muted",
            )}
          >
            {CHANNELS[a.marketplace]?.label} · {a.mode === "oauth" ? "API" : "Bridge"}
          </button>
        );
      })}
    </div>
  );
}
