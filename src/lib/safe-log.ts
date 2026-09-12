import { randomUUID } from "node:crypto";
type Level = "error" | "warn" | "info";
const levels = { error: 0, warn: 1, info: 2 };
export function requestId() {
  return randomUUID();
}
/** Allowlisted fields only; never serialize Error, request, header, URL or arbitrary context. */
export function safeLog(
  code: string,
  level: Level = "error",
  data: { requestId?: string; category?: string; status?: number; latencyMs?: number } = {},
) {
  const configured = process.env.LOG_LEVEL ?? "warn";
  if (configured === "silent" || levels[level] > (levels[configured as Level] ?? 1)) return;
  const safe = (v: string | undefined) => (v && /^[a-zA-Z0-9_-]{1,80}$/.test(v) ? v : undefined);
  console[level](
    JSON.stringify({
      at: new Date().toISOString(),
      level,
      code: safe(code) ?? "INTERNAL_ERROR",
      requestId: safe(data.requestId),
      category: safe(data.category),
      status: data.status,
      latencyMs: data.latencyMs,
    }),
  );
}
export function safeRequestCategory(path: string) {
  if (path.startsWith("/api/auth/")) return "auth";
  if (path.startsWith("/api/desktop/")) return "desktop";
  if (path.startsWith("/_serverFn/")) return "server_function";
  if (path.startsWith("/api/")) return "api";
  return "page";
}
