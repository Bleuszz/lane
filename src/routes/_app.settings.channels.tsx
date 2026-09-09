import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { connectAccount, disconnectAccount, getBootstrap, getVintedConnectStatus, rotatePairingToken, startVintedConnect } from "@/lib/lane/server/fns";
import { CHANNELS, channelList } from "@/lib/lane/channels";
import { formatDateTime } from "@/lib/lane/format";
import { EBAY_CONNECT_COPY, VINTED_CONNECT_COPY } from "@/lib/lane/copy";
import { Button, Panel } from "@/components/ui";
import { ModeChip, StatusBadge } from "@/components/status";
import { QrImage } from "@/components/qr";
import { useEffect, useMemo, useState } from "react";

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
  const [phone, setPhone] = useState<{ id: string; url: string } | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<string | null>(null);

  const phoneMut = useMutation({
    mutationFn: () => startVintedConnect(),
    onSuccess: (r) => {
      setPhone({ id: r.id, url: r.url });
      setPhoneStatus("pending");
    },
  });

  useEffect(() => {
    if (!phone || phoneStatus === "completed") return;
    const t = window.setInterval(() => {
      void getVintedConnectStatus({ data: { id: phone.id } }).then((s) => {
        setPhoneStatus(s.status);
        if (s.status === "completed") void qc.invalidateQueries();
      });
    }, 3000);
    return () => window.clearInterval(t);
  }, [phone, phoneStatus, qc]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        UK pack is default. eBay is official OAuth. Vinted: sign in on Vinted’s site from your phone (QR) or keep Lane
        Bridge on a signed-in vinted.co.uk tab.
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

      <Panel className="p-4">
        <h2 className="text-sm font-medium">Connect Vinted from your phone</h2>
        <p className="mt-1 text-sm text-muted">
          Same idea as Crosslist’s App Store flow: you tap through to Vinted’s real login. A website cannot read
          Vinted’s HttpOnly cookies the way a native in-app browser can, so this page opens a phone link that waits
          until Firefox + Lane Bridge (Android) or desktop Chrome captures the session. After that, Lane stores the
          session encrypted and can sync without the tab staying open.
        </p>
        <Button className="mt-3" disabled={phoneMut.isPending} onClick={() => phoneMut.mutate()}>
          {phoneMut.isPending ? "Creating link…" : "Create phone connect link"}
        </Button>
        {phoneMut.error ? <p className="mt-2 text-sm text-danger">{(phoneMut.error as Error).message}</p> : null}
        {phone ? (
          <div className="mt-4 space-y-3">
            <QrImage value={phone.url} alt="QR code for Vinted connect" />
            <p className="break-all font-mono text-[11px] text-muted">{phone.url}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(phone.url)}>
                Copy link
              </Button>
              {"share" in navigator ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void navigator.share({ title: "Lane Vinted connect", url: phone.url })}
                >
                  Share
                </Button>
              ) : null}
            </div>
            <p className="text-sm">
              Status:{" "}
              <span className="font-medium">
                {phoneStatus === "completed" ? "Connected" : "Waiting for sign-in…"}
              </span>
            </p>
          </div>
        ) : null}
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
