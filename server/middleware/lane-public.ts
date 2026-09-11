// Canonical identity comes from server configuration, never an untrusted Host header.
export default async function lanePublic(
  event: { req: Request; url: URL },
  next: () => unknown | Promise<unknown>,
) {
  const result = await next();
  if (!(result instanceof Response)) return result;
  const headers = new Headers(result.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.LANE_ENV !== "staging" && process.env.LANE_ENV !== "production") return result;
  headers.set("X-Frame-Options", "DENY");
  headers.set("Strict-Transport-Security", "max-age=86400");
  if (process.env.LANE_ENV === "staging") headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Cache-Control", "private, no-store");
  if (!headers.get("content-type")?.includes("text/html"))
    return new Response(result.body, { status: result.status, headers });
  const html = await result.text();
  const origin = process.env.BETTER_AUTH_URL!;
  const publicPaths = [
    "/",
    "/download",
    "/help",
    "/security",
    "/contact",
    "/legal/privacy",
    "/legal/terms",
    "/legal/cookies",
  ];
  const escape = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const canonical = new URL(event.url.pathname, origin).href;
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1] || "Lane";
  const meta = publicPaths.includes(event.url.pathname)
    ? '<link rel="canonical" href="' +
      escape(canonical) +
      '"/><meta property="og:url" content="' +
      escape(canonical) +
      '"/><meta property="og:type" content="website"/><meta property="og:site_name" content="Lane"/><meta property="og:title" content="' +
      escape(title) +
      '"/><meta property="og:description" content="A shared account and desktop workspace for UK resellers. Vinted and eBay beta."/><meta name="twitter:card" content="summary"/><meta name="twitter:title" content="' +
      escape(title) +
      '"/>'
    : '<meta name="robots" content="noindex,nofollow"/>';
  headers.delete("content-length");
  return new Response(html.replace("</head>", meta + "</head>"), {
    status: result.status,
    headers,
  });
}
