import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";

export const Route = createFileRoute("/legal/privacy")({ component: Privacy });

function Privacy() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-10 text-sm leading-relaxed text-muted">
      <Link to="/">
        <LaneWordmark />
      </Link>
      <h1 className="mt-8 text-2xl font-medium text-ink">Privacy</h1>
      <p className="mt-2 text-xs">Last updated 9 September 2026. This is an operational notice, not legal advice.</p>
      <h2 className="mt-6 text-sm font-medium text-ink">What Lane stores</h2>
      <p className="mt-2">
        Email, name, plan, inventory you create or import, job logs, and marketplace session tokens you choose to
        connect (eBay OAuth tokens; Vinted access/refresh tokens captured by the Windows app or Lane Bridge). Tokens
        are encrypted at rest with a server secret.
      </p>
      <h2 className="mt-6 text-sm font-medium text-ink">What Lane does not store</h2>
      <p className="mt-2">Marketplace passwords. We never ask for them.</p>
      <h2 className="mt-6 text-sm font-medium text-ink">Processors</h2>
      <p className="mt-2">
        Hosting and database (Cloudflare / Neon when configured), authentication (Better Auth; optional Google/X via
        the Grok broker), payments (Stripe when keys are set). Each has their own terms.
      </p>
      <h2 className="mt-6 text-sm font-medium text-ink">Your rights</h2>
      <p className="mt-2">
        UK GDPR applies if we process personal data of UK residents. Email the operator to export or delete your
        account. Deleting an account does not unsell items already listed on marketplaces.
      </p>
      <p className="mt-8">
        <Link to="/legal/terms" className="text-ink hover:underline">
          Terms
        </Link>
      </p>
    </main>
  );
}
