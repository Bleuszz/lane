# Auth/session rebuild — Desktop 0.3.1

Status: implementation and local checks complete; real provider/session proof remains incomplete.
The 15:00 reminder was deleted at Nate's request. Do not recreate it.

## What failed and changed

- Social login assumed preview-broker configuration outside its intended origin. Provider configuration is now checked before offering or starting sign-in. Direct Google requires explicit credentials and a matching website origin. Missing configuration produces an explanation and email fallback.
- Popup completion had no deadline. It now has cancellation, a two-minute deadline, source/origin validation, cleanup and actionable failure messages. Provider initiation and client auth requests have 15-second limits. Enabled Google success still needs a real configured OAuth application test.
- Login used stale server-rendered user data after sign-out. It now waits for the current session query before redirecting. Local email signup, successful/failed login and browser sign-out were exercised successfully after this change.
- Vinted used a dead wardrobe target and weak connection evidence. It now starts at `/inbox`, which was observed redirecting anonymous Electron users to the valid login/register flow. Wardrobe URLs come from the authenticated header's member identity, not a guessed path.
- eBay selectors missed the current `#gh_user` greeting and Seller Hub containers. Read-only inspection of an existing session reached Seller Hub and supplied those selectors; a later probe required sign-in. That is partial evidence, not a proven connection/import.
- The old manual page-check flow is replaced by validation and background refresh. Login popups for supported identity-provider hosts are permitted only in isolated interactive windows. No marketplace window receives Node access or Lane's preload.

## Connection and storage contract

`connection-manager.cjs` owns the state machine: DISCONNECTED, OPENING_LOGIN,
WAITING_FOR_USER_LOGIN, AUTHENTICATED_SESSION_CAPTURED, VALIDATING_SESSION,
CONNECTED, SESSION_EXPIRED, RECONNECT_REQUIRED and ERROR.

CONNECTED requires a positive authenticated-page result, usable local cookie material,
account identity, a separate protected-page validation and successful encrypted persistence.
Cookies alone, a loaded page or a login click never establish connection. Duplicate actions
share one operation. Closing login cancels it; five minutes without completion times out.
Disconnect aborts pending operations, deletes the vault and browser state, and clears local
identity/observations. It does not revoke unrelated marketplace sessions on other devices.

Interactive windows are used for sign-in; normal validation and reads use invisible,
sandboxed browser windows with the same per-profile in-memory session. This is rendered-page
automation, not private-API scraping. It can still be blocked or changed by a marketplace.
Challenges are not solved in the background; they produce a reconnect prompt. Login windows
and supported child popups close after successful validation. Refresh never opens visible UI.

Only marketplace-domain cookies persist, encrypted by Electron safeStorage/Windows DPAPI
under `%APPDATA%/Lane/protected`. Identity-provider cookies, passwords and raw session logs
are not retained. Browser localStorage is not restored, so cookie-only persistence may be
insufficient for some login methods. Startup resets stale status and validates saved sessions
before displaying Connected. Refresh runs every five minutes while Lane is open and unpaused.

Web sessions and Desktop pairing are separate. Desktop uses browser approval with a matching
code and verifier, then revocable device tokens; it does not copy the browser's Lane cookies.
The existing pairing protocol has local synthetic-user proof, not staging proof.

## Evidence and limits

- PASS: 23 focused checks covering connection state, cancellation/timeouts, persistence
  failures, stale-session rejection, duplicate attempts, disconnect races, account mismatch,
  stale listing links, auth provider configuration, popup boundaries and existing pairing.
- PASS: real Electron windows/cookies against synthetic HTML establish the required order,
  automatic close, invisible refresh, expiry and local disconnect. This is fixture evidence.
- PASS: Windows encrypted fixture survives a separate Electron process. This proves storage
  recovery, not that a marketplace will accept the recovered session.
- PASS: Desktop startup/local item-review smoke checks, escaped fields and no secret fields.
- PASS: anonymous real Vinted login target; it remains unauthenticated until actual login.
- PASS: local email signup/login, incorrect-password error, session query, sign-out and
  unavailable-provider rejection. The local no-Postgres database is ephemeral.
