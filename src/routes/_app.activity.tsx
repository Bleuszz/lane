import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJobs, getOrderSyncStatus, retryJob } from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { formatDateTime } from "@/lib/lane/format";
import { Button, Panel } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export const Route = createFileRoute("/_app/activity")({ component: ActivityPage });

function ActivityPage() {
  const qc = useQueryClient();
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => getJobs(), refetchInterval: 3000 });
  const orders = useQuery({queryKey:["order-sync"],queryFn:()=>getOrderSyncStatus(),refetchInterval:30_000});
  const retry = useMutation({
    mutationFn: (jobId: string) => retryJob({ data: { jobId } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-medium tracking-[-0.02em]">Activity</h1>
      <p className="mt-1 text-sm text-muted">Track publishing, updates and delisting. Open a result to see what needs attention.</p>
      {retry.isError && <p role="alert" className="mt-3 text-sm text-danger">{retry.error.message}</p>}
      <Panel className="mt-4 space-y-2 p-4">
        <h2 className="text-sm font-medium">eBay sale detection</h2>
        <p className="text-xs text-muted">{orders.isError ? "Could not load detection status. Check sales in eBay." : !orders.data ? "Loading status…" : orders.data.enabled ? "Beta polling is enabled. It needs the worker running and your account connected." : "Automatic polling is off. Record sales on each item and check linked marketplaces."}</p>
        {orders.data?.accounts.map((a,i)=><p key={i} className="text-xs text-muted">{a.label} · {a.environment} · {a.last_success_at ? `Last page checked ${formatDateTime(a.last_success_at)}` : "No completed check"}{a.page_offset ? " · More pages pending" : ""}{a.last_error ? ` · ${a.last_error}` : ""}</p>)}
        {!!orders.data?.reviews.length && <div className="border-t border-line pt-3">
          <h3 className="text-sm font-medium">Orders to review</h3>
          <p className="mt-1 text-xs text-muted">Latest 20 observations needing attention. Check eBay before recording a sale manually; use the line reference shown to prevent duplicate stock changes. Cancellations and refunds do not automatically restore stock.</p>
          <ul className="mt-2 space-y-3">{orders.data.reviews.map((r,i)=><li key={i} className="break-words text-xs"><span className="font-medium">{r.label} · Order {r.order_id}</span><p>Line reference: {r.line_id} · Listing: {r.listing_id}</p><p className="text-muted">{r.reason}</p></li>)}</ul>
        </div>}
      </Panel>
      <Panel className="mt-4 overflow-hidden">
        <ul>
          {(jobs.data ?? []).length === 0 ? (
            <li className="px-4 py-8 text-sm text-muted">No jobs yet. Publish something.</li>
          ) : (
            (jobs.data ?? []).map((j) => (
              <li key={j.id} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{j.type}</span>
                      {" · "}
                      {j.itemTitle ?? "—"}
                      {j.marketplace ? ` · ${CHANNELS[j.marketplace]?.short}` : ""}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-subtle">
                      {j.requestId} · {formatDateTime(j.createdAt)}
                      {j.finishedAt ? ` → ${formatDateTime(j.finishedAt)}` : ""} · attempt {j.attempt}/{j.maxAttempts}
                    </p>
                    {j.errorMessage ? <p className="mt-1 text-sm text-danger">{j.errorMessage}</p> : null}
                    {j.status === "queued" && j.retryAfter ? <p className="mt-1 text-sm text-muted">Automatic retry no earlier than {formatDateTime(j.retryAfter)}. Lane must be running and the account connected.</p> : null}
                    {j.errorBody ? <pre className="mt-1 max-h-24 overflow-auto font-mono text-[11px] text-subtle">{j.errorBody}</pre> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={j.status} />
                    {j.status === "error" ? (
                      <Button size="sm" variant="secondary" disabled={retry.isPending} onClick={() => retry.mutate(j.id)}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
