# Lane

UK-first crosslister. One canonical inventory record; channel listings hang off it. A confirmed sale with quantity 0 delists the rest.

**This is not a Crosslist clone and it never stores marketplace passwords.**

- eBay UK — official REST OAuth (`sell.inventory`)
- Vinted UK — Lane Bridge Chrome MV3 extension, using the seller’s signed-in browser session
- Import up to 200 live listings
- Universal form → queued publish
- Mark sold → autodelist other live channels
- Job log with request ids and retry
- Honest `waiting_for_browser` / `extension_offline` when Chrome is asleep

## Repo map

| Path | What |
|---|---|
| `instructions.txt` | Developer handoff: env, eBay RuName, Cloudflare, domains, what to ask the owner |
| `extension/` | **Standalone** Chrome/Firefox MV3 Lane Bridge (own README) |
| `src/lib/lane/listing-fields.ts` | Vinted vs eBay required fields |
| `src/lib/lane/server/ebay.ts` | eBay Inventory API client |
| `src/lib/lane/server/process.ts` | Job worker (OAuth jobs only) |
| `src/lib/lane/server/bridge.ts` | Pairing-token API used by the extension |
| `src/routes/api/ebay/` | OAuth start + callback |
| `src/routes/api/bridge/` | `/api/bridge/*` |
| `migrations/` | Auth + product + live-adapter SQL |

## Local

```sh
cp .env.example .env   # then fill secrets in your host, not necessarily a file
npm install
npm run dev            # 0.0.0.0:8080
```

Auth schema: `migrations/0001_auth.sql`. Product: `0002_lane.sql`. Live adapters: `0003_live_adapters.sql`.

## What will not work until the owner supplies keys

Connect eBay without `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` / `EBAY_RU_NAME` fails with a real error. Vinted stays `extension_offline` until Lane Bridge heartbeats from a vinted.co.uk tab. There are no placeholder shops.
