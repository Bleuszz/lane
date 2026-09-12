# Lane AI architecture — mock-only skeleton

**NO PRODUCTION AI PROVIDER HAS BEEN SELECTED.**

**PROVIDER AND MODEL CHOICES ARE EXPECTED TO CHANGE.**

Status: local development architecture and review UI. No real AI calls, no purchased credits, no AI API spend. Deployment flags stay off. This is not production-ready AI and does not delay the Render/Neon website handoff.

## Product boundary

`/ai` is the signed-in AI Studio and usage workbench. It offers listing suggestions and image transformation previews. Trial and Starter always have zero AI credits. Explicit local tests use synthetic active Seller/Pro accounts; no real subscription or owner allowance is changed to demonstrate features.

Mock acceptance records a review decision **only**. It never writes `[MOCK]` text into `items`, changes a channel listing, adds a fake image to inventory or publishes anything. This containment is deliberate: development placeholders must not become sellable content.

The two former xAI network handlers are disabled. The old credit module is retained for historical injected ledger tests and refuses normal runtime reservations. Historical ledger rows remain intact; migration 0020 carries prior used credit totals into the new monthly wallet once. There is no active xAI provider dependency.

## Provider boundary and configuration

- `src/lib/lane/ai/types.ts`: `AIProvider` methods `listingSuggestion`, `imageTransform`, `healthCheck`, `estimateCost`, `capabilities`. Provider outputs cross an untrusted `unknown` response boundary and are validated before settlement.
- `providers/registry.server.ts`: explicit slots for mock/OpenAI/Google/FLUX/Anthropic/future. Only mock resolves. Other choices fail `PROVIDER_UNAVAILABLE` before reserving a new batch; no pretend SDK implementations.
- `providers/mock.ts`: deterministic, labelled placeholders. It does not inspect images or invent colour, composition, condition or product facts. Input/output/image-generation usage and cost are zero.
- `config.server.ts`: independently selected text/image provider and model; centralized operation costs and plan allowances. No credential enters client configuration or the public usage DTO.
- Future multi-model routing belongs behind this same provider boundary. A routing adapter can perform confidence checks/fallbacks and return validated aggregate output/usage. The UI still handles one job and review set; detailed per-attempt accounting can extend the internal cost ledger without changing user credit operations.

Environment defaults in `.env.example` and Render Blueprint:

```dotenv
AI_PROVIDER=mock
AI_TEXT_PROVIDER=
AI_IMAGE_PROVIDER=
AI_TEXT_MODEL=
AI_IMAGE_MODEL=
AI_LISTING_ENABLED=false
AI_IMAGE_ENABLED=false
AI_MOCK_DEVELOPMENT=false
AI_OPERATION_COSTS_JSON=
AI_PLAN_ALLOWANCES_JSON=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
FAL_API_KEY=
```

Keys are optional and currently unused. `AI_TEXT_PROVIDER` / `AI_IMAGE_PROVIDER` override `AI_PROVIDER`; model defaults identify the mock. Explicit mock-development permission and the corresponding feature flag are both required. `LANE_ENV=production` refuses mock execution even if flags are accidentally enabled. A previously queued job is also checked at execution; disabling a feature refunds its pending reservation when processed.

Example **provisional** central overrides: `AI_OPERATION_COSTS_JSON={"studio_background":12}` and `AI_PLAN_ALLOWANCES_JSON={"seller":600,"pro":1600}`. Values are nonnegative bounded integers; unknown configuration keys are rejected. Trial/Starter overrides cannot grant AI. No SQL migration is needed for price/allowance changes. Existing job reservations keep their original cost; new jobs use current configuration.

Base allowances: Trial 0, Starter 0, Seller 500, Pro 1500 per UTC calendar month. The workbench reports the server's effective configuration. General plan cards describe provisional defaults and do not promise live AI availability.

## Durable jobs and credits

`service.server.ts` owns SQL operations; authenticated server functions derive the owner from Better Auth, never request-supplied user IDs. Requests contain an owned item ID, optional owned photo ID, operation and bounded settings. Browser credits are display-only.

1. Lock the account, recover expired reservations, check idempotency key/fingerprint.
2. Validate active plan, feature flags, mock environment and provider availability.
3. Lock the current month's wallet. Validate the **whole batch** (maximum 20 jobs) against available credits.
4. Save immutable input/cost snapshots, jobs, reservation events and cost estimates in one transaction. Either the entire batch reserves or none of it does.
5. A processing request claims one job using a unique lease. The provider runs outside SQL locks. Duplicate claims do not rerun it.
6. A validated success consumes that reservation once and stores suggestions/assets and usage/cost atomically.
7. Failure records a sanitized code, FAILED event and REFUNDED terminal state, restoring only that job's reservation. Cancel uses CANCELLED plus a refund entry. Unique ledger events and ownership locks prevent duplicate settlement.

States: QUEUED and RESERVED are recorded together during reservation; PROCESSING has a 30-second lease and a 15-second execution deadline. SUCCEEDED, REFUNDED and CANCELLED are terminal. Queued reservations expire after ten minutes. FAILED is retained in event history before refund settlement. No ambiguous job is silently retried.

Crash recovery runs on account AI state reads, new queues and processing claims. If nobody opens the workbench, an expired reservation remains durably pending until that account is visited/recovered; there is no extra infrastructure or always-on worker in this phase. A future worker can invoke the same lifecycle. The UI offers resume/cancel and explicit retry. Retrying creates a new reservation, discloses its current cost, and retains its idempotency key after an uncertain response.

