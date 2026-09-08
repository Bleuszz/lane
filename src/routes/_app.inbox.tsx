import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBootstrap, retryJob } from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { formatDateTime } from "@/lib/lane/format";
import { Button, Panel } from "@/components/ui";
import { ModeChip, StatusBadge } from "@/components/status";
import { EXTENSION_HONESTY } from "@/lib/lane/copy";

export const Route = createFileRoute("/_app/inbox")({ component: InboxPage });

function InboxPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const retry = useMutation({
    mutationFn: (jobId: string) => retryJob({ data: { jobId } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const data = boot.data;
  if (!data) return <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-secondary" />;

  const empty =
    data.inbox.failedJobs.length === 0 &&
    data.inbox.waitingJobs.length === 0 &&
    data.inbox.offlineAccounts.length === 0 &&
    data.inbox.reauthAccounts.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">Inbox</h1>
        <p className="mt-1 text-sm text-muted">{EXTENSION_HONESTY}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Live", data.liveCount],
          ["Draft", data.draftCount],
          ["Error", data.errorCount],
          ["Sold", data.soldCount],
        ].map(([label, n]) => (
          <Panel key={String(label)} className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
            <p className="mt-1 font-mono text-2xl tabular">{n as number}</p>
          </Panel>
        ))}
      </div>

      {data.inbox.offlineAccounts.length > 0 ? (
        <Panel className="p-4">
          <h2 className="text-sm font-medium">Browser asleep</h2>
          <p className="mt-1 text-sm text-muted">Vinted jobs will sit in waiting_for_browser until the Lane Bridge heartbeats.</p>
          {data.inbox.offlineAccounts.map((a) => (
            <div key={a.id} className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>
                {CHANNELS[a.marketplace]?.label} · {a.label}
              </span>
              <ModeChip mode={a.mode} />
            </div>
          ))}
          <Link to="/settings/channels" className="mt-3 inline-block">
            <Button>Open pairing token</Button>
          </Link>
        </Panel>
      ) : null}

      {data.inbox.reauthAccounts.length > 0 ? (
        <Panel className="p-4">
          <h2 className="text-sm font-medium">Needs attention</h2>
          {data.inbox.reauthAccounts.map((a) => (
            <p key={a.id} className="mt-2 text-sm">
              {CHANNELS[a.marketplace]?.label}: {a.lastError ?? a.status}
            </p>
          ))}
        </Panel>
      ) : null}

      {data.inbox.waitingJobs.length > 0 ? (
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-medium">Waiting for browser</div>
          <ul>
            {data.inbox.waitingJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
                <div>
                  <p>{j.itemTitle ?? j.type} · {j.marketplace ? CHANNELS[j.marketplace]?.short : ""}</p>
                  <p className="font-mono text-[11px] text-subtle">{j.requestId}</p>
                </div>
                <StatusBadge status={j.status} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {data.inbox.failedJobs.length > 0 ? (
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-4 py-3 text-sm font-medium">Failed jobs</div>
          <ul>
            {data.inbox.failedJobs.map((j) => (
              <li key={j.id} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">
                      {j.type} · {j.itemTitle ?? "—"} · {j.marketplace ? CHANNELS[j.marketplace]?.short : ""}
                    </p>
                    <p className="mt-1 text-sm text-danger">{j.errorMessage}</p>
                    {j.errorBody ? <pre className="mt-1 max-h-24 overflow-auto font-mono text-[11px] text-subtle">{j.errorBody}</pre> : null}
                    <p className="mt-1 font-mono text-[11px] text-subtle">
                      {j.requestId} · {formatDateTime(j.createdAt)} · attempt {j.attempt}/{j.maxAttempts}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => retry.mutate(j.id)}>
                    Retry
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {empty ? (
        <Panel className="p-8 text-center">
          <p className="text-sm">Nothing broken.</p>
          <p className="mt-1 text-sm text-muted">
            {data.liveCount > 0
              ? "Live listings are healthy. Open inventory to publish or mark a sale."
              : "Connect Vinted to import 1-click, or create a listing."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/inventory">
              <Button>Inventory</Button>
            </Link>
            {data.liveCount === 0 ? (
              <Link to="/onboarding">
                <Button variant="secondary">Onboarding</Button>
              </Link>
            ) : (
              <Link to="/new">
                <Button variant="secondary">New listing</Button>
              </Link>
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
