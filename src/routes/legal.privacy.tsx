import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
export const Route = createFileRoute("/legal/privacy")({
  head: () => ({ meta: [{ title: "Privacy at Lane — Lane" }] }),
  component: Page,
});
function Page() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link to="/">
        <LaneWordmark />
      </Link>
      <h1 className="mt-12 font-serif text-4xl">Privacy at Lane</h1>
      <div className="mt-8 space-y-6 text-sm leading-7 text-muted">
        {[
          "Draft for owner/legal review · 11 September 2026. The operator's legal identity, contact address and retention schedule must be confirmed before public launch.",
          "Lane stores your account name/email, protected password credentials through Better Auth, sessions, trial/plan dates, device authorisations and inventory you choose to save to its cloud workspace. Device health contains limited connection status and version metadata.",
          "Vinted and eBay browser cookies in the current Desktop session flow are kept locally under Windows-protected encryption. Lane account device tokens are separate. Marketplace passwords are entered directly on the marketplace; raw browser sessions are not uploaded for cloud job execution.",
          "The proposed hosting processors are Render and Neon in an EU region; optional transactional email and Google sign-in require separate configuration. No paid billing, marketing pixels or analytics service is enabled for this launch checkpoint.",
          "Account access and service delivery require processing account data; security diagnostics support protecting the service. The operator must confirm the applicable lawful bases, retention periods, international-transfer arrangements and any legal obligations before launch.",
          "You may request access, correction or deletion and raise a complaint with the ICO. The operator's verified support channel must be published before this draft becomes the live notice. Removing Lane does not delete your marketplace account or cancel marketplace listings.",
        ].map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <nav className="mt-12 flex gap-6 text-sm">
        <Link to="/help">Help centre</Link>
        <Link to="/legal/privacy">Privacy</Link>
        <Link to="/legal/terms">Terms</Link>
      </nav>
    </main>
  );
}
