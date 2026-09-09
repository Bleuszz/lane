import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";

export const Route = createFileRoute("/legal/terms")({ component: Terms });

function Terms() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 text-sm leading-relaxed text-muted">
      <Link to="/">
        <LaneWordmark />
      </Link>
      <h1 className="mt-8 text-2xl font-medium text-ink">Terms</h1>
      <p className="mt-2 text-xs">Last updated 9 September 2026. Draft for operators — have a solicitor review before taking payment.</p>
      <p className="mt-4">
        Lane is a UK reseller tool. You keep one inventory. Lane lists it on channels you connect. You are the seller
        of record on every marketplace. You must follow that marketplace’s terms. Automation can get accounts limited
        or banned. We cap rates; we cannot eliminate the risk.
      </p>
      <p className="mt-4">
        Starter is £12 / month after a 7-day trial once Stripe is live. Refunds: 3 days if you have made fewer than 20
        live publishes, once billing is configured. Until Stripe keys exist, plan switches only change action caps.
      </p>
      <p className="mt-4">
        The Windows app is unsigned. SmartScreen will warn. You run it at your own risk on your PC.
      </p>
      <p className="mt-8">
        <Link to="/legal/privacy" className="text-ink hover:underline">
          Privacy
        </Link>
      </p>
    </main>
  );
}
