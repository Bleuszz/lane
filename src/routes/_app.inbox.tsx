import { ActivationChecklist } from "@/components/activation-checklist";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBootstrap, getInventory, getSales, getVintedSocial, relistListing, retryJob } from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { formatDateTime, formatMoney } from "@/lib/lane/format";
import { desktopApi } from "@/lib/lane/desktop";
import { Button, Panel } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { Heart, MessageCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/inbox")({ component: InboxPage });

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function InboxPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const inv = useQuery({ queryKey: ["inventory"], queryFn: () => getInventory() });
  const sales = useQuery({ queryKey: ["sales"], queryFn: () => getSales() });
  const social = useQuery({ queryKey: ["vinted-social"], queryFn: () => getVintedSocial(), refetchInterval: 60_000 });
  const retry = useMutation({
    mutationFn: (jobId: string) => retryJob({ data: { jobId } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const relist = useMutation({
    mutationFn: (channelListingId: string) => relistListing({ data: { channelListingId } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const relistAll = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await relistListing({ data: { channelListingId: id } });
    },
    onSuccess: () => qc.invalidateQueries(),
  });
  const data = boot.data;
  if (!data) return <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-raised" />;

  const stale = (inv.data ?? []).filter((i) => i.status === "live" && daysAgo(i.createdAt) >= 7).slice(0, 9);
  const staleIds = stale.map((i) => i.channels[0]?.id).filter(Boolean) as string[];
  const staleValue = stale.reduce((sum, i) => sum + (i.basePriceGbp || 0), 0);
  const recentSales = (sales.data ?? []).slice(0, 6);
  const vinted = data.accounts.find((a) => a.marketplace === "vinted_uk");
  const inDesktop = Boolean(desktopApi());
  const likes = social.data?.likes ?? [];
  const offers = social.data?.offers ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.03em]">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {vinted?.status === "green"
              ? `Vinted is connected as ${vinted.remoteUsername ?? "your shop"}.`
              : inDesktop
                ? "Connect Vinted: sign in on their site. The window closes when Lane has the session."
                : "Connect Vinted in the Windows app so Lane can capture the session and close the window."}
          </p>
        </div>
        <Link to="/settings/channels">
          <Button>{vinted?.status === "green" ? "Manage accounts" : "Connect Vinted"}</Button>
        </Link>
      </div>

      <ActivationChecklist data={data}/>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Live", data.liveCount],
          ["Draft", data.draftCount],
          ["Error", data.errorCount],
          ["Sold", data.soldCount],
        ].map(([label, n]) => (
          <Panel key={String(label)} className="px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
            <p className="mt-1 font-mono text-2xl tabular">{n as number}</p>
          </Panel>
        ))}
      </div>

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Sales opportunities</h2>
            <p className="mt-1 text-sm text-muted">Review older listings and decide whether their photos, details or price need a refresh.</p>
          </div>
          {staleIds.length > 0 ? (
            <Button size="sm" disabled={relistAll.isPending} onClick={() => relistAll.mutate(staleIds)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Relist all
            </Button>
          ) : null}
        </div>
        {stale.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">Nothing sitting idle. Import a wardrobe or add a listing.</p>
        ) : (
          <>
            <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-raised px-3 py-2 text-sm text-muted">
              You have <span className="font-medium text-ink">{stale.length} items</span> sitting idle. Relist them to
              review <span className="font-medium text-ink">{formatMoney(staleValue)}</span> in potential sales.
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stale.map((item) => {
                const ch = item.channels[0];
                return (
                  <li key={item.id} className="flex gap-3 rounded-[var(--radius-md)] border border-line bg-raised p-3">
                    {item.primaryPhotoUrl ? (
                      <img src={item.primaryPhotoUrl} alt="" className="h-14 w-14 shrink-0 rounded-[var(--radius-sm)] object-cover" />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-[var(--radius-sm)] bg-surface" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted">
                        {formatMoney(item.basePriceGbp)} · {daysAgo(item.createdAt)}d live
                      </p>
                      {ch ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-2"
                          disabled={relist.isPending}
                          onClick={() => relist.mutate(ch.id)}
                        >
                          Relist
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Recent likes</h2>
              <p className="mt-1 text-xs text-muted">People who favourited your items — send an offer from Vinted.</p>
            </div>
            <Heart className="h-4 w-4 text-subtle" strokeWidth={1.75} />
          </div>
          {likes.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">
              {vinted?.status === "green"
                ? "No likes synced yet. They appear after Vinted notifications are reachable from this session."
                : "Likes sync once Vinted is connected."}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {likes.map((like) => (
                <li key={like.id} className="flex items-start gap-3">
                  {like.photoUrl ? (
                    <img src={like.photoUrl} alt="" className="h-10 w-10 rounded-[var(--radius-sm)] object-cover" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] bg-raised">
                      <Heart className="h-4 w-4 text-subtle" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{like.actor}</span>
                      <span className="text-muted"> favourited </span>
                      {like.title}
                    </p>
                    {like.at ? <p className="text-[11px] text-subtle">{formatDateTime(like.at)}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Recent offers received</h2>
              <p className="mt-1 text-xs text-muted">Accept or decline from your Vinted inbox.</p>
            </div>
            <MessageCircle className="h-4 w-4 text-subtle" strokeWidth={1.75} />
          </div>
          {offers.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">No recent offers.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {offers.map((offer) => (
                <li key={offer.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{offer.actor}</span> on {offer.title}
                    </p>
                    {offer.at ? <p className="text-[11px] text-subtle">{formatDateTime(offer.at)}</p> : null}
                  </div>
                  {offer.priceGbp != null ? (
                    <span className="font-mono tabular">{formatMoney(offer.priceGbp)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-sm font-medium">Recent sales</h2>
          {recentSales.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">No sales recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentSales.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p>{s.itemTitle}</p>
                    <p className="text-xs text-muted">
                      {CHANNELS[s.marketplace]?.short} · {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  <span className="font-mono tabular">{formatMoney(s.soldPriceGbp)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="text-sm font-medium">Needs you</h2>
          {data.inbox.offlineAccounts.length === 0 && data.inbox.failedJobs.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">Quiet. Nothing broken.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.inbox.offlineAccounts.map((a) => (
                <li key={a.id} className="text-muted">
                  {CHANNELS[a.marketplace]?.label} is offline. Open Connect and sign in again.
                </li>
              ))}
              {data.inbox.failedJobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-2">
                  <span>
                    {j.type} · {j.itemTitle ?? "—"}
                    <span className="block text-xs text-danger">{j.errorMessage}</span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => retry.mutate(j.id)}>
                    Retry
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {data.inbox.waitingJobs.length > 0 ? (
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-medium">Waiting for browser</div>
          <ul>
            {data.inbox.waitingJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
                <div>
                  <p>
                    {j.itemTitle ?? j.type} · {j.marketplace ? CHANNELS[j.marketplace]?.short : ""}
                  </p>
                  <p className="font-mono text-[11px] text-subtle">{j.requestId}</p>
                </div>
                <StatusBadge status={j.status} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
