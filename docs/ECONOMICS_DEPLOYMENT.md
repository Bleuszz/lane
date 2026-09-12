# Economics and deployment

Updated 10 September 2026. Actual Lane sales and verified Lane profit: £0. All figures below are scenarios, not forecasts or money earned. No hosting, AI or advertising purchase is made by this plan. Mission spending remains capped at £30 including fees.

## Prices and cost inputs

Provisional monthly customer prices: Starter £9, Seller £19 and Pro £29. Paid publish/relist allowances: 150, 600 and 2,000; AI credit allowances: 0, 150 and 500. Trial: seven days, 25 lifetime publish/relist actions, no card and no AI. All enabled connectors remain available on every paid tier. Marketplace selling fees are the seller's costs and are not Lane subscription revenue.

Source-verified inputs, checked 10 September 2026:

- Standard UK card processing: 1.5% plus £0.20 per payment. Premium and international cards have different rates. [Stripe UK pricing](https://stripe.com/gb/pricing).
- Stripe Billing pay-as-you-go adds 0.7% of Billing volume; this is additional to card processing in this subscription scenario. [Stripe Billing pricing](https://stripe.com/gb/billing/pricing).
- Configurable Grok 4.3 text requests: $1.25 per million input tokens and $2.50 per million output tokens, with reasoning set to none. No cache discount is assumed. Provider token usage, not returned suggestion count, determines the bill. [Grok 4.3](https://docs.x.ai/developers/models/grok-4.3).
- Vercel Pro lists $20/month; Hobby is for personal, non-commercial use. Existing application configuration is closer to a Vercel deployment, but no eligible paid account or unused allowance is assumed. [Vercel pricing](https://vercel.com/pricing), [Hobby restrictions](https://vercel.com/docs/plans/hobby).
- Cloudflare Workers Paid starts at $5/month, with usage overages. It is not a complete application-plus-database quote. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Planning assumptions, not provider quotes: £0.80 per US dollar; expected text request 3,000 input/600 output tokens; 50% credit consumption plus 10% additional billable attempts; £0.25 variable infrastructure per paid user/month; five support minutes at an imputed £12/hour (£1/user/month). Stress assumptions use £1 variable infrastructure and 20 support minutes (£4). Support is an economic allowance even if Nate initially does it unpaid. Replace every assumption with measured usage.

Taxes: the base scenarios assume no output VAT is payable on the stated subscription receipts. This is a modelling assumption, not a statement of Lane's registration status. Corporation/income tax, National Insurance, any irrecoverable VAT on supplier costs, FX/card charges, accounting, insurance, domain purchase, disputes, refunds and founder development time are excluded. A scenario contribution is therefore not final net profit. If output tax is owed, remove it from customer receipts before calculating contribution; if supplier tax cannot be recovered, add it to costs. Verify actual treatment before publishing checkout prices.

## Reproducible formulas

For a monthly price P in GBP, standard UK card plus Billing fees = P × 0.022 + 0.20. Result: £0.398 Starter, £0.618 Seller, £0.838 Pro, before transaction rounding.

AI cost in GBP = attempts × ((input tokens × 1.25 + output tokens × 2.50) / 1,000,000) × USD-to-GBP assumption.

At the expected request size this is $0.00525 or £0.0042 per attempt. Full successful credit use, without retries, costs £0.63 for Seller and £2.10 for Pro. At 50% usage and 10% extra billable attempts, expected AI costs are £0.3465 and £1.155. These request sizes have not been measured on a production cohort.

Per-user contribution = subscription receipts less output tax, payment/Billing fees, provider costs, variable infrastructure, support allowance and refunds/disputes attributable to that user. Monthly operating contribution = sum of per-user contributions minus fixed infrastructure and paid acquisition. Founder labour and business taxes must then be included before calling the result net profit.

## Worst usage and the safety cap

A 16,000-character prompt cap is not a 4,000-token guarantee, particularly for non-ASCII text. Use 40,000 input tokens plus 1,200 output tokens as a conservative engineering stress estimate until tokenizer measurements establish a defensible bound. This costs $0.053 or £0.0424 per attempt. At twice the monthly credit allowance in attempts, an unguarded Seller could cost £12.72 in AI, and an unguarded Pro £42.40. Pro would lose money before hosting or support. An attempt limit alone is insufficient.

The release design therefore adds a separate monthly provider-cost guard: $3 per Seller and $8 per Pro. Reserve $0.10 before dispatch, reconcile against reported token costs, and keep the reservation as an unresolved liability when usage is unknown. Concurrency must be atomic. Failed, empty or rejected outputs can refund a user credit while retaining their provider cost and counting as an attempt. The twice-credit attempt limit remains an additional restriction. Stop accepting calls when the next reservation cannot fit. Monitor the provider account's aggregate spend as well; a per-user application check cannot cap unrelated provider traffic.

At the planning exchange rate, guarded maximum AI liability is £2.40 Seller or £6.40 Pro. This bound depends on correct reservation, reconciliation, a validated maximum request estimate and fixed model pricing. It is not protection against implementation defects or a provider price change. At £0.65/$ and £1.00/$ the caps translate to £1.95/£5.20 and £3/£8 respectively. Update FX assumptions and provider prices before launch.

The cap can pause AI before all advertised credits are usable under unusually expensive or repeated failing requests. This must be clear next to allowances, in the usage screen and FAQ; do not sell credits as guaranteed calls if another cap can interrupt them. Before live billing, either prove ordinary eligible requests fit the allowance under this policy or revise the allowance/prompt size/pricing. Manual crosslisting remains usable when AI is paused.

## Expected and guarded stress contribution

Expected per paid user, after card/Billing fees, expected AI usage, £0.25 variable infrastructure and £1 support allowance:

- Starter: £9 − £0.398 − £0 − £0.25 − £1 = £7.352, or 81.7% of receipts.
- Seller: £19 − £0.618 − £0.3465 − £0.25 − £1 = £16.7855, or 88.3%.
- Pro: £29 − £0.838 − £1.155 − £0.25 − £1 = £25.757, or 88.8%.

Guarded stress per paid user, after the maximum provider-cost allowance, £1 variable infrastructure and £4 support:

- Starter: £9 − £0.398 − £0 − £1 − £4 = £3.602, or 40.0%.
- Seller: £19 − £0.618 − £2.40 − £1 − £4 = £10.982, or 57.8%.
- Pro: £29 − £0.838 − £6.40 − £1 − £4 = £16.762, or 57.8%.

These exclude the taxes and other costs listed above. They assume standard UK cards and no refund or dispute; card mix and support can materially change them. A refund reverses revenue but may not reverse all processing/provider costs. Do not offer unlimited text retries or paid image enhancements inside these allowances.

For an illustrative 40% Starter / 40% Seller / 20% Pro mix, average expected contribution is £14.8064 and guarded stress contribution £9.186 per paying user/month. Use a placeholder fixed-cost budget of £25/month for a Vercel-based pilot: roughly £16 hosting at assumed FX plus £9 reserved for database/storage/operations. The £9 is a budget allowance, not a verified bundle quote. Two expected users or three stress users cover that fixed cost before acquisition and excluded costs.

Ten users at that mix produce £170 receipts and about £123.06 expected operating contribution after the £25 fixed allowance, or £66.86 in the guarded stress scenario. At 50 users those figures are £850 receipts, £715.32 expected and £434.30 guarded stress. This holds support and infrastructure assumptions constant for illustration; it is not a claim those costs actually scale linearly.

Seven users at the illustrative mix yield £78.64 expected operating contribution after fixed costs. That is not proof of the seven-day £70 cash goal: users must actually pay, proceeds must be accessible, real costs must be deducted, and the mix may not occur. A trial or future subscription is not collected cash.

## Acquisition economics

First obtain organic pilot evidence and an accurate comparison page. Measure visitors → trials → completed first crosslist → paid → retained. Trial costs consume infrastructure and support even with zero AI; include them in acquisition cost. Effective CAC = ads + attributed trial costs + paid commissions divided by new paying customers, with zero customers treated as spend with no acquisition, not division by zero.

Illustrative paid search: £0.50 CPC at 5% visitor-to-paid conversion gives £10 ad CAC; £1.50 at 2% gives £75. Neither is a verified keyword quote. At £14.8064 average expected monthly contribution, ad-only payback is about 0.68 versus 5.07 paid months, before churn and trial costs. The £75 case is unsuitable for this mission and unproven retention. Do not use speculative lifetime value to justify a campaign.

Google permits trademarks as keywords but restricts direct-competitor trademark use in ad text and misleading uses. Use clearly Lane-branded copy and tested claims. Start with high-intent terms such as 'Vinted to eBay crosslisting' and 'crosslister alternative'; separate login/support traffic. This policy is not general legal clearance. [Google Ads trademark policy](https://support.google.com/adspolicy/answer/6118?hl=en).

No ad campaign is activated. Any future experiment must fit the remaining £30 total mission budget after infrastructure, fees and AI, have an explicit spending limit and be stopped if it produces no qualified activity. Current evidence supports organic validation first.

## Deployment sequence

1. Continue local development and tests at no new provider cost. Use isolated test data and mocks for API failures. Do not run database migrations against an unknown environment. A successful preview is not a working production connector.
2. Prepare the nearest-runtime test deployment using the existing Nitro/Vercel path if an eligible commercial plan and durable database are available within the budget. Vercel Hobby is not the paid-product hosting plan. Otherwise keep the tested build local until a suitable host is selected; do not silently purchase a plan.
3. Configure production authentication, secure cookies, strong token-encryption secret, exact OAuth redirects, durable PostgreSQL, backups and connection pooling. Fail closed when required secrets are absent. Verify the implemented eBay Media API delivery for local product images; it avoids an extra hosting service, but database storage, bandwidth, provider limits and host runtime still require measurement.
4. Separate migrations from normal build commands, run them deliberately on the intended database, and retain a rollback path. Add authenticated unattended jobs, idempotent webhooks, retry/backoff, job leases and reconciliation. Log outcomes without credentials or unnecessary buyer data. Monitor token expiry, failed delists, stale channels and provider spend.
5. Use seller-approved items for publish/edit/delist tests, confirm destination results, test a sold event and duplicate delivery, and verify a second seller cannot access the first seller's data. Keep live checkout disabled until payment readiness, trial/plan enforcement and usage reconciliation pass. No new payment KYC is assumed.
6. Run the limited assisted pilot. Record support minutes, token usage and cost, storage, errors and user corrections. Turn these measurements into revised unit economics before ads or wider signup.

Cloudflare Workers is a later cost-optimization option, not a configuration-label change. The $5 base is about £4 at assumed FX, but a migration must validate the Nitro preset, Node/pg compatibility, pooling/Hyperdrive route, database, image storage and scheduled jobs. Existing placeholder Wrangler configuration does not prove compatibility. Compare the total monthly bill and maintenance effort with Vercel; do not count an unknown durable database as free. [Workers Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [Hyperdrive PostgreSQL drivers](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/).

## Instrumentation required before claiming profitability

Record plan, billing period, action reservations/outcomes, AI attempt ID, model, token counts, charged estimate, unresolved reservations, credit refunds, provider failures and latency. Reconcile estimated provider cost with provider invoices, subscription receipts with payouts, and support allowance with actual minutes. Keep these separate from sellers' resale profit ledger. The release owner must replace assumptions with a measured cohort report before describing Lane as highly profitable.
