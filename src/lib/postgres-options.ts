import type { PoolConfig } from "pg";

/** One TLS/pool contract for auth, application SQL, migration and verification. */
export function postgresOptions(value: string | undefined, max = 5): PoolConfig {
  if (!value?.trim()) throw new Error("DATABASE_URL is required");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.hash
  )
    throw new Error("DATABASE_URL must identify a PostgreSQL host and database");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // These parameters can override the validated host or read client-side files.
  for (const key of [
    "host",
    "port",
    "user",
    "password",
    "database",
    "sslcert",
    "sslkey",
    "sslrootcert",
  ])
    if (url.searchParams.has(key))
      throw new Error("DATABASE_URL contains unsupported connection overrides");
  if (!local) {
    const mode = url.searchParams.get("sslmode");
    if (mode && !["require", "verify-ca", "verify-full"].includes(mode))
      throw new Error("Remote PostgreSQL requires verified TLS");
    url.searchParams.set("sslmode", "verify-full");
    url.searchParams.delete("uselibpqcompat");
  }
  return {
    connectionString: url.href,
    max,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
    query_timeout: 35000,
    ...(local ? {} : { ssl: { rejectUnauthorized: true }, enableChannelBinding: true }),
  };
}
