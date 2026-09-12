import { useEffect, useState } from "react";
import { measure } from "@/lib/lane/measurement";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAccountOverview } from "@/lib/lane/server/account-fns";
import { listDesktopDevices } from "@/lib/lane/server/desktop-fns";
import { signOut } from "@/lib/auth/client";
export const Route = createFileRoute("/_app/account")({
  head: () => ({
    meta: [{ title: "Your Lane account" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Account,
});
function Account() {
  const [created, setCreated] = useState(false);
  const logout = useMutation({ mutationFn: () => signOut("/login") });
  const account = useQuery({ queryKey: ["account-overview"], queryFn: () => getAccountOverview() });
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => listDesktopDevices() });
  useEffect(() => {
    if (account.data)
      try {
        if (sessionStorage.getItem("lane-signup-complete") === "yes") {
          sessionStorage.removeItem("lane-signup-complete");
          setCreated(true);
          if (account.data.trialStatus === "active") measure("trial_started");
        }
      } catch {}
  }, [account.data]);
  if (account.isPending) return <main aria-busy="true">Loading your account…</main>;
  if (account.isError)
    return (
      <main role="alert">
        Your account could not be loaded.{" "}
        <button onClick={() => void account.refetch()}>Retry</button>
      </main>
    );
  const a = account.data;
  return (
    <main className="mx-auto max-w-4xl space-y-10">
      {created && (
        <p role="status" className="rounded border border-line bg-raised p-4">
          Your Lane account is ready. Your seven-day trial has started — no card, no automatic
          charge.
        </p>
      )}
      <div>
        <p className="eyebrow">YOUR LANE WORKSPACE</p>
        <h1 className="mt-3 font-serif text-4xl">Welcome back.</h1>
        <p className="mt-3 text-muted">One account, wherever you work.</p>
      </div>
      <section className="grid gap-8 border-y border-line py-8 sm:grid-cols-3">
        <div>
          <h2 className="text-sm text-muted">Your trial</h2>
          <p className="mt-2 text-xl capitalize">{a.trialStatus}</p>
          <p className="mt-2 text-sm">
            {a.trialEndsAt
              ? `${a.trialStatus === "ended" ? "Ended" : "Ends"} ${new Date(a.trialEndsAt).toLocaleDateString("en-GB")}`
              : "Starts with account onboarding"}
          </p>
          <p className="mt-2 text-xs text-muted">No card required · 0 trial AI credits</p>
        </div>
        <div>
          <h2 className="text-sm text-muted">Plan</h2>
          <p className="mt-2 text-xl capitalize">{a.plan}</p>
          <p className="mt-2 text-sm text-muted">Paid checkout is not open during beta.</p>
        </div>
        <div>
          <h2 className="text-sm text-muted">Cloud inventory</h2>
          <p className="mt-2 text-xl">
            {a.inventoryCount} {a.inventoryCount === 1 ? "item" : "items"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Desktop discoveries are separate until imported and synced.
          </p>
        </div>
      </section>
      <section>
        <h2 className="font-serif text-2xl">Your desktop, connected.</h2>
        <p className="mt-3 text-muted">
          {devices.isError
            ? "Device status unavailable."
            : `${devices.data?.filter((d) => !d.revoked_at).length ?? 0} paired devices`}
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link to="/devices" className="rounded-full bg-mark px-6 py-3 text-mark-fg">
            Manage devices
          </Link>
          <Link to="/download" className="rounded-full border border-line-strong px-6 py-3">
            Download Lane Desktop
          </Link>
        </div>
        <p className="mt-5 max-w-xl text-sm text-muted">
          Sign in to Lane from Desktop using this same account. Marketplace passwords and browser
          sessions belong to your local marketplace connections.
        </p>
      </section>
      <button
        className="text-sm underline"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        Sign out of Lane
      </button>
      {logout.isError && <p role="alert">Sign-out could not be confirmed. Please retry.</p>}
    </main>
  );
}
