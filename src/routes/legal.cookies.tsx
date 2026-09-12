import { publicHead } from "@/lib/lane/public-site";
import { PublicLayout } from "@/components/public-layout";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
export const Route = createFileRoute("/legal/cookies")({
  head: () => publicHead("/legal/cookies"),
  component: Page,
});
function Page() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mt-12 font-serif text-4xl">Cookies and local storage</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted">
          {[
            "Lane uses essential authentication cookies to keep you signed in and protect sign-in flows. Hosted session cookies are Secure, HttpOnly and SameSite=Lax. A local theme preference may also be stored in your browser.",
            "Optional first-party measurement is off by default. If enabled, you can allow or decline aggregate action counts and change that choice at any time. The consent choice is stored locally; event payloads contain only an approved event name, never account IDs, URLs, referrers or listing data. Do Not Track and Global Privacy Control suppress these counts. No advertising pixels are included.",
            "Marketplace websites have their own cookies and notices. Their authorised browser sessions stay in Lane Desktop's isolated local session storage. Signing out of Lane and disconnecting a marketplace are different actions.",
            "This notice must be reviewed against the final deployed site, including any hosting or email-provider additions, before public launch.",
          ].map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <nav className="mt-12 flex gap-6 text-sm">
          <Link to="/help">Help centre</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </section>
    </PublicLayout>
  );
}