Each UTC month is a separate wallet. Old-month refunds release only their original wallet. No carry-over, no automatic overages, no reset by reinstalling or re-pairing. Failed siblings in a batch do not undo successful jobs. Successful outputs remain charged if later rejected/deleted; provider work would already have completed.

## Listing intelligence

Per-field review preserves imported source value, saved listing value, explicit user context, suggestion, confidence, evidence and accepted/rejected state. Import source is read only from Lane's existing canonical `channel_listings.source_data`; ambiguous multiple sources remain unavailable rather than choosing one. Saved values may include seller edits and are not falsely labelled imported.

Fields cover title, description, brand, colour, material, category, garment type, pattern, fit, style, size and condition. Destination marketplace/category travel as context. Expanding destination specifics means extending the field catalogue and response validator; unknown names must not become arbitrary database column names.

Known values are not silently replaced. Acceptance requires confirmation when source/saved/user values exist, and rejects a stale suggestion if saved data changed after generation. Null/unknown suggestions cannot be accepted. “Accept all safe suggestions” rechecks each high-confidence empty-field candidate; the mock intentionally labels no invented suggestion safe, so it has nothing eligible to bulk-accept. Seller context is bounded and remains separate from inventory.

## Image Studio

Operations: background removal, white/studio/custom backgrounds, flat lay, relight, ghost mannequin, virtual model, enhancement, crop/marketplace format. Settings support original/1:1/4:5/marketplace ratios, scene and model presentation. Costs live only in `catalog.ts` and server overrides.

Mock image output is a labelled placeholder panel, **not generated imagery**. The original is shown separately; “Return to original” switches the preview. Every derivative stores original photo ID, operation, provider, model, job, settings, date, status, reserved credit cost and known provider cost. Accept/reject/delete touch only derivative review state; deletion is a tombstone, never deletion of the source photo. If a seller independently removes the source later, lineage remains and the UI reports it unavailable.

The fidelity policy requires preservation of logos, text, colour, fabric, pattern, construction, proportions and damage. Risky transformations carry a review notice. The mock does not claim that a real model has passed this policy. Real derivative storage, signed preview delivery and fidelity benchmarks belong to the selected-provider release gate; no unnecessary storage service was provisioned now.

## Ledger and privacy

Migration `0020_ai_workbench.sql` adds monthly wallets, batches, jobs, job events, credit ledger, cost ledger, suggestions and generated assets. Job/user composite foreign keys protect dependent ownership. All application queries are owner-filtered; this service is not exposed directly as a client database connection.

Cost ledger stores provider/model, operation, plan, timestamp, input/output usage, generated-image count, estimated/actual provider cost, currency and credits charged. Mock costs are explicitly zero. Public DTOs exclude provider costs, token counts, raw input, secrets and private diagnostics. Future adapters must distinguish unknown cost from zero and retain costs even when customer credits are refunded.

Providers receive only selected listing fields, optional seller context, destination and opaque source-photo references. They do not receive Lane user IDs, auth tokens, marketplace cookies, seller profile data, purchase cost or private inventory notes. Mock does not fetch photo bytes. Future adapters must resolve only authorized selected photos; never accept arbitrary provider fetch URLs or forward marketplace credentials.

Failures are fixed codes, not raw upstream bodies. Photo previews use owned URLs and no referrer. No new analytics event sends AI inputs/outputs. API credentials remain in the hosting provider's secret store when a real adapter is eventually authorized, never Desktop/renderer/browser bundles.

## Adding a real provider later

1. Implement a server-only adapter behind `AIProvider`; normalize its output, usage and cost without changing UI/job ownership contracts.
2. Store the selected credential securely and add the provider to the explicit registry. Keep all release flags off while testing.
3. Add real-output validation and protected derivative storage/delivery. The current mock-only validator intentionally refuses production output; widen it only for an independently validated adapter, never by weakening the mock gate.
4. Test selected fields/images for fidelity, unsupported assertions, timeout/ambiguous outcomes and idempotency. Add detailed routing-attempt accounting if using a composite adapter. Do not retry ambiguous billable calls automatically.
5. Measure real costs, set cost safeguards, benchmark results and review provisional credit prices/allowances.
6. Deliberately enable that feature only after its release gates pass. Review legal/data-processing copy then. No final model choice or benchmark is part of this skeleton.

## Local verification

```powershell
node --env-file=.env.phase2.local --test scripts/ai-workbench.test.mjs
npm run typecheck
npm run build:node
# Isolated loopback fixture only; uses the existing ignored TLS certificate/DB configuration:
$env:LANE_LOCAL_AI_QA='true'
node --env-file=.env.phase2.local scripts/website-local-production.mjs
# Second terminal:
node --env-file=.env.phase2.local scripts/ai-browser-proof.mjs
```

The SQL suite creates and removes only its uniquely named `ai_test_<uuid>` schema in the local fixture. Browser tests create synthetic accounts/items, never contact providers and never modify the owner's plan. They exercise trial gating, labelled suggestions, confirmation, image history/original preservation, refunds, accessibility and responsive widths. Restore the local fixture without `LANE_LOCAL_AI_QA` afterward; default flags are off.

After this skeleton is verified, stop AI work. Next roadmap action remains free Render/Neon website staging, shared-account deployment acceptance and verified Desktop distribution. Full Vinted detail extraction (“Title unknown”) stays first in the later desktop queue.
