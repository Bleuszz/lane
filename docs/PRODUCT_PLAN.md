# Lane product plan

Status: implementation branch; not a production launch. Updated 10 September 2026. Delivery stages and acceptance gates are in [ROADMAP.md](ROADMAP.md); [CONNECTORS.md](CONNECTORS.md) records expansion dependencies; [ECONOMICS_DEPLOYMENT.md](ECONOMICS_DEPLOYMENT.md) contains reproducible cost scenarios.

## Product promise

Keep your existing listing workflow. Prepare another marketplace's listing with fewer repeated questions, clear errors and control over every AI suggestion. Initial proof: Vinted to eBay UK for clothing. Measure ten real items before claiming time savings.

## Build order

1. Preserve imported attributes and photos; add extensible eBay item specifics with live taxonomy validation.
2. Optional AI completion: source-supported suggestions, explicit review, no overwriting seller values, monthly credit limits enforced on the server. Starter works without AI.
3. Redesign the landing page, app navigation, item workflow, connection catalogue and billing around a restrained resale-workroom identity: warm paper, dark green, clear type, fewer decorative cards, useful status.
4. Continue the redesign and Photo studio while making Vinted-to-eBay UK the immediate working path. Browser image adjustments cover crop, rotate, exposure and framing with no image-generation API cost. They do not remove backgrounds. Preserve originals and disclose that enhanced images must retain the item's actual colour and visible defects.
5. All supported marketplaces available on every tier. Show the service catalogue and distinguish implemented connectors from planned ones. Never mark a placeholder as connected. Depop, Etsy, Shopify, WooCommerce, Facebook and Gumtree remain planned; each needs its own integration, eligibility and live verification before support is advertised.
6. Production gate: per-seller eBay policies/photo hosting, marketplace smoke tests, durable database, token configuration, sold-event deduplication and unattended jobs. No universal stock-sync guarantee before this passes.

## Desktop platform order — 12 September 2026

1. **Windows — current supported beta and launch priority.** Public distribution remains gated on a verified installer URL, version, release date and SHA256. A working local beta is not a public release. Keep Windows launch and Vinted full-detail extraction on their existing path.
2. **macOS — coming soon, next high-priority platform.** Extends the usable audience beyond Windows; commercial impact is a hypothesis to validate with actual interested resellers. No build, supported CPU architecture or release date is promised yet.
3. **Linux — coming soon, after macOS.** Useful for versatility, with lower initial commercial priority. Supported distributions and package formats are undecided.

macOS/Linux must not delay Windows launch. This is preparation only: no new platform binaries or pipelines are implemented. `/download` presents the order explicitly, with no fake download links or notification form when email/subscription delivery is not configured.

Before either platform becomes supported, validate:

- Electron packaging per OS and CPU architecture, including native dependencies and clean install/uninstall.
- OS-backed secure credential/session storage, unavailable-keychain behaviour, per-account isolation, restart persistence and complete disconnect cleanup. Do not assume Windows encryption works elsewhere or allow plaintext fallback.
- Vinted/eBay session compatibility, browser navigation, login/popups, legitimate verification, background reads and account isolation; preserve the proven Windows implementation.
- Browser-based Lane login/device approval, callback handling, revocation and platform-specific permissions.
- Installer delivery and update/rollback flow; authenticated metadata, checksums and clear version identification.
- Platform signing: Windows signing remains a later release concern; macOS Developer ID signing/notarisation and Gatekeeper handling need validation; Linux package provenance/signing depends on chosen formats. No purchases or signing credentials requested now.
- Automated build/release matrix on appropriate OS runners, secret isolation, reproducible artifacts and platform smoke tests. Evaluate runner costs before enabling additional CI jobs.

Release gate per OS: normal user installs, pairs the same Lane account, connects marketplaces, reads accurate owned data, restarts/reconnects safely, revokes/disconnects and uninstalls. Publish the platform's download URL/date/hash only after actual artifact verification. Interest collection is optional later through a real consented notification service, never a form that silently discards requests.

## Proposed launch pricing

Trial: seven days, no card, 25 publish/relist actions for the trial's entire lifetime, zero AI credits. The action allowance does not reset at a month boundary. Expiry must be enforced by the server, while viewing and exporting existing work remains available.

Starter: £9/month, 150 publish/relist actions, all supported channels, unlimited account slots, no AI credits.

Seller: £19/month, 600 actions, 150 AI credits, optional autofill, all Starter capabilities.

Pro: £29/month, 2,000 actions, 500 AI credits, same complete connectors. Scale the allowance rather than withholding essential reliability features.

