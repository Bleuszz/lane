import { publicHead } from "@/lib/lane/public-site";
import { PublicLayout } from "@/components/public-layout";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
export const Route = createFileRoute("/security")({
  head: () => publicHead("/security"),
  component: Page,
});
function Page() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mt-12 font-serif text-4xl">Separate accounts. Clear boundaries.</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted">
          {[
            "Your Lane account is shared between web and desktop. Desktop opens the website for sign-in and device approval; it does not keep a separate password database.",
            "Device approvals expire, require the desktop's verifier, and can be consumed once. Device tokens are stored as hashes on the server; access expires after 15 minutes and the device can renew access until its 30-day authorisation expires or is revoked.",
            "Marketplace sessions are isolated per local profile. Windows-protected encryption protects saved cookies at rest. This does not protect against someone already controlling your Windows account. Never share passwords, cookies, tokens or private headers in support diagnostics.",
            "Only safe device health metadata is sent to the account dashboard. Marketplace MFA, CAPTCHA and expired sessions require your own interaction. Lane does not bypass them.",
            "The software has not undergone an independent security audit. Report concerns through the verified support channel once it is published; public launch is pending operator contact details.",
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
