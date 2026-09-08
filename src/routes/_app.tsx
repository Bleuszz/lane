import { createFileRoute } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "@/components/app-shell";
import { LaneWordmark } from "@/components/logo";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="min-h-screen bg-paper">
        <header className="flex h-14 items-center border-b border-line bg-surface px-5">
          <LaneWordmark />
        </header>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return <AppShell />;
}