AI is opt-in. One request returning useful, validated suggestions uses one credit; failed requests or no useful suggestions restore the credit reservation. The provider can still charge Lane for those attempts. Paid allowances reset by UTC calendar month, do not roll over and never trigger automatic overage charges. A separate server attempt limit of twice the monthly AI credit allowance bounds retries, including refunded attempts. A provider-cost guard reserves $0.10 before each request against a $3 Seller/$8 Pro monthly budget and reconciles reported cost; unknown cost retains the reservation. Expensive requests or repeated failures can pause AI before all credits are used. Disclose this beside allowances and in the FAQ. Validate this behaviour before live billing; the economic stress test shows why an attempt limit alone is insufficient.

Connection count is not a proxy for live integration support. Prices are provisional and must be reflected in fresh billing Prices before checkout is enabled. Keep live billing disabled until entitlements, concurrency, trial expiry, webhooks and invoice reconciliation have been tested. Existing paid subscriptions must not be silently repriced. Verify tax registration and customer-price presentation before launch; no automatic tax setting is enabled by this plan.

## Differentiators to prove

- Preserve source detail instead of asking sellers to retype it.
- Required-field checklist driven by the destination category, with permitted values.
- AI shows the supporting listing text; empty/unknown beats invented fabric, dimensions or condition.
- Keep manual edits, expose remaining unknowns, and make accepted values editable.
- Photo studio with reversible local adjustments, before/after review and consistent product framing. Background removal is a separate future feature requiring a tested, commercially usable model or provider and its own cost allowance.
- Clear connection health and recovery instructions; no false connected badges.
- One inventory, reusable templates, existing bulk edit/price rules and export without AI lock-in.
- Next: per-marketplace price previews, duplicate warnings, resumable batch publishing and reliable sold-event history. Existing fee estimates require current fee verification before being marketed as exact profit.

## Ease of use is a release requirement

The first session should answer three questions: what is connected, which item is ready, and what still needs the seller's attention. Use one obvious next action, familiar marketplace wording, compact progress and plain recovery messages. Show advanced options only when needed. Mobile layouts must preserve readable labels, touch targets and review controls.

FAQ and contextual help must explain: supported versus planned channels; how reconnecting works; what an action counts as; trial expiry; what AI can and cannot infer; refunded AI credits versus attempt limits; photo editing versus background removal; whether the browser must stay open; how sold events are detected; data export and cancellation. Answers must match tested behaviour. Avoid unverified claims such as 'all platforms', 'instant stock sync', 'never oversell' or 'most advanced'.

## Acquisition sequence

First, record the same ten-item task in Crosslister and Lane. Publish an honest side-by-side walkthrough with measured time, corrections and failures. Do not claim 'better' on every feature or guaranteed results.

Recruit 3–5 resellers through Nate's existing reseller contacts and communities that allow feedback/pilot requests. Offer an explicitly limited assisted pilot, not an unfinished subscription disguised as production-ready. Ask where work still requires extra input. No fake reviews, unverified customer counts or mass messages.

Next, publish a factual comparison page answering 'Crosslister alternative' and 'Vinted to eBay crosslisting' searches. Show tested capabilities, date, UK availability and limitations. Create short recordings of a real item import, field completion and correction. Track qualified visits -> started trial -> completed first crosslist -> paid -> retained.

## Google Ads experiment (prepared, not launched)

Google's [trademark policy](https://support.google.com/adspolicy/answer/6118?hl=en) does not restrict trademarks as keywords, but restricts trademark use in direct-competitor ads and misleading use. Bid on intent; write clearly Lane-branded ads without implying affiliation. This platform policy is not blanket legal clearance.

Candidate exact/phrase terms: 'crosslister alternative', 'vinted to ebay crosslisting', 'UK crosslisting software'. A bare 'crosslister' term may attract existing customers seeking login/support; test separately only after higher-intent terms. Negative keywords: login, customer service, jobs, crack, free download. Review actual search terms; do not rely on broad match initially.

Draft headlines: 'Lane for UK Resellers'; 'Less Listing Admin'; 'Crosslisting From £9'. Draft description: 'Prepare Vinted and eBay listings in one workspace. Optional AI suggestions. Review your details before publishing.' Use only once the described workflow passes real tests.

No CPC or conversion forecast is verified. Illustrative sensitivity: at £0.50/click and 5% visitor-to-paid conversion, acquisition cost is £10; at £1.50 and 2%, it is £75. These are scenarios, not market quotes. Neither includes hosting, AI, fees, tax or support. A low monthly price cannot support arbitrary acquisition cost.

Paid ads come after working checkout, attribution, a real landing page and first-user evidence. Total mission costs remain capped at £30 including all fees. No ad spend, campaign activation, card charge or new provider account is authorized by this planning document. Reserve any proposed test budget against remaining funds at launch; cap lifetime spend and stop if it produces no qualified activity. Prefer organic proof first.

## Release evidence required

Typecheck; build; tests covering aspect validation, preservation, AI evidence rejection, manual-value protection and concurrent credit limits; responsive UI inspection; live integration checks using seller-approved test items. Separately document what needs real credentials. Do not equate a passing build with a working marketplace connection.
