import { createFileRoute, Link, Navigate, useRouteContext } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LEGAL_FOOTER } from "@/lib/lane/copy";
import { PLAN_DEFS } from "@/lib/lane/plans";
import { formatMoney } from "@/lib/lane/format";
import { LaneMark, LaneWordmark } from "@/components/logo";
import { Button } from "@/components/ui";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user } = useCurrentUserState();
  if (user || sessionUser) return <Navigate to="/inbox" />;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <LaneWordmark />
        <Link to="/login" className="text-sm text-muted hover:text-ink">
          Sign in
        </Link>
      </header>
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-12 md:pt-20">
        <div className="flex items-start gap-4">
          <LaneMark className="mt-1 h-8 w-8 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">UK resellers · GBP</p>
            <h1 className="mt-3 max-w-xl text-4xl font-medium leading-[1.1] tracking-[-0.03em] md:text-5xl">
              One aisle. Every marketplace.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
              A listing is not a row per site. It is one inventory record with channel listings attached.
              When quantity hits zero, the others come down. If the Vinted job is waiting on a sleeping browser, we say so.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login">
                <Button size="lg">Sign in</Button>
              </Link>
              <a href="#how" className="inline-flex">
                <Button size="lg" variant="secondary">
                  How it works
                </Button>
              </a>
            </div>
          </div>
        </div>

        <ol id="how" className="mt-16 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", t: "Connect", d: "eBay via official OAuth. Vinted via the Lane Bridge in your browser. No passwords." },
            { n: "02", t: "Canonical item", d: "One form. Category maps, UK sizes, postage, price rules. Photos stay on Lane." },
            { n: "03", t: "Publish on a queue", d: "Background jobs. Per-channel status. Retry with the raw error, not a shrug." },
            { n: "04", t: "Sale → delist", d: "eBay webhook or Vinted poll. Qty 0 takes every other live listing down." },
          ].map((s) => (
            <li key={s.n} className="bg-surface p-5">
              <p className="font-mono text-[11px] text-muted">{s.n}</p>
              <h2 className="mt-2 text-sm font-medium">{s.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>

        <section className="mt-16">
          <h2 className="text-sm font-medium">Pricing</h2>
          <p className="mt-1 text-sm text-muted">Actions = create + relist. Updates and delists are free. Inventory is unlimited on paid plans.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {Object.values(PLAN_DEFS).map((p) => (
              <div key={p.id} className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-2 font-mono text-2xl tabular tracking-tight">{formatMoney(p.priceGbp)}<span className="text-sm text-muted">/mo</span></p>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {p.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">AI pack +£5/mo. 3-day refund if you have made fewer than 20 live publishes.</p>
        </section>

        <footer className="mt-16 max-w-2xl text-[11px] leading-relaxed text-subtle">{LEGAL_FOOTER}</footer>
      </section>
    </main>
  );
}
