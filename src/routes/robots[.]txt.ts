import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          process.env.LANE_ENV === "production"
            ? "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\nDisallow: /devices\nDisallow: /inventory\nSitemap: " +
                process.env.BETTER_AUTH_URL +
                "/sitemap.xml\n"
            : "User-agent: *\nDisallow: /\n",
          { headers: { "content-type": "text/plain" } },
        ),
    },
  },
});
