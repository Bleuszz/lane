import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
import { Button, Panel } from "@/components/ui";
import { Download, Monitor, ShieldCheck, ArrowRight } from "lucide-react";
import {
  WINDOWS_BUILD,
  WINDOWS_INSTALLER_URL,
  WINDOWS_INSTALLER_BYTES,
  WINDOWS_RELEASE_NOTES,
} from "@/lib/lane/download";
export const Route = createFileRoute("/download")({ component: DownloadPage });
function DownloadPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link to="/">
          <LaneWordmark />
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/help">Help</Link>
          <Link to="/inbox">Open web app ↗</Link>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl gap-14 px-6 py-16 md:grid-cols-[1.15fr_1fr] md:py-24">
        <div>
          <p className="eyebrow">LANE DESKTOP · WINDOWS</p>
          <h1 className="mt-6 font-serif text-5xl leading-[1.04] tracking-tight md:text-6xl">
            Your marketplaces.
            <br />
            At home on
            <br />
            your computer.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-muted">
            Connect marketplaces securely from your own computer. Sign in yourself, keep your saved
            sessions local, and bring your listings into Lane.
          </p>
          <div className="mt-9">
            {WINDOWS_INSTALLER_URL ? (
              <a href={WINDOWS_INSTALLER_URL}>
                <Button size="lg">
                  <Download size={17} /> Download Lane Desktop
                </Button>
              </a>
            ) : (
              <>
                <Button size="lg" disabled>
                  <Download size={17} /> Installer release pending
                </Button>
                <p className="mt-3 max-w-sm text-xs leading-5 text-muted">
                  Version {WINDOWS_BUILD} is being verified. The public download will appear here
                  after packaging and session checks pass.
                </p>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-muted">
            Windows 10/11 · 64-bit · Version {WINDOWS_BUILD}
            {WINDOWS_INSTALLER_BYTES
              ? ` · ${(WINDOWS_INSTALLER_BYTES / 1048576).toFixed(1)} MB`
              : ""}
          </p>
          <a
            className="mt-4 inline-block text-sm underline underline-offset-4"
            href={WINDOWS_RELEASE_NOTES}
          >
            Release notes and install guide
          </a>
        </div>
        <Panel className="self-center overflow-hidden">
          <div className="bg-[#243f35] p-8 text-[#f4f2ed]">
            <Monitor size={30} strokeWidth={1.2} />
            <h2 className="mt-6 font-serif text-3xl">
              A familiar way
              <br />
              to get connected.
            </h2>
            <p className="mt-4 text-sm leading-6 opacity-80">
              Lane opens the marketplace. You sign in on its own page. No password field belongs to
              Lane.
            </p>
          </div>
          <div className="space-y-5 p-8">
            {[
              "Install Lane Desktop",
              "Sign in to your Lane account",
              "Connect Vinted or eBay",
              "Review your imported listings",
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-4 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-raised text-xs">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
            <p className="border-t border-line pt-5 text-xs leading-5 text-muted">
              Real session import is still under verification. An installed app or saved cookie
              alone does not prove an import works.
            </p>
          </div>
        </Panel>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 border-t border-line px-6 py-16 md:grid-cols-3">
        <article>
          <ShieldCheck size={23} />
          <h2 className="mt-5 text-lg font-medium">Sessions stay local</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            The new desktop transport saves cookies using Windows-protected encryption. Marketplace
            passwords, cookies and private headers are excluded from support diagnostics. Disconnect
            removes Lane’s local session copy.
          </p>
        </article>
        <article>
          <h2 className="text-lg font-medium">A normal Windows install</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Run the versioned setup file, choose an install location, then open Lane from Start. No
            Node, terminal or cookie copy/paste is needed. Initial staging testers may need to enter
            the supplied Lane website address once.
          </p>
          <p className="mt-3 text-xs leading-6 text-muted">
            MVP builds are unsigned. Windows may show an unknown-publisher warning. Verify the
            release source and checksum before deciding whether to run it.
          </p>
        </article>
        <article>
          <h2 className="text-lg font-medium">The extension is optional</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Lane Desktop opens its own marketplace windows. The existing browser extension remains a
            separate testing option; it is not required for the desktop session path. Store
            distribution comes later.
          </p>
        </article>
      </section>
      <section className="mx-auto max-w-6xl border-t border-line px-6 py-16">
        <h2 className="font-serif text-3xl">A little help getting started.</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {[
            [
              "What does my computer need?",
              "Windows 10 or 11, a 64-bit processor, an internet connection and permission to install an app for your Windows user. Keep at least 1 GB free for installation and updates.",
            ],
            [
              "What if a session expires?",
              "Open that marketplace from Lane and sign in again. Complete any CAPTCHA or verification yourself. Lane pauses when a challenge needs your attention.",
            ],
            [
              "How do updates and uninstalling work?",
              "For now, check the release notes and install the newer version. Automatic updates are not enabled. Remove Lane through Windows Settings → Apps. Disconnect marketplace sessions first if you want to clear them immediately.",
            ],
            [
              "Is my session fully protected?",
              "Encryption helps protect stored data, but it does not protect against someone already controlling your Windows account. Never install a Lane build from an untrusted source.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="border-b border-line py-4">
              <summary className="cursor-pointer text-sm font-medium">{q}</summary>
              <p className="mt-3 text-sm leading-7 text-muted">{a}</p>
            </details>
          ))}
        </div>
        <Link to="/help" className="mt-8 inline-flex items-center gap-2 text-sm">
          Visit the help centre <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
