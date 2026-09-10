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
- Configure and verify unattended queue processing, sold-event ingestion and delist confirmation; test duplicate event delivery and restart recovery.
- Provide a destination-accessible image upload route before promising cleaned photos can be published to eBay. Verify content type, size, ownership and expiry.
- Benchmark ten varied owner-approved items (two supplied so far), recording time, missing fields, corrections, photos and final result. This is the gate for comparative marketing claims and paid acquisition.

## Local commands

`npm run dev` runs on 127.0.0.1:8080. An explicit `VITE_AUTH_ENABLED=false` override may be used only with no DATABASE_URL for isolated synthetic local testing; do not carry it into staging. In-memory drafts disappear when the process restarts. `npm run test:lane` does not use real credentials or marketplace writes. `npm test` also runs inherited template tests and currently reports their documented failures.
