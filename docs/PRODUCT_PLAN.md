# Lane product plan

Status: implementation branch; not a production launch. Updated 10 September 2026.

## Product promise

Keep your existing listing workflow. Prepare another marketplace's listing with fewer repeated questions, clear errors and control over every AI suggestion. Initial proof: Vinted to eBay UK for clothing. Measure ten real items before claiming time savings.

## Build order

1. Preserve imported attributes and photos; add extensible eBay item specifics with live taxonomy validation.
2. Optional AI completion: source-supported suggestions, explicit review, no overwriting seller values, monthly credit limits enforced on the server. Starter works without AI.
3. Redesign the landing page, app navigation, item workflow, connection catalogue and billing around a restrained resale-workroom identity: warm paper, dark green, clear type, fewer decorative cards, useful status.
4. All supported marketplaces available on every tier. Show the full service catalogue and distinguish implemented connectors from planned ones. Never mark a placeholder as connected. Next connectors need each service's permitted integration and credentials; priority Depop, Etsy, Shopify, WooCommerce, then Facebook/Gumtree and region-specific services.
5. Production gate: per-seller eBay policies/photo hosting, marketplace smoke tests, durable database, token configuration, sold-event deduplication and unattended jobs. No universal stock-sync guarantee before this passes.

## Proposed launch pricing

Starter: £9/month, 150 publish/relist actions, all supported channels, unlimited account slots, no AI credits.

Seller: £19/month, 600 actions, 150 AI credits, optional autofill, all Starter capabilities.

Pro: £29/month, 2,000 actions, 500 AI credits, same complete connectors. Scale the allowance rather than withholding essential reliability features.

One successful AI request uses one credit; failed requests restore the reservation. Credits reset by UTC calendar month, do not roll over and never trigger automatic overage charges. Connection count is not a proxy for live integration support. Prices are proposed and must be reflected in fresh billing Prices before checkout is enabled. Existing paid subscriptions must not be silently repriced. Verify tax registration and customer-price presentation before launch; no automatic tax setting is enabled by this plan.

## Differentiators to prove

- Preserve source detail instead of asking sellers to retype it.
- Required-field checklist driven by the destination category, with permitted values.
- AI shows the supporting listing text; empty/unknown beats invented fabric, dimensions or condition.
- Keep manual edits, expose remaining unknowns, and make accepted values editable.
- Clear connection health and recovery instructions; no false connected badges.
- One inventory, reusable templates, existing bulk edit/price rules and export without AI lock-in.
- Next: per-marketplace price previews, duplicate warnings, resumable batch publishing and reliable sold-event history. Existing fee estimates require current fee verification before being marketed as exact profit.

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
