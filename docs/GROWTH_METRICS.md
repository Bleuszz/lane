# Growth measurement contract

12 September 2026. **Specification, not an implemented new analytics system.** [Budget decisions](MARKETING_BUDGET.md) require qualified users, not raw counters. Marketplace session credentials remain local and separate.

## Existing implementation and the gap

`src/lib/lane/measurement.ts` sends only `{event}` for an allowlist; flags and opt-in consent are required, and GPC/DNT are respected. `migrations/0019_website_support_measurement.sql` stores `website_daily_events(day,event,total)`. No user/session/UTM/referrer/device fields exist. Both analytics flags default off. This is appropriate minimal aggregate measurement, but **page_view is not a unique visitor, event ratios are not a joined funnel, and source-level CAC cannot currently be calculated**. Do not silently repurpose operational data or add tracking in this documentation phase.

Before paid spend choose: (A) implement and privacy-review a minimal consented attribution layer, or (B) use explicitly consenting pilots' self-reported source plus observed tasks in a private local ledger. B supports small-cohort learning but not precise automated ad attribution; label unattributed users, exclude them from paid-channel claims. If attribution remains too uncertain to distinguish paid activations, hold ads. No need to buy analytics.

## Events and exact success definitions

| Funnel stage / event | Authoritative trigger | Count/deduplication |
|---|---|---|
| Visitor / `page_view` existing | Consented page display; proposed daily random visit ID for unique reporting | Existing counter is views only; do not retroactively call it visitors |
| Signup intent / `signup_started` existing | First meaningful signup interaction | Once per consented visit; button click is not account created |
| Signup / `signup_completed` existing name | Server confirms new Lane account transaction | Once per user; client currently emits, proposed server reconciliation required |
| Login / `login_completed` existing | Successful normal authentication | Session event, not new signup |
| Trial / `trial_started` existing name | Server persists first eligible trial start/end | Once per account lifetime; reinstall/logout do not restart |
| Download / `download_clicked` existing | Real release URL clicked | Click only; not proof file downloaded or installed |
| Approval begun / `desktop_device_approval_started` existing | Pairing approval page opened | Distinct pairing request, expired requests excluded from success |
| Device paired / `desktop_device_approved` existing + proposed `desktop_paired` | Approval is not enough: device token exchange and authenticated heartbeat succeed | Once per approved device; activated-user count distinct Lane user |
| Marketplace / proposed `marketplace_connected` | Validated owner session + identity, safe health report | User + marketplace + stable account pseudonym; no cookies/username |
| Discovery / proposed `owned_listings_discovered` | Verified owned index, count known | Diagnostic progress only; **not first import** |
| Import / proposed `first_item_imported` | Canonical owned inventory persisted with major fields verified, not merely links | First per user; incomplete titles/photos fail activation gate |
| Crosslist / proposed `first_crosslist_completed` | Remote listing ID confirmed for owner-approved publication | First per user; draft/click/ambiguous timeout not success |
| Returning user / proposed `meaningful_return` | Refresh/import/review on a separate day, not just opening homepage | D7 window days 7–13 after activation; report eligible denominator |
| Paid / proposed `subscription_paid` | Verified settled provider event, net of refunds | Once per first subscription; webhook ID deduped; checkout disabled today |
| Other existing | `pricing_viewed`, `upgrade_clicked`, `contact_submitted` | Diagnostic intent/confirmation; neither purchase nor activation |

**Pilot-connected user:** signup + paired desktop + verified marketplace + owned discovery. **Activated user (primary acquisition metric):** signup + paired desktop + verified marketplace + first accurate owned import within seven days of signup. **Crosslisting activation:** above plus confirmed first destination publication, tracked separately after release gate. Do not lower the primary definition because full Vinted details are pending. Record assisted/unassisted; exclude founder, staff, bots, QA and duplicate accounts.

## Attribution, privacy and UTMs

Canonical convention: lowercase ASCII snake_case, no names/emails/listing IDs. `utm_source` platform; `utm_medium` cpc / organic_social / community / referral; `utm_campaign=uk_launch_pilot`; `utm_content` asset/flight; `utm_term` approved keyword token only, never arbitrary raw search query.

Examples (replace origin with real HTTPS staging/custom origin at execution, no hardcoded future domain):

- `/how-it-works?utm_source=google&utm_medium=cpc&utm_campaign=uk_launch_pilot&utm_content=search_workflow_f1`
- `/how-it-works?utm_source=reddit&utm_medium=community&utm_campaign=uk_launch_pilot&utm_content=flipping_weekly_demo_v1`
- `/how-it-works?utm_source=tiktok&utm_medium=organic_social&utm_campaign=uk_launch_pilot&utm_content=v01_connections`
- `/signup?utm_source=pilot&utm_medium=referral&utm_campaign=uk_launch_pilot&utm_content=optin_cohort1`

