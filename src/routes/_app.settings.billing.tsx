import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBootstrap, setPlanFn } from "@/lib/lane/server/fns";
import { AI_PACK_GBP, PLAN_DEFS } from "@/lib/lane/plans";
import { formatMoney } from "@/lib/lane/format";
import { Button, Panel } from "@/components/ui";
import type { PlanId } from "@/lib/lane/types";

export const Route = createFileRoute("/_app/settings/billing")({ component: BillingPage });

function BillingPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const settings = boot.data?.settings;
  if (!settings) return <div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-secondary" />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Billing runs on Stripe in production. This preview applies the plan on your account so action caps and the AI pack behave.
        3-day refund if you have made fewer than 20 live publishes.
      </p>
      <p className="text-sm">
        Current: <span className="font-medium">{PLAN_DEFS[settings.plan].name}</span>
        {" · "}
        {settings.actionsRemaining} actions left this month
        {settings.aiPack ? " · AI pack on" : ""}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {Object.values(PLAN_DEFS).map((p) => (
          <Panel key={p.id} className="p-4">
            <p className="text-sm font-medium">{p.name}</p>
            <p className="mt-1 font-mono text-xl tabular">{formatMoney(p.priceGbp)}/mo</p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {p.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <Button
              size="sm"
              className="mt-3"
              variant={settings.plan === p.id ? "secondary" : "primary"}
              onClick={() => setPlanFn({ data: { plan: p.id as PlanId, aiPack: settings.aiPack } }).then(() => qc.invalidateQueries())}
            >
              {settings.plan === p.id ? "Current" : "Switch"}
            </Button>
          </Panel>
        ))}
      </div>
      <Panel className="p-4">
        <p className="text-sm font-medium">AI pack · {formatMoney(AI_PACK_GBP)}/mo</p>
        <p className="mt-1 text-sm text-muted">Listing generation from notes. Background remove credits later. Never auto-publishes.</p>
        <Button
          size="sm"
          className="mt-3"
          variant={settings.aiPack ? "secondary" : "primary"}
          onClick={() => setPlanFn({ data: { plan: settings.plan, aiPack: !settings.aiPack } }).then(() => qc.invalidateQueries())}
        >
          {settings.aiPack ? "AI pack on" : "Add AI pack"}
        </Button>
      </Panel>
    </div>
  );
}
