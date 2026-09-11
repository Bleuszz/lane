# Session diagnostic development checkpoint — 11 September 2026

Continue from `ddc3076` on `codex/lane-smart-crosslisting`. This is development source
running with the existing Electron runtime, not a new installer. Desktop 0.3.1 remains the
last packaged release. Neither marketplace is declared fixed.

**The official eBay developer application was rejected. Browser session is the only active
eBay transport in this seven-day phase. No client ID, client secret, RuName, approval or
new application is required.** Existing API code is future-only and is not the repair path.

## Observed evidence, not assumptions

No Lane/Electron process was running when this investigation began, so the previous live
window could not be inspected directly. A read-only helper restored the installed encrypted
cookies in the existing per-profile in-memory architecture and used background Chromium.
It never printed values, saved page bodies or changed the original session vault.

- eBay: 34 cookies, 8 HTTP-only, 5 session cookies. The background window used the exact
  expected Electron Session instance and reached Seller Hub. Its DOM exposed
  `Manage active listings(24)` and 26 item anchors globally. These counts were observed,
  not hard-coded. Global item anchors are not yet verified as 24 unique owned listings.
- The existing parser expected a greeting in `#gh_user`, but the actual account chrome had
  `.gh-identity__greeting`, `.gh-identity__dialog` and a lazy-loading flyout. There was no
  rendered seller profile link at inspection time. The current page used a heading outside
  the old h1-only count lookup. Identity resolution and extraction were failed gates.
- A subsequent saved-cookie replay returned Sign in. Further replays stopped. This does
  not prove persistent partitions are needed: the saved snapshot may have become stale,
  or eBay may require reauthentication. The next test must start with fresh owner login and
  validate immediately in the same process, before testing cold restart separately.
- Vinted: 24 cookies, 7 HTTP-only, zero session cookies. These flags do not determine which
  cookies authenticate. Same-session identity was confirmed for the background window,
  but navigation timed out. Auth recognition/wardrobe extraction therefore remain unproven.

## Diagnostic changes

- Track Connect/Refresh/Read separately. Refresh/Read are disabled during connection and
  guarded at IPC and manager boundaries. They cannot silently attach to Connect.
- Record stage, operation, error category/code/time, last successful stage, session presence,
  cookie counts, stable partition identifier and strict `webContents.session === session`
  assertions for both interactive and background windows.
- Session probe runs a bounded background validation without changing Connected state.
  It exposes metadata-only cookies, visible/background gate summaries, identity resolution,
  Seller Hub access, live listing count, link count and count agreement. Copy diagnostics
  includes the gate summary; no values, tokens, passwords, headers or account names.
- Remove greeting-based identity. eBay requires a seller profile URL in account chrome.
  On the observed Seller Hub layout, bounded Chromium mouse movement opens only the
  lazy account flyout. No sign-out, publish or other write control is clicked. This path
  passes an Electron fixture; it still needs the owner's fresh-session live test.
- Read h1/h2/h3/role headings, use listing-root item links/explicit row IDs, follow same-origin
  next-page links and perform bounded scrolling for lazy loading. Limit 10 pages/200 unique
  links. Unsupported button-only pagination or larger inventories produce incomplete/unknown
  state; they are not claimed fully synced. Discovered listings are visible locally.
- A non-zero live count with zero links is EXTRACTION_FAILED. Partial count agreement is
  LISTING_COUNT_MISMATCH. Unknown listing state does not produce a successful sync time.
- A permitted navigation that interrupts the initial auth load can continue to the state
  machine instead of closing the login window. Page-load failures preserve sanitised gate
  evidence, and encryption failures report a per-profile storage stage.
- Vinted remains a separate parser using its own authenticated header identity and wardrobe
  URL. No eBay cookie names or account DOM rules are applied to it.

## Session architecture decision

