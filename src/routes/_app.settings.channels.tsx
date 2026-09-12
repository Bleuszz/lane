import { EbaySellerSettings } from "@/components/ebay-seller-settings";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  connectAccount,
  disconnectAccount,
  getBootstrap,
  getVintedConnectStatus,
  rotatePairingToken,
  startVintedConnect,
} from "@/lib/lane/server/fns";
import { CHANNELS, channelList } from "@/lib/lane/channels";
import { formatDateTime } from "@/lib/lane/format";
import { EBAY_CONNECT_COPY, PHONE_CONNECT_COPY, VINTED_CONNECT_COPY } from "@/lib/lane/copy";
import { WINDOWS_DOWNLOAD_URL } from "@/lib/lane/download";
import { Button, Panel } from "@/components/ui";
import { ModeChip, StatusBadge } from "@/components/status";
import { QrImage } from "@/components/qr";
import { desktopApi } from "@/lib/lane/desktop";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import type { MarketplaceId } from "@/lib/lane/types";

export const Route = createFileRoute("/_app/settings/channels")({ component: ChannelsPage });

function ChannelsPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const connect = useMutation({
    mutationFn: async (marketplace: MarketplaceId) => {
      const res = await connectAccount({ data: { marketplace } });
      if (res.oauthUrl) {
        window.location.assign(res.oauthUrl);
        return res;
      }
      const desk = desktopApi();
      const token = boot.data?.settings.pairingToken ?? "";
      if (desk) {
        toast("Sign in on the marketplace window. It closes when Lane has the session.");
        if (desk.setPairing) await desk.setPairing(token, window.location.origin);
        const r = await desk.connect(marketplace, { pairingToken: token, origin: window.location.origin });
        if (!r.ok) throw new Error(r.error ?? "Connect window closed before a session was captured.");
        toast.success(r.username ? `Connected as ${r.username}` : "Connected");
        return res;
      }
      if (marketplace === "vinted_uk") {
        toast("Open Lane Desktop to connect Vinted. Your marketplace session stays on your computer.");
      }
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
        if (s.status === "completed") {
          toast.success("Vinted connected");
          void qc.invalidateQueries();
        }
      });
    }, 2500);
    return () => window.clearInterval(t);
  }, [phone, phoneStatus, qc]);

  const inDesktop = Boolean(desktopApi());
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const laneProtocol = phone
    ? `lane://connect?marketplace=vinted_uk&token=${encodeURIComponent(token)}&origin=${encodeURIComponent(origin)}&id=${encodeURIComponent(phone.id)}&k=${encodeURIComponent(new URL(phone.url).searchParams.get("k") ?? "")}`
    : `lane://connect?marketplace=vinted_uk&token=${encodeURIComponent(token)}&origin=${encodeURIComponent(origin)}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Accounts</h1>
        <p className="mt-1 text-sm text-muted">
          {inDesktop
            ? "Connect opens the real site. When you are signed in, Lane takes the session and closes the window."
            : "Connect Vinted and eBay from Lane Desktop. Manage paired computers in Your devices."}
        </p>
      </div>
      {connect.error ? <p className="text-sm text-danger">{(connect.error as Error).message}</p> : null}
      {ebayFlag === "connected" ? <p className="text-sm text-ok">eBay connected.</p> : null}
      {ebayFlag === "missing_keys" ? <p className="text-sm text-danger">eBay keys are not set on the server.</p> : null}
      {ebayFlag === "denied" || ebayFlag === "error" ? (
        <p className="text-sm text-danger">eBay OAuth failed{ebayReason ? `: ${ebayReason}` : "."}</p>
      ) : null}

      {!inDesktop ? (
        <Panel className="p-4">
          <h2 className="text-sm font-medium">Lane Desktop</h2>
          <p className="mt-1 text-sm text-muted">
            Install Lane Desktop, sign in to Lane and approve the matching device code. Then connect each marketplace
            in its own login window. The current beta reads listing pages locally; desktop inventory import is still being verified.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={WINDOWS_DOWNLOAD_URL} className="inline-flex">
              <Button size="sm">Download for Windows</Button>
            </a>
            <a href="/devices" className="inline-flex">
              <Button size="sm" variant="secondary">
                Your devices
              </Button>
            </a>
          </div>
        </Panel>
      ) : null}

      <details className="space-y-3">
      <summary className="cursor-pointer text-sm text-muted">Existing Lane Bridge setup (advanced)</summary>
      <p className="text-sm text-muted">Optional legacy extension setup. Lane Desktop does not need this token. Cloud session capture is disabled for the new beta.</p>
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
      </Panel>

      <Panel className="p-4">
        <h2 className="text-sm font-medium">Connect Vinted from another device</h2>
        <p className="mt-1 text-sm text-muted">{PHONE_CONNECT_COPY}</p>
        <Button className="mt-3" disabled>
          Legacy capture unavailable
        </Button>
        {phoneMut.error ? <p className="mt-2 text-sm text-danger">{(phoneMut.error as Error).message}</p> : null}
        {phone ? (
          <div className="mt-4 space-y-3">
            <QrImage value={phone.url} alt="QR code for the Vinted connect page" />
            <p className="break-all font-mono text-[11px] text-muted">{phone.url}</p>
            <p className="text-xs text-subtle">
              Phone cameras open this page. On this PC, use Open in Lane so the Windows app does the capture. A phone
              Safari/Chrome session cannot be sent to Lane.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(phone.url)}>
                Copy link
              </Button>
              {"share" in navigator ? (
                <Button size="sm" variant="secondary" onClick={() => void navigator.share({ title: "Lane Vinted connect", url: phone.url })}>
                  Share
                </Button>
              ) : null}
              <a href={laneProtocol} className="inline-flex">
                <Button size="sm">Open capture in Windows app</Button>
              </a>
            </div>
            <p className="text-sm">
              Status:{" "}
              <span className="font-medium">{phoneStatus === "completed" ? "Connected" : "Waiting for sign-in…"}</span>
            </p>
          </div>
        ) : null}
      </Panel>

      </details>
      {accounts.filter(a => a.marketplace === "ebay_uk" && a.oauthConnected).map(a => <EbaySellerSettings key={a.id} accountId={a.id} label={a.label}/>)}
      <div className="space-y-3">
        {accounts.map((a) => (
          <Panel key={a.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-xs text-muted">
                  {a.remoteUsername ?? "Not identified yet"} · {CHANNELS[a.marketplace]?.site}
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
              {a.marketplace === "vinted_uk" && inDesktop ? (
                <Button size="sm" disabled={connect.isPending} onClick={() => connect.mutate(a.marketplace)}>
                  Reconnect
                </Button>
              ) : null}
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
          const connected = accounts.some((a) => a.marketplace === c.id && a.status === "green");
          return (
            <Panel key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{c.label}</p>
                <span className="rounded-full bg-raised px-2 py-1 text-[11px] text-muted">{c.enabled ? "Beta connector" : "Planned"}</span>
              </div>
              {c.id === "ebay_uk" ? <p className="mt-2 text-xs text-muted">{EBAY_CONNECT_COPY}</p> : null}
              {c.enabled ? (
                <Button
                  size="sm"
                  className="mt-3"
                  variant={connected ? "secondary" : "primary"}
                  disabled={connect.isPending}
                  onClick={() => connect.mutate(c.id)}
                >
                  {connected ? `Reconnect ${c.short}` : `Connect ${c.short}`}
                </Button>
              ) : (
                <p className="mt-3 text-xs text-subtle">Planned integration · not available to connect yet.</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
