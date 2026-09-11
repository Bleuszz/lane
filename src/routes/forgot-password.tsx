import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
export const Route = createFileRoute("/forgot-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset your password — Lane" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Reset,
});
function Reset() {
  const { token } = Route.useSearch();
  const [value, setValue] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const config = useQuery({
    queryKey: ["auth-configuration"],
    queryFn: async () => {
      const r = await fetch("/api/auth/configuration");
      if (!r.ok) throw Error("Unavailable");
      return r.json() as Promise<{ passwordResetAvailable: boolean }>;
    },
  });
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <Link to="/login">← Sign in to Lane</Link>
      <h1 className="mt-10 font-serif text-4xl">
        {token ? "Choose a new password" : "Forgot your password?"}
      </h1>
      {config.isPending ? (
        <p className="mt-6">Checking email availability…</p>
      ) : !config.data?.passwordResetAvailable ? (
        <p className="mt-6">
          Password recovery email is not configured on this beta server yet. It must be enabled
          before public account launch.
        </p>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = token
                ? await authClient.resetPassword({ token, newPassword: value })
                : await authClient.requestPasswordReset({
                    email: value,
                    redirectTo: window.location.origin + "/forgot-password",
                  });
              if (r.error) throw Error("Reset failed");
              setMessage(
                token
                  ? "Password changed. You can now sign in."
                  : "If an eligible account exists, a reset email will arrive shortly.",
              );
            } catch {
              setMessage("The request could not be completed. Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm">
            {token ? "New password" : "Email"}
            <input
              className="mt-2 w-full rounded border border-line bg-surface p-3"
              type={token ? "password" : "email"}
              autoComplete={token ? "new-password" : "email"}
              minLength={token ? 8 : undefined}
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <button disabled={busy} className="rounded-full bg-mark px-6 py-3 text-mark-fg">
            {busy ? "Please wait…" : token ? "Change password" : "Send reset link"}
          </button>
          <p role="status">{message}</p>
        </form>
      )}
    </main>
  );
}
