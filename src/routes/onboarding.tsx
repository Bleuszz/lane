import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { completeOnboarding, connectAccount, getBootstrap, importRemote, previewRemote } from "@/lib/lane/server/fns";
import { EBAY_CONNECT_COPY, EXTENSION_HONESTY, LEGAL_FOOTER, VINTED_CONNECT_COPY } from "@/lib/lane/copy";
import { LaneWordmark } from "@/components/logo";
import { Button } from "@/components/ui";
import { ModeChip } from "@/components/status";
import { useState } from "react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, isPending } = useCurrentUserState();
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const [err, setErr] = useState<string | null>(null);

  const vinted = boot.data?.accounts.find((a) => a.marketplace === "vinted_uk");
  const ebay = boot.data?.accounts.find((a) => a.marketplace === "ebay_uk");
  const token = boot.data?.settings.pairingToken ?? "";

  const preview = useQuery({
    queryKey: ["preview", vinted?.id],
    queryFn: () => previewRemote({ data: { accountId: vinted!.id } }),
    enabled: Boolean(vinted),
  });

  const connect = useMutation({
    mutationFn: async (marketplace: "vinted_uk" | "ebay_uk") => {
      const res = await connectAccount({ data: { marketplace } });
      if (res.oauthUrl) {
        window.location.assign(res.oauthUrl);
      }
      return res;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => setErr(e.message),
  });
  const doImport = useMutation({
    mutationFn: async () => {
      if (!vinted) throw new Error("Connect Vinted first");
      const ids = (preview.data ?? []).filter((r) => !r.alreadyImported).map((r) => r.remoteId);
      if (ids.length === 0) throw new Error("No wardrobe items yet. Pair Lane Bridge and leave vinted.co.uk open.");
      return importRemote({ data: { accountId: vinted.id, remoteIds: ids } });
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => setErr(e.message),
  });

  if (isPending || boot.isPending) {
    return <div className="min-h-screen bg-paper" />;
  }
  if (!user) return <RedirectToSignIn />;
  if (boot.data?.settings.onboardingComplete) return <Navigate to="/inbox" />;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex h-14 max-w-xl items-center justify-between px-5">
        <LaneWordmark />
        <button
          type="button"
          className="text-sm text-muted"
          onClick={() => completeOnboarding().then(() => qc.invalidateQueries())}
        >
          Skip
        </button>
      </header>
      <div className="mx-auto max-w-xl px-5 py-8">
        <p className="font-mono text-[11px] text-muted">Setup</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-0.02em]">Connect real shops</h1>
        <p className="mt-2 text-sm text-muted">{EXTENSION_HONESTY}</p>
        {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}

        <ol className="mt-8 space-y-4">
          <li className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
            <h2 className="text-sm font-medium">1. Lane Bridge Chrome extension</h2>
            <p className="mt-1 text-sm text-muted">
              Load the unpacked extension from the <span className="font-mono">extension/</span> folder in this repo
              (chrome://extensions → Developer mode → Load unpacked). Pair it with this token. It only runs while a
              tab is open on vinted.co.uk.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="block flex-1 truncate rounded-[var(--radius-sm)] bg-raised px-2 py-2 font-mono text-[11px]">
                {token || "Sign in to mint a token"}
              </code>
              <Button
                size="sm"
                variant="secondary"
                disabled={!token}
                onClick={() => token && navigator.clipboard.writeText(token)}
              >
                Copy
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-subtle">
              Lane origin for the popup is this site's URL. Full install steps: instructions.txt.
            </p>
          </li>
          <li className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">2. Connect Vinted UK</h2>
              <ModeChip mode="extension" />
            </div>
            <p className="mt-1 text-sm text-muted">{VINTED_CONNECT_COPY}</p>
            {vinted ? (
              <p className="mt-3 text-sm">
                Account created. Status: {vinted.status}
                {vinted.remoteUsername ? ` · ${vinted.remoteUsername}` : " · waiting for the extension to identify you"}
              </p>
            ) : (
              <Button className="mt-3" disabled={connect.isPending} onClick={() => connect.mutate("vinted_uk")}>
                Connect Vinted
              </Button>
            )}
          </li>
          <li className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">3. Connect eBay UK</h2>
              <ModeChip mode="oauth" />
            </div>
            <p className="mt-1 text-sm text-muted">{EBAY_CONNECT_COPY}</p>
            {!boot.data?.ebayConfigured ? (
              <p className="mt-3 text-sm text-danger">
                Server is missing eBay keys. The developer must set them (instructions.txt). Connect will not fake a shop.
              </p>
            ) : null}
            {ebay ? (
              <p className="mt-3 text-sm">Connected as {ebay.remoteUsername ?? ebay.label}</p>
            ) : (
              <Button className="mt-3" disabled={connect.isPending} onClick={() => connect.mutate("ebay_uk")}>
                Connect eBay UK
              </Button>
            )}
          </li>
          <li className="rounded-[var(--radius-md)] border border-line bg-surface p-4">
            <h2 className="text-sm font-medium">4. Import Vinted wardrobe</h2>
            <p className="mt-1 text-sm text-muted">
              Up to 200 live items the extension has pushed. Title + price or photo hash links instead of duplicating.
            </p>
            {preview.data ? (
              <p className="mt-2 text-sm tabular">{preview.data.length} live on Vinted (synced)</p>
            ) : (
              <p className="mt-2 text-sm text-muted">No wardrobe yet — the extension must heartbeat first.</p>
            )}
            <Button className="mt-3" disabled={!vinted || doImport.isPending} onClick={() => doImport.mutate()}>
              {doImport.isPending ? "Importing…" : "Import synced items"}
            </Button>
            {doImport.data ? (
              <p className="mt-2 text-sm text-muted">
                Created {doImport.data.created}, linked {doImport.data.linked}
              </p>
            ) : null}
          </li>
        </ol>

        <Button
          className="mt-8 w-full"
          onClick={() =>
            completeOnboarding().then(() => {
              void qc.invalidateQueries();
              window.location.href = "/inbox";
            })
          }
        >
          Open inbox
        </Button>
        <p className="mt-3 text-center text-sm">
          <Link to="/settings/channels" className="text-mark">
            Channel settings
          </Link>
        </p>
        <p className="mt-6 text-[11px] leading-relaxed text-subtle">{LEGAL_FOOTER}</p>
      </div>
    </main>
  );
}
