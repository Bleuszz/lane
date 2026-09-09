import { createFileRoute } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
import { Button, Input, Panel } from "@/components/ui";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/connect/vinted/$id")({ component: ConnectVinted });

function ConnectVinted() {
  const { id } = Route.useParams();
  const k = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("k") ?? "";
  const [status, setStatus] = useState<"pending" | "completed" | "error" | "expired">("pending");
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function load() {
    const res = await fetch(`/api/vinted/connect/${id}?k=${encodeURIComponent(k)}`);
    const json = (await res.json()) as { status?: string; pairingToken?: string | null; error?: string };
    if (!res.ok) {
      setStatus(res.status === 410 ? "expired" : "error");
      setErr(json.error ?? "This link is not valid.");
      return json;
    }
    if (json.status === "completed") setStatus("completed");
    setPairingToken(json.pairingToken ?? null);
    return json;
  }

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(t);
  }, [id, k]);

  async function submitToken() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vinted/connect/${id}?k=${encodeURIComponent(k)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token.trim() }),
      });
      const json = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not verify the session");
      setStatus("completed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8 text-ink">
      <div className="mx-auto max-w-md space-y-5">
        <LaneWordmark />
        <h1 className="text-2xl font-medium tracking-[-0.02em]">Connect Vinted from this phone</h1>
        {status === "completed" ? (
          <Panel className="p-4">
            <p className="text-sm font-medium">Connected.</p>
            <p className="mt-1 text-sm text-muted">You can close this tab. Lane will sync your wardrobe using the captured session.</p>
          </Panel>
        ) : status === "expired" ? (
          <p className="text-sm text-danger">{err}</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              You sign in on Vinted’s real site. Lane never sees the password. After you are in, this page waits for
              the session to arrive.
            </p>
            <Panel className="p-4 space-y-3">
              <p className="text-sm font-medium">1. Sign in on Vinted</p>
              <a href="https://www.vinted.co.uk/member/signup/select_type" target="_blank" rel="noreferrer">
                <Button className="w-full">Open Vinted login</Button>
              </a>
              <p className="text-[11px] text-subtle">
                Email, Google, Apple, and 2FA all work because you are on vinted.co.uk — not a fake form.
              </p>
            </Panel>
            <Panel className="p-4 space-y-3">
              <p className="text-sm font-medium">2. Capture the session</p>
              <p className="text-sm text-muted">
                iPhone Safari cannot hand Vinted’s cookies to a website (they are HttpOnly). Crosslist’s App Store app
                does this with an in-app browser. On a phone, the working path is Firefox + Lane Bridge:
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Install Firefox from the Play Store (Android) or use desktop Chrome.</li>
                <li>Load Lane Bridge unpacked / from the repo <code className="font-mono text-[11px]">extension/</code> folder.</li>
                <li>Pair with the token below and this origin.</li>
                <li>Open vinted.co.uk signed in. The extension uploads the session. This page turns green.</li>
              </ol>
              {pairingToken ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Pairing token</p>
                  <code className="mt-1 block break-all rounded-[var(--radius-sm)] bg-raised px-2 py-2 font-mono text-[11px]">
                    {pairingToken}
                  </code>
                  <p className="mt-1 font-mono text-[11px] text-subtle">{origin}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => void navigator.clipboard.writeText(pairingToken)}
                  >
                    Copy token
                  </Button>
                </div>
              ) : null}
            </Panel>
            <Panel className="p-4 space-y-3">
              <p className="text-sm font-medium">Advanced — paste refresh token</p>
              <p className="text-sm text-muted">
                If you already have <span className="font-mono text-xs">refresh_token_web</span> from Vinted (computer
                DevTools → Application → Cookies), paste it. Do not paste your password.
              </p>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="refresh_token_web"
                className="font-mono text-xs"
              />
              <Button disabled={busy || token.trim().length < 20} onClick={() => void submitToken()}>
                {busy ? "Checking…" : "Save session"}
              </Button>
            </Panel>
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <p className="text-[11px] text-subtle">Waiting for the session… this page refreshes by itself.</p>
          </>
        )}
      </div>
    </main>
  );
}
