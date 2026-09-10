import { PublishPreview } from "@/components/publish-preview";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveItemFn,
  cloneItemFn,
  deleteItemsFn,
  delistListings,
  getBootstrap,
  getItemFn,
  getSettingsExtras,
  markSoldFn,
  publishItems,
  pushUpdate,
  relistListing,
  updateItemFn,
} from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { formatDateTime, formatMoney } from "@/lib/lane/format";
import { ChannelPicker, ItemForm, ListingTargetPicker, draftFromItem } from "@/components/item-form";
import type { ListingTarget } from "@/lib/lane/listing-fields";
import { Button, Panel } from "@/components/ui";
import { ModeChip, StatusBadge } from "@/components/status";
import { useEffect, useRef, useState } from "react";
import type { ItemDraft } from "@/lib/lane/types";

export const Route = createFileRoute("/_app/inventory/$id")({ component: ItemPage });

function ItemPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const itemQ = useQuery({ queryKey: ["item", id], queryFn: () => getItemFn({ data: { id } }) });
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const extras = useQuery({ queryKey: ["settings-extras"], queryFn: () => getSettingsExtras() });
  const [targetOverride, setTargetOverride] = useState<ListingTarget | null>(null);
  const [review, setReview] = useState(false);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const loadedItemId = useRef<string | null>(null);
  useEffect(() => {
    if (itemQ.data && loadedItemId.current !== id) {
      loadedItemId.current = id;
      setDraft(draftFromItem(itemQ.data));
    }
  }, [itemQ.data, id]);

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("No draft");
      return updateItemFn({ data: { id, draft } });
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  if (itemQ.isError) return <p className="text-sm text-danger">Could not load this item. Return to inventory and try again.</p>;
  if (itemQ.isPending || !draft) return <div className="h-64 animate-pulse rounded-[var(--radius-md)] bg-secondary" />;
  if (itemQ.isError) return <p className="text-sm text-danger">Item not found.</p>;
  const item = itemQ.data;
  const picked = (boot.data?.accounts ?? []).filter((a) => accountIds.includes(a.id));
  const wantsEbay = item.channels.some((c) => c.marketplace === "ebay_uk") || picked.some((a) => a.marketplace === "ebay_uk");
  const wantsVinted = item.channels.some((c) => c.marketplace === "vinted_uk") || picked.some((a) => a.marketplace === "vinted_uk");
  const listingTarget: ListingTarget = targetOverride ?? (wantsEbay && wantsVinted ? "both" : wantsEbay ? "ebay" : "vinted");


  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {review && <PublishPreview draft={draft} accounts={picked} rules={extras.data?.rules ?? []} onClose={() => setReview(false)} onConfirm={async () => {
        await save.mutateAsync();
        const result = await publishItems({data:{itemIds:[id],accountIds}});
        setMsg(`Queued ${result.queued} job(s).`); void qc.invalidateQueries();
      }}/>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/inventory" className="text-xs text-muted hover:text-ink">
            Inventory
          </Link>
          <h1 className="mt-1 text-xl font-medium tracking-[-0.02em]">{item.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            {item.sku ? <span className="font-mono text-xs text-muted">{item.sku}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => cloneItemFn({ data: { id } }).then((r) => nav({ to: "/inventory/$id", params: { id: r.id } }))}
          >
            Clone
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              archiveItemFn({ data: { id } }).then(() => nav({ to: "/inventory" }))
            }
          >
            Archive
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this listing from Lane? Live marketplace listings are not ended. Delist first if you want them taken down.",
                )
              ) {
                return;
              }
              void deleteItemsFn({ data: { itemIds: [id] } }).then(() => nav({ to: "/inventory" }));
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {item.status === "sold" ? (
        <Panel className="p-4 text-sm">
          Sold on {item.soldChannel ? CHANNELS[item.soldChannel as keyof typeof CHANNELS]?.label : "—"} for {formatMoney(item.soldPriceGbp ?? 0)} at {formatDateTime(item.soldAt)}.
        </Panel>
      ) : null}

      <ListingTargetPicker value={listingTarget} onChange={setTargetOverride}/>
      <ItemForm
        draft={draft}
        onChange={setDraft}
        target={listingTarget}
        rules={extras.data?.rules ?? []}
        aiEnabled={Boolean(boot.data?.settings.aiPack)}
      />

      <section>
        <h2 className="text-sm font-medium">Channels</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {item.channels.length === 0 ? (
            <p className="text-sm text-muted">Not listed anywhere yet.</p>
          ) : (
            item.channels.map((c) => (
              <Panel key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{CHANNELS[c.marketplace]?.label}</p>
                    <p className="text-xs text-muted">{c.accountLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ModeChip mode={c.mode} />
                    <StatusBadge status={c.remoteStatus} />
                  </div>
                </div>
                <p className="mt-2 tabular text-sm">{formatMoney(c.channelPriceGbp ?? item.basePriceGbp)}</p>
                <p className="mt-1 text-[11px] text-subtle">
                  Last sync {formatDateTime(c.lastSyncedAt)} · qty on channel {c.quantityOnChannel}
                </p>
                {c.lastError ? <p className="mt-2 text-sm text-danger">{c.lastError}</p> : null}
                {c.url ? (
                  <a href={c.url} className="mt-2 inline-block text-xs text-mark underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                    Open listing
                  </a>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.remoteStatus === "live" ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => pushUpdate({ data: { itemId: id, accountIds: [c.marketplaceAccountId] } }).then(() => qc.invalidateQueries())}>
                        Push update
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => delistListings({ data: { itemIds: [id], accountIds: [c.marketplaceAccountId] } }).then(() => qc.invalidateQueries())}>
                        Delist
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => relistListing({ data: { channelListingId: c.id } }).then(() => qc.invalidateQueries())}>
                        Relist
                      </Button>
                      <Button
                        size="sm"
                        disabled={item.quantity !== 1}
                        title={item.quantity !== 1 ? "Per-unit sale entry is not available yet" : undefined}
                        onClick={() =>
                          markSoldFn({ data: { itemId: id, marketplace: c.marketplace, via: "manual" } }).then(() => {
                            setMsg("Sale recorded. Other live channels queued for delist if qty is now 0.");
                            void qc.invalidateQueries();
                          })
                        }
                      >
                        Mark sold here
                      </Button>
                    </>
                  ) : null}
                </div>
              </Panel>
            ))
          )}
        </div>
      </section>

      {item.status !== "sold" ? (
        <section>
          <h2 className="text-sm font-medium">Publish to</h2>
          <div className="mt-3">
            <ChannelPicker
              accounts={boot.data?.accounts ?? []}
              selected={accountIds}
              onToggle={(aid) => setAccountIds((cur) => (cur.includes(aid) ? cur.filter((x) => x !== aid) : [...cur, aid]))}
            />
          </div>
          <Button
            className="mt-3"
            disabled={save.isPending}
            onClick={() => setReview(true)}
          >
            {accountIds.length ? "Review and publish" : "Preview listing"}
          </Button>
        </section>
      ) : null}

      {msg ? <p className="text-sm text-ok">{msg}</p> : null}
      {save.error ? <p className="text-sm text-danger">{(save.error as Error).message}</p> : null}
    </div>
  );
}
