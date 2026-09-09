import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createItemFn, getBootstrap, getSettingsExtras, publishItems, saveTemplateFn } from "@/lib/lane/server/fns";
import { ChannelPicker, EMPTY_DRAFT, ItemForm, ListingTargetPicker } from "@/components/item-form";
import { Button, Input } from "@/components/ui";
import { useMemo, useState } from "react";
import type { ItemDraft } from "@/lib/lane/types";
import { type ListingTarget, validateListing } from "@/lib/lane/listing-fields";

export const Route = createFileRoute("/_app/new")({ component: NewPage });

function NewPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const extras = useQuery({ queryKey: ["settings-extras"], queryFn: () => getSettingsExtras() });
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [target, setTarget] = useState<ListingTarget | null>(null);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [tplName, setTplName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const accounts = boot.data?.accounts ?? [];
  const visibleAccounts = useMemo(() => {
    if (!target) return [];
    if (target === "vinted") return accounts.filter((a) => a.marketplace === "vinted_uk");
    if (target === "ebay") return accounts.filter((a) => a.marketplace === "ebay_uk");
    return accounts.filter((a) => a.marketplace === "vinted_uk" || a.marketplace === "ebay_uk");
  }, [accounts, target]);

  function pickTarget(next: ListingTarget) {
    setTarget(next);
    const match =
      next === "vinted"
        ? accounts.filter((a) => a.marketplace === "vinted_uk")
        : next === "ebay"
          ? accounts.filter((a) => a.marketplace === "ebay_uk")
          : accounts.filter((a) => a.marketplace === "vinted_uk" || a.marketplace === "ebay_uk");
    setAccountIds(match.map((a) => a.id));
    if (next === "vinted" && !draft.postageProfileId) {
      setDraft((d) => ({ ...d, postageProfileId: "vinted_medium", quantity: "1" }));
    }
  }

  const create = useMutation({
    mutationFn: async (andPublish: boolean) => {
      if (!target) throw new Error("Pick Vinted, eBay, or both first.");
      const problems = validateListing(draft, target);
      if (andPublish && problems.length) throw new Error(problems[0]);
      if (!draft.title.trim()) throw new Error("Title is required");
      const payload: ItemDraft = {
        ...draft,
        quantity: target === "vinted" ? "1" : draft.quantity || "1",
        sku:
          target === "ebay" || target === "both"
            ? draft.sku.trim() || `LN-${Date.now().toString(36).toUpperCase()}`
            : draft.sku,
      };
      const { id } = await createItemFn({ data: payload });
      if (andPublish && accountIds.length) {
        await publishItems({ data: { itemIds: [id], accountIds } });
      }
      return id;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries();
      void nav({ to: "/inventory/$id", params: { id } });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">New listing</h1>
        <p className="mt-1 text-sm text-muted">
          Pick the marketplace first. The form only asks for fields that destination actually requires.
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">List to</p>
        <ListingTargetPicker value={target} onChange={pickTarget} />
      </div>
      {target ? (
        <>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Account</p>
            <ChannelPicker
              accounts={visibleAccounts}
              selected={accountIds}
              onToggle={(id) => setAccountIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
            />
            {visibleAccounts.length === 0 ? (
              <p className="mt-2 text-sm text-danger">
                No {target === "both" ? "Vinted or eBay" : target === "vinted" ? "Vinted" : "eBay"} account connected.{" "}
                <Link to="/settings/channels" className="underline underline-offset-4">
                  Connect it
                </Link>
                .
              </p>
            ) : null}
          </div>
          <ItemForm
            draft={draft}
            onChange={setDraft}
            target={target}
            rules={extras.data?.rules ?? []}
            aiEnabled={Boolean(boot.data?.settings.aiPack)}
          />
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={create.isPending} onClick={() => create.mutate(true)}>
              {create.isPending ? "Saving…" : accountIds.length ? "Save and queue publish" : "Save draft"}
            </Button>
            <Button variant="secondary" disabled={create.isPending} onClick={() => create.mutate(false)}>
              Save draft only
            </Button>
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name" className="w-40" />
            <Button
              variant="ghost"
              onClick={() => saveTemplateFn({ data: { name: tplName || "Untitled", payload: draft } }).then(() => qc.invalidateQueries())}
            >
              Save template
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Choose Vinted, eBay, or both to open the matching form.</p>
      )}
    </div>
  );
}
