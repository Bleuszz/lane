# Scheduling and image preparation foundation

Status: disabled foundation, validated locally with synthetic data. No new marketplace write
transport is installed. No infrastructure, cron, paid processing or AI service was added.
The existing eBay/Vinted login, session storage and listing discovery implementation is unchanged.

## Boundaries and capability policy

`src/lib/lane/scheduler/policy.ts` is the policy source of truth, separate from executor code.
For **both eBay UK and Vinted UK**, PUBLISH, RELIST, UPDATE, DELIST and PRICE_UPDATE are currently
**MANUAL_ONLY**. Batch automation and automatic scheduling are not validated. Image normalization
is EXPERIMENTAL preparation; this is not a claim that each marketplace accepts every export.

MANUAL creates reminders that become REQUIRES_USER_ACTION when due. It never records a remote
success or charges a listing action. The user still performs the marketplace action themselves.
ASSISTED, SCHEDULED and AUTOMATIC require explicitly SUPPORTED policy, automation permission and
a registered trusted inspector/executor. Production registers neither. Changing flags alone
cannot authorize writes. The test suite injects a local executor; it makes no network requests.

## Durable lifecycle and dispatch

Migration `0021_scheduler_normalization.sql` adds separate `scheduled_actions`, `schedule_batches`,
`scheduler_settings`, `scheduler_scopes`, `scheduler_attempts`, `scheduler_events`,
`scheduler_notifications` and `image_normalizations` tables. The retained OAuth worker cannot
consume the new table. No in-memory timer is the schedule source of truth.

Jobs record owner, marketplace/account/item, operation/mode, immutable request identity, snapshot
hash, schedule/expiry/start/completion, attempts, lease, safe error code and remote receipt ID.
States include DRAFT, QUEUED, SCHEDULED, WAITING, WAITING_FOR_DEVICE, RUNNING, SUCCEEDED, FAILED,
RETRY_WAIT, PAUSED, CANCELLED, REQUIRES_RECONNECT and REQUIRES_USER_ACTION. Scope/batch pauses are
stored separately so pausing cannot erase an underlying recovery or uncertain-result state.

`SchedulerService.queue()` locks the owner's settings row, revalidates the batch and inserts all
jobs in one transaction. A stable owner/request key returns the same batch on retry; a changed
payload with the same key fails. An active-intent unique index prevents overlapping item/account
jobs, even for different operations. Known remote targets are retained on non-publish jobs and compared with fresh inspection;
a changed target requires review. Existing remote state, pending legacy jobs and recent
successful publish/relist intents also block duplicate creation. An ambiguous result remains a
block even if its queued work is cancelled. A future verified reconciliation path must resolve
that block; cancellation is not evidence that a remote write did not happen.

`runNext(owner)` claims work under a PostgreSQL transaction advisory lock and owner lock. SQL
time is authoritative; fake time is dependency-injected only in tests. It checks flags, user
enablement, all pause scopes, holds, expiry, active hours, policy, current listing snapshot,
legacy conflicts, trusted account/device health and recent remote state. A future inspector must
explicitly validate destination requirements and image readiness, as well as account identity.
No arbitrary online device is treated as proof of this seller's session. Read failures wait;
offline devices use WAITING_FOR_DEVICE without an attempt charge. Reads have a bounded timeout.

Only one write per account may hold a lease. The executor receives a stable idempotency key and
an AbortSignal. Execution is outside the database transaction; its timeout is 60 seconds, lease
120 seconds. Lease-token checks prevent late results from overwriting recovery. A claimed action
is already active: pause/cancel does not pretend it can undo a potentially committed operation.

The authenticated web action currently checks due reminders on demand. A periodic worker/device
claim loop is a **future integration gate**, not a running service. Refreshing a page is not
required to preserve jobs. An interrupted RUNNING write is recovered as REQUIRES_USER_ACTION,
with its account paused; it is never blindly replayed after restart. Schedules past their expiry
need review. Scheduling horizon is seven days; each queued intent expires seven days after its
planned start. Server and browser clocks cannot override dispatch time/caps.

