import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJobs, retryJob } from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { formatDateTime } from "@/lib/lane/format";
import { Button, Panel } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export const Route = createFileRoute("/_app/activity")({ component: ActivityPage });

function ActivityPage() {
  const qc = useQueryClient();
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => getJobs(), refetchInterval: 3000 });
  const retry = useMutation({
    mutationFn: (jobId: string) => retryJob({ data: { jobId } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-medium tracking-[-0.02em]">Activity</h1>
      <p className="mt-1 text-sm text-muted">Track publishing, updates and delisting. Open a result to see what needs attention.</p>
      {retry.isError && <p role="alert" className="mt-3 text-sm text-danger">{retry.error.message}</p>}
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
