import { createFileRoute, Link, Navigate, useRouteContext } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LEGAL_FOOTER } from "@/lib/lane/copy";
import { PLAN_DEFS } from "@/lib/lane/plans";
import { formatMoney } from "@/lib/lane/format";
import { desktopApi } from "@/lib/lane/desktop";
import { LaneWordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user } = useCurrentUserState();
  if (user || sessionUser) return <Navigate to="/inbox" />;
  const inDesktop = Boolean(desktopApi());

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <LaneWordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!inDesktop ? (
            <Link to="/download" className="hidden text-sm text-muted hover:text-ink sm:inline">
              Download Windows
            </Link>
          ) : null}
          <Link to="/login" className="text-sm text-muted hover:text-ink">
            Sign in
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-16 md:pt-24">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">UK · GBP · one inventory</p>
        <h1 className="mt-4 max-w-xl text-4xl font-medium leading-[1.08] tracking-[-0.04em] md:text-6xl">
          List once. Stay in sync.
        </h1>
        <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">
          You keep one inventory. Lane lists it on Vinted, eBay and the rest. You sign in on those sites — Lane never
          takes the password. When something sells, the others come down. The Windows app is this website in a shell:
          same account, same plan, same shops.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login">
            <Button size="lg">Start 7-day free trial</Button>
          </Link>
          {!inDesktop ? (
            <Link to="/download" className="inline-flex">
              <Button size="lg" variant="secondary">
                Download for Windows
              </Button>
            </Link>
          ) : null}
        </div>
        <p className="mt-4 max-w-lg text-sm text-subtle">
          {inDesktop
            ? "You're in the Windows app. Sign in with the same Lane account. Connect opens Vinted and closes itself when the session is captured."
            : "Unzip, double-click Lane.exe, paste your Lane URL, then sign in. Connect opens the real marketplace. When you are signed in, the window closes on its own. Starter is " +
              formatMoney(PLAN_DEFS.starter.priceGbp) +
              " a month after the trial if you stay."}
        </p>

        <div className="mt-16 grid gap-3 md:grid-cols-3">
          {Object.values(PLAN_DEFS).map((p) => (
            <div key={p.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="mt-2 font-mono text-2xl tabular tracking-tight">
                {formatMoney(p.priceGbp)}
                <span className="text-sm text-muted">/mo</span>
              </p>
              <p className="mt-3 text-sm text-muted">{p.notes.join(". ")}</p>
            </div>
          ))}
        </div>
        <footer className="mt-16 max-w-2xl text-[11px] leading-relaxed text-subtle">
          <p>{LEGAL_FOOTER}</p>
          <p className="mt-3">
            <Link to="/download" className="hover:text-ink">
              Download Windows
            </Link>
            {" · "}
            <Link to="/legal/privacy" className="hover:text-ink">
              Privacy
            </Link>
            {" · "}
            <Link to="/legal/terms" className="hover:text-ink">
              Terms
            </Link>
          </p>
        </footer>
      </section>
    </main>
  );
}
