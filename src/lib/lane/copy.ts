export const PRODUCT_NAME = "Lane";

export const LEGAL_FOOTER =
  "Lane never asks for marketplace passwords. eBay uses official OAuth. Vinted: you sign in on Vinted’s own site; the Windows app (or Lane Bridge) captures the session and closes the window. Keep a signed-in browser for fallback. Aggressive automation can breach marketplace terms — we cap rates to reduce risk, we cannot eliminate it.";

export const EXTENSION_HONESTY =
  "Vinted runs from a captured session when one exists, otherwise from Lane Bridge on an open vinted.co.uk tab. Closing that tab parks jobs as waiting_for_browser unless a server session is stored. eBay runs on the server via OAuth.";

export const VINTED_CONNECT_COPY =
  "Lane never sees your Vinted password. In the Windows app, Connect opens vinted.co.uk. When you are signed in, the window closes by itself. On the website in a normal browser, pair Lane Bridge or use the phone Firefox path.";

export const EBAY_CONNECT_COPY =
  "Official eBay REST OAuth. You will be sent to eBay to approve sell.inventory access. Requires EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RU_NAME and Business Policy IDs on the server.";

export const PHONE_CONNECT_COPY =
  "A phone browser cannot hand Vinted’s login cookies to a website. Generate a link, then tap Open in Lane on this Windows PC — the app opens Vinted, captures the session, and closes the window. Scanning the QR on a phone only works with Firefox + Lane Bridge on Android. Safari cannot capture the session.";