## Settings and caps

`settings.ts` validates server-side configuration. Defaults: OFF, approval required, five-minute
minimum spacing, ten items per batch, twelve attempts per rolling hour, fifty per rolling day,
three consecutive failures, three retries with 30/120/600-second backoff, a fifteen-minute pause
after ten completed actions, all weekdays, 09:00–20:00 Europe/London. Quiet hours are opt-in.
Additional batch and marketplace failure thresholds are configurable. Extra confirmation is
required above the user's item threshold, and cannot be bypassed by the browser.

Effective caps take the minimum of system, marketplace and user/override caps. System ceilings
are thirty attempts per rolling hour, one hundred per rolling day and fifty items per batch;
current marketplace policy lowers these to twelve/fifty/twenty. These are Lane product defaults,
**not marketplace-published rate limits**. Attempts include safely retried failures. A shared
advisory lock protects the system ceiling across owners/workers; user marketplace and account
ceilings are also enforced. Changing timezone does not reset rolling usage. Existing publish/
relist action allowance is reserved using the job's stable key; retries cannot charge it twice.

Intervals support fixed or user-selected bounded windows, persisted once at dispatch for load
smoothing. Preview uses the upper interval bound and known reservations. Active/quiet hours and
weekdays are checked in IANA local time while instants stay UTC, including DST gaps/repeats.
Completion estimates are labelled as the final planned start: provider holds, processing time,
other owners and device availability can extend them. The pause-after-N-completions counter is
per account and spans batches. It does not reset merely by creating another small batch.

## Dry run, approval and controls

`/automation` offers settings, item selection, per-item READY/WARNING/BLOCKED results, removal of
blocked items, explicit approval, planned times, audit history and pause/cancel/reschedule.
Dry run checks required canonical fields, positive price, quantity, source image references,
local/remote conflicts, remaining action allowance, policy, caps and timing. It performs no
remote writes. Session and destination readiness that have not been independently checked are
explicit warnings, not green claims. In a future automated transport these must pass again
immediately before execution. Current manual reminders are always labelled manual-only.

Global, marketplace, account and batch pauses prevent new claims. Resume requires review and
cannot shorten Retry-After. Cancel affects only non-running jobs; “future only” also filters by
scheduled time. Rescheduling rechecks active hours, bounds and review, preserves attempt counts,
and refuses ambiguous/recovered writes that require reconciliation.

The additive SQL trigger `lane_legacy_schedule_guard` extends global/account/marketplace pauses
and conflicting new intents to **new claims by the retained legacy write worker/bridge**. It
locks the same settings row, returns no claim when paused, and leaves existing leases and read/
authentication operations alone. No session connector code was changed.

## Retries, challenges and diagnostics

Only SAFE_RETRY or RATE_LIMIT with explicit `noRemoteEffect=true` may retry automatically.
Backoff is at least the configured value and any Retry-After seconds/HTTP date. Provider holds
are not shortened by resume. Very long holds require review. Unknown outcomes, thrown executor
errors and timeouts pause the account for reconciliation; a timeout is not proof of failure.
Publish/relist success requires a sanitized remote receipt ID.

CAPTCHA, MFA/challenge, account mismatch and marketplace warnings stop the account immediately.
Expired/unknown authentication requires reconnect. Account/batch failure and marketplace auth/
warning thresholds are durable. Nothing solves or bypasses a challenge. Audit rows contain
fixed result/reason codes, operation, item, marketplace, time and attempt, never upstream bodies,
cookies, passwords, tokens or authorization headers. Notifications are durable event hooks for
completion, pause, session expiry and user attention; no email/push service is provisioned.

## Non-destructive images

