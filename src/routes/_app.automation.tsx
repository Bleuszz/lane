import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button, Panel } from "@/components/ui";
import {
  getScheduleState,
  saveScheduleSettings,
  previewSchedule,
  queueSchedule,
  pauseSchedule,
  cancelSchedule,
  checkSchedule,
  rescheduleAction,
} from "@/lib/lane/scheduler/fns";
import { DEFAULT_SETTINGS, type SchedulerSettings } from "@/lib/lane/scheduler/settings";
import { MODES, OPERATIONS, type QueueMode, type Operation } from "@/lib/lane/scheduler/policy";
export const Route = createFileRoute("/_app/automation")({
  head: () => ({
    meta: [
      { title: "Scheduling & safety | Lane" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Automation,
});
const inputClass = "mt-1 block w-full rounded border border-line bg-paper p-2";
function Automation() {
  const qc = useQueryClient(),
    state = useQuery({
      queryKey: ["schedule"],
      queryFn: () => getScheduleState(),
      refetchInterval: 5000,
    });
  const [settings, setSettings] = useState<SchedulerSettings | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [account, setAccount] = useState(""),
    [items, setItems] = useState<string[]>([]),
    [operation, setOperation] = useState<Operation>("PUBLISH"),
    [mode, setMode] = useState<QueueMode>("MANUAL"),
    [start, setStart] = useState(""),
    [approved, setApproved] = useState(false),
    [large, setLarge] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [scope, setScope] = useState("all");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewSchedule>> | null>(null),
    [move, setMove] = useState<Record<string, string>>({});
  const initialStart = useRef(new Date().toISOString());
  const active = useRef(false),
    request = useRef<{ key: string; body: string } | null>(null);
  useEffect(() => {
    if (state.data && !settings) setSettings(state.data.settings.config);
  }, [state.data, settings]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule"] });
  async function act(work: () => Promise<unknown>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  const data = state.data,
    s = settings ?? DEFAULT_SETTINGS;
  const change = <K extends keyof SchedulerSettings>(key: K, value: SchedulerSettings[K]) => {
    setSettings({ ...s, [key]: value });
    setPreview(null);
  };
  const build = () => {
    const startAt = start ? new Date(start).toISOString() : initialStart.current,
      body = JSON.stringify({ account, items, operation, mode, startAt, approved, large });
    if (request.current?.body !== body) request.current = { key: crypto.randomUUID(), body };
    return {
      accountId: account,
      itemIds: items,
      operation,
      mode,
      startAt,
      approved,
      largeApproved: large,
      requestKey: request.current.key,
    };
  };
  const numeric = (key: keyof SchedulerSettings, label: string, min: number, max: number) => (
    <label key={key} className="text-sm">
      {label}
      <input
        className={inputClass}
        type="number"
        min={min}
        max={max}
        value={Number(s[key])}
        onChange={(e) => change(key, Number(e.target.value) as never)}
      />
    </label>
  );
  const when = (value: string) =>
    new Date(value).toLocaleString("en-GB", {
      timeZone: data?.settings.config.timezone ?? "Europe/London",
      dateStyle: "short",
      timeStyle: "short",
    });
  if (state.isError)
    return (
      <p role="alert">
        Scheduling data unavailable.{" "}
        <button className="underline" onClick={() => void state.refetch()}>
          Retry
        </button>
      </p>
    );
  if (!data) return <p role="status">Loading scheduling controls…</p>;
  const jobs = [...data.jobs].sort(
    (a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="eyebrow">Scheduling foundation</p>
        <h1 className="page-title">Work at your pace.</h1>
        <p className="mt-3 text-muted">
          Plan batches, keep originals and stop safely when an account needs attention.
        </p>
      </header>
      <Panel className="space-y-2 border-dashed p-5">
        <strong>
          {data.flags.scheduler
            ? "Scheduler test environment"
            : "Scheduling features are switched off"}
        </strong>
        <p className="text-sm text-muted">
          Current Vinted and eBay session writes are manual-only. This page can plan reminders when
          enabled; it cannot publish, relist or edit marketplace listings. No automated write
          transport is registered.
        </p>
        <p className="text-sm text-muted">
          Intervals and caps below are Lane product limits, not claims about marketplace limits.
          Timing windows spread work; they do not hide automation.
        </p>
      </Panel>
      {error && (
        <p role="alert" className="rounded bg-warn-bg p-4">
          {error.replaceAll("_", " ")}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded bg-ok-bg p-4">
          {notice}
        </p>
      )}
      <Panel className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">Pause controls</h2>
        <p role="status">
          All scheduled automation: {data.settings.paused ? "PAUSED" : "Not paused"} · new execution{" "}
          {data.flags.bulk ? "still governed by capability policy" : "disabled"}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy}
            onClick={() =>
              void act(() =>
                pauseSchedule({ data: { scope: "all", paused: true, reviewed: false } }),
              )
            }
          >
            PAUSE ALL AUTOMATION
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void act(() => cancelSchedule({ data: { futureOnly: true } }))}
          >
            Cancel future jobs only
          </Button>
        </div>
        <p className="text-xs text-muted">
          Already running actions retain their lease and may finish safely. Pausing does not erase
          queued jobs.
        </p>
        <label className="block text-sm">
          Pause scope
          <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All automation</option>
            <option value="marketplace:ebay_uk">eBay</option>
            <option value="marketplace:vinted_uk">Vinted</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={"account:" + a.id}>
                {a.label}
              </option>
            ))}
            {data.batches.map((b) => (
              <option key={b.id} value={"batch:" + b.id}>
                Batch {b.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          I have reviewed the reason for the pause. Resume will still recheck policy, health and
          provider holds.
        </label>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void act(() => pauseSchedule({ data: { scope, paused: true, reviewed: false } }))
            }
          >
            Pause selected
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !reviewed}
            onClick={() =>
              void act(() => pauseSchedule({ data: { scope, paused: false, reviewed } }))
            }
          >
            Resume selected
          </Button>
        </div>
        {data.scopes
          .filter((x) => x.paused || x.hold_until)
          .map((x) => (
            <p key={x.scope} className="text-sm break-all">
              {x.scope} · {x.paused ? "Paused" : "Temporary hold"} · {x.reason}
              {x.hold_until ? " · until " + when(x.hold_until) : ""}
            </p>
          ))}
      </Panel>
      <details className="rounded-xl border border-line bg-surface p-5" open>
        <summary className="cursor-pointer text-xl font-semibold">
          Automation / scheduling settings
        </summary>
        <div className="mt-5 space-y-6">
          <section>
            <h3 className="mb-3 font-semibold">General</h3>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => change("enabled", e.target.checked)}
              />
              Enable scheduling (subject to server flags and marketplace policy)
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="text-sm">
                Timezone
                <input
                  className={inputClass}
                  value={s.timezone}
                  onChange={(e) => change("timezone", e.target.value)}
                />
              </label>
              {(["activeStart", "activeEnd"] as const).map((k) => (
                <label className="text-sm" key={k}>
                  {k === "activeStart" ? "Active from" : "Active until"}
                  <input
                    className={inputClass}
                    type="time"
                    value={s[k]}
                    onChange={(e) => change(k, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <fieldset className="mt-3">
              <legend className="mb-2 text-sm">Active weekdays</legend>
              <div className="flex flex-wrap gap-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <label key={d} className="flex gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={s.weekdays.includes(i)}
                      onChange={(e) =>
                        change(
                          "weekdays",
                          e.target.checked ? [...s.weekdays, i] : s.weekdays.filter((n) => n !== i),
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">Timing</h3>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                ["Fast", 300, 300],
                ["Normal", 300, 600],
                ["Gentle", 600, 1200],
              ].map(([label, min, max]) => (
                <Button
                  variant="secondary"
                  key={label}
                  onClick={() =>
                    setSettings({ ...s, minSeconds: Number(min), maxSeconds: Number(max) })
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {numeric("minSeconds", "Minimum interval (seconds)", 60, 3600)}
              {numeric("maxSeconds", "Maximum interval (seconds)", 60, 3600)}
              {numeric("batchPauseEvery", "Pause after completed actions", 1, 50)}
              {numeric("batchPauseSeconds", "Batch pause (seconds)", 0, 7200)}
            </div>
            <p className="mt-2 text-xs text-muted">
              A spacing value is selected once per started action and persisted. Quiet/active hours
              can extend it.
            </p>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">Limits</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {numeric("hourly", "Rolling hourly cap", 1, 30)}
              {numeric("daily", "Rolling 24-hour cap", 1, 100)}
              {numeric("batchSize", "Maximum batch size", 1, 50)}
            </div>
            <p className="mt-2 text-xs text-muted">
              Effective caps use the lowest system, marketplace and user limit. Changing timezone
              cannot reset rolling caps.
            </p>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">Safety</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {numeric("maxConsecutiveFailures", "Account failure threshold", 1, 5)}
              {numeric("maxBatchFailures", "Batch failure threshold", 1, 10)}
              {numeric("maxAuthFailures", "Marketplace auth failure threshold", 1, 3)}
              {numeric("maxWarnings", "Marketplace warning threshold", 1, 3)}
              {numeric("confirmAbove", "Extra confirmation above items", 1, 50)}
            </div>
            <p className="mt-3 text-sm">
              Challenge, warning, account mismatch and expired authentication always stop that
              account immediately. These stops cannot be disabled.
            </p>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">Retries</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              {numeric("retryLimit", "Retries after initial attempt", 0, 3)}
              {s.retryBackoff.map((v, i) => (
                <label key={i} className="text-sm">
                  Backoff {i + 1} (seconds)
                  <input
                    className={inputClass}
                    type="number"
                    min="30"
                    max="3600"
                    value={v}
                    onChange={(e) =>
                      change(
                        "retryBackoff",
                        s.retryBackoff.map((n, k) => (i === k ? Number(e.target.value) : n)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Retry only after confirmed non-execution. Ambiguous timeouts need remote
              reconciliation; Retry-After is never shortened.
            </p>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">Quiet hours</h3>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={s.quietEnabled}
                onChange={(e) => change("quietEnabled", e.target.checked)}
              />
              Enable quiet hours
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(["quietStart", "quietEnd"] as const).map((k) => (
                <label key={k}>
                  {k === "quietStart" ? "Quiet from" : "Quiet until"}
                  <input
                    className={inputClass}
                    type="time"
                    value={s[k]}
                    onChange={(e) => change(k, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">Images</h3>
            <label className="block text-sm">
              Default preparation preference
              <select
                className={inputClass}
                value={s.imagePreset}
                onChange={(e) => change("imagePreset", e.target.value as typeof s.imagePreset)}
              >
                <option value="ORIGINAL">Original — no changes</option>
                <option value="CLEAN_EXPORT">Clean export — prepare and review separately</option>
              </select>
            </label>
            <p className="mt-2 text-sm">
              Originals always stay intact. No image edits run just because you schedule a batch.{" "}
              <a className="underline" href="/image-tools">
                Prepare and compare image exports
              </a>
              .
            </p>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">Marketplace overrides</h3>
            {(["ebay_uk", "vinted_uk"] as const).map((m) => (
              <fieldset key={m} className="mb-4 rounded border border-line p-3">
                <legend>{m === "ebay_uk" ? "eBay" : "Vinted"} · manual-only writes</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["hourly", "daily", "batchSize"] as const).map((k) => (
                    <label key={k} className="text-sm">
                      {k}
                      <input
                        className={inputClass}
                        type="number"
                        min="1"
                        max={k === "hourly" ? 30 : k === "daily" ? 100 : 50}
                        placeholder="Inherit"
                        value={s.overrides[m][k] ?? ""}
                        onChange={(e) =>
                          change("overrides", {
                            ...s.overrides,
                            [m]: {
                              ...s.overrides[m],
                              [k]: e.target.value ? Number(e.target.value) : undefined,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>
          <Button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await saveScheduleSettings({ data: s });
                setNotice("Scheduling settings saved. Capability restrictions remain enforced.");
              })
            }
          >
            Save scheduling settings
          </Button>
        </div>
      </details>
      <Panel className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">Batch dry run</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Account
            <select
              aria-label="Schedule account"
              className={inputClass}
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Choose account</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operation
            <select
              className={inputClass}
              value={operation}
              onChange={(e) => {
                setOperation(e.target.value as Operation);
                setPreview(null);
              }}
            >
              {OPERATIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select
              className={inputClass}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as QueueMode);
                setPreview(null);
              }}
            >
              {MODES.map((m) => (
                <option key={m} disabled={m !== "MANUAL"}>
                  {m}
                  {m !== "MANUAL" ? " — not validated" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <input
              className={inputClass}
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setPreview(null);
              }}
            />
            <small className="text-muted">
              Input uses this browser's timezone. Schedule displays in {s.timezone}.
            </small>
          </label>
        </div>
        <fieldset>
          <legend className="mb-2">Saved items</legend>
          <div className="max-h-60 space-y-2 overflow-auto">
            {data.items.map((i) => (
              <label className="flex gap-2 text-sm" key={i.id}>
                <input
                  type="checkbox"
                  checked={items.includes(i.id)}
                  onChange={(e) => {
                    setItems(
                      e.target.checked ? [...items, i.id] : items.filter((id) => id !== i.id),
                    );
                    setPreview(null);
                  }}
                />
                {i.title}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          variant="secondary"
          disabled={busy || !account || !items.length}
          onClick={() => void act(async () => setPreview(await previewSchedule({ data: build() })))}
        >
          Validate full batch · no writes
        </Button>
        {preview && (
          <div className="space-y-3 rounded-lg border border-line p-4">
            <p>
              {preview.rows.length} items · {preview.account.marketplace} · {operation} ·{" "}
              {preview.photoCount} source photos
            </p>
            <p className="text-sm">
              Spacing: {preview.caps.minSeconds / 60}–{preview.caps.maxSeconds / 60} minutes ·
              active {preview.settings.activeStart}–{preview.settings.activeEnd}{" "}
              {preview.settings.timezone}
            </p>
            <p className="text-sm">
              Estimated final scheduled start:{" "}
              {preview.estimatedCompletion ? when(preview.estimatedCompletion) : "Unavailable"}.
              Holds, processing and other users can extend this estimate.
            </p>
            <p>
              {preview.rows.filter((r) => r.status === "BLOCKED").length} blocked ·{" "}
              {preview.rows.filter((r) => r.status === "WARNING").length} warnings
            </p>
            {preview.rows.map((r) => (
              <div className="border-t border-line pt-2 text-sm" key={r.itemId}>
                <strong>
                  {r.title} · {r.status}
                </strong>
                <p>{when(r.scheduledAt)}</p>
                <p className="text-muted">{r.reasons.join(" · ").replaceAll("_", " ")}</p>
              </div>
            ))}
            <Button
              variant="secondary"
              disabled={!preview.rows.some((r) => r.status === "BLOCKED")}
              onClick={() => {
                setItems(preview.rows.filter((r) => r.status !== "BLOCKED").map((r) => r.itemId));
                setPreview(null);
              }}
            >
              Remove blocked items
            </Button>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              I approve this manual reminder batch. This does not authorize unverified remote
              writes.
            </label>
            {preview.confirmationRequired && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={large}
                  onChange={(e) => setLarge(e.target.checked)}
                />
                I confirm this batch exceeds my extra-approval threshold.
              </label>
            )}
            <Button
              disabled={
                busy ||
                !approved ||
                (preview.confirmationRequired && !large) ||
                preview.rows.some((r) => r.status === "BLOCKED")
              }
              onClick={() =>
                void act(async () => {
                  await queueSchedule({ data: build() });
                  request.current = null;
                  initialStart.current = new Date().toISOString();
                  setPreview(null);
                  setItems([]);
                  setApproved(false);
                  setLarge(false);
                  setNotice("Manual reminder batch queued. No marketplace actions performed.");
                })
              }
            >
              Queue approved reminders
            </Button>
          </div>
        )}
      </Panel>
      <section className="space-y-3">
        <h2 className="text-2xl">Schedule · {s.timezone}</h2>
        <p className="text-sm">
          Next planned job:{" "}
          {jobs.find((j) => !["SUCCEEDED", "FAILED", "CANCELLED"].includes(j.status))
            ? when(
                jobs.find((j) => !["SUCCEEDED", "FAILED", "CANCELLED"].includes(j.status))!
                  .scheduled_at,
              )
            : "None"}
        </p>
        <Button
          variant="secondary"
          disabled={busy || !data.flags.scheduler}
          onClick={() => void act(() => checkSchedule())}
        >
          Check due reminders
        </Button>
        {jobs.map((j) => (
          <Panel key={j.id} className="space-y-2 p-4">
            <p>
              <strong>
                {when(j.scheduled_at)} ·{" "}
                {data.items.find((i) => i.id === j.item_id)?.title ?? j.item_id}
              </strong>
            </p>
            <p className="text-sm">
              {j.marketplace} · {j.operation} · {j.status.replaceAll("_", " ")} · attempt{" "}
              {j.attempt_count}
            </p>
            {j.last_error && (
              <p className="text-sm text-muted">
                {j.last_error === "OPEN_LANE_DESKTOP"
                  ? "Lane Desktop is offline. Open Lane Desktop to continue."
                  : j.last_error === "MANUAL_ACTION_ONLY"
                    ? "Complete this action yourself in the marketplace. Lane has not performed it."
                    : j.last_error.replaceAll("_", " ")}
              </p>
            )}
            {!["RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].includes(j.status) && (
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void act(() => cancelSchedule({ data: { jobId: j.id } }))}
                >
                  Cancel item
                </Button>
                <label className="text-sm">
                  Move to
                  <input
                    className={inputClass}
                    type="datetime-local"
                    value={move[j.id] ?? ""}
                    onChange={(e) => setMove({ ...move, [j.id]: e.target.value })}
                  />
                </label>
                <Button
                  variant="secondary"
                  disabled={busy || !move[j.id] || !reviewed}
                  onClick={() =>
                    void act(() =>
                      rescheduleAction({
                        data: { id: j.id, at: new Date(move[j.id]).toISOString(), reviewed },
                      }),
                    )
                  }
                >
                  Reschedule after review
                </Button>
              </div>
            )}
          </Panel>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">Activity & reasons</h2>
        {data.events.slice(0, 30).map((e) => (
          <p className="rounded border border-line p-3 text-sm" key={e.id}>
            {when(e.created_at)} · {e.marketplace} · {e.operation} · {e.status} · attempt{" "}
            {e.attempt} · {e.reason?.replaceAll("_", " ")}
          </p>
        ))}
      </section>
    </div>
  );
}
