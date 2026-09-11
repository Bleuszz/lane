import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useQuery } from "@tanstack/react-query";
import type { authConfiguration } from "@/lib/auth/configuration";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LEGAL_FOOTER } from "@/lib/lane/copy";
import { LaneWordmark } from "@/components/logo";
import { Button, Field, Input } from "@/components/ui";
import { useState, type FormEvent } from "react";
import { safeReturnPath } from "@/lib/auth/return-path";

export const Route = createFileRoute("/login")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { returnTo?: string; authError?: boolean } => ({
    returnTo: safeReturnPath(search.returnTo, "/account"),
    authError: Boolean(search.authError || search.error),
  }),
  component: Login,
});

function Login() {
  const { returnTo = "/account", authError } = Route.useSearch();
  return <LoginForm returnTo={returnTo} authError={authError} />;
}
export function LoginForm({
  returnTo = "/account",
  authError = false,
  initialMode = "in",
}: {
  returnTo?: string;
  authError?: boolean;
  initialMode?: "in" | "up";
}) {
  const config = useQuery({
    queryKey: ["auth-configuration"],
    queryFn: async () => {
      const response = await fetch("/api/auth/configuration", {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Sign-in options could not be loaded. Retry.");
      return response.json() as Promise<ReturnType<typeof authConfiguration>>;
    },
    retry: false,
  });
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(
    authError ? "The provider did not complete sign-in. Retry or use email sign-in." : null,
  );
  const [busy, setBusy] = useState(false);

  if (isPending)
    return <main className="min-h-screen bg-paper p-8 text-ink">Checking your Lane session…</main>;
  if (user) return <Navigate to={returnTo} />;

  async function social(providerId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(providerId, {
        callbackURL: returnTo,
        errorCallbackURL: "/login?authError=1&returnTo=" + encodeURIComponent(returnTo),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Retry or use email.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "Seller",
          callbackURL: returnTo,
        });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.signIn.email({ email, password, callbackURL: returnTo });
        if (res.error) throw new Error(res.error.message);
      }
      window.location.href = returnTo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-5xl md:grid-cols-2">
        <section className="hidden flex-col justify-between border-r border-line p-10 md:flex">
          <LaneWordmark />
          <div>
            <h1 className="max-w-sm text-3xl font-medium tracking-[-0.03em] leading-tight">
              Your Lane account. At your desk and on the web.
            </h1>
            <p className="mt-4 max-w-sm text-sm text-muted leading-relaxed">
              One account for your trial, devices and workspace. Connect Vinted and eBay separately
              in Lane Desktop; their saved marketplace sessions stay on your computer.
            </p>
          </div>
          <p className="max-w-sm text-[11px] leading-relaxed text-subtle">{LEGAL_FOOTER}</p>
        </section>
        <section className="flex flex-col justify-center px-6 py-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 md:hidden">
              <LaneWordmark />
            </div>
            <h2 className="text-xl font-medium tracking-[-0.02em]">
              {mode === "in" ? "Sign in" : "Create account"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              7 days free. No card required. No AI credits needed.
            </p>

            {authEnabled ? (
              <>
                <form className="mt-6 space-y-3" onSubmit={(e) => void submit(e)}>
                  {mode === "up" ? (
                    <Field label="Name">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                      />
                    </Field>
                  ) : null}
                  <Field label="Email">
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Password">
                    <Input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "up" ? "new-password" : "current-password"}
                    />
                  </Field>
                  {error ? (
                    <p role="alert" className="text-sm text-danger">
                      {error}
                    </p>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
                  </Button>
                </form>
                {mode === "in" && (
                  <Link to="/forgot-password" className="mt-4 block text-sm underline">
                    Forgot password?
                  </Link>
                )}
                <button
                  type="button"
                  className="mt-3 text-sm text-muted hover:text-ink"
                  onClick={() => setMode(mode === "in" ? "up" : "in")}
                >
                  {mode === "in"
                    ? "Need an account? Create one"
                    : "Already have an account? Sign in"}
                </button>
                <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-subtle">
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="space-y-2">
                  {config.isPending && (
                    <p className="text-sm text-muted">Loading sign-in options…</p>
                  )}
                  {config.isError && (
                    <p role="alert" className="text-sm text-danger">
                      Sign-in options could not be loaded.{" "}
                      <button onClick={() => void config.refetch()} className="underline">
                        Retry
                      </button>
                    </p>
                  )}
                  {config.data?.providers
                    .filter((p) => p.available)
                    .map((p) => (
                      <div key={p.providerId}>
                        <Button
                          key={p.providerId}
                          variant="secondary"
                          className="w-full"
                          disabled={busy || !p.available}
                          onClick={() => void social(p.providerId)}
                        >
                          Continue with {p.label}
                        </Button>
                        {!p.available && <p className="mt-1 text-xs text-muted">{p.reason}</p>}
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
            )}
            <p className="mt-8 text-sm text-muted">
              <Link to="/" className="underline-offset-4 hover:underline">
                Back
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
