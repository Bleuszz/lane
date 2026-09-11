# Staging handoff

No staging deployment exists. Local work is not blocked by this. No service, subscription, domain or paid API was purchased.

## Required before deployment

1. Choose an existing suitable host and durable PostgreSQL database, with access granted through the normal provider tooling. The current Nitro output targets Vercel. Cloudflare remains an option but its adapter/database compatibility is not verified; `wrangler.toml` alone is not deployable proof. Cost/eligibility assumptions are in ECONOMICS_DEPLOYMENT.md. Do not purchase a plan automatically.
2. Set `VITE_AUTH_ENABLED=true`, a strong `BETTER_AUTH_SECRET`, exact HTTPS `BETTER_AUTH_URL`, and `DATABASE_URL` in the host secret store. Local PGlite is in memory and is not staging storage. Keep the encryption secret stable after tokens are stored.
3. Use `.env.example` for the current configuration names. Set eBay sandbox App ID, Cert ID and RuName, with accepted redirect `https://HOST/api/ebay/callback`. The seller must authorize the account. Policies and merchant location belong to each seller account; do not install a global seller address.
4. Run `npm ci`, `npm run typecheck`, `npm run test:lane` and `npm run build`. Run `npm run db:migrate` separately only against the identified staging database after verifying target and backup/rollback arrangements. Builds no longer invoke migrations.
5. Keep `LANE_BILLING_V2_READY=false`, `LANE_ALLOW_PREVIEW_PLANS=false` and paid AI unconfigured for the initial no-cost smoke test. If payment testing is later authorized, use Stripe test mode, the V2 GBP price IDs, signed webhooks and portal configuration. Verify actual price/currency/product/interval before enabling checkout. Never paste secrets in issues or committed files.
6. Load the current `extension/` folder locally and pair it to the exact Lane origin. Results now require `claimToken`; an old bridge build is incompatible. The seller signs in on Vinted itself. A copied token or public URL does not prove the full connection works.

## Release checks after access is available

- Sign in/out, account isolation, trial expiry, plan enforcement, and secret handling.
- Read-only import first: both provided Vinted examples, all 6/7 photos, original descriptions, brand, category, condition, size ranges and colours. Material is unknown unless explicitly supplied. Verify live taxonomy before confirming new category mappings.
- Review destination fields and prices. Obtain the owner's exact authorization for any real publish/edit/delist test. Confirm IDs/URLs remotely, inject a lost acknowledgement, and verify retries create no duplicate. Never count a queued job as success.
- After staging approval, configure the host scheduler to call GET or POST `/api/worker` with `Authorization: Bearer <LANE_WORKER_SECRET>` (a dedicated random secret of at least 32 characters). It handles at most three eBay jobs per request; set a compatible runtime timeout and measure duration before choosing cadence. No schedule is installed by this branch. Verify sold-event ingestion and delist confirmation; test duplicate event delivery and restart recovery.
- Verify the implemented Media API photo route with authorized seller credentials before promising cleaned-image publishing. Check format/size acceptance, receipt expiry, image quality, account isolation and retry behavior.
- Benchmark ten varied owner-approved items (two supplied so far), recording time, missing fields, corrections, photos and final result. This is the gate for comparative marketing claims and paid acquisition.

## Local commands

`npm run dev` runs on 127.0.0.1:8080. An explicit `VITE_AUTH_ENABLED=false` override may be used only with no DATABASE_URL for isolated synthetic local testing; do not carry it into staging. In-memory drafts disappear when the process restarts. `npm run test:lane` does not use real credentials or marketplace writes. `npm test` also runs inherited template tests and currently reports their documented failures.

## Billing webhook release gate

The local reconciler now uses Stripe Node 22.6.2 / API 2026-08-26.dahlia to retrieve the current subscription with its latest invoice. No Stripe requests were made in the test run. Checkout/portal creation retains the existing form transport; verify those flows in test mode before enabling billing.

Apply migration 0011 only to the identified staging database. It adds event receipts, per-subscription serialization and unique customer/subscription bindings. Audit pre-existing duplicate bindings first; do not delete customer data to force migration success. A subscription replacement is deliberately held as `binding_conflict` for explicit reconciliation; automatic migration between subscriptions is not implemented.

Configure the signed endpoint for subscription created/updated/deleted/paused/resumed; Checkout completed/async_payment_succeeded/async_payment_failed; invoice paid/payment_failed/payment_action_required/voided/marked_uncollectible. Current invoice `parent.subscription_details.subscription` and legacy `subscription` references are supported. Verify deliveries in Stripe test mode, including delayed payments, duplicate delivery, cancellation, recovery and price changes. Provider/database failures return 503 and roll back the event receipt, allowing retry. Inspect receipt outcomes for `binding_conflict` and `unknown_price`; an alert/dashboard for these is still needed before production.

Only a recognized single plan at quantity one, active subscription, paid latest invoice and no collection pause grants paid access. Provider trials do not reset Lane's no-card trial. Unknown prices and other statuses withhold paid access. This conservative rule can also suspend access on an unpaid immediate-upgrade invoice; test the intended portal proration configuration before launch.

