import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBootstrap, importCsv, importRemote, previewRemote, syncRemoteCatalog } from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { formatMoney } from "@/lib/lane/format";
import { Button, NativeSelect, Panel } from "@/components/ui";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/import")({ component: ImportPage });

function ImportPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const [accountId, setAccountId] = useState<string>("");
  const accounts = boot.data?.accounts ?? [];
  const selected = accountId || accounts[0]?.id || "";
  const preview = useQuery({
    queryKey: ["preview", selected],
    queryFn: () => previewRemote({ data: { accountId: selected } }),
    enabled: Boolean(selected),
  });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const rows = preview.data ?? [];

  useEffect(() => {
    if (!preview.data) return;
    setPicked(new Set(preview.data.filter((r) => !r.alreadyImported).map((r) => r.remoteId)));
  }, [selected, preview.data]);

  const run = useMutation({
    mutationFn: () => importRemote({ data: { accountId: selected, remoteIds: [...picked] } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const csvMut = useMutation({
    mutationFn: (csv: string) => importCsv({ data: { csv } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const sync = useMutation({
    mutationFn: () => syncRemoteCatalog({ data: { accountId: selected } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">Import</h1>
        <p className="mt-1 text-sm text-muted">
          Pull live listings from a connected account. eBay fetches via OAuth. Vinted fetches from a captured session
          when one exists, otherwise Lane Bridge pushes the wardrobe from a signed-in tab. Title + price or photo hash
          attaches to an existing canonical item instead of duplicating.
        </p>
      </div>
      {accounts.length === 0 ? (
        <Panel className="p-6 text-sm text-muted">Connect Vinted to import 1-click.</Panel>
      ) : (
        <>
          <NativeSelect value={selected} onChange={(e) => setAccountId(e.target.value)} className="max-w-sm">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {CHANNELS[a.marketplace]?.label} · {a.label}
              </option>
            ))}
          </NativeSelect>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!selected || sync.isPending}
              onClick={() => sync.mutate()}
            >
              {sync.isPending ? "Syncing…" : "Sync from marketplace"}
            </Button>
          </div>
          {sync.data?.waiting ? <p className="text-sm text-muted">{sync.data.message}</p> : null}
          {sync.data && !sync.data.waiting ? (
            <p className="text-sm text-muted">
              Synced {sync.data.upserted} listings from {sync.data.source === "vinted" ? "Vinted" : sync.data.source === "ebay" ? "eBay" : "the extension"}.
            </p>
          ) : null}
          {sync.error ? <p className="text-sm text-danger">{(sync.error as Error).message}</p> : null}
          {rows.length === 0 ? (
            <Panel className="p-6 text-sm text-muted">
              Nothing synced yet. For Vinted, finish phone connect or pair Lane Bridge on vinted.co.uk. For eBay, click
              Sync after OAuth.
            </Panel>
          ) : null}
          <Panel className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="px-3 py-2 w-10" />
                  <th className="px-2 py-2">Listing</th>
                  <th className="px-2 py-2">Price</th>
                  <th className="px-2 py-2">Match</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.remoteId} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        disabled={r.alreadyImported}
                        checked={picked.has(r.remoteId)}
                        onChange={() =>
                          setPicked((cur) => {
                            const n = new Set(cur);
                            if (n.has(r.remoteId)) n.delete(r.remoteId);
                            else n.add(r.remoteId);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-8 overflow-hidden rounded-[var(--radius-xs)] bg-secondary">
                          {r.photoUrl ? <img src={r.photoUrl} alt="" className="h-full w-full object-cover" /> : null}
                        </span>
                        <span>
                          <span className="block">{r.title}</span>
                          <span className="block text-[11px] text-muted">{r.brand} · {r.sizeLabel}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 tabular">{formatMoney(r.priceGbp)}</td>
                    <td className="px-2 py-2 text-xs text-muted">
                      {r.alreadyImported ? "already attached" : r.matchItemId ? `link via ${r.matchReason}` : "create item"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Button disabled={!selected || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? "Importing…" : `Import ${picked.size}`}
          </Button>
          {run.data ? (
            <p className="text-sm text-muted">Created {run.data.created}, linked {run.data.linked}.</p>
          ) : null}
        </>
      )}

      <section>
        <h2 className="text-sm font-medium">CSV</h2>
        <p className="mt-1 text-sm text-muted">Columns: title, price_gbp, sku, brand, category, condition, size_uk, colour, qty, cost_gbp, tags, description.</p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-3 text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((t) => csvMut.mutate(t));
          }}
        />
        {csvMut.data ? <p className="mt-2 text-sm">Created {csvMut.data.created} drafts.</p> : null}
      </section>
    </div>
  );
}
