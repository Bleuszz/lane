import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { authConfiguration } from "@/lib/auth/configuration";
import { getSql } from "@/lib/db";
import { limitedBody } from "@/lib/request-body";
import { consumeLimit } from "@/lib/request-limits";

async function handle(request: Request) {
  const url = new URL(request.url),
    config = authConfiguration(process.env, url.origin);
  if (request.method === "GET" && url.pathname === "/api/auth/configuration")
    return Response.json(config, { headers: { "Cache-Control": "no-store" } });
  if (request.method === "POST") {
    let text: string;
    try {
      text = await limitedBody(request, 16384);
    } catch {
      return Response.json(
        { code: "REQUEST_TOO_LARGE", message: "Request is too large." },
        { status: 413 },
      );
    }
    request = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: text,
    });
    if (["staging", "production"].includes(process.env.LANE_ENV ?? "")) {
      const limit = await consumeLimit(
        await getSql(),
        "auth-intake",
        { window: 60, max: 1000 },
        process.env.BETTER_AUTH_SECRET!,
      );
      if (!limit.allowed)
        return Response.json(
          { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
        );
    }
    if (
      ["/api/auth/request-password-reset", "/api/auth/forget-password"].includes(url.pathname) &&
      !config.passwordResetAvailable
    )
      return Response.json(
        {
          code: "EMAIL_NOT_CONFIGURED",
          message: "Email delivery is not configured on this staging environment.",
        },
        { status: 503 },
      );
  }
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
