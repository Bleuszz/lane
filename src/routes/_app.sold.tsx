import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSales } from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { formatDate, formatMoney } from "@/lib/lane/format";
import { Panel } from "@/components/ui";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_app/sold")({ component: SoldPage });

function SoldPage() {
  const sales = useQuery({ queryKey: ["sales"], queryFn: () => getSales() });
  const rows = sales.data ?? [];
  const gmv = rows.reduce((s, r) => s + r.soldPriceGbp, 0);
  const complete = rows.filter(r => r.amountsBasis === "entered" && r.netGbp !== null && r.costTotalGbp !== null);
  const recordedNet = complete.reduce((sum,r) => sum+r.netGbp!,0);
  const recordedCosts = complete.reduce((sum,r) => sum+r.costTotalGbp!,0);
  const margin = recordedNet-recordedCosts;
  const mix = Object.values(
    rows.reduce<Record<string, { name: string; gmv: number }>>((acc, r) => {
      const name = CHANNELS[r.marketplace]?.short ?? r.marketplace;
      acc[name] = acc[name] ?? { name, gmv: 0 };
      acc[name].gmv += r.soldPriceGbp;
      return acc;
    }, {}),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">Sold</h1>
        <p className="mt-1 text-sm text-muted">Recorded sale amounts. Some imported fees are estimates; this page does not verify payments received.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Sale amounts", formatMoney(gmv)],
          ["Complete entries", `${complete.length}/${rows.length}`],
          ["Recorded costs", complete.length ? formatMoney(recordedCosts) : "Unknown"],
          ["Recorded margin", complete.length ? formatMoney(margin) : "Unknown"],
        ].map(([k, v]) => (
          <Panel key={k} className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{k}</p>
            <p className="mt-1 font-mono text-xl tabular">{v}</p>
          </Panel>
        ))}
      </div>
      <p className="text-xs text-muted">Costs and margin cover only entries with entered fees and a saved item cost. They exclude postage, refunds and tax. Totals cover the latest {rows.length} entries.</p>
      {mix.length > 0 ? (
        <Panel className="p-4">
          <p className="text-xs font-medium">Channel mix</p>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mix} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6e6960" }} axisLine={false} tickLine={false} />
                <YAxis
                  width={44}
                  tick={{ fontSize: 11, fill: "#6e6960" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `£${v}`}
                />
                <Tooltip formatter={(v) => formatMoney(Number(v ?? 0))} />
                <Bar dataKey="gmv" fill="var(--color-mark)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : null}
      <Panel className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-[0.1em] text-muted">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-2 py-2">Channel</th>
              <th className="px-2 py-2">Sold</th>
              <th className="px-2 py-2">Net</th>
              <th className="px-2 py-2">Via</th>
              <th className="px-2 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">No sales yet.</td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    <Link to="/inventory/$id" params={{ id: s.itemId }} className="hover:underline">
                      {s.itemTitle}
                    </Link>
                    <p className="text-xs text-muted">Qty {s.quantity}{s.reference ? ` · ${s.reference}` : ""}</p>
                  </td>
                  <td className="px-2 py-2">{CHANNELS[s.marketplace]?.short}</td>
                  <td className="px-2 py-2 tabular">{formatMoney(s.soldPriceGbp)}</td>
                  <td className="px-2 py-2 tabular">{s.netGbp === null ? "Unknown" : formatMoney(s.netGbp)}{s.amountsBasis === "estimated" ? <span className="block text-xs text-muted">Estimate</span> : null}</td>
                  <td className="px-2 py-2 text-xs text-muted">{s.detectedVia.replaceAll("_", " ")}</td>
                  <td className="px-2 py-2 text-muted">{formatDate(s.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
