# Lane

UK-first crosslister. One canonical inventory record; channel listings hang off it. A confirmed sale with quantity 0 delists the rest.

**This is not a Crosslist clone and it never stores marketplace passwords.**

- eBay UK — official REST OAuth (`sell.inventory`)
- Vinted UK — Windows in-app browser captures the session (Crosslist-style: sign in, window closes). Lane Bridge is the fallback.
- Import up to 200 live listings
- Universal form → queued publish
- Mark sold → autodelist other live channels
- Job log with request ids and retry
- Honest `waiting_for_browser` / `extension_offline` when Chrome is asleep
- Dark UI (Cursor / Grok-like). Light mode is a toggle, not inverted beige.

The Windows app **is this website** in Chromium. Sign in with the same account so the plan and shops match.

## Repo map

| Path | What |
|---|---|
| `CLOUDFLARE-PROMPT.md` | Hand this to a VM agent to get a free `*.pages.dev` / `*.workers.dev` URL |
| `instructions.txt` | Developer handoff: env, eBay RuName, Cloudflare, domains |
| `desktop/` | Electron shell. `main.cjs` opens the marketplace, reads cookies, closes |
| `extension/` | **Standalone** Chrome/Firefox MV3 Lane Bridge |
| `src/lib/lane/listing-fields.ts` | Vinted vs eBay required fields |
| `src/lib/lane/server/ebay.ts` | eBay Inventory API client |
| `src/lib/lane/server/process.ts` | Job worker (OAuth jobs only) |
| `src/lib/lane/server/bridge.ts` | Pairing-token API used by the extension and the Windows app |
| `src/routes/api/ebay/` | OAuth start + callback |
| `src/routes/api/bridge/` | `/api/bridge/*` |
| `migrations/` | Auth + product + live-adapter SQL |

## Local

```sh
cp .env.example .env
npm install
npm run dev
```

## Windows

The site page is `/download`. It points at Drive file `Lane-Windows.zip` (`WINDOWS_FILE_ID` in `src/lib/lane/download.ts`).

Unzip, run `Lane.exe`, paste the Lane URL from Cloudflare, sign in. Connect Vinted → sign in on their site → the window closes when the session is captured.

The Drive file must be shared **anyone with the link** or public visitors hit a Google login wall.

## What will not work until the owner supplies keys

Connect eBay without `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` / `EBAY_RU_NAME` fails with a real error. Vinted stays `extension_offline` until a session is captured (Windows app) or Lane Bridge heartbeats from a vinted.co.uk tab. There are no placeholder shops.
