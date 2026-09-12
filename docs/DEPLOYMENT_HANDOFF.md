# Deploy Lane staging

No credentials are requested now. External provisioning awaits owner authentication/secret entry. Use a free generated URL: no domain, Google, email, billing or AI key needed. Owner interaction target: **5–10 minutes**, excluding provider builds/account verification. Codex performs setup where access permits; owner handles sign-in/permission dialogs.

1. **Neon:** sign into [Console](https://console.neon.tech). Create `lane-staging`, Free, PostgreSQL 16, AWS Frankfurt. Connect → pooled connection string. Transfer privately into Render `DATABASE_URL`, never chat/Git/screenshots.
2. **Render:** sign into [Dashboard](https://dashboard.render.com), New → Blueprint, authorise GitHub `Bleuszz/lane`, select **`codex/lane-smart-crosslisting`**, root `render.yaml`. Confirm one Free Node service in Frankfurt, no paid disk/worker/Render database. Supply `DATABASE_URL`.
3. **Secret:** Blueprint generates `BETTER_AUTH_SECRET`; preserve across redeploys. For manual service creation only, `npm run secret:generate` creates a local value to paste directly into Render. Never commit it. No source edits required.
4. **Deploy:** apply Blueprint. Build `npm ci && npm run build:node`; start `node scripts/start-server.mjs`. Render supplies the validated HTTPS origin automatically. Optional features and indexing stay off.
5. **Migrate:** automatic startup, no separate owner action. All **22** files apply transactionally before serving; repeat startup applies zero. Failure stops startup; do not reset the database.
6. **Verify — Codex:** health database ok + intended Git SHA; run `node scripts/staging-smoke.mjs https://GENERATED.onrender.com`. With DB credentials privately loaded, run `npm run db:verify`. Follow [live acceptance](LIVE_ACCEPTANCE.md) for account/trial/Desktop/revoke/screenshots. Green provider deployment alone is not acceptance.

Before provider access: **`npm run check:deploy`**. Needs Node 24/npm and Docker, no owner accounts. It installs the lockfile in a clean tracked-source copy, builds and tests disposable PostgreSQL without old .env/build/DB state. Stage new files before checking an in-progress change. Evidence: `artifacts/deploy-check/<run>/`.

**Google/email later:** [environment contract](ENVIRONMENT.md). Google Web OAuth authorised origin is the exact website HTTPS origin; callback `/api/auth/callback/google`. Put ID/secret in Render, redeploy, test. Reset stays unavailable until `RESEND_API_KEY` plus verified `LANE_EMAIL_FROM`. No secrets in chat.

**Domain later:** owner purchases when ready. Add apex/www in Render; copy its exact DNS targets to Cloudflare/registrar DNS, verify managed TLS, choose apex and redirect www. Set `BETTER_AUTH_URL` to the chosen HTTPS origin, update optional Google callbacks, redeploy and re-pair Desktop. Keep noindex until deliberately setting `LANE_ENV=production` and `PUBLIC_INDEXING=true`. Do not apply proxy/cache rules blindly around auth.

See [architecture](DEPLOYMENT_ARCHITECTURE.md), [migrations](MIGRATIONS.md) and [recovery](BACKUP_AND_RECOVERY.md). Broad commercial launch also needs operator/contact/legal review, recovery delivery and a verified installer. First desktop follow-up: **Vinted full item-detail extraction**.
