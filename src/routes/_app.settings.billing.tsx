import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBootstrap, setPlanFn, startStripeCheckout, startStripePortal } from "@/lib/lane/server/fns";
import { AI_PACK_GBP, PLAN_DEFS } from "@/lib/lane/plans";
import { formatMoney } from "@/lib/lane/format";
import { Button, Panel } from "@/components/ui";
import type { PlanId } from "@/lib/lane/types";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_app/settings/billing")({ component: BillingPage });

function BillingPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const settings = boot.data?.settings;
  const setup = boot.data?.stripeSetup;
  const stripeOn = Boolean(setup?.configured ?? boot.data?.stripeConfigured);
  const flag = useMemo(() => new URLSearchParams(window.location.search).get("checkout"), []);
  const [err, setErr] = useState<string | null>(null);

  const checkout = useMutation({
    mutationFn: (opts: { plan: PlanId; aiPack: boolean }) => startStripeCheckout({ data: opts }),
    onSuccess: (r) => {
      window.location.assign(r.url);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const portal = useMutation({
    mutationFn: () => startStripePortal(),
    onSuccess: (r) => window.location.assign(r.url),
    onError: (e: Error) => setErr(e.message),
  });

  if (!settings) return <div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-secondary" />;

  const ticks: [string, boolean][] = setup
    ? [
        ["STRIPE_SECRET_KEY", setup.secret],
        ["STRIPE_WEBHOOK_SECRET", setup.webhook],
        ["STRIPE_PRICE_STARTER", setup.prices.starter],
        ["STRIPE_PRICE_SELLER", setup.prices.seller],
        ["STRIPE_PRICE_PRO", setup.prices.pro],
        ["STRIPE_PRICE_AI_PACK", setup.prices.aiPack],
      ]
    : [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {stripeOn
          ? "Checkout goes to Stripe. Webhooks update the plan. 3-day refund if you have made fewer than 20 live publishes."
          : "Card billing is not live on this server yet. The switches below only change action caps. Set the keys in the checklist, then Subscribe becomes a real Stripe Checkout."}
      </p>
      {flag === "success" ? <p className="text-sm text-mark">Payment received. Plan updates when the webhook lands.</p> : null}
      {flag === "cancel" ? <p className="text-sm text-muted">Checkout cancelled.</p> : null}
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      <p className="text-sm">
        Current: <span className="font-medium">{PLAN_DEFS[settings.plan].name}</span>
        {" · "}
        {settings.actionsRemaining} actions left this month
        {settings.aiPack ? " · AI pack on" : ""}
        {" · "}
        {settings.billingStatus}
      </p>
      {stripeOn && settings.stripeCustomerId ? (
        <Button variant="secondary" disabled={portal.isPending} onClick={() => portal.mutate()}>
          Manage billing
        </Button>
      ) : null}
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
              disabled={checkout.isPending}
              onClick={() => {
                if (stripeOn) checkout.mutate({ plan: p.id as PlanId, aiPack: settings.aiPack });
                else setPlanFn({ data: { plan: p.id as PlanId, aiPack: settings.aiPack } }).then(() => qc.invalidateQueries());
              }}
            >
              {settings.plan === p.id ? "Current" : stripeOn ? `Subscribe ${formatMoney(p.priceGbp)}` : "Switch"}
            </Button>
          </Panel>
        ))}
      </div>
      <Panel className="p-4">
        <p className="text-sm font-medium">AI pack · {formatMoney(AI_PACK_GBP)}/mo</p>
        <p className="mt-1 text-sm text-muted">Listing generation from notes. Never auto-publishes.</p>
        <Button
          size="sm"
          className="mt-3"
          variant={settings.aiPack ? "secondary" : "primary"}
          disabled={checkout.isPending}
          onClick={() => {
            if (stripeOn) checkout.mutate({ plan: settings.plan, aiPack: !settings.aiPack });
            else setPlanFn({ data: { plan: settings.plan, aiPack: !settings.aiPack } }).then(() => qc.invalidateQueries());
          }}
        >
          {settings.aiPack ? "AI pack on" : stripeOn ? "Add AI pack at checkout" : "Add AI pack"}
        </Button>
      </Panel>
      <Panel className="p-4">
        <p className="text-sm font-medium">Live billing setup</p>
        <p className="mt-1 text-sm text-muted">
          Secrets never leave the server. This only shows whether each env var is present. Full steps: instructions.txt §7c.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {ticks.map(([name, ok]) => (
            <li key={name} className="flex items-center justify-between gap-3">
              <code className="font-mono text-[11px]">{name}</code>
              <span className={ok ? "text-mark" : "text-muted"}>{ok ? "Set" : "Missing"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-subtle">
          Webhook URL: /api/stripe/webhook · events: checkout.session.completed, customer.subscription.updated,
          customer.subscription.deleted, invoice.payment_failed. Test card 4000 0000 0000 0002.
        </p>
      </Panel>
    </div>
  );
}
