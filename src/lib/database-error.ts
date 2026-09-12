/** Preserve machine-readable SQLSTATE for conflict handling, never SQL/detail/connection data. */
export function databaseError(error: unknown) {
  const safe = new Error("Database operation unavailable. Please try again.") as Error & {
    code?: string;
  };
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "string" && /^[A-Z0-9]{5}$/.test(code)) safe.code = code;
  return safe;
}
