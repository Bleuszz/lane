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
- Source-shaped fixtures and mocked eBay responses do not certify live connector compatibility. Finish the ten-item benchmark, mobile UI QA, auth/billing webhook replay checks and seller isolation review before a pilot.
- Existing resale fee estimates are inherited approximations, not reconciled seller profit. The draft form now shows destination prices rather than claiming a universal take-home amount. SaaS contribution assumptions are in ECONOMICS_DEPLOYMENT.md.

## Test baseline

The portable full runner exposes 271 tests: 253 pass and 18 inherited template tests fail. These cover absent `.grok`/skill/auth fixture files, Grok-specific metadata expectations and Windows symlink permissions. They existed before the Lane changes and are not disabled. Core 20 and auth/app-data 55 pass. Continue tracking that baseline rather than claiming the whole repository is green.

Builds and migrations are separate operations. Node 24.14 was used locally. No remote database was migrated.


## Latest verification and limits

Production build and TypeScript pass. Scoped lint has no errors (four existing-style React refresh/dependency warnings). Local browser QA covered the landing page, activation checklist, accessible draft fields, draft save/reload and Photo studio export. A bundled illustration was used for the photo test; the original and 1200px JPEG copy both survived reload. No horizontal overflow was observed at the tested desktop width. Narrow-screen and connected publish-preview QA remain explicit followups.

The worker requires a separate 32+ character secret, rejects unauthorized calls, preserves job ownership and honors paused accounts. It processes queued eBay jobs and expired-lease recovery; it does not implement an eBay order feed or magically detect sales. Terminal failed jobs still require review/retry rather than unlimited automatic replay.

New source eBay imports now retain offer/SKU receipts for subsequent delisting. Unknown generic used condition remains a review requirement instead of being silently labelled very good. Historical imported rows lacking these receipts need a separate repair/reconciliation pass before being relied on for automatic delisting.
