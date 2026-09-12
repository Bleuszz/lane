import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageIntro, StartLink, FaqSection } from "@/components/public-layout";
import { publicHead } from "@/lib/lane/public-site";
export const Route = createFileRoute("/pricing")({
  head: () => publicHead("/pricing"),
  component: Pricing,
});
function Pricing() {
  return (
    <PublicLayout>
      <PageIntro eyebrow="NO CARD. NO AUTOMATIC CHARGE." title="Try the workroom. Take your time.">
        <p>
          Seven days to explore Lane’s beta account experience. Paid plans are provisional: checkout
          stays closed until billing and product release checks pass.
        </p>
      </PageIntro>
      <section className="public-section !pt-0">
        <article className="trial-card">
          <div>
            <p className="eyebrow">7-DAY FREE TRIAL</p>
            <h2 className="mt-3 font-serif text-5xl">£0</h2>
            <p className="mt-4 leading-7">
              One account · Desktop device approval · 0 AI credits
              <br />
              Trial dates are stored on the server. Reinstalling does not restart them.
            </p>
          </div>
          <StartLink />
        </article>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            ["Starter", "9", "Planned standard workflow without AI credits."],
            [
              "Seller",
              "19",
              "Planned optional AI allowance. Final credits and limits will be published before purchase.",
            ],
            [
              "Pro",
              "29",
              "Planned higher-volume workflow. Final limits and features are not yet released.",
            ],
          ].map(([name, price, detail]) => (
            <article key={name} className="public-card">
              <p className="eyebrow">PLANNED MONTHLY PLAN</p>
              <h2 className="mt-4 font-serif text-3xl">{name}</h2>
              <p className="mt-5 text-4xl">
                £{price}
                <span className="text-sm text-muted"> / month</span>
              </p>
              <p className="mt-5 min-h-24 text-sm leading-7 text-muted">{detail}</p>
              <p className="mt-6 border-t border-line pt-4 text-sm">Checkout not open</p>
            </article>
          ))}
        </div>
        <p className="mt-7 text-sm leading-7 text-muted">
          No payment details are collected for the trial. No automatic renewal or charge. Final
          inclusions and any applicable tax will be shown before paid checkout opens. Trial expiry
          does not delete your inventory.
        </p>
      </section>
      <FaqSection />
    </PublicLayout>
  );
}
