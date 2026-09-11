export function deploymentPolicy(env: Record<string, string | undefined>) {
  const deployed = env.LANE_ENV === "staging" || env.LANE_ENV === "production";
  if (!deployed) return { deployed: false, origin: null };
  for (const key of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"])
    if (!env[key]?.trim()) throw new Error(`Deployment requires ${key}`);
  const url = new URL(env.BETTER_AUTH_URL!);
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
  if (env.VITE_AUTH_ENABLED !== "true")
    throw new Error("Deployment requires VITE_AUTH_ENABLED=true");
  if (env.LANE_ALLOW_PREVIEW_PLANS === "true") throw new Error("Preview plans cannot be deployed");
  return { deployed: true, origin: url.origin };
}
