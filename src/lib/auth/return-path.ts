/** Keep post-login navigation inside Lane, including desktop pairing parameters. */
export function safeReturnPath(value: unknown, fallback = "/onboarding"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  const url = new URL(value, "https://lane.invalid");
  if (
    url.origin !== "https://lane.invalid" ||
    url.pathname === "/login" ||
    url.pathname.startsWith("/api/")
  )
    return fallback;
  return url.pathname + url.search + url.hash;
}
