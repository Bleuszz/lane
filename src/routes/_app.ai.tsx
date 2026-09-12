import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  AI_FIELDS,
  AI_OPERATIONS,
  FIDELITY_RULE,
  MOCK_MODES,
  type AiOperation,
  type MockMode,
} from "@/lib/lane/ai/catalog";
import {
  getAiState,
  queueAi,
  runAi,
  cancelAi,
  retryAi,
  reviewAi,
  acceptSafeAi,
  reviewAiAsset,
} from "@/lib/lane/ai/fns";
import { Button, Panel } from "@/components/ui";

export const Route = createFileRoute("/_app/ai")({
  head: () => ({
    meta: [
      { title: "AI Studio & credits | Lane" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AiStudio,
});
const errorText: Record<string, string> = {
  FEATURE_DISABLED: "This feature is switched off.",
  DEVELOPMENT_ONLY:
    "Mock tools are available only in an explicitly enabled development environment.",
  PLAN_HAS_NO_AI_CREDITS:
    "Trial and Starter include zero AI credits. Mock testing requires a configured paid-plan test account.",
  INSUFFICIENT_CREDITS: "This batch exceeds your remaining credits. Nothing was reserved.",
  PROVIDER_UNAVAILABLE: "No production provider is configured. No credits were charged.",
  CONFIRM_KNOWN_VALUE: "Confirm review of the existing value first.",
  SAVED_VALUE_CHANGED: "Your saved listing changed. Generate a fresh suggestion before accepting.",
  IDEMPOTENCY_CONFLICT:
    "This request identifier was already used for different settings. Start a new request.",
  LEASE_EXPIRED: "The interrupted job expired. Its credits were restored.",
};
const safePhoto = (url: string) =>
  /^https:\/\//.test(url) ||
  /^data:image\/(png|jpeg|webp);base64,/.test(url) ||
  url.startsWith("/lane-");
function AiStudio() {
  const qc = useQueryClient();
  const state = useQuery({
    queryKey: ["ai-state"],
    queryFn: () => getAiState(),
    refetchInterval: 3000,
  });
  const [family, setFamily] = useState<"listing" | "image">("listing");
  const [operation, setOperation] = useState<AiOperation>("listing_complete");
  const [itemId, setItem] = useState("");
  const [photoIds, setPhotos] = useState<string[]>([]);
  const [destination, setDestination] = useState<"ebay_uk" | "vinted_uk">("ebay_uk");
  const [category, setCategory] = useState("");
  const [userValues, setValues] = useState<Record<string, string>>({});
  const [ratio, setRatio] = useState<"original" | "1:1" | "4:5" | "marketplace">("original");
  const [scene, setScene] = useState<
    | "white studio"
    | "soft grey"
    | "linen"
    | "marble"
    | "concrete"
    | "bedroom"
    | "wardrobe"
    | "custom"
  >("white studio");
  const [presentation, setPresentation] = useState<"masculine" | "feminine" | "neutral">("neutral");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<MockMode>("SUCCESS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [original, setOriginal] = useState<Record<string, boolean>>({});
  const active = useRef(false),
    pending = useRef<{ body: string; key: string } | null>(null);
  const retryKeys = useRef<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-state"] });
  async function act(work: () => Promise<unknown>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      const code = e instanceof Error ? e.message : "Request failed";
      setError(errorText[code] || code);
    } finally {
      active.current = false;
      setBusy(false);
      await refresh();
    }
  }
  async function process(ids: string[]) {
    await refresh();
    for (const id of ids) {
      await runAi({ data: { id } });
      await refresh();
    }
  }
  const data = state.data;
  if (state.isError)
    return (
      <p role="alert">
        AI usage is unavailable.{" "}
        <button className="underline" onClick={() => void state.refetch()}>
          Try again
        </button>
      </p>
    );
  if (!data) return <p role="status">Loading AI usage…</p>;
  const enabled = data.development && data.flags[family];
  const count = family === "image" ? photoIds.length : 1,
    cost = data.costs[operation] * count;
  async function generate() {
    const selected = family === "image" ? photoIds : [undefined];
    const requests = selected.map((photoId) => ({
      itemId,
      photoId,
      operation,
      destination,
      category,
      userValues,
      settings: { ratio, scene, presentation, prompt },
      mode,
    }));
    const body = JSON.stringify(requests);
    if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
    // Keep the key after an uncertain response; retries cannot reserve twice.
    const ids = await queueAi({ data: { requestKey: pending.current!.key, requests } });
    await process(ids);
    pending.current = null;
  }
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header>
        <p className="eyebrow">Development workbench</p>
        <h1 className="page-title">AI Studio</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Listing intelligence and image previews, with your originals kept intact.
        </p>
      </header>
      <Panel className="border-dashed p-5">
        <strong>AI PROVIDER NOT CONFIGURED — DEVELOPMENT PREVIEW</strong>
        <p className="mt-2 text-sm text-muted">
          No real AI calls. Mock outputs are labelled and never sent to your live listings.
          Accepting a preview records your review only. Operation prices and plan allowances are
          provisional.
        </p>
      </Panel>
      <section aria-label="AI credit usage" className="grid gap-4 sm:grid-cols-3">
        <Panel className="p-5">
          <h2 className="text-sm text-muted">AI credits remaining</h2>
          <p className="mt-2 text-3xl">
            {data.remaining} <span className="text-base text-muted">/ {data.allowance}</span>
          </p>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-sm text-muted">Reserved / used</h2>
          <p className="mt-2 text-xl">
            {data.reserved} reserved · {data.consumed} used
          </p>
          <p className="mt-2 text-xs text-muted">
            Failed jobs restore reservations. No overage charges.
          </p>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-sm text-muted">Next reset</h2>
          <p className="mt-2 text-xl">
            {new Date(data.resetsAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}
          </p>
          <p className="mt-2 text-xs text-muted">UTC calendar month. Credits do not roll over.</p>
        </Panel>
      </section>
      {!enabled && (
        <p role="status" className="rounded-lg bg-raised p-4">
          {data.development
            ? "This AI feature is switched off."
            : "AI generation is disabled in this environment."}{" "}
          Trial and Starter include zero AI credits. Manual listing tools remain available.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-warn-bg p-4">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant={family === "listing" ? "primary" : "secondary"}
          onClick={() => {
            setFamily("listing");
            setOperation("listing_complete");
          }}
        >
          Listing intelligence
        </Button>
        <Button
          variant={family === "image" ? "primary" : "secondary"}
          onClick={() => {
            setFamily("image");
            setOperation("background_remove");
          }}
        >
          Image Studio
        </Button>
      </div>
      <Panel className="space-y-5 p-5 sm:p-7">
        <h2 className="text-xl font-semibold">
          {family === "listing"
            ? "Review suggestions, one field at a time."
            : "An original, then a separate derivative."}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm">Saved listing</span>
            <select
              className="w-full rounded border border-line bg-paper p-3"
              aria-label="Saved listing"
              value={itemId}
              onChange={(e) => {
                setItem(e.target.value);
                setPhotos([]);
                setValues({});
              }}
            >
              <option value="">Choose a listing</option>
              {data.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="block text-sm">Destination</span>
            <select
              className="w-full rounded border border-line bg-paper p-3"
              value={destination}
              onChange={(e) => setDestination(e.target.value as typeof destination)}
            >
              <option value="ebay_uk">eBay UK</option>
              <option value="vinted_uk">Vinted UK</option>
            </select>
          </label>
        </div>
        {!data.items.length && (
          <p className="text-sm text-muted">
            Save or import a listing before using this workbench.{" "}
            <a className="underline" href="/new">
              Create a listing
            </a>
            .
          </p>
        )}
        <fieldset>
          <legend className="mb-3 text-sm">Choose an operation</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(AI_OPERATIONS)
              .filter(([, o]) => o.family === family)
              .map(([key, o]) => (
                <label
                  key={key}
                  className="flex cursor-pointer gap-3 rounded-lg border border-line p-3"
                >
                  <input
                    type="radio"
                    name="ai-operation"
                    checked={operation === key}
                    onChange={() => setOperation(key as AiOperation)}
                  />
                  <span>
                    {o.label}
                    <small className="block text-muted">
                      {data.costs[key as AiOperation]} credits
                    </small>
                  </span>
                </label>
              ))}
          </div>
        </fieldset>
        {family === "listing" ? (
          <details>
            <summary className="cursor-pointer">
              Add seller values for this suggestion request
            </summary>
            <p className="my-3 text-sm text-muted">
              Saved/imported facts remain separate. These values are request context and will not
              overwrite your inventory.
            </p>
            <label className="block">
              Destination category
              <input
                className="my-2 block w-full rounded border border-line bg-paper p-2"
                maxLength={200}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {AI_FIELDS.map((f) => (
                <label key={f} className="text-sm capitalize">
                  {f}
                  <input
                    className="mt-1 block w-full rounded border border-line bg-paper p-2"
                    maxLength={f === "description" ? 5000 : 200}
                    value={userValues[f] || ""}
                    onChange={(e) => setValues({ ...userValues, [f]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </details>
        ) : (
          <>
            <fieldset>
              <legend className="mb-3">Source photos · select up to 20</legend>
              <div className="flex flex-wrap gap-3">
                {data.photos
                  .filter((p) => p.item_id === itemId)
                  .map((p, i) => (
                    <label key={p.id} className="w-32 rounded-lg border border-line p-2">
                      <input
                        type="checkbox"
                        aria-label={`Select source photo ${i + 1}`}
                        checked={photoIds.includes(p.id)}
                        disabled={!photoIds.includes(p.id) && photoIds.length >= 20}
                        onChange={(e) =>
                          setPhotos(
                            e.target.checked
                              ? [...photoIds, p.id]
                              : photoIds.filter((id) => id !== p.id),
                          )
                        }
                      />
                      {safePhoto(p.url) ? (
                        <img
                          className="mt-2 aspect-square w-full object-contain"
                          src={p.url}
                          alt={`Original listing photo ${i + 1}`}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <p className="text-xs">Preview unavailable</p>
                      )}
                    </label>
                  ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                Output ratio
                <select
                  className="mt-2 block w-full rounded border border-line bg-paper p-2"
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value as typeof ratio)}
                >
                  {["original", "1:1", "4:5", "marketplace"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Scene
                <select
                  className="mt-2 block w-full rounded border border-line bg-paper p-2"
                  value={scene}
                  onChange={(e) => setScene(e.target.value as typeof scene)}
                >
                  {[
                    "white studio",
                    "soft grey",
                    "linen",
                    "marble",
                    "concrete",
                    "bedroom",
                    "wardrobe",
                    "custom",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Model presentation
                <select
                  className="mt-2 block w-full rounded border border-line bg-paper p-2"
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value as typeof presentation)}
                >
                  {["neutral", "masculine", "feminine"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            {scene === "custom" && (
              <label className="block">
                Background prompt
                <textarea
                  className="mt-2 block w-full rounded border border-line bg-paper p-2"
                  value={prompt}
                  maxLength={1000}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
            )}
            <p className="text-sm text-muted">{FIDELITY_RULE}</p>
            {AI_OPERATIONS[operation].risky && (
              <p className="rounded-lg bg-warn-bg p-3 text-sm">
                This transformation may alter the apparent shape or condition. Compare all product
                details with the original before any future publication.
              </p>
            )}
          </>
        )}
        {data.development && (
          <label className="block text-sm">
            Mock test outcome
            <select
              className="ml-3 rounded border border-line bg-paper p-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as MockMode)}
            >
              {MOCK_MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <p>
            Cost: <strong>{cost} credits</strong> · {count} {count === 1 ? "job" : "jobs"}
            <span className="mt-1 block text-sm text-muted">
              Remaining after reservation: {Math.max(0, data.remaining - cost)}
            </span>
          </p>
          <Button
            disabled={
              !enabled || busy || !itemId || count === 0 || !data.allowance || cost > data.remaining
            }
            onClick={() => void act(generate)}
          >
            {busy ? "Processing request…" : "Generate development preview"}
          </Button>
        </div>
      </Panel>
      <section className="space-y-4">
        <h2 className="text-2xl">Recent usage & reviews</h2>
        <p className="text-sm text-muted">
          Most recent 50 jobs. Rejecting or deleting a successful preview does not refund an already
          completed operation. No mock output is publishable.
        </p>
        {!data.jobs.length && <Panel className="p-6">No AI jobs yet.</Panel>}
        {data.jobs.map((job) => (
          <Panel key={job.id} className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {AI_OPERATIONS[job.operation]?.label || job.operation}
                </h3>
                <p className="text-sm text-muted">
                  {new Date(job.created_at).toLocaleString("en-GB")} · {job.credit_cost} credits ·
                  MOCK
                </p>
              </div>
              <p role="status">
                {job.status === "REFUNDED"
                  ? "Failed — credits restored"
                  : job.status === "CANCELLED"
                    ? "Cancelled — credits restored"
                    : job.status}
              </p>
            </div>
            {job.error_code && (
              <p className="text-sm">{errorText[job.error_code] || job.error_code}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {job.status === "RESERVED" && (
                <Button disabled={busy} onClick={() => void act(() => process([job.id]))}>
                  Resume queued job
                </Button>
              )}
              {["RESERVED", "PROCESSING"].includes(job.status) && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void act(() => cancelAi({ data: { id: job.id } }))}
                >
                  Cancel job
                </Button>
              )}
              {["REFUNDED", "CANCELLED"].includes(job.status) && (
                <Button
                  variant="secondary"
                  disabled={
                    busy ||
                    !data.development ||
                    !data.flags[AI_OPERATIONS[job.operation].family] ||
                    data.costs[job.operation] > data.remaining ||
                    !data.allowance
                  }
                  onClick={() =>
                    void act(async () => {
                      retryKeys.current[job.id] ||= crypto.randomUUID();
                      const ids = await retryAi({
                        data: { id: job.id, requestKey: retryKeys.current[job.id] },
                      });
                      await process(ids);
                      delete retryKeys.current[job.id];
                    })
                  }
                >
                  Retry same test · {data.costs[job.operation]} credits
                </Button>
              )}
            </div>
            {data.suggestions.some(
              (s) => s.job_id === job.id && s.safe && s.state === "pending",
            ) && (
              <Button
                disabled={busy}
                onClick={() => void act(() => acceptSafeAi({ data: { id: job.id } }))}
              >
                Accept all safe suggestions
              </Button>
            )}
            <div className="grid gap-3 lg:grid-cols-2">
              {data.suggestions
                .filter((s) => s.job_id === job.id)
                .map((s) => (
                  <div key={s.id} className="space-y-2 rounded-lg border border-line p-4">
                    <h4 className="font-semibold capitalize">{s.field}</h4>
                    <dl className="space-y-1 text-sm">
                      <div>
                        <dt className="inline text-muted">Imported source: </dt>
                        <dd className="inline break-words">
                          {s.source_value || "Unknown / unavailable"}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">Saved value: </dt>
                        <dd className="inline break-words">{s.saved_value || "Unknown"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">User context: </dt>
                        <dd className="inline break-words">{s.user_value || "Not provided"}</dd>
                      </div>
                    </dl>
                    <p className="break-words">{s.suggested_value || "Could not determine"}</p>
                    <p className="text-xs text-muted">
                      Confidence: {s.confidence} · {s.evidence}
                    </p>
                    <p className="text-sm">Review: {s.state}</p>
                    {s.state === "pending" && (
                      <>
                        {s.suggested_value && (s.saved_value || s.source_value || s.user_value) && (
                          <label className="flex gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={confirmed[s.id] || false}
                              onChange={(e) =>
                                setConfirmed({ ...confirmed, [s.id]: e.target.checked })
                              }
                            />
                            I reviewed the existing value. Accept this mock suggestion in the review
                            history only.
                          </label>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={
                              busy ||
                              !s.suggested_value ||
                              Boolean(
                                (s.saved_value || s.source_value || s.user_value) &&
                                !confirmed[s.id],
                              )
                            }
                            onClick={() =>
                              void act(() =>
                                reviewAi({
                                  data: {
                                    id: s.id,
                                    decision: "accepted",
                                    confirm: confirmed[s.id] || false,
                                  },
                                }),
                              )
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void act(() =>
                                reviewAi({
                                  data: { id: s.id, decision: "rejected", confirm: false },
                                }),
                              )
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
            {data.assets
              .filter((a) => a.job_id === job.id)
              .map((a) => {
                const source = data.photos.find((p) => p.id === a.source_photo_id);
                return (
                  <div key={a.id} className="space-y-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm">Original · preserved</p>
                        {source && safePhoto(source.url) ? (
                          <img
                            className="aspect-square max-h-80 w-full rounded-lg bg-raised object-contain"
                            src={source.url}
                            alt="Unmodified source listing photo"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <p>
                            Original is unavailable in the current listing; it was not deleted by
                            this job.
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="mb-2 text-sm">Development derivative · {a.status}</p>
                        {original[a.id] && source && safePhoto(source.url) ? (
                          <img
                            className="aspect-square max-h-80 w-full object-contain"
                            src={source.url}
                            alt="Returned to unmodified original"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex aspect-square max-h-80 flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-raised p-5 text-center">
                            <strong>AI PROVIDER NOT CONFIGURED</strong>
                            <p className="mt-3">DEVELOPMENT PREVIEW</p>
                            <p className="mt-3 text-sm">No image was generated or transformed.</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setOriginal({ ...original, [a.id]: !original[a.id] })}
                      >
                        {original[a.id] ? "Show mock preview" : "Return to original"}
                      </Button>
                      {(["accepted", "rejected", "deleted"] as const).map((status) => (
                        <Button
                          key={status}
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void act(() => reviewAiAsset({ data: { id: a.id, status } }))
                          }
                        >
                          {status === "accepted"
                            ? "Accept preview"
                            : status === "rejected"
                              ? "Reject preview"
                              : "Delete generated version"}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </Panel>
        ))}
      </section>
    </div>
  );
}
