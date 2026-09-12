# Live staging acceptance — not yet performed

Record HTTPS origin, date, Render deployment and health build SHA. Use a synthetic account, never real marketplace writes. Keep credentials/browser state private and ignored. Confirm free quotas; no paid upgrade is authorised.

- [ ] HTTPS loads; cold application/database wake behavior measured.
- [ ] Health reports database ok and correct version/commit/build time.
- [ ] `db:verify`: all 22 migration checksums/tables and actual remote TLS pass.
- [ ] Real signup, logout and email/password login work without optional keys.
- [ ] Seven-day trial, zero AI credits; redeploy/login/device linking cannot reset it.
- [ ] Account/dashboard and provisional pricing render; checkout disabled.
- [ ] Desktop opens same account approval; exchange/heartbeat show the same owner.
- [ ] Desktop/server restart preserve pairing; website revoke blocks access and refresh.
- [ ] Anonymous and second-user ownership isolation hold.
- [ ] AI, scheduler and image controls hidden/disabled; no calls or marketplace writes.
- [ ] Download remains unavailable until a verified installer exists; no local paths.
- [ ] Help, security, privacy, terms, contact accessible with honest beta limitations.
- [ ] Unconfigured Google/email show unavailable, never fake success.
- [ ] Sitemap accessible; robots disallow staging and response/meta noindex present.
- [ ] Canonicals match configured origin; private routes absent from sitemap.
- [ ] Secure/HttpOnly/SameSite cookies, CSP/frame/HSTS/security headers verified.
- [ ] Cross-origin auth POST rejected; Render proxy IP and rate limits verified.
- [ ] Client errors/logs contain no tokens, SQL, secrets or stack traces.
- [ ] Live screenshots: home desktop/mobile, pricing, signup/login, dashboard/trial, devices, download and genuine 404.

Read-only smoke: `node scripts/staging-smoke.mjs https://GENERATED.onrender.com`.

Screenshots: set `BASE_URL` to the public HTTPS origin and run `npm run screenshots:live`. Install bundled Chromium once with `npx playwright install chromium` if needed. The script labels LIVE STAGING with date/build and saves `artifacts/live-staging/<timestamp>/manifest.json`. Account/device captures are explicitly skipped without a synthetic authenticated fixture. Optional `SCREENSHOT_FIXTURE_STATE` must be a private ignored browser-state file for a synthetic test account, with `SCREENSHOT_FIXTURE_CONFIRMED=true`. Never export a real customer's session for screenshots. No credentials are requested now.

Broader commercial-launch gates remain separate: operator/contact/legal review, recovery email and verified desktop release. Google/domain are optional for staging. First desktop feature follow-up: **Vinted full listing-detail extraction**.
