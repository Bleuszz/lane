# Lane implementation status

Lane is a tested local beta foundation, not a finished or deployed service. Only Vinted UK and eBay UK are implemented; other marketplaces stay in the roadmap. Current checkpoints, checks, owner-only steps and usage are in `../progress.txt`. No real marketplace mutation, deployment, purchase or paid inference was used in this work.

## Product and source preservation

The app has a redesigned landing page, help/billing screens, accessible forms, a first-crosslist checklist, mobile inventory cards and dialogs with focus restoration and scroll containment. Bulk actions require explicit selection. Saved drafts can be previewed without a connection; publishing still requires a connected destination and a complete review.

Imports preserve source identity, descriptions, photos, category identity, size ranges, multiple colours and unknown fields. Item/photo/tag writes are transactional. Source retries cannot overwrite later manual edits. Per-marketplace fields preserve seller overrides; unconfirmed taxonomy mappings block publication. Two owned Vinted pages were inspected, but public-page inspection and source-shaped fixtures do not prove authenticated import.

Batch publishing requires each item's preview approval followed by final batch confirmation. Owner checks and review hashes reject changed saved data, prices or destinations. Transaction locks prevent partially queued batches. Queued content jobs use immutable owner-scoped snapshots; retries keep approved content and price while live inventory caps quantity. Legacy jobs without snapshots require explicit review.

Photo studio produces a 1200px JPEG copy with crop/framing, rotation and lighting adjustments, retaining the original. Background removal is not implemented. During authorized eBay jobs, local JPEG/PNG files up to 2 MB resolve through its Media API. Existing HTTPS URLs pass through without server-side downloading. Whole-selection validation, upload receipts scoped by owner/account/environment/hash, expiry margins and lease checks preserve all photos and reuse successful uploads after partial failure. Listing writes wait for every selected photo. Lost acknowledgements or concurrent uploads may still leave unused provider images; exactly-once media creation is not claimed.

## Execution, stock and recovery

Jobs have stable intents, atomic claims, channel leases, guarded retries and eBay offer reconciliation. Interrupted browser creates need reconciliation rather than blind replay. Sale records, stock changes and their follow-up jobs commit together; duplicate sale delivery cannot decrement twice. Each distinct sale retains its own follow-up even while a content/stock job is active. Partial-sale eBay updates change quantity only.

Before outward eBay photo/content/quantity writes, the worker rereads stock and account status and renews its lease. Sold/archived items, reduced stock, paused/disconnected accounts and expired/foreign work stop. Retry reloads current quantity without substituting unapproved content. Completion preserves concurrent account pauses/re-auth state. The database check and remote write are not atomic: verified sale ingestion and retained follow-ups remain necessary, and there is no overselling guarantee.

Temporary eBay connection/response failures and HTTP 408/429/500/502/503/504 automatically return eligible worker jobs to the queue. Backoff starts at 30 seconds and doubles, adds up to five seconds of jitter, and honours a longer Retry-After. Automatic execution stops at five total attempts or the lower job limit. Provider holds beyond 24 hours require review. Cooldown survives in the database and appears in Activity; early claims and batch selection cannot bypass it. Permanent responses, invalid data, ambiguous receipts, stock changes and unknown errors do not qualify. Browser creates never gain automatic replay from this policy. Cooldowns are job-scoped, not account/application-wide quota coordination.

Per-seller eBay policies/location are selected and revalidated against that account. `/api/worker` uses a dedicated secret and processes bounded batches. No scheduler has been activated. Automatic retry means eligibility for subsequent queue processing, not a running scheduled service; staging needs a configured trigger and measured runtime.

## Trial, AI and billing

The seven-day no-card trial grants 25 lifetime publish/relist actions and zero AI. Proposed GBP9/19/29 plans have server-enforced allowances; checkout stays gated pending verification. AI is opt-in, evidence-backed, limited to supported values and preserves manual entries. Credits, usage estimates, refunds and supplier cost guards are separate; unknown usage retains its conservative provider-cost reservation. Local photo adjustments use no paid image model.

Signed Stripe events reconcile current paid subscription state with durable deduplication, serialized provider reads and owner binding. Unknown prices, unpaid state and ambiguous replacement bindings withhold access. Test-mode event delivery, Checkout/Portal behavior and replacement-subscription operations still need authorized verification.

## Current evidence

TypeScript, production build and current changed-file ESLint pass. The full portable suite reports **287 tests: 269 pass, 18 inherited failures**. All **36 core tests** pass within that run. The inherited failures concern missing template/skill/auth fixtures, Grok metadata assumptions and Windows symlink permissions; they are not disabled.

Tests use real isolated PGlite with mocked providers. They cover persistence/rollback, ownership, concurrency, quotas, source details, snapshot-backed bridge dispatch, lost eBay acknowledgements, stock changes during uploads, retained sale follow-ups, photo receipt expiry, billing replay and automatic retry cooldown/exhaustion. The retry integration proves one remote listing and one action/hourly reservation after a lost publish response. Browser QA covered draft/photo save and reload, 362x698 cards/dialogs/focus, no horizontal overflow, batch blockers and invalid URL feedback. No connected end-to-end publication has been verified.

## Remaining gates and productive local work

- Authorized eBay keys/RuName/seller session and Vinted bridge login are needed for real import, current taxonomy/conditions, seller policies, photo acceptance and controlled marketplace tests. Eight more varied owned items are needed for the ten-item benchmark.
- Staging needs an explicitly chosen host/database, secure auth/token configuration, migration approval, measured storage/runtime, a worker trigger and verified sold-event ingestion. No infrastructure was created. Follow `STAGING.md`, including migrations through 0014 and legacy-job review.
- Verify provider rate-limit scope and account/application cooldown behavior before volume tests; the current job policy alone does not coordinate a shared provider quota.
- Add the quantity/reference form for manual multi-unit sales. Review deletion and snapshot retention without deleting pending work or erasing evidence needed for reconciliation.
- Reconcile fees before presenting seller profit. SaaS unit economics remain assumptions in `ECONOMICS_DEPLOYMENT.md`; no paid pilot, revenue or competitive performance claim is established by these tests.
