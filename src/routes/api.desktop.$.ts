import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { limitedBody } from "@/lib/request-body";
import { consumeLimit } from "@/lib/request-limits";
import {
  beginPair,
  exchangePair,
  refreshDevice,
  heartbeatDevice,
  revokeDeviceToken,
} from "@/lib/lane/server/desktop-devices";
async function handle({ request }: { request: Request }) {
  try {
    const endpoint = new URL(request.url).pathname.split("/").pop();
    if (!endpoint || !["pair", "exchange", "refresh", "heartbeat", "revoke"].includes(endpoint))
      return Response.json({ error: "Unknown device operation." }, { status: 404 });
    const text = await limitedBody(request, 4096);
    if (text.length > 4096) return Response.json({ error: "Request too large." }, { status: 413 });
    const body = JSON.parse(text),
      path = new URL(request.url).pathname.split("/").pop(),
      sql = await getSql();
    if (["staging", "production"].includes(process.env.LANE_ENV ?? "")) {
      const limit = await consumeLimit(
        sql,
        "desktop-intake:" + path,
        { window: 60, max: path === "pair" ? 20 : 300 },
        process.env.BETTER_AUTH_SECRET!,
      );
      if (!limit.allowed)
        return Response.json(
          { error: "Too many device requests. Try again later." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
        );
    }
    let result;
    if (path === "pair") result = await beginPair(sql, body);
    else if (
      path === "exchange" &&
      typeof body.id === "string" &&
      typeof body.verifier === "string"
    )
      result = await exchangePair(sql, body.id, body.verifier);
    else if (
      path === "refresh" &&
      typeof body.refreshToken === "string" &&
      /^[A-Za-z0-9_-]{43}$/.test(body.refreshToken)
    )
      result = await refreshDevice(sql, body.refreshToken);
    else if (path === "heartbeat")
      result = await heartbeatDevice(
        sql,
        (request.headers.get("authorization") || "").replace(/^Bearer /, ""),
        body,
      );
    else if (path === "revoke" && typeof body.refreshToken === "string")
      result = await revokeDeviceToken(sql, body.refreshToken);
    else return Response.json({ error: "Invalid device request." }, { status: 400 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE")
      return Response.json({ error: "Request too large." }, { status: 413 });
    return Response.json(
      { error: "Device request failed. Check pairing or start again." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const Route = createFileRoute("/api/desktop/$")({ server: { handlers: { POST: handle } } });
