import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { authConfiguration } from "@/lib/auth/configuration";

async function handle(request: Request) {
  const url = new URL(request.url),
    config = authConfiguration(process.env, url.origin);
  if (request.method === "GET" && url.pathname === "/api/auth/configuration")
    return Response.json(config, { headers: { "Cache-Control": "no-store" } });
  if (
    request.method === "POST" &&
    ["/api/auth/sign-in/oauth2", "/api/auth/sign-in/social"].includes(url.pathname)
  ) {
    const body = await request
      .clone()
      .json()
      .catch(() => ({}));
    const id = body.providerId || body.provider;
    const provider = config.providers.find((p) => p.providerId === id);
    if (!provider?.available)
      return Response.json(
        {
          code: "PROVIDER_NOT_CONFIGURED",
          message: provider?.reason || "This sign-in provider is not configured for Lane.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
  }
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