- Full suite: 319 tests, 301 pass and 18 inherited template failures. Typecheck, auth invariant,
  changed web-file lint and Node production build pass. See progress.txt for final build checks.
- UNKNOWN: configured Google success, owner Vinted authentication/wardrobe enumeration,
  complete supplied-item extraction, real session restart/reconnect and eBay reliable import.
- eBay identity can fall back to a display greeting if no seller profile link is rendered.
  This is not a proven stable seller ID; multi-account correctness needs stronger real evidence.
- Reads are bounded to 200 rendered links on the current owned-listings page and two item
  details. Missing attributes remain unknown. Cloud inventory ingestion and pagination are
  not implemented in this transport. Public listing metadata is not full import proof.
- eBay writes/orders remain UNSUPPORTED in session mode; quantity/sold-state are UNKNOWN.
  Official eBay OAuth/API code remains available with separate approval/testing requirements.
- No deployment, infrastructure purchase, real marketplace write or production billing.

## Owner test

ACTION: Install 0.3.1 and test a fresh Vinted connection, then eBay.
SERVICE: Lane Desktop, Vinted UK and eBay UK.
WHY: Only Nate can complete marketplace sign-in/MFA and confirm owned-account results.
EXACT STEPS: Quit the old Lane app. Run
`desktop/dist/installer/Lane-Setup-0.3.1.exe` from this repository and open Lane from Start.
Confirm version 0.3.1. Leave website address blank until staging exists. Choose Connect Vinted
(or Reconnect), sign in directly and wait. Connected must appear only after validation; the
login window should then close automatically. Choose Refresh listings: no visible marketplace
window should open. Choose Read item details and Review read items to inspect local results.
Repeat with eBay, then restart Lane and test refresh again. If validation fails, report the exact
Lane status/message; do not repeatedly retry a challenge or share credentials/diagnostic secrets.
The two supplied Vinted URLs in DESKTOP_SESSION_PHASE.md must later be verified field by field.
COST: GBP0. The installer is unsigned; no signing claim is made.
KYC/ID: No new ID process intended; stop if a marketplace requests one.
EXPECTED RESULT: Validated identity and owned-listing state, or a concrete safe failure.
BLOCKED WITHOUT THIS: Real session, restart/reconnect, wardrobe and supplied-item proof.
CAN YOU CONTINUE OTHER WORK: YES.

ACTION: Configure a Google OAuth application when the Lane staging origin is chosen.
SERVICE: Google Cloud OAuth configuration and the Lane host's secret settings.
WHY: No direct Google provider is currently configured for the local/staging website.
EXACT STEPS: Register the exact website origin and redirect URI
`https://YOUR_LANE_HOST/api/auth/callback/google`. Set GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET, a stable BETTER_AUTH_SECRET and exact BETTER_AUTH_URL privately on
the host. Use a durable DATABASE_URL. Do not paste secrets in chat. Test with an allowed user.
COST: No purchase authorized; GBP0 target.
KYC/ID: Google account access required; no new identity process planned.
EXPECTED RESULT: A configured provider that can undergo a real success/cancel/failure test.
BLOCKED WITHOUT THIS: Claiming Google login works end to end.
CAN YOU CONTINUE OTHER WORK: YES.

## Next actions

1. Diagnose the owner test, improve account identity/DOM handling from real evidence and
   verify both supplied Vinted items, every photo and field. Keep UNKNOWN values explicit.
2. Connect proven read results to owner-scoped leased tasks and idempotent canonical inventory
   ingestion. Reject revoked devices and duplicate/expired results; keep credentials local.
3. Prove restart, expiry, account mismatch and disconnect using real sessions.
4. After the local read gate, configure the prepared free staging host/database and auth,
   migrate the identified database, deploy and repeat all account/device/marketplace checks.
5. Request a precise owner-approved eBay write test only after read/staging proof.
