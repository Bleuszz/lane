# Lane staging architecture

Decision checked 12 September 2026: **Render Free Node service + Neon Free PostgreSQL; GitHub is source of truth.** No cloud resource has been provisioned in this pass. No custom domain or optional provider is needed for staging.

## Runtime and release

The existing app uses TanStack Start, React 19, Vite, Nitro's Node server, Better Auth, node-postgres and Sharp. Workers would introduce adapter/runtime work without helping this release. Render runs Node 24.14.0 in Frankfurt from repository root, branch `codex/lane-smart-crosslisting`. `npm ci && npm run build:node` builds on Linux; never upload Windows `.output`. `node scripts/start-server.mjs` validates configuration, applies migrations and starts `.output/server/index.mjs`. Health checks PostgreSQL and reports app version, commit, build time and dirty-source status.

The Blueprint creates one free service, with commit auto-deploy and no worker, disk, Render database or cron. Free hosting has no pre-deploy command or shell entitlement to depend on: checked startup migration is intentional. Transaction-level locking serializes concurrent starts. Build failure leaves the database unchanged; migration failure prevents the new server starting. Review future SQL before pushing this auto-deployed branch.

## Database and identity

Neon Free PostgreSQL 16, AWS Frankfurt. Put its pooled connection string in `DATABASE_URL`. Lane enforces verified remote TLS and retains channel binding. App pool: 5 connections; auth pool: 3; migrator: 1, per process. Transaction-scoped migration locking is compatible with transaction pooling; actual Neon TLS and pooling still need live acceptance. Local proof uses fresh PostgreSQL 16, not cloud credentials.

One Better Auth user owns trial, inventory and devices. Email/password needs no Google or email key. Cookies are Secure, HttpOnly, host-only and SameSite=Lax. Deployed reads consult PostgreSQL so revoked sessions are not cached. Sessions last seven days with daily refresh. Trusted origins come from the exact configured HTTPS origin, not request headers. Google is unavailable until configured. Reset explicitly reports email unavailable without the existing Resend adapter's credentials. Basic staging does not claim verified email or delivered recovery; recovery/contact/legal readiness must pass before a broad paid launch.

Desktop uses website approval and a PKCE-protected, one-use exchange for owner-bound revocable tokens. Tokens are hashed server-side. Marketplace cookies stay in the existing local desktop architecture. This phase does not change connectors or upload their sessions. See DESKTOP_STAGING_TEST.md.

## Optional features and files

Billing, AI/mock workbench controls, scheduling and normalization default OFF. Seven-day trials have zero AI credits. No optional API key is required. Downloads use `src/lib/lane/download.ts`; the normal installer stays unavailable until a verified public release supplies version, URL, date, size and SHA256. Prefer GitHub Releases later.

No durable application filesystem is assumed. Imported image URLs may expire; database-stored image data consumes PostgreSQL capacity. Render's disk is ephemeral. Before large imports, select separately approved durable object storage and test asset recovery. No new storage service is included now.

Analytics is optional, first-party, aggregate and consented; both build/server flags must be enabled. Only allowlisted event counts are stored. No user IDs, private listings, raw referrers or query strings are sent. UTM attribution is not collected: later add allowlisted campaign labels after retention/consent review. Support stays disabled until an operator agrees to monitor its stored queue; no response SLA is promised.

Jobs are durable records. No always-on worker or cron is provisioned. Sleeping hosting cannot guarantee timed execution. Scheduler and new marketplace writes stay disabled; future execution needs a separately reviewed worker and budget. Do not add artificial keep-awake traffic.

## Cost and scaling

[Render Free](https://render.com/docs/free) is evaluation infrastructure: 512 MB, sleep after 15 idle minutes, wake may take about a minute, ephemeral disk and 750 free instance hours/workspace/month. Build/bandwidth quotas are shared; reaching quotas without payment can suspend work. Excessive external traffic can also cause suspension. Only limited prior deployments are retained. Account-specific quotas need confirmation on provisioning; no paid overages are enabled.

[Neon plans](https://neon.com/docs/introduction/plans) currently list Free: 0.5 GB storage/project, 100 CU-hours/project/month, 5 GB public transfer/project/month and five-minute scale-to-zero. History is six hours subject to a 1 GB-month allowance, plus one manual snapshot. This is not independent long-term backup. Measure combined cold-start latency live; Frankfurt reduces distance to UK/EU users but is not a latency promise.

Current cost: **£0 within free allowances**. Likely first approved upgrade: [Render 0.5 CPU / 512 MB at US$7/month](https://render.com/pricing) to remove sleep, with more memory if measurement requires it. Neon Launch is usage-based, currently $0.106/CU-hour plus storage per its plans page. Recheck checkout, tax, FX and quotas when approval is requested. No automatic paid upgrade.

## Domain, security and recovery

Render's validated `RENDER_EXTERNAL_URL` supplies the auth origin when unset. `PUBLIC_INDEXING=false` keeps staging noindex. Sitemap stays inspectable, but robots disallows crawling and it is not submitted to Search Console. Later configure domain/DNS/managed TLS, set `BETTER_AUTH_URL`, update optional Google callbacks, redeploy and re-pair Desktop. Enable indexing only with `LANE_ENV=production` and `PUBLIC_INDEXING=true` on the chosen custom origin. Verify redirects and callbacks before retiring the temporary host.

Headers include frame denial, CSP, nosniff, permissions restrictions, referrer policy and short HSTS for HTTPS. CSP restricts scripts/connections to self but permits inline SSR hydration; no unsafe-eval. Nonced CSP needs separate hydration validation. Logs use safe request IDs/categories/status/latency. Auth limits are atomic and durable; confirm Render's proxy IP behavior live. A global intake cap provides a separate bound but is not a DDoS guarantee.

See MIGRATIONS.md and BACKUP_AND_RECOVERY.md. Roll back only schema-compatible code; never automatically reverse SQL or erase a database to recover.
