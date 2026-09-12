import { PUBLIC_PAGES } from "../../src/lib/lane/public-site";
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
export default async function lanePublic(
  event: { req: Request; url: URL },
  next: () => unknown | Promise<unknown>,
) {
  const result = await next();
  if (!(result instanceof Response)) return result;
  const headers = new Headers(result.headers);
  if (!["staging", "production"].includes(process.env.LANE_ENV || "")) return result;
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Strict-Transport-Security", "max-age=86400");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  // SSR hydration uses inline scripts. Nonces are a later hardening step; no eval or external scripts allowed.
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  const path = event.url.pathname;
  const page = PUBLIC_PAGES[path as keyof typeof PUBLIC_PAGES];
  const indexable = process.env.LANE_ENV === "production" && Boolean(page) && result.status === 200;
  if (!indexable) headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set(
    "Cache-Control",
    path.startsWith("/assets/") && result.status === 200
      ? "public, max-age=31536000, immutable"
      : "private, no-store",
  );
  if (!headers.get("content-type")?.includes("text/html"))
    return new Response(result.body, { status: result.status, headers });
  let html = await result.text();
  const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
  let meta = indexable ? "" : '<meta name="robots" content="noindex,nofollow"/>';
  if (page && result.status === 200) {
    const [title, description] = page;
    html = html
      .replace(/<title>.*?<\/title>/gs, "")
      .replace(/<meta\s+name="description"[^>]*>/gi, "");
    meta += `<title>${escape(title)}</title><meta name="description" content="${escape(description)}"/><link rel="canonical" href="${escape(origin + path)}"/>`;
    meta += `<meta property="og:type" content="website"/><meta property="og:site_name" content="Lane"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(description)}"/><meta property="og:url" content="${escape(origin + path)}"/><meta property="og:image" content="${escape(origin)}/lane-social.png"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:alt" content="Lane: a crosslisting workspace for UK resellers, Vinted and eBay beta"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escape(title)}"/><meta name="twitter:description" content="${escape(description)}"/><meta name="twitter:image" content="${escape(origin)}/lane-social.png"/>`;
    const data = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": origin + "/#organization",
          name: "Lane",
          url: origin + "/",
        },
        {
          "@type": "WebSite",
          "@id": origin + "/#website",
          name: "Lane",
          url: origin + "/",
          publisher: { "@id": origin + "/#organization" },
        },
        ...(path === "/"
          ? [
              {
                "@type": "SoftwareApplication",
                name: "Lane",
                applicationCategory: "BusinessApplication",
                operatingSystem: "Windows",
                url: origin + "/",
                description,
              },
            ]
          : []),
      ],
    };
    meta +=
      '<script type="application/ld+json">' +
      JSON.stringify(data).replaceAll("<", "\\u003c") +
      "</script>";
    const verification = process.env.GOOGLE_SITE_VERIFICATION;
    if (verification && /^[A-Za-z0-9_-]{10,200}$/.test(verification))
      meta += `<meta name="google-site-verification" content="${verification}"/>`;
  }
  headers.delete("content-length");
  return new Response(html.replace("</head>", meta + "</head>"), {
    status: result.status,
    headers,
  });
}
