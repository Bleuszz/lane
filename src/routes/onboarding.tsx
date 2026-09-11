import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { completeOnboarding, getBootstrap } from "@/lib/lane/server/fns";
import { LaneWordmark } from "@/components/logo";
import { Button, Panel } from "@/components/ui";
export const Route = createFileRoute("/onboarding")({ component: Onboarding });
function Onboarding() {
  const { user, isPending } = useCurrentUserState(),
    qc = useQueryClient();
  const boot = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => getBootstrap(),
    enabled: Boolean(user),
    retry: false,
  });
  const finish = useMutation({
    mutationFn: () => completeOnboarding(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bootstrap"] }),
  });
  if (isPending) return <main className="p-8">Checking your Lane account…</main>;
  if (!user) return <RedirectToSignIn />;
  if (boot.data?.settings.onboardingComplete) return <Navigate to="/inbox" />;
  return (
    <main className="min-h-screen bg-paper px-6 py-8 text-ink">
      <div className="mx-auto max-w-xl space-y-6">
        <LaneWordmark />
        <h1 className="font-serif text-3xl">Your shops, connected to Lane.</h1>
        <p className="text-sm text-muted">
          Your Lane account is ready. Use Lane Desktop to sign in to your marketplaces and keep
          their sessions on your computer.
        </p>
        <Panel className="space-y-3 p-5">
          <h2 className="font-medium">1. Install Lane Desktop</h2>
          <p className="text-sm text-muted">
            Download the Windows installer, open Lane and sign in to this Lane account. Check the
            matching code before approving your computer.
          </p>
          <Link to="/download" className="inline-block text-sm underline">
            Download and installation guide
          </Link>
        </Panel>
        <Panel className="space-y-3 p-5">
          <h2 className="font-medium">2. Connect your marketplaces</h2>
          <p className="text-sm text-muted">
            Choose Connect Vinted or Connect eBay in Desktop. Sign in normally. Lane checks your
            account before it shows Connected and closes the login window. Verification steps always
            remain under your control.
          </p>
          <Link to="/devices" className="inline-block text-sm underline">
            Your devices and connection health
          </Link>
        </Panel>
        <Panel className="space-y-3 p-5">
          <h2 className="font-medium">3. Refresh and review in Lane</h2>
          <p className="text-sm text-muted">
            Refresh listings from Desktop and review the fields and photos it reads. If your session
            expires, Lane asks you to reconnect. Desktop-to-cloud inventory import is still being
            completed.
          </p>
          <Link to="/settings/channels" className="inline-block text-sm underline">
            Account settings and official eBay connection
          </Link>
        </Panel>
        {boot.isError && (
          <p role="alert">
            Your account setup could not be loaded.{" "}
            <button className="underline" onClick={() => void boot.refetch()}>
              Retry
            </button>
          </p>
        )}
        {finish.isError && <p role="alert">Setup could not be saved. Try again.</p>}
        <Button
          disabled={finish.isPending || boot.isPending || boot.isError}
          onClick={() => finish.mutate()}
        >
          {finish.isPending ? "Saving…" : "Open Lane workspace"}
        </Button>
        <p className="text-xs text-muted">
          You can connect your shops later. Creating a Lane account does not mark a marketplace as
          connected.
        </p>
      </div>
    </main>
  );
}
