# Lane Bridge

Standalone Chrome / Firefox MV3 extension for **Lane**.

This folder is the whole add-on. You do not need the rest of the Lane repo
to load it — only this directory.

Lane never sees your Vinted password. You sign in on [vinted.co.uk](https://www.vinted.co.uk).
The extension uses that signed-in tab (and `refresh_token_web`) to import,
publish, update, delist, and detect sales.

---

## Load in Chrome (desktop)

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → select **this folder** (`extension/`)
4. Sign in to Lane in the browser
5. Lane → **Settings → Channels** → copy the pairing token (`lnb_…`)
6. Click the Lane Bridge icon
   - **Lane origin** = the Lane site URL, no trailing slash  
     (preview / local: `http://127.0.0.1:8080`)
   - **Pairing token** = `lnb_…`
7. Grant the host permission when Chrome asks
8. Stay signed in on `https://www.vinted.co.uk`

Once cookies are captured, Vinted jobs can run on Lane’s server. If Vinted
blocks the server IP (DataDome), keep the Vinted tab open — the extension
completes those jobs itself.

---

## Load in Firefox (desktop or Android)

`manifest.json` includes a Gecko id (`lane-bridge@lane.app`).

**Desktop:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on
→ pick `manifest.json` in this folder.

**Android:** Firefox → Settings → About Firefox → tap the logo 5 times →
Debug add-ons via `about:debugging` from a desktop Firefox connected over USB.
Chrome on Android cannot load extensions.

Pair the same way: origin + `lnb_` token.

---

## What it does

| Lane job | On vinted.co.uk |
|---|---|
| Catalog / import | `GET /api/v2/users/{id}/items` (cap 200) → `POST /api/bridge/catalog` |
| Publish / relist | Upload photos, resolve brand / colour / size ids, `POST /api/v2/items` |
| Update | `PUT /api/v2/items/{id}` |
| Delist | `DELETE /api/v2/items/{id}` |
| Sold | Poll closed+sold items → `POST /api/bridge/sold` |
| Session | Reads `access_token_web` / `refresh_token_web` → `POST /api/bridge/session` |

Closing the Vinted tab parks jobs as `waiting_for_browser` **unless** a
refresh token is already stored on the Lane account.

The Lane website cannot complete these jobs. There is no “wake bridge”
button that fakes a green Vinted shop.

---

## Files

```
extension/
  manifest.json        MV3, cookies + vinted host permissions
  background.js        Pairing, heartbeat, cookie upload, job results
  content-vinted.js    Isolated-world poller on vinted.co.uk
  injected.js          MAIN-world Vinted client (CSRF + session cookies)
  popup.html / .js / .css
  icons/
  README.md            this file
```

If Vinted change an API path, edit **`injected.js` only**.

---

## Pairing security

- Token starts with `lnb_`
- Sent as `Authorization: Bearer` to `/api/bridge/*`
- Rotate it in Settings → Channels to disconnect every browser at once
- Do not paste Vinted passwords into Lane or into this popup

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Test returns 401 | Token rotated or typed wrong. Copy again. |
| Origin permission denied | Click Pair and accept the prompt for the Lane URL. |
| “Not signed in on vinted.co.uk” | Sign in, leave the tab open, click Test. |
| Jobs stay `waiting_for_browser` | Tab closed, or DataDome blocked the server. Re-open Vinted. |
| Cookies not captured | Confirm `cookies` permission and host `*://*.vinted.co.uk/*`. |

Owner-facing product docs: `../instructions.txt`.
