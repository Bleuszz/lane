import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBootstrap, startStripeCheckout, startStripePortal } from "@/lib/lane/server/fns";
import { setAiPreference } from "@/lib/lane/server/smart-fill";
import { PLAN_DEFS } from "@/lib/lane/plans";
import { formatMoney } from "@/lib/lane/format";
import { Button, Panel } from "@/components/ui";
import type { PlanId } from "@/lib/lane/types";
import { useState } from "react";

export const Route = createFileRoute("/_app/settings/billing")({ component: BillingPage });
function BillingPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const [error, setError] = useState("");
  const checkout = useMutation({ mutationFn: (plan: PlanId) => startStripeCheckout({ data: { plan, aiPack: false } }), onSuccess: (r) => window.location.assign(r.url), onError: (e: Error) => setError(e.message) });
  const portal = useMutation({ mutationFn: () => startStripePortal(), onSuccess: (r) => window.location.assign(r.url), onError: (e: Error) => setError(e.message) });
  const preference = useMutation({ mutationFn: (enabled: boolean) => setAiPreference({ data: { enabled } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["bootstrap"] }), onError: (e: Error) => setError(e.message) });
  const settings = boot.data?.settings;
  if (boot.isError) return <p role="alert">Could not load your plan. Please refresh.</p>;
  if (!settings) return <p role="status" className="text-muted">Loading your plan…</p>;
  const stripeOn = boot.data?.stripeConfigured;
  return <div className="mx-auto max-w-5xl space-y-8">
    <div><p className="eyebrow">Your workspace</p><h1 className="page-title">A plan for your pace.</h1><p className="mt-2 text-muted">Every supported marketplace, on every plan. Add AI when it helps.</p></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!stripeOn && <p className="rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">Launch pricing is shown below. Subscriptions are not available in this environment yet.</p>}
    <Panel className="flex flex-wrap items-center justify-between gap-5 p-6"><div><p className="text-sm text-muted">Current plan</p><h2 className="mt-1 text-xl font-semibold">{PLAN_DEFS[settings.plan].name}</h2><p className="mt-2 text-sm text-muted">{settings.billingStatus === "trialing" ? `${settings.trialActive ? "No-card trial" : "Trial ended"} · ${settings.trialEndsAt ? new Date(settings.trialEndsAt).toLocaleDateString("en-GB") : ""} · ` : ""}{settings.actionsRemaining} listing actions left · {settings.billingStatus}</p></div>{settings.stripeCustomerId && <Button variant="secondary" disabled={portal.isPending} onClick={() => portal.mutate()}>Manage subscription</Button>}</Panel>
    <div className="grid gap-4 md:grid-cols-3">{Object.values(PLAN_DEFS).map((p) => <Panel key={p.id} className={`flex flex-col p-6 ${p.id === "seller" ? "ring-1 ring-mark" : ""}`}><p className="text-sm font-semibold">{p.name}{p.id === "seller" && <span className="ml-2 text-xs font-normal text-mark">With AI assistance</span>}</p><p className="my-5 text-4xl tracking-tight">{formatMoney(p.priceGbp)}<span className="text-sm text-muted"> / month</span></p><ul className="mb-6 flex-1 space-y-3 text-sm text-muted">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul><Button disabled={!stripeOn || checkout.isPending || settings.plan === p.id || Boolean(settings.stripeCustomerId)} variant={p.id === "seller" ? "primary" : "secondary"} onClick={() => checkout.mutate(p.id)}>{settings.plan === p.id ? "Your current plan" : settings.stripeCustomerId ? "Change in billing portal" : stripeOn ? `Choose ${p.name}` : "Not open yet"}</Button></Panel>)}</div>
    <Panel className="space-y-4 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">AI assistance</h2><p className="mt-1 text-sm text-muted">You decide when AI can read listing text and suggest missing details.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[var(--color-mark)]" checked={settings.aiAutofillEnabled} disabled={!settings.aiCreditsLimit || preference.isPending} onChange={(e) => preference.mutate(e.target.checked)}/>{settings.aiAutofillEnabled ? "On" : "Off"}</label></div><p className="text-sm"><strong>{Math.max(0, settings.aiCreditsLimit - settings.aiCreditsUsed)}</strong> of {settings.aiCreditsLimit} credits remaining this month.</p><p className="text-xs leading-relaxed text-muted">One successful AI request uses one credit. Failed requests restore the credit; field searches with no useful suggestions are free. Credits reset each UTC calendar month, do not roll over, and never create an automatic overage charge. Photo framing and lighting edits use no AI credits. A monthly provider-cost guard may pause AI before all credits are used, especially after timeouts; it never triggers extra charges.</p></Panel>
  </div>;
}
