# Lane Bridge (Chrome MV3)

Unpacked Chrome extension. It is the only process allowed to complete Vinted jobs.

## Load

1. Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `extension/` folder
4. Open Lane → Settings → Channels, copy the pairing token
5. Click the extension icon, paste:
   - **Lane origin** — the deployed Lane URL (no trailing slash). Local: `http://127.0.0.1:8080`
   - **Pairing token** — `lnb_…`
6. Stay signed in on [vinted.co.uk](https://www.vinted.co.uk) and leave that tab open

## Behaviour

| Lane job | What the extension does |
|---|---|
| import / catalog | `GET /api/v2/users/{id}/items` while you are signed in, `POST /api/bridge/catalog` |
| publish / relist | Upload photos, `POST /api/v2/items`, report remote id |
| update | `PUT /api/v2/items/{id}` |
| delist | `DELETE /api/v2/items/{id}` |
| sold | Poll closed+sold items, `POST /api/bridge/sold` |

Closing the Vinted tab parks jobs as `waiting_for_browser`. The Lane web app **cannot** complete these jobs.

## If Vinted change their API

Edit `injected.js` only. Paths, CSRF, catalog ids and status ids live there on purpose.
