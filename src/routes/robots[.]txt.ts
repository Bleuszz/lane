import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          process.env.LANE_ENV === "production" && process.env.PUBLIC_INDEXING === "true"
            ? "User-agent: *\nAllow: /\nDisallow: /ai\nDisallow: /automation\nDisallow: /image-tools\nDisallow: /api/\nDisallow: /account\nDisallow: /devices\nDisallow: /inventory\nDisallow: /inbox\nDisallow: /products\nDisallow: /settings\nDisallow: /onboarding\nDisallow: /login\nDisallow: /signup\nDisallow: /forgot-password\nDisallow: /auth/\nSitemap: " +
                process.env.BETTER_AUTH_URL +
                "/sitemap.xml\n"
            : "User-agent: *\nDisallow: /\n",
          { headers: { "content-type": "text/plain" } },
        ),
    },
  },
});
