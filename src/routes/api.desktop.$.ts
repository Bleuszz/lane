import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  beginPair,
  exchangePair,
  refreshDevice,
  heartbeatDevice,
  revokeDeviceToken,
} from "@/lib/lane/server/desktop-devices";
async function handle({ request }: { request: Request }) {
  try {
    const text = await request.text();
    if (text.length > 4096) return Response.json({ error: "Request too large." }, { status: 413 });
    const body = JSON.parse(text),
      path = new URL(request.url).pathname.split("/").pop(),
      sql = await getSql();
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
  } catch {
    return Response.json(
      { error: "Device request failed. Check pairing or start again." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const Route = createFileRoute("/api/desktop/$")({ server: { handlers: { POST: handle } } });
