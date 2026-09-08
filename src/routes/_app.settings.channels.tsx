import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { connectAccount, disconnectAccount, getBootstrap, rotatePairingToken } from "@/lib/lane/server/fns";
import { CHANNELS, channelList } from "@/lib/lane/channels";
import { formatDateTime } from "@/lib/lane/format";
import { EBAY_CONNECT_COPY, VINTED_CONNECT_COPY } from "@/lib/lane/copy";
import { Button, Panel } from "@/components/ui";
import { ModeChip, StatusBadge } from "@/components/status";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/settings/channels")({ component: ChannelsPage });

function ChannelsPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const connect = useMutation({
    mutationFn: async (marketplace: "vinted_uk" | "ebay_uk") => {
      const res = await connectAccount({ data: { marketplace } });
      if (res.oauthUrl) window.location.assign(res.oauthUrl);
      return res;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
  const rotate = useMutation({
    mutationFn: () => rotatePairingToken(),
    onSuccess: () => qc.invalidateQueries(),
  });
  const accounts = boot.data?.accounts ?? [];
  const token = boot.data?.settings.pairingToken ?? "";
  const ebayFlag = useMemo(() => new URLSearchParams(window.location.search).get("ebay"), []);
  const ebayReason = useMemo(() => new URLSearchParams(window.location.search).get("reason"), []);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        UK pack is default. eBay is official OAuth. Vinted is Lane Bridge — publish and autodelist only while a Chrome
        tab is open on vinted.co.uk.
      </p>
      {connect.error ? <p className="text-sm text-danger">{(connect.error as Error).message}</p> : null}
      {ebayFlag === "connected" ? <p className="text-sm text-mark">eBay connected.</p> : null}
      {ebayFlag === "missing_keys" ? (
        <p className="text-sm text-danger">eBay keys are not set on the server. See instructions.txt.</p>
      ) : null}
      {ebayFlag === "denied" || ebayFlag === "error" ? (
        <p className="text-sm text-danger">eBay OAuth failed{ebayReason ? `: ${ebayReason}` : "."}</p>
      ) : null}

      <Panel className="p-4">
        <h2 className="text-sm font-medium">Lane Bridge pairing token</h2>
        <p className="mt-1 text-sm text-muted">{VINTED_CONNECT_COPY}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="block min-w-0 flex-1 truncate rounded-[var(--radius-sm)] bg-raised px-2 py-2 font-mono text-[11px]">
            {token}
          </code>
          <Button size="sm" variant="secondary" onClick={() => token && navigator.clipboard.writeText(token)}>
            Copy
          </Button>
          <Button size="sm" variant="ghost" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
            Rotate
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          Paste this into the extension popup with this site's origin. Rotating immediately disconnects any already-paired
          browser.
        </p>
      </Panel>

      <div className="space-y-3">
        {accounts.map((a) => (
          <Panel key={a.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-xs text-muted">
                  {a.remoteUsername ?? "Not identified yet"} · {CHANNELS[a.marketplace]?.site}
                  {a.sandbox ? " · eBay sandbox" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ModeChip mode={a.mode} />
                <StatusBadge status={a.status} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-subtle">
              Last heartbeat {formatDateTime(a.lastHeartbeatAt)} · {a.publishesThisHour}/{a.maxPublishesPerHour} publishes
              this hour
            </p>
            {a.lastError ? <p className="mt-2 text-sm text-danger">{a.lastError}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => disconnectAccount({ data: { id: a.id } }).then(() => qc.invalidateQueries())}
              >
                Disconnect
              </Button>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {channelList({ includeDisabled: true }).map((c) => {
          const connected = accounts.some((a) => a.marketplace === c.id);
          return (
            <Panel key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{c.label}</p>
                <ModeChip mode={c.mode} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {c.enabled ? (c.priority === 0 ? "P0 · UK pack" : `P${c.priority}`) : "Not in MVP"}
              </p>
              {c.id === "ebay_uk" ? <p className="mt-2 text-xs text-muted">{EBAY_CONNECT_COPY}</p> : null}
              {c.enabled ? (
                <Button
                  size="sm"
                  className="mt-3"
                  variant={connected ? "secondary" : "primary"}
                  disabled={connect.isPending}
                  onClick={() => connect.mutate(c.id as "vinted_uk" | "ebay_uk")}
                >
                  {connected && c.id === "ebay_uk"
                    ? "Reconnect eBay"
                    : connected
                      ? "Connect another account"
                      : `Connect ${c.short}`}
                </Button>
              ) : (
                <p className="mt-3 text-xs text-subtle">Ships later. Hidden from the day-one form.</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
