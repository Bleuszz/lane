import type { ReactNode } from "react";
import { LaneWordmark } from "./logo";
import { FAQ } from "@/lib/lane/public-site";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing min-h-screen bg-paper text-ink">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="public-header">
        <a href="/" aria-label="Lane home">
          <LaneWordmark />
        </a>
        <nav aria-label="Main navigation" className="public-nav">
          <a href="/features">Features</a>
          <a href="/pricing">Pricing</a>
          <a href="/how-it-works">How it works</a>
          <a href="/login" className="public-signin">
            Sign in ↗
          </a>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="public-footer">
        <div>
          <a href="/" aria-label="Lane home">
            <LaneWordmark />
          </a>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            A little more room for the work behind reselling.
            <br />
            Independent of Vinted and eBay. Windows beta.
          </p>
        </div>
        <nav aria-label="Explore Lane">
          <h2>Explore</h2>
          <a href="/features">Features</a>
          <a href="/pricing">Pricing & trial</a>
          <a href="/how-it-works">How it works</a>
          <a href="/download">Download for Windows</a>
          <a href="/account">Your account</a>
        </nav>
        <nav aria-label="Help and trust">
          <h2>Help & trust</h2>
          <a href="/help">Help centre</a>
          <a href="/contact">Contact</a>
          <a href="/security">Security</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/legal/cookies">Cookies & measurement</a>
        </nav>
      </footer>
    </div>
  );
}
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="public-section public-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="public-lead">{children}</div>
    </section>
  );
}
export function StartLink({ children = "Start free for 7 days" }: { children?: ReactNode }) {
  return (
    <a href="/signup" className="public-button" data-lane-event="signup_started">
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
export function FaqSection() {
  return (
    <section className="public-section border-t border-line">
      <p className="eyebrow">BEFORE YOU START</p>
      <h2 className="mt-4 font-serif text-4xl">Good questions. Clear answers.</h2>
      <div className="mt-8 max-w-3xl">
        {FAQ.map(([q, a]) => (
          <details key={q} className="border-b border-line py-5">
            <summary className="cursor-pointer font-medium">{q}</summary>
            <p className="mt-4 text-muted leading-7">{a}</p>
          </details>
        ))}
      </div>
      <a href="/help" className="mt-8 inline-block underline">
        Visit the Lane help centre
      </a>
    </section>
  );
}
export function PublicNotFound() {
  return (
    <PublicLayout>
      <PageIntro eyebrow="404 · PAGE NOT FOUND" title="This one has moved on.">
        <p>
          The page may have moved, or the address may be incomplete. Let’s get you back to your
          workroom.
        </p>
      </PageIntro>
      <div className="public-section !pt-0 flex flex-wrap gap-4">
        <a className="public-button" href="/">
          Back to Lane
        </a>
        <a className="public-button secondary" href="/help">
          Help centre
        </a>
        <a className="public-button secondary" href="/account">
          Your account
        </a>
      </div>
    </PublicLayout>
  );
}
