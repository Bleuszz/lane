import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
export const Route = createFileRoute("/legal/terms")({
  head: () => ({ meta: [{ title: "Lane beta terms — Lane" }] }),
  component: Page,
});
function Page() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link to="/">
        <LaneWordmark />
      </Link>
      <h1 className="mt-12 font-serif text-4xl">Lane beta terms</h1>
      <div className="mt-8 space-y-6 text-sm leading-7 text-muted">
        {[
          "Draft for owner/legal review · 11 September 2026. These terms are not yet a final customer contract. Operator identity, support contact and consumer-rights wording require approval before public launch.",
          "Lane is an independent early-beta reseller workspace. It is not owned, endorsed or operated by Vinted or eBay. You remain responsible for your marketplace accounts, listing accuracy and compliance with their rules.",
          "Vinted/eBay desktop authentication and listing discovery have passed an owner pilot. Complete Vinted item extraction, background publishing and full stock synchronisation are not represented as release-proven. Review source listings and do not rely on unknown fields.",
          "The seven-day trial costs £0, has no AI credits and requires no card. Trial dates are attached to the Lane account, not the desktop installation. No paid subscription begins automatically.",
          "Provisional monthly pricing is Starter £9, Seller £19 and Pro £29. Paid checkout stays closed until its release gate passes. No refund policy or recurring charge is created by these draft prices; mandatory consumer rights are not excluded.",
          "Windows builds are unsigned until code signing is obtained. Use only the release linked from Lane's download page and check its SHA256. You can revoke a desktop from the website and disconnect local marketplace sessions in Desktop.",
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