Use separate environment keys in the host secret store, preferably restricted keys with only required Checkout/Portal/subscription read permissions. No secrets belong in source or logs. Tax registration and collection settings must be reviewed before accepting payments; `automatic_tax` has not been enabled. See [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [webhook delivery and signature guidance](https://docs.stripe.com/webhooks), and [recurring-payment tax setup](https://docs.stripe.com/billing/taxes/collect-taxes).

## Listing snapshot migration and storage

Migration 0012 adds `listing_snapshots`; no new service is required. Apply it before running the updated workers. Publish/relist/user-update jobs without snapshot references will stop for review. Identify any legacy jobs, reconcile remote listings and obtain an explicit decision before superseding/requeueing them; never copy current edited data into old jobs automatically. Database-generated partial-sale updates remain stock-only and do not need snapshots.

Measure snapshot bytes with representative photo sets before selecting a paid plan. Identical content/price revisions are deduplicated, but data-URL photos and different destination prices still increase storage. Photo delivery now uses eBay Media API receipts in the same database (migration 0013); real provider verification remains. Establish owner deletion/retention rules before a paid pilot: referenced snapshots must survive pending work and retries; unreferenced/expired revisions need a safe retention policy. No automatic purge was introduced. Verify sandbox partial-sale updates, per-offer error handling, edited-after-queue behavior and lost acknowledgements with real provider responses.

## eBay image delivery

Apply migration 0013 before enabling photo jobs. No bucket, CDN subscription, new service, API key or image-generation provider is required by this implementation. It uses the seller's existing `sell.inventory` OAuth scope and `POST /commerce/media/v1_beta/image/create_image_from_file` with multipart field `image`. eBay's `imageUrl` and `expirationDate` response drives receipt caching. Production uses api.ebay.com; sandbox uses api.sandbox.ebay.com, with no automatic environment fallback. Verify the sandbox route and actual receipt shape before any approved production test.

Sources: [eBay managing images](https://www.developer.ebay.com/api-docs/sell/static/inventory/managing-image-media.html), [Media overview](https://developer.ebay.com/api-docs/commerce/media/static/overview.html), and [eBay's Media schema](https://www.ebay.co.jp/developer/api/media_api/documentation). Use the Media API rather than adding the deprecated Trading picture-upload call.

Test one small owned JPEG, a PNG, a Photo studio copy and a mixed HTTPS/local set. Compare order, colour and visible defects with originals; eBay may resize/recompress images. Simulate partial upload failure and confirm successful receipts are reused. Check near-expiry refresh, invalid/missing receipts, and an already-live job retry. A lost upload acknowledgement or simultaneous upload may leave an unused image at eBay; do not claim exact-once media creation. No remote image cleanup is implemented.

Lane deliberately accepts only JPEG/PNG uploads up to 2 MB each, even though eBay supports additional formats. Existing HTTPS photos are not fetched by Lane's server. This caps individual file memory, but twelve-file snapshots and upload duration still need measurement against the chosen host's request/runtime limits. Originals remain in the current database; eBay hosting does not remove Lane's storage/retention work.

## Stock-race follow-up (migration 0014)

Apply 0014 before the updated worker is used for the pilot. It replaces the sale transaction function so each new sale retains its own destination follow-up. It does not rewrite existing jobs, reconstruct past suppressed events or contact marketplaces. Reconcile existing channel quantities and pending/error jobs before replay; no automatic legacy replay is authorized.

In the authorized sandbox, record a sale while an image upload or listing update is in flight, then verify that stale writes stop or the separately retained sale job corrects the destination. Repeat with two distinct partial sales, duplicate event delivery, final depletion and an account pause during execution. Verify the eventual remote quantity and ended state, not merely the queued/done labels. Lane's database check and eBay's write are not atomic; reliable ingestion plus retained follow-ups are still required. Stock-change errors currently stop for guarded retry rather than being blindly replayed.


## Automatic retry policy

The existing `jobs.retry_after` column now holds a durable cooldown for temporary eBay transport errors. No additional migration or scheduler is required by this code change. Configure the approved queue trigger separately; neither cooldown expiry nor an open Activity page alone proves the worker ran. Activity displays the earliest retry time, not a promised completion time.

Eligible failures: interrupted connection/response and HTTP 408, 429, 500, 502, 503, 504. Delay is 30/60/120/240 seconds for attempts 1-4 plus up to five seconds of jitter, or a longer provider Retry-After. A lower job limit is honoured; automatic retry never extends past five total attempts. A Retry-After longer than 24 hours leaves the job for review. Permanent responses, invalid listings, ambiguous success receipts, stock changes and unknown exceptions remain stopped. Browser creates retain their reconciliation gate.

Verify a lost create/publish acknowledgement, cooldown, paused account, server restart and attempt exhaustion with authorized sandbox responses. The local full-process test proves no early HTTP call, duplicate remote listing or extra action/hourly reservation after a lost publish response. Current cooldown is per job; add/verify account or application-wide coordination if provider quota behavior requires it before volume testing. No real failure injection or marketplace mutation has occurred.


## Manual sale metadata (migration 0015)

Apply 0015 before using the revised manual-sale route. It adds reference, amount basis and total cost-at-sale fields; existing estimated amounts remain labelled estimated and historical cost snapshots remain unknown. The form records the total amount for all units in that entry, excluding postage, plus optional known fees. Saved item cost is treated as per-unit and multiplied by quantity. The margin display is limited to entries with entered fees and a known cost snapshot, excluding postage/refunds/tax; it is not proof of payment or cash profit.

With an authorized staging item, verify quantity/reference entry, accurate shop selection, repeat submission after a lost response, different details under a used reference, insufficient stock, a partial sale and final depletion. Use the actual marketplace order-line ID when available so later imported events can share its key. Vinted sold-listing observations do not necessarily provide that key; manual-versus-automatic reconciliation still needs real response verification before promising universal deduplication.

Local tests use real PGlite transactions and no marketplace calls. They verify concurrent duplicate prevention, owner boundaries, immutable cost totals, unknown fees and rollback of the sale/stock/outbox if the metadata update fails. Browser QA covers the unlinked gate and modal focus, not a real connected sale submission. No genuine sale was recorded during implementation.