Keep Option A for this diagnostic. It restored a real eBay Seller Hub page with the saved
cookie set, so there is no evidence yet that losing origin storage caused that particular
failure. Explicit persistence is Windows DPAPI-encrypted under `%APPDATA%/Lane/protected`.
Memory partitions isolate accounts; closing a window leaves its Session alive. Cookie-only
restoration does not restore localStorage, IndexedDB or service workers after process exit.

Option B (`persist:...`) would let Chromium retain origin storage per profile. That does not
guarantee eBay will accept a restarted session; session-cookie restoration also needs direct
testing. It can persist sensitive origin data outside Lane's encrypted vault. No Option B
profile was created and no authentication success is claimed for it. Only compare it against
the same successful owner-login baseline if Option A's same-process read passes but cold
restart fails with evidence that required origin storage is missing. Do not switch merely
because the persistent design sounds simpler.

Electron documents shared instances for the same partition and the persistent prefix in its
[Session API](https://www.electronjs.org/docs/latest/api/session#frompartitionpartition-options).
This build asserts object identity at runtime rather than relying solely on that contract.
Background reads use the existing sandboxed BrowserWindow transport, where the Seller Hub
DOM was actually observed. Ordinary Node fetch is not used for marketplace requests. No new
Session.fetch path is claimed tested or required. No raw Cookie headers are constructed.

The diagnostic launcher uses the installed Lane user-data directory so the owner can test
the same profile and DPAPI key. Quit any installed Lane instance first. Startup only attempts
background restoration when a stable identity was previously validated by this version.
Legacy greeting identity is cleared; encrypted cookies are retained. Disconnect clears
browser storage, the encrypted cookie vault, local observations and profile settings.
Windows account compromise/malware can access an unlocked process; encryption at rest is
not protection against control of the signed-in Windows user. No cloud or web renderer can
read the vault. Passwords are entered into marketplace pages and never captured by Lane.

## Checks

- 19 focused Node checks pass: state transitions, conflicting operations, count failures,
  security boundaries and diagnostics redaction.
- Actual Electron session fixture passes: lazy account flyout, profile identity, two-page
  listing discovery, exact shared Session, cookies retained after window closure, invisible
  refresh, expiry and Disconnect.
- Actual Electron reader fixtures pass: greeting alone rejected, known empty eBay account,
  Vinted authenticated inbox and own/foreign wardrobe distinction.
- Desktop startup/local-review smoke checks pass. Typecheck passes.
- No installer build or broad full-suite rerun: the current milestone is a live diagnostic.
  Previous full-suite evidence remains historical; mocks are not acceptance evidence.

## One owner test

ACTION: Run the diagnostic launcher and test fresh eBay and Vinted sign-in once.
SERVICE: Local Lane Desktop and the owner's marketplace accounts.
WHY: The old saved eBay snapshot later requested sign-in; Vinted navigation was inconclusive.
EXACT STEPS: Quit Lane. Double-click `desktop/Launch Lane Session Diagnostic.vbs` in this
repository. Confirm `SESSION DIAGNOSTIC` beside version 0.3.1. Leave website address blank.
Choose Reconnect eBay and complete direct marketplace login/verification. When Seller Hub
appears, allow Lane to validate. If it closes and connects, inspect Discovered listings and
use Refresh listings. If it remains open, run Session probe in Lane while keeping that window
open. Copy diagnostics and report the resulting gate summary. Repeat once for Vinted. Stop
on challenges that need further interaction; no repeated retries. Do not send cookie values.
After successful connection/read, restart the diagnostic and separately test restoration.
COST: GBP0. No installer or API credentials required.
KYC/ID: Normal owner sign-in/MFA only; stop if new ID is demanded.
EXPECTED RESULT: Actual account identity, background validation and owned links/count, or
a precise failed stage with visible/background/session evidence.
BLOCKED WITHOUT THIS: Fresh-session live acceptance, cold restart and the next installer.
CAN YOU CONTINUE OTHER WORK: YES — diagnose returned evidence and repair the failed gate.

After two failed patches to the same live gate, stop and reassess evidence. No other
marketplaces, marketing, billing, AI tools, infrastructure or redesign during this repair.
