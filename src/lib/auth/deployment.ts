import { postgresOptions } from "../postgres-options.ts";
export function deploymentPolicy(env: Record<string, string | undefined>) {
  const deployed = env.LANE_ENV === "staging" || env.LANE_ENV === "production";
  if (!deployed) return { deployed: false, origin: null };
  // Render supplies this at build and runtime. Never derive trust from request headers.
  if (!env.BETTER_AUTH_URL?.trim() && env.RENDER === "true" && env.RENDER_EXTERNAL_URL) {
    let generated: URL;
    try {
      generated = new URL(env.RENDER_EXTERNAL_URL);
    } catch {
      throw Error("Invalid Render staging origin");
    }
    if (
      generated.protocol !== "https:" ||
      !generated.hostname.endsWith(".onrender.com") ||
      generated.username ||
      generated.password ||
      generated.port ||
      generated.pathname !== "/" ||
      generated.search ||
      generated.hash
    )
      throw new Error("Invalid Render staging origin");
    env.BETTER_AUTH_URL = generated.origin;
  }
  for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"])
    if (!env[key]?.trim()) throw new Error(`Deployment requires ${key}`);
  let url: URL;
  try {
    url = new URL(env.BETTER_AUTH_URL!);
  } catch {
    throw Error("BETTER_AUTH_URL must be the exact HTTPS origin");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("BETTER_AUTH_URL must be the exact HTTPS origin");
  if (env.BETTER_AUTH_SECRET!.trim().length < 32)
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  const secret = env.BETTER_AUTH_SECRET!.trim();
  if (
    new Set(secret).size < 8 ||
    /^(change.?me|your.?secret|development|default|placeholder|example|test.?secret)/i.test(secret)
  )
    throw new Error("BETTER_AUTH_SECRET must be a generated secret, not a default or placeholder");
  postgresOptions(env.DATABASE_URL);
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    throw new Error("TLS verification cannot be disabled");
  if (env.LOG_LEVEL && !["error", "warn", "info", "silent"].includes(env.LOG_LEVEL))
    throw new Error("Invalid LOG_LEVEL");
  if (
    env.PUBLIC_INDEXING === "true" &&
    (env.LANE_ENV !== "production" || url.hostname.endsWith(".onrender.com"))
  )
    throw new Error("Public indexing requires a deliberate production custom origin");
  if (env.VITE_AUTH_ENABLED !== "true")
    throw new Error("Deployment requires VITE_AUTH_ENABLED=true");
  if (env.LANE_ALLOW_PREVIEW_PLANS === "true") throw new Error("Preview plans cannot be deployed");
  return { deployed: true, origin: url.origin };
}
