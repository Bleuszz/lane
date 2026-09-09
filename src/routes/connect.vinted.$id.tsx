import { createFileRoute } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
import { Button, Input, Panel } from "@/components/ui";
import { PHONE_CONNECT_COPY } from "@/lib/lane/copy";
import { desktopApi } from "@/lib/lane/desktop";
import { useEffect, useRef, useState } from "react";

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
  const desk = desktopApi();
  const started = useRef(false);
  const laneUrl =
    pairingToken
      ? `lane://connect?marketplace=vinted_uk&token=${encodeURIComponent(pairingToken)}&origin=${encodeURIComponent(origin)}&id=${encodeURIComponent(id)}&k=${encodeURIComponent(k)}`
      : "";

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
    const t = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(t);
  }, [id, k]);

  useEffect(() => {
    if (!desk || status !== "pending" || !pairingToken || started.current) return;
    started.current = true;
    let cancelled = false;
    void (async () => {
      if (desk.setPairing) await desk.setPairing(pairingToken, origin);
      const r = await desk.connect("vinted_uk", {
        pairingToken,
        origin,
        connectId: id,
        connectSecret: k,
      });
      if (cancelled) return;
      if (r.ok) setStatus("completed");
      else {
        started.current = false;
        setErr(r.error ?? "Connect window closed before a session was captured.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [desk, status, pairingToken, origin, id, k]);

  async function submitToken() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vinted/connect/${id}?k=${encodeURIComponent(k)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token.trim() }),
      });
      const json = (await res.json()) as { error?: string; username?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save session");
      setStatus("completed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-10">
      <LaneWordmark />
      <h1 className="mt-8 text-2xl font-medium tracking-[-0.03em]">Connect Vinted</h1>
      <p className="mt-2 text-sm text-muted">{PHONE_CONNECT_COPY}</p>
      {status === "completed" ? (
        <Panel className="mt-6 p-4">
          <p className="text-sm text-ok">Vinted is connected. You can close this page and go back to Lane.</p>
        </Panel>
      ) : (
        <Panel className="mt-6 space-y-3 p-4">
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          {desk ? (
            <p className="text-sm text-muted">Opening Vinted in the app window…</p>
          ) : (
            <>
              <p className="text-sm text-muted">
                This page cannot read Vinted’s login cookies. On the Windows PC, tap Open in Lane. A phone Safari or
                Chrome session cannot be sent to Lane — use Firefox + Lane Bridge on Android, or the Windows app.
              </p>
              {laneUrl ? (
                <a href={laneUrl} className="inline-flex">
                  <Button>Open in Lane (Windows)</Button>
                </a>
              ) : null}
              <p className="text-xs text-subtle">Status: {status === "expired" ? "expired" : "waiting"}</p>
            </>
          )}
          <details className="pt-2">
            <summary className="cursor-pointer text-xs text-subtle">Advanced: paste a refresh token</summary>
            <div className="mt-3 flex gap-2">
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="refresh_token_web" />
              <Button disabled={busy || !token.trim()} onClick={() => void submitToken()}>
                Save
              </Button>
            </div>
          </details>
        </Panel>
      )}
    </main>
  );
}
