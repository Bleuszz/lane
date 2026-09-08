import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { exchangeEbayCode, ebayUser } from "@/lib/lane/server/ebay";
import { ebayEnv, readOauthState, seal } from "@/lib/lane/server/secret";
import { ensureUser } from "@/lib/lane/server/map";
import { makeId } from "@/lib/lane/ids";

export const Route = createFileRoute("/api/ebay/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const dest = new URL("/settings/channels", request.url);
        const error = url.searchParams.get("error");
        if (error) {
          dest.searchParams.set("ebay", "denied");
          dest.searchParams.set("reason", url.searchParams.get("error_description") ?? error);
          return Response.redirect(dest, 302);
        }
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          dest.searchParams.set("ebay", "missing_code");
          return Response.redirect(dest, 302);
        }
        try {
          const { userId } = readOauthState(state);
          const tokens = await exchangeEbayCode(code);
          const identity = await ebayUser(tokens.access_token);
          const sql = await getSql();
          await ensureUser(sql, userId);
          const existing = await sql<{ id: string }>`
            select id from marketplace_accounts where user_id = ${userId} and marketplace = ${"ebay_uk"} order by created_at asc limit 1
          `;
          const sandbox = ebayEnv() === "sandbox";
          const expires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          if (existing[0]) {
            await sql`
              update marketplace_accounts set
                remote_username = ${identity.username},
                remote_user_id = ${identity.userId},
                oauth_connected = true,
                oauth_access_token = ${seal(tokens.access_token)},
                oauth_refresh_token = ${seal(tokens.refresh_token ?? "")},
                oauth_expires_at = ${expires},
                status = 'green',
                last_error = null,
                sandbox = ${sandbox},
                updated_at = now()
              where id = ${existing[0].id} and user_id = ${userId}
            `;
          } else {
            await sql`
              insert into marketplace_accounts (
                id, user_id, marketplace, mode, label, remote_username, remote_user_id, status,
                oauth_connected, oauth_access_token, oauth_refresh_token, oauth_expires_at, sandbox
              ) values (
                ${makeId("acc")}, ${userId}, ${"ebay_uk"}, ${"oauth"}, ${"eBay UK"},
                ${identity.username}, ${identity.userId}, ${"green"},
                ${true}, ${seal(tokens.access_token)}, ${seal(tokens.refresh_token ?? "")}, ${expires}, ${sandbox}
              )
            `;
          }
          dest.searchParams.set("ebay", "connected");
          dest.searchParams.set("user", identity.username);
          return Response.redirect(dest, 302);
        } catch (err) {
          dest.searchParams.set("ebay", "error");
          dest.searchParams.set("reason", err instanceof Error ? err.message : "OAuth failed");
          return Response.redirect(dest, 302);
        }
      },
    },
  },
});
