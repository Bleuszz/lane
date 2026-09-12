import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageIntro, StartLink } from "@/components/public-layout";
import { publicHead } from "@/lib/lane/public-site";
export const Route = createFileRoute("/how-it-works")({
  head: () => publicHead("/how-it-works"),
  component: How,
});
function How() {
  return (
    <PublicLayout>
      <PageIntro
        eyebrow="FROM ACCOUNT TO WORKROOM"
        title="Your shops. Your sign-in. One Lane account."
      >
        <p>
          Lane on the web manages your account. Lane Desktop connects to marketplaces from your own
          computer. They share your Lane identity, not your marketplace passwords.
        </p>
      </PageIntro>
      <section className="public-section !pt-0 max-w-4xl">
        {[
          [
            "01",
            "Create your Lane account",
            "Use email and password. Google appears only when properly configured. Opening your account starts a seven-day, no-card trial with zero AI credits.",
            "/signup",
            "Create an account",
          ],
          [
            "02",
            "Install the verified Windows release",
            "Check the download page for availability, version and checksum. The public release is pending staging verification; you do not need Node, npm or a terminal.",
            "/download",
            "Check Windows release availability",
          ],
          [
            "03",
            "Approve your desktop",
            "Choose Sign in to Lane in Desktop. Your browser opens the Lane website. Sign in to the same account, compare the device code and approve only the connection you started.",
            "/devices",
            "Manage desktop devices",
          ],
          [
            "04",
            "Connect Vinted or eBay",
            "Sign in directly in the marketplace window and complete any MFA or CAPTCHA yourself. Lane validates the account and uses its local authorised session.",
            "/security",
            "Understand local session security",
          ],
          [
            "05",
            "Review what Lane finds",
            "Owned listing discovery works in the owner pilot. Full Vinted details and reliable publishing remain unverified. Review data in the beta and continue managing sales on the marketplaces.",
            "/features",
            "Read the current beta capabilities",
          ],
        ].map(([n, t, b, href, label]) => (
          <article className="workflow-step" key={n}>
            <span className="font-serif text-4xl text-mark" aria-hidden="true">
              {n}
            </span>
            <div>
              <h2 className="font-serif text-3xl">{t}</h2>
              <p className="mt-4 leading-7 text-muted">{b}</p>
              <a href={href} className="mt-4 inline-block underline">
                {label} →
              </a>
            </div>
          </article>
        ))}
      </section>
      <section className="public-section border-t border-line">
        <h2 className="font-serif text-4xl">Start with your own account.</h2>
        <p className="public-lead">No marketplace password sharing. No automatic charge.</p>
        <StartLink />
      </section>
    </PublicLayout>
  );
}
