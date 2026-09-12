# Deployment-readiness evidence

**LOCAL PRODUCTION BUILD — not a live deployment.** Verified 12 September 2026, 14:17 UTC. Code revision: `e1b07742a8d34a0e63048e5bf2a30cdac2c60631`, clean working tree at snapshot time. Subsequent checkpoint updates documentation/evidence only.

`npm run check:deploy` exited **0**. It installed 571 locked packages into an isolated tracked-source copy, using Node 24.14.0. It did not copy local environment files, old build output, existing DB state or global browser installation. Bundled Playwright Chromium was used. The fresh PostgreSQL 16 fixture and its app process were removed after the run; original Desktop profiles/marketplace sessions and earlier local database were untouched.

Verified:

- Typecheck and **69 focused tests** pass: configuration/TLS/secret safety, Blueprint official JSON schema, auth, trial/entitlement behavior, owner-bound pairing, local connector state/security, migration planning, reliable operations and aggregate measurement.
- Production Node build passes. Linux Sharp/libvips/Rolldown dependencies are present in the lockfile; actual Render Linux build remains live validation.
- **All 22 migrations** run on fresh PostgreSQL; concurrent starts serialize, repeat run applies zero, changed historical SQL is rejected and an intentionally broken migration rolls back without leaving its table/history behind.
- Atomic rate-limit concurrency allows exactly the configured maximum, stores HMAC keys and recovers after expiry.
- `db:verify`: no missing/extra migrations, checksum mismatches or missing critical tables. `database.json` reports TLS false because this fixture uses loopback PostgreSQL; remote Neon TLS is explicitly untested, while the application enforces certificate verification for remote hosts.
- Real browser signup, HTTPS Secure/HttpOnly/SameSite cookie, seven-day trial, account dashboard, same-user device approval/exchange/heartbeat, server restart, refresh/revoke, logout/login and unchanged trial start all pass. Expiry retains inventory.
- CSRF rejection and actual login rate-limit responses pass. Unconfigured Google/reset email fail explicitly. No AI, scheduler, normalization or billing activation is needed.
- Public routes/internal links, unique marketing metadata, canonical/social image/JSON-LD, sitemap, noindex robots/headers, security headers and genuine HTTP 404 pass. Home has no horizontal overflow at 320/390/768/1440 pixels.
- Account axe scan: **zero violations** for tested WCAG 2/2.1/2.2 AA tags. This is not a full manual accessibility certification. Screenshots were visually inspected for layout and form/navigation clarity.
- Safe server log scan found none of the fixture DB/auth secrets or sensitive header patterns. No cloud calls, marketplace writes or paid service use occurred.

Screenshots contain synthetic test data only, labelled with local build SHA/time:

[Desktop home](home-desktop.png), [mobile](home-mobile.png), [320px](home-narrow.png), [pricing](pricing.png), [signup](signup.png), [login](login.png), [account/trial](account-trial.png), [devices](devices.png), [download](download.png), [404](404.png).

Raw logs are local ignored files under `artifacts/deploy-check/1789222441257-1cdcd1/`. [Result](result.json), [database summary](database.json), [axe result](accessibility.json). No new Lighthouse result is claimed in this hardening pass; current deployment latency/Core Web Vitals still need hosted measurement.

External gates: provider provisioning, real Neon TLS/pooling, Render build/HTTPS/cold start, packaged Desktop pairing and hosted acceptance. [Handoff](../../DEPLOYMENT_HANDOFF.md). Public-commercial-launch gates remain distinct from free staging readiness. First desktop feature follow-up: full Vinted listing details.
