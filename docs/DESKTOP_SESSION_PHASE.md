# Desktop/session phase handoff

Scope: Vinted UK + eBay UK only. Official eBay API code remains available. Connector evidence distinguishes official API, desktop session, extension, assisted manual and unsupported transports; evidence belongs to an account/device, not a global marketing claim.

Current auth rebuild details and owner steps: [AUTH_SESSION_REBUILD.md](AUTH_SESSION_REBUILD.md). Desktop version 0.3.1. The 3 PM reminder was deleted; do not recreate it.

## Current boundary

Desktop runs a trusted local interface and untrusted, isolated marketplace windows. It uses a visible window for authentication and invisible isolated windows for rendered DOM/JSON-LD validation and reads. Refresh is explicit and also runs every five minutes while open and unpaused. It does not intercept passwords, export sessions to cloud workers, use hidden private APIs as its transport, bypass challenges or execute marketplace writes. Existing extension is optional; cookie permission and its cloud-cookie upload were removed. Its legacy marketplace implementation has not become a verified replacement for Desktop.

Pairing migration `0018_desktop_devices.sql` adds account-owned revocable devices and expiring single-use pairing challenges. The browser approval needs the matching displayed code; token exchange also needs the verifier kept by the initiating Desktop. Refresh credentials last 30 days, access credentials 15 minutes; only hashes are stored server-side. Heartbeats contain version, pause and a fixed set of marketplace statuses. Local pairing works against the isolated development user; real account auth and staging remain separate checks.

Desktop reads at most 200 links from the currently rendered owned-listings page and at most two detail pages per explicit read. There is no pagination/crawl, remote canonical import or desktop task claim/result protocol yet. Local encrypted observations are the next integration input. Before connecting them to inventory, verify provenance, owner identity, complete photo order and field completeness against the supplied listings. Do not silently turn partial metadata into a complete item or map missing values to guessed defaults.

## Capability evidence

For **both desktop session connectors**, import listings and read listing are **UNKNOWN** until the owner's real login test; local parser code is not proof. The UI reads local observations but cloud inventory import is not yet wired.

For **eBay desktop session transport**, create listing, edit listing, end listing, relist, upload images and read orders are **UNSUPPORTED** in this build. Read quantity and read sold state are **UNKNOWN** and remain null in observations. No eBay session operation is classified PROVEN. The official connector has separate local fixture evidence; developer approval and real seller API testing are still outstanding.

After read proof, implement an owner-scoped read-only desktop task protocol with bounded leases, claim tokens, expiry, idempotent canonical results and revoked-device rejection. Keep credentials local. Only then consider explicitly reviewed browser-assisted writes; do not reuse generic retries for ambiguous publish results.

## Owner test

Install 0.3.1 and follow the exact test in [AUTH_SESSION_REBUILD.md](AUTH_SESSION_REBUILD.md#owner-test). The old manual Check listings page flow has been removed. No reminder is scheduled.

Known Vinted owner items:
- https://www.vinted.co.uk/items/9912534056-ralph-lauren-sport-cable-knit-v-neck-sweater-pink-l
- https://www.vinted.co.uk/items/9912518964-polo-ralph-lauren-american-flag-knit-sweater-white-s

Verify ID, source URL, full title/description, GBP price, every original photo in order, brand, category, size, condition, colours, status and relevant attributes. Unknown stays unknown. Finding these public URLs alone is not wardrobe enumeration proof. If they are not the first two owned listings, adjust the bounded selection after inspecting the real wardrobe; do not pretend the current button targets them automatically.

## Cheapest staging preparation

Prepared choice: **Render free Node web service + Neon free Postgres**, subject to account eligibility and actual session/read proof. `render.yaml` is a template, not a created service. `npm run build:node` produces Nitro Node server output; the original Vercel build remains available. Desktop initiates outgoing HTTPS polling, so staging needs no inbound desktop ports or WebSocket infrastructure. No worker schedule is installed.

Official provider checks on 11 September 2026:
- [Render free](https://render.com/docs/free): free web service sleeps after inactivity and has a monthly hours allowance; files are ephemeral. Its free Postgres expires, so it is not the durable database choice.
- [Neon pricing](https://neon.com/pricing): free database has storage/compute/transfer caps. Current inventory photos stored in the DB can consume the small free storage allowance quickly; measure actual pilot data before promising capacity.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby): personal/non-commercial restriction makes it unsuitable as the default commercial Lane plan.
- [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/): free request/CPU limits; this application's adapter and database execution still need compatibility proof.
- [Railway trial](https://docs.railway.com/pricing/free-trial) and [Fly trial](https://fly.io/docs/about/free-trial/): time/credit-limited trials do not establish ongoing free hosting.

Budget target GBP0 recurring for the initial staging pilot; GBP30 acquisition reserve untouched. Free-tier availability is not a production uptime/capacity promise. No accounts, domains, monitoring or paid services were created.

After local marketplace proof: obtain owner-approved provider access, create only the chosen free staging service/database, set exact HTTPS origin/auth secret/database URL in provider secret storage, apply migrations through 0018 to that identified database, then deploy. Keep billing, paid AI, order polling, worker schedules and legacy cloud sessions disabled. Repeat actual account login, pairing, revocation, both marketplace imports, restart persistence, expiry and redacted logging checks. Record each checklist item separately; do not label staging proven before those observations exist.
