import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { saveVintedSession, tokensFromCookieJar } from "@/lib/lane/server/vinted";
import { tokensEqual } from "@/lib/lane/server/secret";

export const Route = createFileRoute("/api/vinted/connect/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      OPTIONS: () => new Response(null, { status: 204 }),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rest = url.pathname.replace(/^\/api\/vinted\/connect\/?/, "");
  const [id] = rest.split("/").filter(Boolean);
  const secret = url.searchParams.get("k") ?? "";
  if (!id) return json({ error: "Missing session" }, 400);
  if (!secret) return json({ error: "Missing k" }, 400);

  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from vinted_connect_sessions where id = ${id}
  `;
  const row = rows[0];
  if (!row || !tokensEqual(String(row.secret), secret)) return json({ error: "Unknown or expired connect link." }, 404);
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    await sql`update vinted_connect_sessions set status = 'expired' where id = ${id}`;
    return json({ error: "This connect link expired. Start again from Settings → Channels." }, 410);
  }

  const userId = String(row.user_id);
  const settings = await sql<{ extension_pairing_token: string | null }>`
    select extension_pairing_token from user_settings where user_id = ${userId}
  `;

  if (request.method === "GET") {
    return json({
      status: String(row.status),
      pairingToken: settings[0]?.extension_pairing_token ?? null,
      error: row.error ? String(row.error) : null,
    });
  }

  if (request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as {
      refreshToken?: string;
      accessToken?: string;
      cookies?: Array<{ name?: string; value?: string }>;
    };
    const jar = Array.isArray(body.cookies) ? body.cookies : null;
    const fromJar = tokensFromCookieJar(jar);
    const refresh = String(body.refreshToken ?? "").trim() || fromJar.refresh;
    const access = String(body.accessToken ?? "").trim() || fromJar.access;
    if (!refresh && !access) return json({ error: "refreshToken or accessToken required" }, 400);
    try {
      const saved = await saveVintedSession(sql, userId, {
        accessToken: access || null,
        refreshToken: refresh || access,
        cookies: jar,
      });
      return json({ ok: true, username: saved.username, status: "completed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not verify Vinted session";
      await sql`update vinted_connect_sessions set error = ${message} where id = ${id}`;
      return json({ error: message }, 400);
    }
  }

  return json({ error: "Method not allowed" }, 405);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
