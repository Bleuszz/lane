import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
export const Route = createFileRoute("/legal/cookies")({
  head: () => ({ meta: [{ title: "Cookies and local storage — Lane" }] }),
  component: Page,
});
function Page() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link to="/">
        <LaneWordmark />
      </Link>
      <h1 className="mt-12 font-serif text-4xl">Cookies and local storage</h1>
      <div className="mt-8 space-y-6 text-sm leading-7 text-muted">
        {[
          "Lane uses essential authentication cookies to keep you signed in and protect sign-in flows. Hosted session cookies are Secure, HttpOnly and SameSite=Lax. A local theme preference may also be stored in your browser.",
          "The current release does not add advertising or optional analytics cookies. Any later non-essential tracking will need its own consent controls before activation.",
          "Marketplace websites have their own cookies and notices. Their authorised browser sessions stay in Lane Desktop's isolated local session storage. Signing out of Lane and disconnecting a marketplace are different actions.",
          "This notice must be reviewed against the final deployed site, including any hosting or email-provider additions, before public launch.",
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
