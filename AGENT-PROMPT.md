# Lane — prompt for the next coding agent

You are continuing Lane (UK-first crosslister). Repo: https://github.com/Bleuszz/lane  
Owner talks in product terms. Do not ask them to run npm or open localhost.

## Product rules (do not break)

- Never collect marketplace passwords. Official OAuth where it exists (eBay/Etsy/Shopify/Woo/Whatnot). Vinted/Depop/Facebook: Electron WebView or Lane Bridge cookie capture.
- Canonical inventory: one item, N `channel_listings`. Sale with qty 0 autodelists other live channels.
- No placeholder shops (`london_rails`, `lane_uk_shop`). Honest `adapter not wired` vs dummy green.
- GBP, DD/MM/YYYY, en-GB.
- Preview on `0.0.0.0:8080` via `sh /workspace/startup.sh` / `npm run dev`.
- Do not invent eBay / Stripe / Cloudflare / Neon accounts.

## Connect must work like Crosslist

`desktop/main.cjs` `openConnect`:

1. Isolated partition `persist:lane-{marketplace}`.
2. Load the real site (vinted.co.uk etc).
3. Poll **the whole cookie jar** (`ses.cookies.get({})`) every ~800ms. Do **not** use `cookies.get({ url })` alone — Chromium drops host cookies on public-suffix domains like `*.co.uk`. That is why a logged-in Vinted homepage used to never close.
4. Also `executeJavaScript` and look for Log out / user menu.
5. Tokens: `refresh_token_web`, `access_token_web` (and refresh/access patterns).
6. POST `/api/bridge/session` with the pairing token, then **close the window**.
7. Bar at the top of the Vinted window: “Sign in… closes by itself”.

Website Connect button calls `window.lane.connect(marketplace, { pairingToken, origin })`. AppShell writes the pairing token via `lane.setPairing` on bootstrap.

The desktop app **loads the website**. It is not a second inventory. User signs into Lane first so subscription/plan/shops match.

## Phone connect

Safari cannot read HttpOnly cookies. Do not pretend the QR alone captures a Vinted session.

Working paths:

- Windows in-app browser (primary).
- `lane://connect?marketplace=vinted_uk&token=&origin=&id=&k=` protocol.
- Firefox + `extension/` Lane Bridge.
- Advanced: paste `refresh_token_web`.

## UI

Dark-first Cursor/Grok tokens in `src/styles.css` (`#0a0a0b` paper, white primary, Outfit). Light is `html[data-theme="light"]`, not inverted beige. Dashboard is Vindy-inspired (plan chip, sales opportunities / Relist) without faking likes/offers.

## Cloudflare

`CLOUDFLARE-PROMPT.md` is the VM agent brief to get a free `*.pages.dev` / `*.workers.dev` URL. After it exists, put it in `lane.json` next to `Lane.exe` (`{ "appUrl": "https://…" }`).

## Windows portable EXE

Linux sandbox cannot emit a signed NSIS installer. Recipe: official `electron-v37-win32-x64.zip`, drop `desktop/*` into `resources/app`, rename `electron.exe` → `Lane.exe`. Folder of DLLs required. SmartScreen: More info → Run anyway until a code-signing cert exists.

## Stack

TanStack Start + React 19 + Tailwind v4 + Better Auth + Neon/PGLite. Auth on. Server functions scoped by `context.userId`.
