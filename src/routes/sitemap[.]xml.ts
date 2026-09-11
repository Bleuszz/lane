import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const origin = process.env.BETTER_AUTH_URL;
        if (!origin || process.env.LANE_ENV !== "production")
          return new Response("Not published", { status: 404 });
        const paths = [
          "/",
          "/download",
          "/help",
          "/security",
          "/contact",
          "/legal/privacy",
          "/legal/terms",
          "/legal/cookies",
        ];
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            paths.map((p) => "<url><loc>" + new URL(p, origin).href + "</loc></url>").join("") +
            "</urlset>",
          { headers: { "content-type": "application/xml" } },
        );
      },
    },
  },
});
