# Environment contract

This document and `.env.example` are authoritative for the Node staging release. Set secrets in Render's Environment panel, never browser variables, Desktop packages, Git or chat. The app never needs marketplace cookies in its cloud environment. Empty optional values mean unavailable, not simulated success.

## Required for basic deployment

- `DATABASE_URL` — secret, from Neon Connect, pooled PostgreSQL URL. Remote hosts require verified TLS. Lane rejects connection overrides and insecure SSL modes; localhost is allowed only for isolated QA. Pool options are shared by app/auth/migration/verifier.
- `BETTER_AUTH_SECRET` — stable generated secret, at least 32 characters with no placeholder/default. Blueprint generates it. Manual alternative: `npm run secret:generate`, then paste privately into Render. Changing it invalidates sessions and encrypted tokens; do not regenerate each deploy.
- `BETTER_AUTH_URL` — exact HTTPS origin, no credentials/path/query. On Render, optional because Lane validates and adopts platform `RENDER_EXTERNAL_URL`; custom origin later overrides it. Never infer trust from browser headers.
- `LANE_ENV=staging` and `VITE_AUTH_ENABLED=true` — supplied by Blueprint; auth must stay on. `LANE_ENV=production` is for deliberate commercial readiness, not simply a production JS build.
- `NODE_VERSION=24.14.0` — Render build/runtime version. `PORT` and `HOST` are platform/runtime inputs, not secrets. `NODE_ENV=production` is set by the start script.

Startup fails before serving for missing required settings, HTTP auth origins, default secrets, disabled auth, disabled TLS verification or enabled preview plans. No PGlite fallback is allowed in staging/production. Errors identify the setting, not its value.

## Optional, default disabled

- `PUBLIC_INDEXING=false` — staging robots and response/meta noindex. True requires `LANE_ENV=production` and a chosen origin outside onrender.com. Sitemap remains readable for verification even while noindex.
- `LOG_LEVEL=warn` — `error`, `warn`, `info`, `silent`. Info adds safe request category/ID/status/latency, never URLs, headers, bodies or arbitrary error objects.
- `LANE_SUPPORT_ENABLED=false` — stored authenticated support queue; enable only once someone monitors it. No email is implied.
- `LANE_ANALYTICS_ENABLED=false` plus `VITE_LANE_ANALYTICS_ENABLED=false` — optional consented aggregate event counts. Both required; changing VITE values needs rebuild. No analytics ID or vendor account exists in this implementation; `ANALYTICS_ID` would do nothing. No UTM/referrer payload storage.
- `GOOGLE_SITE_VERIFICATION` — public Search Console HTML token. Prefer custom-domain DNS verification later.

## Required only for Google

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: a Google Cloud Web OAuth client for the chosen origin. Both plus a matching origin are required. Redirect: **`BETTER_AUTH_URL/api/auth/callback/google`**, as implemented by Better Auth's direct Google provider. Authorised JavaScript origin is `BETTER_AUTH_URL`. No wildcard redirects. Absent/partial configuration leaves email login working and social sign-in unavailable. Existing account linking requires verified local email in deployed mode; do not bypass this to merge accounts. Test linking separately after email verification is configured.

## Required only for email

`RESEND_API_KEY`, `LANE_EMAIL_FROM`: existing server-side Resend reset-email adapter and a verified sender. Both required. There is no generic `EMAIL_API_KEY` or `EMAIL_PROVIDER` switch today; do not configure unused names. Without these, `/forgot-password` explains unavailability and reset POST returns 503 `EMAIL_NOT_CONFIGURED`. The sender validates reset link origin and uses a bounded HTTPS request; it never fabricates delivery. Actual delivery and sender DNS remain separate live gates.

## Required only for billing

`LANE_BILLING_V2_READY=false`. Future release needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_V2_STARTER`, `STRIPE_PRICE_V2_SELLER`, `STRIPE_PRICE_V2_PRO` plus verified checkout/webhooks. Legacy `STRIPE_PRICE_STARTER/SELLER/PRO/AI_PACK` are compatibility mappings only. `STRIPE_PUBLISHABLE_KEY` is not needed for basic staging. Pricing is provisional and no purchase can succeed with billing disabled.

## AI skeleton only

`AI_PROVIDER=mock`; optional `AI_TEXT_PROVIDER`, `AI_IMAGE_PROVIDER`, `AI_TEXT_MODEL`, `AI_IMAGE_MODEL` override server routing. `AI_LISTING_ENABLED=false`, `AI_IMAGE_ENABLED=false`, `AI_MOCK_DEVELOPMENT=false`. Workbench UI requires explicit development enablement; production cannot expose mock AI. `AI_OPERATION_COSTS_JSON` and `AI_PLAN_ALLOWANCES_JSON` are optional centralized overrides, not secrets. Trial/Starter remain zero-credit plans.

`OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `FAL_API_KEY` are reserved empty server-only slots, **unused**, not evidence of implemented adapters. No real provider has been selected; no external AI calls are enabled. See AI_ARCHITECTURE.md.

## Future features, keep OFF

`SCHEDULER_ENABLED=false`, `BULK_AUTOMATION_ENABLED=false`, `IMAGE_NORMALIZATION_ENABLED=false`: no scheduler worker is provisioned. `LANE_WORKER_SECRET` stays empty until a separately approved execution service exists. `LANE_EBAY_ORDER_POLLING=false`, `LANE_LEGACY_CLOUD_SESSIONS` unset/false, `LANE_ALLOW_PREVIEW_PLANS=false`.

Inactive legacy eBay API adapter variables: `EBAY_ENV`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`; old policy defaults `EBAY_FULFILLMENT_POLICY_ID`, `EBAY_PAYMENT_POLICY_ID`, `EBAY_RETURN_POLICY_ID` are not current per-account configuration. None is a release requirement. `VINTED_USER_AGENT` is legacy-only. Current supported authentication uses local authorised browser sessions; never add API credentials as a blocker.

## Platform/build and local QA only

Render supplies `RENDER`, `RENDER_EXTERNAL_URL`, `RENDER_GIT_COMMIT`; do not replace them with user input. Build script uses `LANE_DEPLOY_TARGET=node`. QA may supply `LANE_BUILD_COMMIT`/`LANE_BUILD_DIRTY` for a source snapshot without Git; normal builds read Git HEAD/status. None is a secret. Build ID is metadata, not authentication.

Preview broker variables (`GROK_AUTH_*`, `GROK_GATE_ORIGIN`, `GROK_PROJECT_ID`, `GROK_CONNECTORS_URL`, `GROK_CONNECTOR_ACCESS_TOKEN`, `VITE_PUBLIC_HOSTNAME`, `VITE_STUN_URLS`) belong to the inherited development preview. Do not populate them on Render. Preview broker sign-in is not required for deployed email/password auth.

`LANE_LOCAL_AI_QA`, `LANE_LOCAL_SCHEDULER_QA`, `LANE_PROOF_ORIGIN` and preview timeout/browser flags are local test inputs, not deployment settings. `BASE_URL` configures live screenshots; `SCREENSHOT_FIXTURE_STATE` is a private browser-state file for an explicitly confirmed synthetic account only, with `SCREENSHOT_FIXTURE_CONFIRMED=true`. Never commit that file. Use an ignored artifacts path. No screenshot command requires production user credentials.
