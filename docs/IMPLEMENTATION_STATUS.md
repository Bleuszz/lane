# Lane implementation status

The branch is a tested local beta foundation, not a finished or deployed service. Read `../progress.txt` for current results and owner-only gates. No real marketplace writes or paid inference were used during this work.

## Working locally

Source data is kept separately from destination fields. Imports use stable source identities and database transactions; retries cannot overwrite an edited item or leave a half-written photo collection. Missing condition/category/material remain unresolved. Destination specifics are checked against eBay taxonomy when credentials are available. AI is optional, text-backed, bounded and reviewed; it fills blanks rather than replacing manual specifics. Negated evidence is rejected conservatively.

Photo studio preserves the original and adds a 1200px JPEG copy. It adjusts framing, rotation and lighting; background removal is not implemented. Local JPEG/PNG files up to 2 MB now resolve to eBay-hosted URLs through the Media API when an authorized publish/update job runs. All selected photos are validated before upload, successful receipts are cached per owner/account/environment/content hash, and originals remain unchanged. Real provider upload acceptance is still unverified.

Jobs have durable intent keys, atomic claims, leases, guarded retries and remote-offer reconciliation. Sale events and inventory changes commit with their delist outbox. Browser jobs require a matching claim token and interrupted creates are parked for reconciliation instead of blindly repeated. Vinted bridge and server routes still require real account verification.

A seven-day no-card trial has 25 lifetime actions and zero AI. Paid plans have server-enforced action/AI allowances. AI credits and estimated supplier cost are separate; refunds do not erase provider liabilities. Unknown token use keeps the conservative cost reservation. Cost guards may pause AI before all credits are spent. Current launch prices are GBP9/19/29; checkout cannot use old price IDs for new prices and stays gated off.

## Important remaining implementation

- Per-seller eBay policy/location selection is implemented and revalidated on save; live verification remains. Complete current category and condition mappings. The two women's knitwear source leaves are preserved, but their eBay mapping remains unconfirmed pending authenticated taxonomy checks.
- The dedicated-secret `/api/worker` endpoint is implemented (maximum three eBay jobs per invocation). A configured host scheduler and verified sold-event ingestion are still needed before promising automatic delisting while the app is closed. No scheduler has been activated, so current eBay queue progress is driven by application requests; Vinted needs an available session/bridge.
- Vinted authenticated list/detail responses may omit fields; verify the full real import and add bounded detail retrieval where the observed response requires it.
- Verify the implemented eBay Media API upload route in the authorized sandbox, including response expiry, formats, image quality and runtime. No extra hosting service was created.
- Multi-unit sale logic accepts stable order-line IDs internally; the current manual sale button is restricted to quantity one until a proper quantity/reference form is supplied.
- Source-shaped fixtures and mocked eBay responses do not certify live connector compatibility. Finish the ten-item benchmark, mobile UI QA, authenticated Stripe test-mode checks and seller isolation review before a pilot.
- Existing resale fee estimates are inherited approximations, not reconciled seller profit. The draft form now shows destination prices rather than claiming a universal take-home amount. SaaS contribution assumptions are in ECONOMICS_DEPLOYMENT.md.

## Test baseline

The portable full runner exposes 284 tests: 266 pass and 18 inherited template tests fail. These cover absent `.grok`/skill/auth fixture files, Grok-specific metadata expectations and Windows symlink permissions. They existed before the Lane changes and are not disabled. Core 33 pass in the current full run; auth/app-data 55 passed in the previous run. Continue tracking that baseline rather than claiming the whole repository is green.

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

Batch review has since been implemented below. Test real connected eBay taxonomy/validation states before a paid pilot. Mobile layout checks do not certify phone-based marketplace connection support.

## Reviewed batch publishing — 11 September BST

Inventory publishing now selects destinations, loads each saved item, and requires a full preview approval for every item before a separate final batch confirmation. Reviews show all photos, destination prices and validation blockers; an Edit listing link returns to the editor. No approval is a publish action by itself. A server hash covers saved item content and relevant destination/pricing settings; changes require a fresh review. Routine account heartbeats do not invalidate it.

Queue creation now locks all selected item parents in a transaction, checks ownership and availability before writing, verifies the full review set, and commits the batch together. A late database or destination preparation error rolls back prior queue writes. Sold/archived/foreign or missing selections reject the batch. Network marketplace processing starts only after commit. Multi-item calls require review hashes; existing single-item editor calls retain their existing preview flow.

Verification: 24 focused tests pass, including new hash invalidation/coverage and PGlite ownership/rollback checks. TypeScript, changed-file ESLint and production build pass. Browser checks at localhost:8081 used the synthetic draft and a newly created offline Vinted placeholder (no credential/session). The actual preparation endpoint showed both photos and its destination rule price, blocked incomplete fields/offline approval, and kept final batch confirmation disabled. No publish attempt was made. Connected success and full PostgreSQL concurrency remain staging checks. The last full-suite result remains 255 pass / 18 inherited failures; it predates these two new tests.

