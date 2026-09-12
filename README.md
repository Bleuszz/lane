# Lane

UK-first reseller workspace with a shared web account and Windows Desktop. **Current status, 12 September 2026:** eBay/Vinted session authentication and owned-listing discovery are owner-proven. Full Vinted item details (including rows showing “Title unknown”) remain the first desktop follow-up. Full import, reliable publishing and automatic delisting must not be advertised as completed.

Free staging deployment is locally prepared and tested; no public deployment is claimed. Billing, AI and bulk automation remain disabled. Active marketplace transport is the owner's local browser session; existing official API code is retained for possible future use.

- [Authoritative progress](progress.txt)
- [Deployment handoff](docs/DEPLOYMENT_HANDOFF.md) and [local verification evidence](docs/qa/deployment-readiness/README.md)
- [£30 launch acquisition playbook](docs/LAUNCH_MARKETING_PLAN.md), [budget/model](docs/MARKETING_BUDGET.md) and [measurement contract](docs/GROWTH_METRICS.md)

Marketing documents are preparation only: no spend, ads, outreach or public posts have been executed. The repository map and older setup material below describe historical/future paths too; follow current progress and deployment handoff for this phase.

## Repo map

| Path | What |
|---|---|
| `CLOUDFLARE-PROMPT.md` | Paste into Cursor to **update** the existing free `*.pages.dev` / `*.workers.dev` deploy |
| `CURSOR-CLOUDFLARE.md` | One-screen pointer at that prompt |
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

The site page is `/download`. It points at Drive file `Lane-Windows.zip` (`WINDOWS_FILE_ID` in `src/lib/lane/download.ts`, currently `1ggyKPwn0notrnwO671M1IIZ-UCzo0wFr`).

Unzip, run `Lane.exe`, paste the Lane URL from Cloudflare, sign in. Connect Vinted → sign in on their site → the window closes when the session is captured.

The Drive file must be shared **anyone with the link** or public visitors hit a Google login wall.

## What will not work until the owner supplies keys

Connect eBay without `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` / `EBAY_RU_NAME` fails with a real error. Vinted stays `extension_offline` until a session is captured (Windows app) or Lane Bridge heartbeats from a vinted.co.uk tab. There are no placeholder shops.
