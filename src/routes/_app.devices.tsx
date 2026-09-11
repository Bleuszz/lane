import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveDesktop, listDesktopDevices, revokeDesktop } from "@/lib/lane/server/desktop-fns";
import { Button, Panel } from "@/components/ui";
export const Route = createFileRoute("/_app/devices")({
  validateSearch: (search: Record<string, unknown>): { pair?: string; code?: string } => ({
    pair: typeof search.pair === "string" ? search.pair : "",
    code: typeof search.code === "string" ? search.code : "",
  }),
  component: Devices,
});
function Devices() {
  const { pair = "", code = "" } = Route.useSearch(),
    qc = useQueryClient(),
    devices = useQuery({
      queryKey: ["devices"],
      queryFn: () => listDesktopDevices(),
      refetchInterval: 15000,
    });
  const approve = useMutation({
    mutationFn: () => approveDesktop({ data: { id: pair, code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeDesktop({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });
  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <h1 className="font-serif text-3xl">Your Lane setup</h1>
      <p className="text-sm text-muted">
        Desktop keeps marketplace sessions on your computer. You can revoke its access to Lane here.
      </p>
      {pair && code && (
        <Panel className="space-y-3 p-5">
          <h2 className="font-medium">Connect Lane Desktop</h2>
          <p className="text-sm">
            Check that Lane Desktop shows this same code:{" "}
            <strong className="font-mono">{code}</strong>. Approve only a pairing you just started.
          </p>
          <Button
            onClick={() => approve.mutate()}
            disabled={approve.isPending || approve.isSuccess}
          >
            {approve.isSuccess ? "Approved — return to Desktop" : "Approve this device"}
          </Button>
          {approve.isError && (
            <p role="alert">Pairing expired or could not be approved. Start again from Desktop.</p>
          )}
        </Panel>
      )}
      {devices.isError && <p role="alert">Devices could not be loaded.</p>}
      {devices.data?.length === 0 && (
        <Panel className="p-5">
          No paired desktops yet. Open Lane Desktop and choose Sign in to Lane.
        </Panel>
      )}
      {devices.data?.map((d) => (
        <Panel key={d.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-medium">{d.label}</h2>
            <p className="text-sm text-muted">
              {d.revoked_at
                ? "Revoked"
                : d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 90000
                  ? "Online"
                  : "Lane Desktop is offline. Open Lane Desktop to continue."}{" "}
              · {d.version ? `Version ${d.version}` : "Version not reported"}
            </p>
            <p className="text-xs text-muted">
              Vinted: {marketplaceHealth(d, "vinted")} · eBay: {marketplaceHealth(d, "ebay")}
              {d.last_seen_at ? ` · Last seen ${new Date(d.last_seen_at).toLocaleString()}` : ""}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={Boolean(d.revoked_at) || revoke.isPending}
            onClick={() => revoke.mutate(d.id)}
          >
            Revoke
          </Button>
        </Panel>
      ))}
      {revoke.isError && <p role="alert">Could not revoke this device. Try again.</p>}
    </main>
  );
}
function marketplaceHealth(
  device: {
    revoked_at: string | null;
    last_seen_at: string | null;
    capabilities: { vinted?: string; ebay?: string };
  },
  marketplace: "vinted" | "ebay",
) {
  if (device.revoked_at) return "Disconnected";
  if (!device.last_seen_at || Date.now() - new Date(device.last_seen_at).getTime() >= 90000)
    return "Unverified while desktop is offline";
  return device.capabilities[marketplace] === "authenticated"
    ? "Connected"
    : "Not validated — check Desktop";
}
