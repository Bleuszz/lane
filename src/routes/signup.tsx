import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "./login";
import { safeReturnPath } from "@/lib/auth/return-path";
export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturnPath(s.returnTo, "/account"),
  }),
  head: () => ({ meta: [{ title: "Create your Lane account — 7 days free" }] }),
  component: Signup,
});
function Signup() {
  const { returnTo } = Route.useSearch();
  return <LoginForm initialMode="up" returnTo={returnTo || "/account"} />;
}
