import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { ebayAuthorizeUrl } from "@/lib/lane/server/ebay";
import { ebayConfigured, signOauthState } from "@/lib/lane/server/secret";

export const Route = createFileRoute("/api/ebay/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser();
        if (!user) {
          return Response.redirect(new URL("/login?next=/settings/channels", request.url), 302);
        }
        if (!ebayConfigured()) {
          return Response.redirect(
            new URL("/settings/channels?ebay=missing_keys", request.url),
            302,
          );
        }
        const url = ebayAuthorizeUrl(signOauthState(user.id));
        return Response.redirect(url, 302);
      },
    },
  },
});
