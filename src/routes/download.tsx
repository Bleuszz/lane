import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Panel } from "@/components/ui";
import {
  WINDOWS_BUILD,
  WINDOWS_DOWNLOAD_URL,
  WINDOWS_DOWNLOAD_VIEW_URL,
} from "@/lib/lane/download";

export const Route = createFileRoute("/download")({ component: DownloadPage });

function DownloadPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
        <Link to="/">
          <LaneWordmark />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/login" className="text-sm text-muted hover:text-ink">
            Sign in
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Windows · {WINDOWS_BUILD}</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.03em] md:text-4xl">Download Lane for Windows</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          A portable folder. Unzip it, double-click Lane.exe. The window is this website — sign in with the same
          account so inventory and shops match. Connect opens Vinted and closes when the session is captured.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={WINDOWS_DOWNLOAD_URL} rel="noreferrer">
            <Button size="lg">Download Lane-Windows.zip</Button>
          </a>
          <a href={WINDOWS_DOWNLOAD_VIEW_URL} rel="noreferrer">
            <Button size="lg" variant="secondary">
              Open in Google Drive
            </Button>
          </a>
        </div>
        <p className="mt-3 text-xs text-subtle">
          About 120 MB. If Drive asks you to sign in, use Open in Google Drive then File → Download. The file must be
          shared as “anyone with the link”.
        </p>
        <ol className="mt-10 space-y-4 text-sm text-muted">
          <li>
            <span className="font-medium text-ink">1. Unzip</span> — Lane.exe sits next to chrome DLLs. Do not run npm.
          </li>
          <li>
            <span className="font-medium text-ink">2. SmartScreen</span> — More info → Run anyway. Not code-signed.
          </li>
          <li>
            <span className="font-medium text-ink">3. Lane URL</span> — paste your live hostname. Not GitHub.
          </li>
          <li>
            <span className="font-medium text-ink">4. Sign in</span> — same email as the website.
          </li>
          <li>
            <span className="font-medium text-ink">5. Connect Vinted</span> — sign in on their site. The tab closes
            when Lane has the session.
          </li>
        </ol>
        <Panel className="mt-10 p-5">
          <h2 className="text-sm font-medium">What this build is</h2>
          <p className="mt-2 text-sm text-muted">
            Portable Chromium shell. Isolated WebView for marketplaces. HttpOnly cookies are readable here; a normal
            website tab cannot do that. Publisher: Lane (UK).
          </p>
        </Panel>
        <p className="mt-8 text-sm text-subtle">
          <Link to="/legal/privacy" className="hover:text-ink">
            Privacy
          </Link>
          {" · "}
          <Link to="/legal/terms" className="hover:text-ink">
            Terms
          </Link>
        </p>
      </section>
    </main>
  );
}
