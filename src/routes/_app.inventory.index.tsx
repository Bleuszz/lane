import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkEdit, delistListings, exportCsv, getBootstrap, getInventory, publishItems } from "@/lib/lane/server/fns";
import { formatAge, formatMoney } from "@/lib/lane/format";
import { CHANNELS } from "@/lib/lane/channels";
import { Button, Input, Panel } from "@/components/ui";
import { ChannelDot, StatusBadge } from "@/components/status";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import type { InventoryRow } from "@/lib/lane/types";

export const Route = createFileRoute("/_app/inventory/")({ component: InventoryPage });

function InventoryPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["inventory"], queryFn: () => getInventory() });
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");

  const rows = useMemo(() => {
    const list = items.data ?? [];
    return list.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q.trim()) {
        const n = q.toLowerCase();
        if (!`${r.title} ${r.sku ?? ""} ${r.brand ?? ""}`.toLowerCase().includes(n)) return false;
      }
      return true;
    });
  }, [items.data, q, status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "j") setCursor((c) => Math.min(rows.length - 1, c + 1));
      if (e.key === "k") setCursor((c) => Math.max(0, c - 1));
      if (e.key === " " && rows[cursor]) {
        e.preventDefault();
        toggle(rows[cursor]!.id);
      }
      if (e.key === "Enter" && rows[cursor]) nav({ to: "/inventory/$id", params: { id: rows[cursor]!.id } });
      if (e.key === "p" || e.key === "P") setPublishOpen(true);
      if (e.key === "d" || e.key === "D") void onDelist();
      if (e.key === "Escape") setSelected(new Set());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ids = selected.size ? [...selected] : rows[cursor] ? [rows[cursor]!.id] : [];

  const pub = useMutation({
    mutationFn: () => publishItems({ data: { itemIds: ids, accountIds } }),
    onSuccess: () => {
      setPublishOpen(false);
      void qc.invalidateQueries();
    },
  });
  const del = useMutation({
    mutationFn: () => delistListings({ data: { itemIds: ids } }),
    onSuccess: () => qc.invalidateQueries(),
  });

  async function onDelist() {
    if (!ids.length) return;
    if (!window.confirm(`Delist ${ids.length} item(s) from live channels?`)) return;
    await del.mutateAsync();
  }

  async function onExport() {
    const csv = await exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lane-inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.02em]">Inventory</h1>
          <p className="mt-1 text-sm text-muted">j/k move · space select · Enter open · P publish · D delist</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/new">
            <Button>New listing</Button>
          </Link>
          <Button variant="secondary" onClick={() => void onExport()}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, SKU, brand" className="max-w-xs" />
        {["all", "live", "draft", "error", "sold", "queued"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn("h-8 rounded-full px-3 text-xs", status === s ? "bg-mark text-mark-fg" : "bg-secondary text-muted")}
          >
            {s}
          </button>
        ))}
      </div>

      {selected.size > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-raised px-3 py-2 text-sm">
          <span className="tabular">{selected.size} selected</span>
          <Button size="sm" onClick={() => setPublishOpen(true)}>Publish</Button>
          <Button size="sm" variant="secondary" onClick={() => void onDelist()}>Delist</Button>
          <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find in title" className="h-8 w-32" />
          <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Replace" className="h-8 w-32" />
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              bulkEdit({ data: { itemIds: [...selected], titleFind: find, titleReplace: replace } }).then(() => qc.invalidateQueries())
            }
          >
            Apply
          </Button>
        </div>
      ) : null}

      <Panel className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">SKU</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Channels</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Age</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                    Empty aisle. Connect Vinted to import 1-click, or create a listing.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <Row
                    key={row.id}
                    row={row}
                    active={i === cursor}
                    checked={selected.has(row.id)}
                    onCheck={() => toggle(row.id)}
                    onOpen={() => nav({ to: "/inventory/$id", params: { id: row.id } })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {publishOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/30 p-4">
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <h2 className="text-sm font-medium">Publish {ids.length} item(s)</h2>
            <p className="mt-1 text-sm text-muted">eBay jobs run on the server. Vinted waits for the Lane Bridge.</p>
            <div className="mt-3 space-y-2">
              {(boot.data?.accounts ?? []).map((a) => (
                <label key={a.id} className="flex h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accountIds.includes(a.id)}
                    onChange={() =>
                      setAccountIds((cur) => (cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id]))
                    }
                  />
                  {CHANNELS[a.marketplace]?.label} · {a.mode === "oauth" ? "API" : "EXT"}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPublishOpen(false)}>Cancel</Button>
              <Button disabled={pub.isPending || accountIds.length === 0} onClick={() => pub.mutate()}>
                {pub.isPending ? "Queueing…" : "Queue publish"}
              </Button>
            </div>
            {pub.error ? <p className="mt-2 text-sm text-danger">{(pub.error as Error).message}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  row,
  active,
  checked,
  onCheck,
  onOpen,
}: {
  row: InventoryRow;
  active: boolean;
  checked: boolean;
  onCheck: () => void;
  onOpen: () => void;
}) {
  return (
    <tr className={cn("border-b border-line last:border-0", active ? "bg-secondary/80" : "hover:bg-raised")}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select ${row.title}`} />
      </td>
      <td className="px-2 py-2">
        <button type="button" onClick={onOpen} className="flex items-center gap-3 text-left">
          <span className="h-10 w-8 overflow-hidden rounded-[var(--radius-xs)] bg-secondary">
            {row.primaryPhotoUrl ? <img src={row.primaryPhotoUrl} alt="" className="h-full w-full object-cover" /> : null}
          </span>
          <span>
            <span className="block max-w-[240px] truncate">{row.title}</span>
            <span className="block text-[11px] text-muted">{row.brand}</span>
          </span>
        </button>
      </td>
      <td className="px-2 py-2 font-mono text-xs text-muted">{row.sku ?? "—"}</td>
      <td className="px-2 py-2 tabular">{row.quantity}</td>
      <td className="px-2 py-2">
        <span className="flex flex-wrap gap-1">
          {row.channels.length === 0 ? <span className="text-subtle">—</span> : row.channels.map((c) => (
            <ChannelDot key={c.id} marketplace={c.marketplace} remoteStatus={c.remoteStatus} />
          ))}
        </span>
      </td>
      <td className="px-2 py-2 tabular">{formatMoney(row.basePriceGbp)}</td>
      <td className="px-2 py-2 text-muted">{formatAge(row.createdAt)}</td>
      <td className="px-2 py-2"><StatusBadge status={row.status} /></td>
    </tr>
  );
}
