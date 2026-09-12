import { ReleaseGate } from "@/components/release-gate";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button, Panel } from "@/components/ui";
import {
  getNormalizationState,
  queueNormalization,
  runNormalization,
  reviewNormalization,
  getNormalizedImage,
} from "@/lib/lane/scheduler/fns";
import {
  PRESETS,
  normalizationSchema,
  type NormalizationOptions,
} from "@/lib/lane/normalization/options";
export const Route = createFileRoute("/_app/image-tools")({
  head: () => ({
    meta: [{ title: "Image exports | Lane" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => (
    <ReleaseGate feature="images">
      <ImageTools />
    </ReleaseGate>
  ),
});
function ImageTools() {
  const state = useQuery({
      queryKey: ["normalization"],
      queryFn: () => getNormalizationState(),
      refetchInterval: 4000,
    }),
    qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]),
    [options, setOptions] = useState<NormalizationOptions>(
      normalizationSchema.parse({ preset: "ORIGINAL" }),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [previews, setPreviews] = useState<Record<string, string>>({}),
    [original, setOriginal] = useState<Record<string, boolean>>({});
  const active = useRef(false),
    key = useRef<{ body: string; key: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["normalization"] });
  async function act(work: () => Promise<unknown>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image request failed");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  const data = state.data;
  if (state.isError) return <p role="alert">Image history unavailable.</p>;
  if (!data) return <p role="status">Loading image exports…</p>;
  const safe = (url: string) => /^data:image\/(jpeg|png);base64,|^https:\/\//.test(url);
  const field = "mt-1 block w-full rounded border border-line bg-paper p-2";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Non-destructive image preparation</p>
        <h1 className="page-title">A clean export. The same item.</h1>
        <p className="mt-3 text-muted">
          Your original stays untouched. Compare every derivative before accepting it.
        </p>
      </header>
      <Panel className="space-y-2 border-dashed p-5">
        <strong>
          {data.enabled ? "Local image preparation enabled" : "Image normalization is switched off"}
        </strong>
        <p className="text-sm text-muted">
          JPEG/PNG originals saved in Lane, up to 2 MB and 20 megapixels. Remote URLs require
          uploading the original first. Background replacement is unsupported. No AI generation or
          marketplace writes.
        </p>
      </Panel>
      {error && (
        <p role="alert" className="rounded bg-warn-bg p-4">
          {error.replaceAll("_", " ")}
        </p>
      )}
      <Panel className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">Prepare selected photos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.photos.map((p, i) => (
            <label key={p.id} className="rounded border border-line p-2">
              <input
                type="checkbox"
                aria-label={`Select photo ${i + 1}`}
                checked={selected.includes(p.id)}
                disabled={!selected.includes(p.id) && selected.length >= 12}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id),
                  )
                }
              />
              {safe(p.url) && (
                <img
                  alt={`Original photo for ${p.title}`}
                  className="mt-2 aspect-square w-full object-contain"
                  src={p.url}
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="mt-2 block text-xs">{p.title}</span>
              {!p.url.startsWith("data:") && (
                <span className="text-xs text-muted">Upload original to prepare</span>
              )}
            </label>
          ))}
        </div>
        <label className="block">
          Export preset
          <select
            aria-label="Export preset"
            className={field}
            value={options.preset}
            onChange={(e) =>
              setOptions({ ...options, preset: e.target.value as typeof options.preset })
            }
          >
            {PRESETS.map((p) => (
              <option key={p} disabled={p === "WHITE_BACKGROUND"}>
                {p}
                {p === "WHITE_BACKGROUND" ? " — unsupported" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted">
          Original makes no changes, including metadata. Clean Export fixes orientation, converts to
          sRGB and strips privacy metadata. Marketplace Ready also fits within a conservative 1600px
          box; destination acceptance still needs validation. Thumbnail fits within 320px. Aspect
          ratio is preserved.
        </p>
        {options.preset === "CUSTOM" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Format
              <select
                className={field}
                value={options.format}
                onChange={(e) =>
                  setOptions({ ...options, format: e.target.value as "jpeg" | "png" })
                }
              >
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </label>
            {(
              [
                ["maxDimension", "Maximum dimension", 256, 2048, 1],
                ["quality", "JPEG quality", 75, 95, 1],
                ["brightness", "Brightness", 0.95, 1.05, 0.01],
                ["contrast", "Contrast", 0.95, 1.05, 0.01],
              ] as const
            ).map(([k, label, min, max, step]) => (
              <label key={k}>
                {label}
                <input
                  className={field}
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={options[k]}
                  onChange={(e) => setOptions({ ...options, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            {(
              [
                ["sharpen", "Conservative sharpening"],
                ["cropSquare", "Centre square crop — may remove edge content"],
                [
                  "fillTransparencyWhite",
                  "Fill existing transparency white — does not remove background",
                ],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={options[k]}
                  onChange={(e) => setOptions({ ...options, [k]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        )}
        <p className="text-sm">
          {new Set(data.photos.filter((p) => selected.includes(p.id)).map((p) => p.item_id)).size}{" "}
          listings · {selected.length} photos · local processing time depends on image size; each
          decode has a 15-second processing timeout.
        </p>
        <p className="text-xs text-muted">
          Keep logos, visible text, colour, pattern, damage and proportions accurate. Accepted
          exports remain separate from live listings; nothing is published automatically.
        </p>
        <Button
          disabled={busy || !data.enabled || !selected.length}
          onClick={() =>
            void act(async () => {
              const body = JSON.stringify({ selected, options });
              if (key.current?.body !== body) key.current = { body, key: crypto.randomUUID() };
              const ids = await queueNormalization({
                data: { photoIds: selected, options, requestKey: key.current.key },
              });
              await refresh();
              for (const id of ids) {
                await runNormalization({ data: { id } });
                await refresh();
              }
              key.current = null;
            })
          }
        >
          {busy ? "Preparing copies…" : "Prepare separate copies"}
        </Button>
      </Panel>
      <section className="space-y-4">
        <h2 className="text-2xl">Processing history</h2>
        {data.jobs.map((j) => {
          const p = data.photos.find((p) => p.id === j.source_photo_id);
          return (
            <Panel className="space-y-3 p-5" key={j.id}>
              <h3 className="font-semibold">
                {j.preset} · {j.status} · {j.review}
              </h3>
              <p className="text-xs text-muted">
                {new Date(j.created_at).toLocaleString("en-GB")} · {j.width ?? "?"} ×{" "}
                {j.height ?? "?"} · {j.format ?? "pending"} ·{" "}
                {j.file_size ? Math.round(j.file_size / 1024) + " KB" : "size pending"}
              </p>
              {j.last_error && <p role="status">{j.last_error.replaceAll("_", " ")}</p>}
              {j.status === "QUEUED" && (
                <Button
                  disabled={busy || !data.enabled}
                  onClick={() => void act(() => runNormalization({ data: { id: j.id } }))}
                >
                  Resume image job
                </Button>
              )}
              {j.status === "SUCCEEDED" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm">Original</p>
                      {p && safe(p.url) ? (
                        <img
                          alt="Preserved source image"
                          className="aspect-square max-h-80 w-full bg-raised object-contain"
                          src={p.url}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <p>Original no longer available in this listing.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-sm">
                        {original[j.id] ? "Original view" : "Derivative preview"}
                      </p>
                      {original[j.id] && p && safe(p.url) ? (
                        <img
                          alt="Returned to original"
                          className="aspect-square max-h-80 w-full object-contain"
                          src={p.url}
                          referrerPolicy="no-referrer"
                        />
                      ) : previews[j.id] ? (
                        <img
                          alt="Normalized derivative for comparison"
                          className="aspect-square max-h-80 w-full bg-raised object-contain"
                          src={previews[j.id]}
                        />
                      ) : (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void act(async () => {
                              setPreviews({
                                ...previews,
                                [j.id]: await getNormalizedImage({ data: { id: j.id } }),
                              });
                            })
                          }
                        >
                          Load derivative preview
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setOriginal({ ...original, [j.id]: !original[j.id] })}
                    >
                      {original[j.id] ? "View derivative" : "View original"}
                    </Button>
                    <Button
                      disabled={busy || !previews[j.id]}
                      onClick={() =>
                        void act(() =>
                          reviewNormalization({ data: { id: j.id, decision: "accepted" } }),
                        )
                      }
                    >
                      Accept after comparison
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          reviewNormalization({ data: { id: j.id, decision: "rejected" } }),
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await reviewNormalization({ data: { id: j.id, decision: "deleted" } });
                    setPreviews((prev) => {
                      const copy = { ...prev };
                      delete copy[j.id];
                      return copy;
                    });
                  })
                }
              >
                Delete derivative only
              </Button>
              <p className="text-xs text-muted">
                Processing version: {j.processing_version ?? "Pending"}
              </p>
            </Panel>
          );
        })}
      </section>
    </div>
  );
}