`normalization/engine.server.ts` uses local Sharp processing, not an AI provider. ORIGINAL copies
the exact bytes, including metadata. CLEAN_EXPORT auto-orients, converts to sRGB and drops
metadata. MARKETPLACE_READY additionally fits an aspect-preserving 1600px box. THUMBNAIL uses a
320px box. These dimensions are conservative export defaults, not universal marketplace rules.
CUSTOM offers JPEG/PNG, bounded quality/size, at most ±5% brightness/contrast, conservative
sharpening, explicit centre-square crop and explicit filling of **existing transparency** white.
Crop can remove edge content and corrections can affect appearance: the UI requires comparison.
WHITE_BACKGROUND replacement remains UNSUPPORTED; no object/background segmentation exists.

Original pixels/files are never overwritten. Each SQL job has source/derivative IDs, source hash,
preset/options, version, status, dimensions/type/bytes/timestamps and accept/reject/delete state.
Accept records review; it does not silently attach an export to a live listing. Deleting a
derivative clears its bytes, preserves its source, and prevents a running result resurrecting it.
Changed originals invalidate queued processing and acceptance. Interrupted processing is marked
FAILED/PROCESS_INTERRUPTED, recoverable by creating a new explicit request.

Inputs are owned JPEG/PNG originals already saved in Lane, ≤2 MB and ≤20 MP, single-page only.
Arbitrary remote URLs are **not server-fetched**: this avoids SSRF and makes original ownership
and byte preservation testable. Upload/save the original through the existing item flow first.
Output is ≤2 MB; each decode has a 15-second processing timeout. Processing is serial per server
process with bounded Sharp cache/concurrency. The small pilot stores derivative data in Postgres,
limited to fifty non-deleted results per owner; raw output can therefore approach 100 MB, and
base64 storage adds overhead. This must be revisited before allowing many users on a small free
database. Nothing adds object storage or recurring cost now.

The scheduling image preference defaults to ORIGINAL. CLEAN_EXPORT is an opt-in preference for
separate preparation/review; it does not silently run or substitute derivatives. Future
automated dispatch with that preference is explicitly blocked until accepted-derivative payload
integration is implemented and verified. Bulk preparation currently handles up to twelve photos
per atomic batch, with individual durable processing results.

Implementation references: [Sharp output/metadata](https://sharp.pixelplumbing.com/api-output/),
[orientation](https://sharp.pixelplumbing.com/api-operation/),
[input limits](https://sharp.pixelplumbing.com/api-constructor/),
[resize](https://sharp.pixelplumbing.com/api-resize/). Production native dependencies must be built
on the target host OS/architecture; Render's Linux `npm ci && npm run build:node` does this.

## Flags, tests and later enablement

All three flags remain false in `.env.example`, Render and normal local production:
`SCHEDULER_ENABLED`, `BULK_AUTOMATION_ENABLED`, `IMAGE_NORMALIZATION_ENABLED`. No provider key is
needed. Authenticated settings/preview pages explain disabled status; public marketing makes no
live automation claim. No API spend, infrastructure or marketplace writes were introduced.

Tests: `node --env-file=.env.phase2.local --test scripts/scheduler-normalization.test.mjs` uses
only the isolated local PostgreSQL fixture, a disposable schema, all migrations, fake clocks,
synthetic photos and injected local executors. `scripts/scheduler-browser-proof.mjs` exercises
the actual local production build with synthetic signup and manual reminders, no remote writes.
Run it only with `LANE_LOCAL_SCHEDULER_QA=true` on `scripts/website-local-production.mjs`; the
fixture still hard-disables bulk automation. Restore without that QA flag after testing.

Before enabling real scheduled writes: verify owner-approved connector capabilities; implement
trusted per-account device/identity/requirements/remote-state inspection and canonical receipt
reconciliation; prove ambiguous-write recovery; connect accepted derivative payloads if needed;
integrate a bounded dispatcher/device claim loop; verify actual platform policy; then deliberately
enable eligible capabilities and flags. Do not infer those gates from passing simulated tests.

Next roadmap task remains free website staging deployment. Provider access is still the external
blocker. First later desktop task remains full Vinted listing detail extraction: “Title unknown”
does not count as a complete import.
