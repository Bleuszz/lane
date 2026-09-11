import { createFileRoute, Link, Navigate, useRouteContext } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LEGAL_FOOTER } from "@/lib/lane/copy";
import { LaneWordmark } from "@/components/logo";
import { Button, Field, Input } from "@/components/ui";
import { useState, type FormEvent } from "react";
import { safeReturnPath } from "@/lib/auth/return-path";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({ returnTo: safeReturnPath(search.returnTo) }),
  component: Login,
});

function Login() {
  const { returnTo = "/onboarding" } = Route.useSearch();
  const { sessionUser } = useRouteContext({ from: "__root__" });
  const { user } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user || sessionUser) return <Navigate to={returnTo} />;

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
              One inventory record. Every channel listing hangs off it.
            </h1>
            <p className="mt-4 max-w-sm text-sm text-muted leading-relaxed">
              When it sells, the others come down. Vinted through your browser. eBay through official OAuth. Passwords never leave the marketplace.
            </p>
          </div>
          <p className="max-w-sm text-[11px] leading-relaxed text-subtle">{LEGAL_FOOTER}</p>
        </section>
        <section className="flex flex-col justify-center px-6 py-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 md:hidden">
              <LaneWordmark />
            </div>
            <h2 className="text-xl font-medium tracking-[-0.02em]">{mode === "in" ? "Sign in" : "Create account"}</h2>
            <p className="mt-1 text-sm text-muted">UK resellers. GBP. No marketplace passwords.</p>

            {authEnabled ? (
              <>
                <form className="mt-6 space-y-3" onSubmit={(e) => void submit(e)}>
                  {mode === "up" ? (
                    <Field label="Name">
                      <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </Field>
                  ) : null}
                  <Field label="Email">
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </Field>
                  <Field label="Password">
                    <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} />
                  </Field>
                  {error ? <p className="text-sm text-danger">{error}</p> : null}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
                  </Button>
                </form>
                <button
                  type="button"
                  className="mt-3 text-sm text-muted hover:text-ink"
                  onClick={() => setMode(mode === "in" ? "up" : "in")}
                >
                  {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
                </button>
                <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-subtle">
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="space-y-2">
                  {GROK_PROVIDERS.map((p) => (
                    <Button
                      key={p.providerId}
                      variant="secondary"
                      className="w-full"
                      onClick={() => void signIn(p.providerId, { callbackURL: returnTo })}
                    >
                      Continue with {p.label}
                    </Button>
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
