import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Help with Lane — Lane" }] }),
  component: Page,
});
function Page() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link to="/">
        <LaneWordmark />
      </Link>
      <h1 className="mt-12 font-serif text-4xl">Help with Lane</h1>
      <div className="mt-8 space-y-6 text-sm leading-7 text-muted">
        {[
          "Lane is currently in an owner-led beta. The public support address is awaiting operator confirmation and must be published before general signup opens.",
          "For connection trouble, open Lane Desktop and copy its sanitised diagnostics. Note your app version, marketplace and failed stage. Do not include passwords, cookies or tokens.",
          "Existing pilot participants can use their established contact with the operator. Visit the help centre for setup, trials and current beta limitations.",
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
