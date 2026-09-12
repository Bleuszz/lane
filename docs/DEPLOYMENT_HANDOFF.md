# Lane deployment handoff

Status: deployable local production build. **BLOCKED — OWNER LOGIN REQUIRED** for access to the existing Render/Neon sessions. No public service or cloud database has been provisioned by this task. Domain purchase is deferred.

## Smallest owner handoff

When back at the PC, open the signed-in Render and Neon dashboards in a normal Chrome or Edge window and leave it visible. Tell Codex which browser. Codex will perform setup and verification; the owner handles Google authentication, any GitHub permission dialog and any provider-only confirmation.

Target owner interaction: about 3–5 minutes if existing sessions and repository access work; allow 5–10 minutes if GitHub authorisation is needed. Provider build time and Google OAuth setup are additional, not included in that estimate. No card or paid plan is needed for this staging design.

## Neon — one durable staging database

1. In `https://console.neon.tech`, use the existing account. Create a project named `lane-staging`, PostgreSQL 16, AWS Frankfurt (`eu-central-1`) on **Free**. Do not upgrade compute or retention. Keep scale-to-zero enabled and the smallest compute setting available.
2. Use the project's Connect dialog: select its database/role and enable connection pooling. Keep the provider's TLS parameters in the PostgreSQL URL (normally `sslmode=require`, plus any currently supplied channel-binding option).
3. Transfer that URL directly into Render's secret `DATABASE_URL` field. Do not paste it in chat, commit it, or put it in a screenshot. No raw marketplace sessions belong in either service.
4. The startup migrator uses a single pg connection and SQL transactions. These migrations contain no session-level advisory locks or prepared statements requiring a direct endpoint. If provider pooling rejects a migration, inspect its sanitised error and use a private direct endpoint for that migration; do not remove TLS.

## Render — existing branch, one free web service

Use New → Blueprint, connect only `Bleuszz/lane` where repository access is required, select `codex/lane-smart-crosslisting`, and load root `render.yaml`. A branch-specific shortcut is:

https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FBleuszz%2Flane%2Ftree%2Fcodex%2Flane-smart-crosslisting

This is for the owner's single staging service, not a public customer deployment button. Check the plan says **Free**, region **Frankfurt**, with no database, worker, disk or paid add-on in Render. Set `DATABASE_URL` from Neon. The blueprint generates the auth secret automatically.

Render supplies `RENDER_EXTERNAL_URL` at build and runtime. Lane validates its HTTPS `.onrender.com` origin and uses it as `BETTER_AUTH_URL` when no explicit custom origin is configured. There is no need to guess a hostname before deployment. A later explicit `BETTER_AUTH_URL` takes precedence.

- Node: 24.14.0.
- Build: `npm ci && npm run build:node`.
- Start: `node scripts/start-server.mjs`.
- Startup validates configuration, applies pending SQL files transactionally and launches `.output/server/index.mjs`.
- Health: `/api/health` checks SQL connectivity and returns only `ok` or `unavailable`.
- Source updates: commit-triggered auto-deploy on this branch. Keep meaningful commits, watch build quota; pause auto-deploy in Render if troubleshooting would exhaust it.
- Generated assets include Brotli/gzip variants. No marketplace writes or production billing are enabled.

## Environment names and sources

Required or supplied by the blueprint:

- `DATABASE_URL`: Neon Connect dialog, pooled TLS URL; **secret**.
- `BETTER_AUTH_SECRET`: Render generated value; **secret**, stable across redeploys. Rotating it signs users out.
- `LANE_ENV=staging`: keeps the entire temporary hostname noindex and robots disallowed.
- `VITE_AUTH_ENABLED=true`: email/password auth remains enabled.
- `BETTER_AUTH_URL`: optional on Render; later set the exact custom HTTPS origin without a path or query.
- `LANE_BILLING_V2_READY=false`, `LANE_EBAY_ORDER_POLLING=false`, `LANE_ALLOW_PREVIEW_PLANS=false`.
- `LANE_SUPPORT_ENABLED=false`: enable only after the operator agrees to monitor the stored support queue and publishes an accessible contact route for signed-out people.
- `LANE_ANALYTICS_ENABLED=false`, `VITE_LANE_ANALYTICS_ENABLED=false`: optional aggregate measurement, both flags must be enabled; rebuild after changing the VITE flag. Browser opt-in is also required. No analytics vendor account needed.

Optional later:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google Cloud OAuth Web client. Put secrets in Render, never Electron or Git.
- `RESEND_API_KEY`, `LANE_EMAIL_FROM`: verified transactional sender. Reset email remains unavailable until both exist and real delivery passes.
- `GOOGLE_SITE_VERIFICATION`: Search Console's HTML verification token only. Prefer DNS verification after buying the custom domain.

Do not add eBay API credentials: official API transport is inactive for this phase. Do not upload marketplace cookies.

## Deploy and verify — Codex performs this

After the first Render deployment is Live:

