# Website acceptance evidence — 12 September 2026

**LOCAL PRODUCTION BUILD. Not a live deployment.** Node/Nitro production output served through an isolated localhost HTTPS proxy, using persistent PostgreSQL 16 in the existing test Docker volume. The test browser trusts only the local fixture certificate for these checks; this does not prove provider TLS.

## Results

- Typecheck and production Node build pass.
- 37 focused auth, deployment-policy, migration, trial, device and measurement tests pass.
- All 19 SQL migrations applied; required tables verified. Local database uses loopback; remote verification requires TLS.
- Real browser forms and SQL prove signup, login, logout, a 168-hour server trial, unchanged trial dates after re-login, account-owned device approval, one-use exchange and revocation. A synthetic expired-trial account retains its inventory.
- Secure/HttpOnly account cookies and rejection of foreign-origin sign-out verified locally. The sign-out client now navigates after the successful server response; it no longer waits on a client session-store notification.
- Support intake tested against real SQL: concurrent requests respect the three-per-account daily cap, another account has its own allowance, and successful submission produces a saved-request receipt. Intake remains disabled in staging configuration until the owner can monitor it.
- Public browser QA covers 13 pages and 16 discovered internal destinations: no broken destinations, unique public titles/descriptions, parseable structured data, sitemap exclusions, robots policy, genuine HTTP 404, health and anonymous session checks.
- No automated axe WCAG A/AA violations on checked public pages or the account page. No public horizontal overflow at 320, 390 or 768 pixels; desktop captures at 1440 pixels. This is useful automated coverage, not a WCAG certification.
- Actual Node staging startup check passes configuration, migrations, canonical/noindex/cache and origin checks. No live Render/Neon proof exists yet.

## Performance

Final homepage Lighthouse measurement on 12 September, with simulated mobile and desktop profiles:

- Mobile: performance **90**, accessibility **100**, best practices **100**, SEO **100**. LCP **3.00 seconds**, total blocking time **0 ms**, CLS **0**.
- Desktop: performance **98**, accessibility **100**, best practices **100**, SEO **100**. LCP **0.91 seconds**, total blocking time **0 ms**, CLS **0**.
- INP is **not measured**; field data and real interactions are required. Mobile LCP still exceeds the 2.5-second good threshold in this run. Measure the deployed site before claiming good Core Web Vitals.

Public assets have gzip/Brotli variants and immutable fingerprinted-asset caching. HTML and APIs use private/no-store. No external fonts or tracking scripts are required. The previous CSP warning came from Zod's dynamic-code capability probe; disabling that probe removed the violation without permitting eval. A subsequent change removes a duplicate help question and fixes singular/expired-trial wording; the measured homepage implementation is unchanged.

Lighthouse generated both reports; its Windows temporary-profile cleanup reported a permission warning. No remaining Lighthouse Chrome process was found. No user browser profiles were deleted.

## Security and privacy limits

The enforced CSP blocks eval, framing, objects and external scripts. SSR currently requires inline script/style allowances; a nonce-based SSR policy remains a future hardening task. No claim of an independent security audit is made.

Optional first-party measurement is disabled by default on both client and server. Opt-in, Do Not Track and Global Privacy Control are tested; payloads are allowlisted event names only, with omitted credentials/referrers. The endpoint rejects extra fields/foreign origins, bounds the request body and applies a process-wide intake cap. Daily aggregate counts cannot provide user-level attribution, and public event submissions are not fraud-proof conversion evidence. Retention and operator processes need review before enabling measurement/support.

Secrets, test credentials, local certificates and raw test logs stay in ignored files. Published screenshots use synthetic test accounts and contain no marketplace cookies or real inventory. Desktop marketplace source was not changed in this website phase.

## Reproduce

Use an isolated local PostgreSQL fixture and ignored environment file; do not point destructive fixture setup at a real customer database.

```powershell
npm run typecheck
npm run build:node
node --test scripts/website-measurement.test.mjs scripts/deployment-policy.test.mjs scripts/auth-configuration.test.mjs scripts/desktop-pairing.test.mjs scripts/desktop-return-path.test.mjs scripts/entitlements.test.mjs scripts/migration-plan.test.mjs scripts/sign-out-plan.test.mjs
node --env-file=.env.phase2.local scripts/verify-database.mjs
node --env-file=.env.phase2.local scripts/website-support-proof.mjs
node --env-file=.env.phase2.local scripts/phase2-build-proof.mjs
node --env-file=.env.phase2.local scripts/website-local-production.mjs
# In a second terminal while the local fixture runs:
node scripts/website-qa.mjs
$env:LANE_PROOF_ORIGIN = 'https://localhost:8443'
node --env-file=.env.phase2.local scripts/phase2-account-proof.mjs
node scripts/website-lighthouse.mjs
```

The local HTTPS fixture needs the ignored localhost certificate/key described in its script. Performance tests should run without concurrent browser QA. Machine-readable results and full Lighthouse reports live under ignored `artifacts/website-qa`; reviewed screenshots are in [the gallery](qa/README.md).

## Remaining live gates

1. Access existing owner Render/Neon dashboards, provision free services and privately configure the database URL.
2. Run public HTTPS, durable database, signup/login/trial and device tests on the actual generated staging origin.
3. Prove the packaged Desktop pairs to that same account, survives restart and loses access after revocation.
4. Publish only the verified Windows release, date and SHA256; the download page currently explains its pending status.
5. Configure/test email delivery and optional Google OAuth; approve legal operator/contact/retention details before general public signup. Paid checkout remains closed.

Domain purchase is deferred and is not a staging blocker. Full Vinted listing-detail extraction remains the first desktop follow-up.
