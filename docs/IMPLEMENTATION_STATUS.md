# Lane implementation status

The branch is a tested local beta foundation, not a finished or deployed service. Read `../progress.txt` for current results and owner-only gates. No real marketplace writes or paid inference were used during this work.

## Working locally

Source data is kept separately from destination fields. Imports use stable source identities and database transactions; retries cannot overwrite an edited item or leave a half-written photo collection. Missing condition/category/material remain unresolved. Destination specifics are checked against eBay taxonomy when credentials are available. AI is optional, text-backed, bounded and reviewed; it fills blanks rather than replacing manual specifics. Negated evidence is rejected conservatively.

Photo studio preserves the original and adds a 1200px JPEG copy. It adjusts framing, rotation and lighting; background removal is not implemented. New/edited images still need a public HTTPS hosting route for eBay. Every selected eBay photo is checked so unhosted copies cannot disappear silently.

Jobs have durable intent keys, atomic claims, leases, guarded retries and remote-offer reconciliation. Sale events and inventory changes commit with their delist outbox. Browser jobs require a matching claim token and interrupted creates are parked for reconciliation instead of blindly repeated. Vinted bridge and server routes still require real account verification.

A seven-day no-card trial has 25 lifetime actions and zero AI. Paid plans have server-enforced action/AI allowances. AI credits and estimated supplier cost are separate; refunds do not erase provider liabilities. Unknown token use keeps the conservative cost reservation. Cost guards may pause AI before all credits are spent. Current launch prices are GBP9/19/29; checkout cannot use old price IDs for new prices and stays gated off.

## Important remaining implementation

- Per-seller eBay policy/location selection is implemented and revalidated on save; live verification remains. Complete current category and condition mappings. The two women's knitwear source leaves are preserved, but their eBay mapping remains unconfirmed pending authenticated taxonomy checks.
- The dedicated-secret `/api/worker` endpoint is implemented (maximum three eBay jobs per invocation). A configured host scheduler and verified sold-event ingestion are still needed before promising automatic delisting while the app is closed. No scheduler has been activated, so current eBay queue progress is driven by application requests; Vinted needs an available session/bridge.
- Vinted authenticated list/detail responses may omit fields; verify the full real import and add bounded detail retrieval where the observed response requires it.
- Public HTTPS hosting/upload of new or cleaned photos remains a release requirement, not an excuse to create paid infrastructure while the owner is absent.
- Multi-unit sale logic accepts stable order-line IDs internally; the current manual sale button is restricted to quantity one until a proper quantity/reference form is supplied.
- Source-shaped fixtures and mocked eBay responses do not certify live connector compatibility. Finish the ten-item benchmark, mobile UI QA, authenticated Stripe test-mode checks and seller isolation review before a pilot.
- Existing resale fee estimates are inherited approximations, not reconciled seller profit. The draft form now shows destination prices rather than claiming a universal take-home amount. SaaS contribution assumptions are in ECONOMICS_DEPLOYMENT.md.

## Test baseline

The portable full runner exposes 273 tests: 255 pass and 18 inherited template tests fail. These cover absent `.grok`/skill/auth fixture files, Grok-specific metadata expectations and Windows symlink permissions. They existed before the Lane changes and are not disabled. Core 22 pass in the current run; auth/app-data 55 passed in the previous run. Continue tracking that baseline rather than claiming the whole repository is green.

Builds and migrations are separate operations. Node 24.14 was used locally. No remote database was migrated.


## Latest verification and limits

Production build and TypeScript pass. Scoped lint has no errors (four existing-style React refresh/dependency warnings). Local browser QA covered the landing page, activation checklist, accessible draft fields, draft save/reload and Photo studio export. A bundled illustration was used for the photo test; the original and 1200px JPEG copy both survived reload. No horizontal overflow was observed at the tested desktop width. Narrow-screen QA now covers the unconnected path at 362x698. Connected publish-preview QA remains a followup.

The worker requires a separate 32+ character secret, rejects unauthorized calls, preserves job ownership and honors paused accounts. It processes queued eBay jobs and expired-lease recovery; it does not implement an eBay order feed or magically detect sales. Terminal failed jobs still require review/retry rather than unlimited automatic replay.

New source eBay imports now retain offer/SKU receipts for subsequent delisting. Unknown generic used condition remains a review requirement instead of being silently labelled very good. Historical imported rows lacking these receipts need a separate repair/reconciliation pass before being relied on for automatic delisting.

## Billing reliability checkpoint — 11 September BST

Signed webhooks use the official SDK with timestamp validation and signing-key rotation support. A transaction stores each event receipt together with its entitlement update. Per-subscription locks serialize provider reads, so delayed payloads are not applied as current state. The current Stripe subscription and expanded invoice determine access; unpaid checkout metadata never grants a plan. Unique customer/subscription bindings prevent cross-user entitlement reuse. Invoice events from an older subscription cannot replace the bound subscription. Failed provider reads or database writes remain retryable without a poisoned receipt.

Two new tests exercise signatures and real PGlite migration/rollback/deduplication/isolation using an injected Stripe reader. These are local simulations, not completed Stripe integration certification. All 22 focused tests, TypeScript, billing-file ESLint and production build pass. See STAGING.md for supported event types, conservative payment gates and remaining operator reconciliation work.

## Mobile and review usability — 11 September BST

Inventory uses product cards below the desktop breakpoint, keeping photos, price, quantity, status, SKU and shopfronts readable without table scrolling. Bulk publish/delist/delete require explicit selection. Inventory keyboard shortcuts ignore active dialogs, native controls, links and modifier combinations. The menu, batch dialog, Photo studio and review share native modal behavior with background scroll locking and focus restoration.

A saved item can be previewed before connecting an account; confirmation is still disabled without a selected connected destination. The preview has a scrollable content area and a visible action footer on small screens. At the tested 362x698 viewport, the inventory and preview had no page-level horizontal overflow. Browser checks verified modal state, focus entering the close button and returning to the opener, retained product selection and blocked no-account publishing. Photo studio loads in its labelled dialog. TypeScript, scoped lint and production build pass after these changes. Existing 22 core tests / full-suite 255 pass and 18 inherited failures were last run at the billing checkpoint; no new automated test was added for these presentation changes.

Remaining UX work: batch publish currently selects accounts without a complete per-item destination preview. Add that review flow before a paid pilot, and test real connected eBay taxonomy/validation states. Mobile layout checks do not certify phone-based marketplace connection support.