1. Read `/api/health` over generated HTTPS. Check Render's log contains migration names/status only, no secrets.
2. Run `node scripts/staging-smoke.mjs https://GENERATED.onrender.com`. It checks public pages, canonical origin, privacy/cache/security headers and anonymous auth. It intentionally does not create an account or claim full desktop acceptance.
3. With DATABASE_URL loaded privately in an ignored environment file, run `node --env-file=.env.staging.local scripts/verify-database.mjs`. All 19 migrations and required tables must be present; remote PostgreSQL must use TLS. Never pass the URL on a visible command line.
4. Use a disposable owner-approved staging test account: actual signup form → account → 168-hour trial → logout → login. Verify the trial dates remain unchanged after redeployment. Do not send real email until configured.
5. Launch the exact existing Lane Desktop build. Sign in to Lane using the generated site, approve the matching code, verify the same user/device in `/devices`, restart and revoke. Marketplace session code is unchanged, but this packaged Desktop/staging proof is still mandatory.
6. Only after packaged pairing is proven, prepare a normal Windows release. Publish a verified GitHub Release installer, record version/date/bytes/SHA256 in `src/lib/lane/download.ts`, test downloading the exact asset and compare checksum. Do not enable the download button with an old unverified diagnostic executable.

Local proof commands (existing isolated PostgreSQL fixture only):

- `npm run typecheck`
- `npm run build:node`
- `node --env-file=.env.phase2.local scripts/phase2-build-proof.mjs`
- `node --env-file=.env.phase2.local scripts/website-support-proof.mjs`
- `node --env-file=.env.phase2.local scripts/verify-database.mjs`
- `node scripts/website-qa.mjs` and `node scripts/website-lighthouse.mjs` against the running local HTTPS fixture.

`website-local-production.mjs` is a test harness, not the Render entry point. Its self-signed local certificate is ignored by test browsers only. All its screenshots are **LOCAL PRODUCTION BUILD**, never live staging.

## Google OAuth, when the hostname exists

Actual implementation: Better Auth's direct `google` provider in `src/lib/auth/server.ts`, default `/api/auth` base path; installed Better Auth callback route is `/callback/:id`. Therefore:

- Application type: Web application.
- Authorised JavaScript origin: `https://GENERATED.onrender.com` (later the exact custom origin).
- Authorised redirect URI: `https://GENERATED.onrender.com/api/auth/callback/google`.
- Configure consent-screen app name and appropriate test users while Google publishing status is Testing.
- Put client ID/secret in Render and redeploy. Test sign-in from a normal browser. Do not bypass Google restrictions or add localhost to hosted trusted origins.
- Allow roughly 10–20 minutes owner interaction if a new Google Cloud consent screen/client is needed. It is optional for initial email/password staging.

## Domain later

Owner buys a domain only when ready. Current shortlist and renewal costs are in `PHASE2_HOSTING_DOMAINS.md`; availability is provisional.

1. Add apex and www custom domains in Render. Copy Render's exact current DNS targets into the chosen DNS provider; do not invent IP addresses.
2. Verify managed TLS for both. Choose apex as canonical, redirect www to apex using Render's verified custom-domain redirect or a Cloudflare redirect rule.
3. Set explicit `BETTER_AUTH_URL=https://PURCHASED-DOMAIN`. Update Google origin/callback and transactional-email sender DNS where applicable. Keep host-only auth cookies; users sign in again on the new hostname.
4. Keep `LANE_ENV=staging` until contact/legal/email/release checks are approved. Then change to `production` and verify robots, canonical URLs and sitemap from the actual custom domain.
5. Search Console: verify DNS or the configured HTML token; submit the custom-domain `/sitemap.xml`. Do not submit temporary staging for indexing. Use canonical redirects for the old hostname after completing callback migration.

## Operating the beta and rollback

Render Free sleeps after 15 minutes and can take about a minute to wake. It is staging infrastructure, not a production availability promise. Do not add a keep-awake monitor. Check Render bandwidth/build quotas and Neon storage/compute/egress before inviting users; avoid enabling paid overages or adding a payment method. Provider dashboard quotas remain unverified until account access works.

Support is a stored queue, not automated email delivery: authorised operator access through Neon SQL can read `support_requests` joined by user ID to the Better Auth user record. Enable only after choosing who checks it and publishing a contact route; never expose this query to ordinary users. Deletion requests need operator execution/retention review. Aggregate analytics can be read from `website_daily_events`; no per-user funnel joins are possible by design. Cap is 120 intake requests/minute/process; counts are indicative, not fraud-resistant business metrics. Retention should be approved before enabling either feature.

Before a destructive schema change, export/verify a database backup privately. These new migrations are additive. Roll back application code using Render's prior deploy or Git revert; do not roll back SQL destructively to make old code run. Render Free only retains limited rollback history. No background worker/cron is required for this account phase; desktop work waits when no device is online.

Public launch still needs verified contact/operator/legal details, reset-email delivery, a verified installer, and actual hosted account/device tests. Custom domain and Google OAuth can follow free staging. First desktop follow-up: full Vinted detail extraction; `Title unknown` is not full import.

Sources checked 12 September 2026: [Render environment variables](https://render.com/docs/environment-variables), [Blueprint reference](https://render.com/docs/blueprint-spec), [branch deployment shortcut](https://render.com/docs/deploy-to-render), [Free service limits](https://render.com/docs/free), [Neon pooling](https://neon.com/docs/connect/connection-pooling).