The dispatch gap identified in this checkpoint is addressed by the immutable snapshots below. Cleaned-photo delivery remains a release gate.

## Immutable queued listing content — 11 September BST

Publish, relist and user-requested update jobs now reference owner-scoped immutable snapshots of listing data and destination price. A content hash deduplicates identical revisions; private cost/notes, account credentials and live receipts are excluded. Retries preserve the original snapshot reference. Both eBay processing and Vinted bridge delivery load that saved revision. Current item state still controls sold/archive handling and caps quantity at the smaller of current stock and the queued amount. Missing/invalid/foreign or legacy snapshot references fail closed instead of taking the latest edited content.

Partial sales produced by `lane_record_sale` retain their stock-update path. These jobs are identified by their authoritative sale/request relationship and use a quantity-only eBay request; they do not require a content snapshot or rewrite price, description or photos. The adapter checks each returned SKU/offer status rather than trusting an HTTP success alone. See [eBay quantity-update guidance](https://www.developer.ebay.com/api-docs/sell/static/inventory/bulk-updates.html).

Verification: the full portable suite now reports 278 tests, 260 pass and the same 18 inherited template failures. All 27 focused core checks pass within that suite. Real PGlite tests cover actual enqueue/claim and bridge dispatch after subsequent edits, duplicate enqueue retaining its first snapshot, stock reduction/increase caps, owner/item isolation, missing snapshots and no bridge dispatch/credit consumption after sale. The sale-outbox identity and quantity-only request are tested; eBay network results remain mocked. TypeScript, changed-file lint and production build pass.

Limits: snapshot references preserve the selected photo URLs, not the remote bytes if a source URL later changes/expires. Current category mapping code and seller policy configuration are still checked at execution. Cross-marketplace sale races and live receipts require the existing reconciliation/staging tests. Pre-snapshot content jobs require operator review, not automatic conversion to today's data. This branch has no deployed users or known live jobs needing migration.

## Photo delivery checkpoint

The worker supplies a lazy photo resolver to eBay publishing/updating. Already-live offer reconciliation returns before any upload. Otherwise, listing writes wait for the entire photo set. New JPEG/PNG files are uploaded as multipart `image` files; existing HTTPS URLs pass through without server-side fetching. Lane checks MIME/signature, a 2 MB local file bound, a maximum of twelve photos, and the provider's HTTPS URL/expiry receipt. Fetch rejects redirects and has a 30-second timeout per upload; the job lease is renewed before each write.

Migration 0013 stores only content hashes and upload receipts in the existing database. Receipts are cached separately for each owner, account and environment, expire with a five-minute safety margin, and survive later-photo failures. Canonical image data and immutable queued snapshots are not replaced. A missing/lost response before persistence may still leave an unused provider image, and concurrent jobs may upload the same image; exactly-once media creation is not claimed. Listing reconciliation remains independent.

Thirty focused core tests pass, including three new photo tests covering database-backed cache behavior and mocked multipart/listing requests. Full suite: 281 total, 263 pass, the same 18 inherited failures. TypeScript/build pass; current photo-change lint has zero errors and two existing React refresh warnings. Local browser checks confirmed invalid URL feedback, loaded originals and the unconnected publish gate. No real upload or marketplace mutation was performed.

## Stock changes during execution

Before each eBay photo/content/quantity write, the worker renews its lease and rereads owner-scoped item stock and account status. Content jobs cannot exceed the approved snapshot or current availability; stock-only jobs require the exact current quantity. Sold/archived, paused/disconnected and expired/foreign work stop. An interrupted job's retry reloads current stock while retaining its original content and upload receipts. Successful update bookkeeping now records quantity, and completion preserves a concurrent account pause/re-auth state.

Migration 0014 gives each distinct sale its own outbox key. A sale during an existing content or stock job therefore retains a queued follow-up rather than colliding with that older intent. Sale-event deduplication still prevents duplicate decrements; per-channel leases serialize execution. Existing jobs are preserved. No automatic reconstruction of previously suppressed jobs is attempted.

These checks narrow the interval between stock read and outward write; they are not an atomic transaction with eBay. A sale after the check still needs its durable follow-up, and an unobserved remote sale still requires ingestion. No overselling guarantee is made. Three new regression tests pass, including an actual database sale during a mocked upload and queued follow-ups behind running jobs. Current full suite: 284 total / 266 pass / 18 inherited failures; 33 core tests pass within that run. TypeScript, changed-server lint and production build pass.