Proposed attribution stores only allowlisted source/medium/campaign/content, canonical landing **path without arbitrary query**, coarse desktop/mobile/tablet class, consent version/time and pseudonymous first-party join key. First eligible touch within 30 days is acquisition source; last touch is secondary, never overwrite first silently. Unknown/direct stays unknown/direct. Do not use fingerprinting to join mobile and desktop; after consent, shared Lane identity can join pairing outcomes. Account security data is not ad targeting data.

Do not send passwords, cookies, tokens, OAuth codes, full referrers, private listings/photos, email, account names, IPs or auth headers to analytics/ads. No enhanced-conversion email hashing or session replay in this plan. Consent decline must not affect trial/product access. Proposed raw attribution retention 90 days then aggregate/delete; owner/privacy review required. Platform tags only after consent/configuration review; existing measurement stays off meanwhile. Consult current [ICO marketing and storage/access guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/) before implementation.

Private pilot ledger fields: random pilot code, consent to contact/research, source self-report, invitation date, signup/paired/connected/import/return milestones, assistance minutes, blocker category, testimonial permission. Do not place the identity lookup or individual data in this GitHub repository. Marketing opt-in is separate from consent to usability research and separate from optional analytics. Pilot deletion requests honoured through confirmed operator route.

## Dashboard / formulas

Daily view: all-in spend, qualified signups, activated users, unresolved onboarding failures, remaining cash. Weekly view: source cohorts, first-import completion, D7 eligible return, support minutes and actual paid outcomes. Record source/build/date and denominators. Owner reviews evenings, not constant automated surveillance.

| Metric | Formula / interpretation |
|---|---|
| Visitors | Distinct consented visit IDs in defined period; unavailable from current aggregate table |
| Qualified signups | Distinct real new users meeting ICP; keep total signups separately |
| Signup rate | Same-cohort qualified signups / attributable unique visitors; absent visitor IDs: report click→signup instead |
| Trials | Distinct server-confirmed eligible trial starts |
| Activation rate | Users activated within seven days / signups with full seven-day observation; also show provisional younger cohort |
| Paid conversion | Actual first payers / activated users with full billing observation window |
| CPC | Media cost / ad clicks; additionally report all-in cost/click |
| CPA-signup | All-in acquisition cash / attributable qualified signups |
| CPA-activation | All-in cash / attributable activated users |
| CAC-cash | All-in acquisition cash / first actual paid customers |
| CAC-fully-loaded | (Cash + attributed acquisition labour + onboarding labour) / actual first payers |
| MRR | Sum active recurring monthly charges net of VAT/refunds, annual contracts divided by 12; £0 during disabled billing |
| D7 retention | Meaningful users returning days 7–13 / activated users old enough for that full window |
| Paid renewal | Customers with successfully paid renewal / customers whose renewal became due |
| Observed contribution LTV | Cohort net collected revenue minus variable support, payment, AI and allocated hosting, divided by initial payers |
| Modelled LTV | Monthly contribution × assumed retained paid months; label scenario; do not extrapolate tiny-sample 1/churn |
| Cash remaining | Approved budget minus actual invoiced spend minus accrued liabilities/reservations |

Never divide by zero. Zero spend with no user = N/A; positive spend with zero payers = CAC undefined/no payers. Show denominators and age next to percentages. Report organic, paid, warm, creator and assisted cohorts separately; do not credit Search with all launches during its dates. Ads-platform modelled conversions are secondary to actual account/task evidence.

## Preflight QA before execution

1. Use explicitly marked synthetic accounts excluded from reports. UTM survives navigation/signup, consent refusal sends nothing, unknown source stays unknown.
2. Double clicks/reload/duplicate callback do not count two users, trial starts or pairings. Approved-but-never-exchanged pairing not activated.
3. Marketplace health events contain safe enums only. “Title unknown” discovery cannot emit verified first import.
4. Publish failure/ambiguous remote result cannot emit crosslist success. Revoked devices cannot submit valid events.
5. Test one consenting new-user journey and reconcile visible result with private ledger. Verify paid report excludes founder/test traffic.
6. Confirm deletion/retention, contact opt-out, data access and provider costs. Test real conversion import/tag only after approval; use counts from all-in invoice reconciliation.

No new event collectors, tags, cookies or migrations were implemented by this marketing task.
