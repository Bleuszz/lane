import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout, PageIntro, StartLink } from "@/components/public-layout";
import { publicHead } from "@/lib/lane/public-site";
export const Route = createFileRoute("/features")({
  head: () => publicHead("/features"),
  component: Features,
});
function Features() {
  return (
    <PublicLayout>
      <PageIntro eyebrow="THE LANE WORKSPACE" title="One place to prepare. Clear steps to sell.">
        <p>
          A crosslisting workspace built around your own accounts, reusable stock information and a
          review before the next step. Here’s exactly where the beta stands.
        </p>
      </PageIntro>
      <section className="public-section !pt-0 grid gap-6 md:grid-cols-2">
        {[
          [
            "Available in the beta",
            "One Lane identity",
            "Your web account, trial and approved desktop devices belong together. Revoke a desktop without creating another account.",
          ],
          [
            "Owner pilot verified",
            "Vinted + eBay connections",
            "Sign into marketplaces yourself in Lane Desktop. Account recognition and owned listing discovery have passed the owner pilot.",
          ],
          [
            "Still being verified",
            "Complete listing information",
            "Finding a listing is different from importing all its details. Some Vinted rows still show Title unknown; full photos and attributes are the next milestone.",
          ],
          [
            "Still being verified",
            "Prepare, review, then publish",
            "Reliable crosslisting and publishing are release gates. Do not depend on background publishing, automatic delisting or sold-stock sync yet.",
          ],
          [
            "Architecture in place",
            "Inventory that belongs to you",
            "The account data structure keeps stock ownership separate from marketplace connections. End-to-end cloud inventory sync remains a release check.",
          ],
          [
            "Planned, optional",
            "Assistance without invented facts",
            "AI field assistance and image tools are planned. They are not required for the trial, and unknown item information must stay unknown.",
          ],
        ].map(([state, title, body]) => (
          <article className="public-card" key={title}>
            <p className="eyebrow">{state}</p>
            <h2 className="mt-4 font-serif text-3xl">{title}</h2>
            <p className="mt-4 text-muted leading-7">{body}</p>
          </article>
        ))}
      </section>
      <section className="public-section border-t border-line">
        <h2 className="font-serif text-4xl">A useful beta starts with honest limits.</h2>
        <p className="public-lead">
          Explore the account experience now. Follow the{" "}
          <a href="/how-it-works" className="underline">
            setup walkthrough
          </a>{" "}
          and check{" "}
          <a href="/download" className="underline">
            release availability
          </a>{" "}
          before planning your desktop workflow.
        </p>
        <StartLink />
      </section>
    </PublicLayout>
  );
}
