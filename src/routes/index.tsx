import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, StartLink, FaqSection } from "@/components/public-layout";
import { publicHead } from "@/lib/lane/public-site";
export const Route = createFileRoute("/")({ head: () => publicHead("/"), component: Home });
function Home() {
  return (
    <PublicLayout>
      <section className="public-section home-hero">
        <div>
          <p className="eyebrow">FOR UK RESELLERS · WINDOWS BETA</p>
          <h1>
            Less repeating.
            <br />
            <em>More reselling.</em>
          </h1>
          <p className="public-lead">
            A crosslisting workspace for your Vinted and eBay workflow. One Lane account to organise
            your setup and connect your own marketplace sessions.
          </p>
          <div className="flex flex-wrap gap-3">
            <StartLink />
            <a href="/how-it-works" className="public-button secondary">
              See how Lane works
            </a>
          </div>
          <p className="mt-5 text-sm text-muted">
            No card · 0 trial AI credits · Paid checkout not open
          </p>
        </div>
        <aside className="hero-note">
          <p className="eyebrow">BUILT AROUND YOUR WORK</p>
          <span className="hero-number" aria-hidden="true">
            01 / 02
          </span>
          <h2 className="font-serif text-3xl">
            One account.
            <br />
            Two places to work.
          </h2>
          <p className="mt-5 leading-7 text-muted">
            Your account on the web. Your marketplace sessions on your computer.
          </p>
          <p className="mt-6 border-t border-line pt-5 text-sm leading-6">
            Vinted + eBay connections and discovery work in the owner pilot. Full import and
            publishing are still being verified.
          </p>
          <a className="mt-5 inline-block underline" href="/features">
            What the beta can do →
          </a>
        </aside>
      </section>
      <section className="public-section !pt-0">
        <figure className="product-proof">
          <img
            src="/lane-account-preview.png"
            width="1280"
            height="900"
            loading="lazy"
            decoding="async"
            alt="Lane account screen showing trial status, plan and desktop device management"
          />
          <figcaption>
            Actual Lane account screen · local test account, not customer statistics.
          </figcaption>
        </figure>
      </section>
      <section className="public-section border-t border-line">
        <p className="eyebrow">A CONSIDERED WORKSPACE</p>
        <h2 className="mt-4 max-w-2xl font-serif text-4xl md:text-5xl">
          Know what’s connected.
          <br />
          Know what comes next.
        </h2>
        <div className="mt-10 grid gap-9 md:grid-cols-3">
          {[
            [
              "A shared identity",
              "Use the same Lane account on the web and desktop. Your trial and approved devices stay together.",
              "/how-it-works",
              "Understand the workflow",
            ],
            [
              "Your sign-in stays yours",
              "Sign into marketplaces directly. Local browser sessions stay separate from your cloud account.",
              "/security",
              "Read about session security",
            ],
            [
              "Clear limits, by design",
              "Unknown listing details stay unknown. Review what the beta supports before relying on a workflow.",
              "/features",
              "Explore the beta features",
            ],
          ].map(([t, b, href, label]) => (
            <article key={t}>
              <h3 className="font-serif text-2xl">{t}</h3>
              <p className="mt-4 leading-7 text-muted">{b}</p>
              <a href={href} className="mt-5 inline-block underline">
                {label} →
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section border-t border-line flex flex-wrap items-center justify-between gap-8">
        <div>
          <p className="eyebrow">ROOM TO TRY IT</p>
          <h2 className="mt-4 font-serif text-4xl">Seven days. No card.</h2>
          <p className="mt-4 text-muted">Explore the beta before any paid plan is available.</p>
        </div>
        <a href="/pricing" className="public-button secondary">
          See pricing & trial details →
        </a>
      </section>
      <FaqSection />
    </PublicLayout>
  );
}
