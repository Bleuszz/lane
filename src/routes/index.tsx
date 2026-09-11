import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
import { PLAN_DEFS } from "@/lib/lane/plans";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lane — a calmer workspace for UK resellers" },
      {
        name: "description",
        content:
          "Connect Vinted and eBay through Lane Desktop. One Lane account for your reseller workspace. Explore the beta with a 7-day free trial.",
      },
    ],
  }),
  component: Home,
});
function Home() {
  return (
    <main className="marketing min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-7 lg:px-12">
        <LaneWordmark />
        <nav aria-label="Main navigation" className="flex items-center gap-6 text-sm">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link to="/download" className="hidden sm:block">
            Download
          </Link>
          <Link to="/login" className="rounded-full border border-line-strong px-5 py-2">
            Sign in ↗
          </Link>
        </nav>
      </header>
      <section className="mx-auto grid max-w-7xl gap-14 px-6 py-16 lg:grid-cols-[1.3fr_1fr] lg:px-12 lg:py-24">
        <div>
          <p className="eyebrow">THE RESELLER'S WORKROOM · EARLY BETA</p>
          <h1 className="mt-8 font-serif text-[clamp(3.5rem,7vw,6.5rem)] leading-[.98] tracking-[-.05em]">
            Good finds.
            <br />
            Room to grow.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-8 text-muted">
            A considered workspace for the work behind selling. Connect your shops, bring your stock
            together, and prepare for your next listing.
          </p>
          <div className="mt-9 flex flex-wrap gap-5">
            <Link to="/signup" className="rounded-full bg-mark px-8 py-4 font-medium text-mark-fg">
              Start free ↗
            </Link>
            <Link to="/download" className="rounded-full border border-line-strong px-7 py-4">
              Download Lane
            </Link>
          </div>
          <p className="mt-5 text-xs text-muted">
            7-day trial · No card · 0 AI credits · Windows desktop beta
          </p>
        </div>
        <aside className="self-center border-y border-line-strong py-8">
          <p className="eyebrow">ONE ACCOUNT. TWO PLACES TO WORK.</p>
          <div className="mt-7 space-y-8">
            {[
              ["01", "Lane on the web", "Your account, trial and approved desktop devices."],
              [
                "02",
                "Lane on your computer",
                "Sign into Vinted and eBay directly. Marketplace sessions stay local.",
              ],
              [
                "03",
                "Your next listing",
                "Discovery works in the owner pilot. Complete item extraction and publishing are still being verified.",
              ],
            ].map(([n, t, b]) => (
              <div key={n} className="grid grid-cols-[2rem_1fr] gap-4">
                <span className="text-xs text-muted">{n}</span>
                <div>
                  <h2 className="font-serif text-2xl">{t}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
      <figure className="mx-auto max-w-6xl px-6 pb-16">
        <img
          src="/lane-account-preview.png"
          alt="Lane account dashboard showing trial dates and desktop device management"
          width="1280"
          height="900"
          loading="lazy"
          className="w-full rounded-xl border border-line"
        />
        <figcaption className="mt-3 text-xs text-muted">
          Actual Lane account screen · local acceptance-test account, not customer statistics.
        </figcaption>
      </figure>
      <section id="how" className="bg-mark px-6 py-20 text-mark-fg lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow">BUILT AROUND YOUR OWN SHOPS</p>
          <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-tight">
            Less scattered.
            <br />
            More considered.
          </h2>
          <div className="mt-12 grid gap-9 md:grid-cols-3">
            {[
              [
                "Keep an inventory",
                "Store reusable item records and review available source information. Missing details remain unknown.",
              ],
              [
                "Connect with control",
                "Vinted + eBay session connections are in beta. You complete marketplace sign-in and verification yourself.",
              ],
              [
                "Prepare, then review",
                "Crosslisting, field validation and optional AI are the direction of travel. Full automated publishing is not a verified promise today.",
              ],
            ].map(([t, b]) => (
              <div key={t}>
                <h3 className="text-lg">{t}</h3>
                <p className="mt-3 text-sm leading-7 opacity-80">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 border-t border-white/20 pt-6 text-xs opacity-80">
            Vinted + eBay only in this beta. Additional marketplaces, sales reporting and automation
            come later.
          </p>
        </div>
      </section>
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
        <p className="eyebrow">A SMALL START</p>
        <h2 className="mt-4 font-serif text-4xl">Try Lane. Find your rhythm.</h2>
        <div className="mt-10 border-y border-line py-6">
          <strong className="text-xl">7-day free trial · £0</strong>
          <p className="mt-2 text-sm text-muted">
            Starts with your Lane account onboarding. No card, no AI credits and no automatic
            charge.
          </p>
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {Object.values(PLAN_DEFS).map((p) => (
            <div key={p.id}>
              <h3 className="font-medium">{p.name}</h3>
              <p className="mt-4 text-4xl">
                £{p.priceGbp}
                <span className="text-sm text-muted"> / month</span>
              </p>
              <p className="mt-4 text-sm text-muted">
                {p.aiCredits
                  ? "Planned optional AI allowance"
                  : "Standard workflows, no AI credits"}
              </p>
              <p className="mt-2 text-xs text-muted">Provisional plan · checkout not open</p>
            </div>
          ))}
        </div>
        <Link
          to="/signup"
          className="mt-10 inline-block rounded-full bg-mark px-7 py-3 text-mark-fg"
        >
          Start free ↗
        </Link>
      </section>
      <section className="mx-auto grid max-w-7xl gap-10 border-t border-line px-6 py-16 md:grid-cols-2 lg:px-12">
        <h2 className="font-serif text-3xl">Straight answers.</h2>
        <div>
          {[
            [
              "Is everything ready?",
              "Lane is an early beta. Owner-tested Vinted and eBay connections and listing discovery work. Vinted detail extraction is incomplete; some discovered titles are unknown. Publishing and full synchronisation are not release-proven.",
            ],
            [
              "Do I need another desktop account?",
              "No. Sign into the Lane website, approve your desktop, and use the same Lane account. Marketplace logins are separate.",
            ],
            [
              "Will I be charged after seven days?",
              "No. The trial does not require a card and does not start a paid subscription.",
            ],
            [
              "Are you affiliated with Vinted or eBay?",
              "No. Lane is independent. Their names identify the marketplaces you can connect in the beta.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="border-b border-line py-5">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-3 text-sm leading-7 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-6 border-t border-line px-6 py-8 text-xs text-muted lg:px-12">
        <span>Lane · An independent reseller workspace</span>
        <nav className="flex flex-wrap gap-5">
          <Link to="/help">Help</Link>
          <Link to="/security">Security</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/cookies">Cookies</Link>
        </nav>
      </footer>
    </main>
  );
}
