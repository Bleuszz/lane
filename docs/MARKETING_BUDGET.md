# Marketing budget, forecasts and unit economics

12 September 2026. **TOTAL BASE BUDGET £30. PLANNED MAXIMUM £30. SPENT £0. REMAINING £30. Approved live campaigns: none.** This is a conditional cash allocation, not permission to spend. [Master plan](LAUNCH_MARKETING_PLAN.md) defines product gates, including G5 publishing proof for the drafted crosslisting Search terms. No subscriptions, domain or creative purchase allocated. Domain remains deferred by owner instruction; free staging is sufficient for a limited pilot.

## Plan A: £0 organic

Allocate cash £0, preserve £30. Allocate 12–16 founder hours across opt-in pilots, onboarding, two approved demonstrations and reusable educational content. Reach/signup hypotheses and risks are in the master plan. Economic time cost at assumed £15/hour: £180–£240. Cash CPA £0 does not mean customer acquisition is free.

## Plan B: staged £30, including fees

[Google's UK surcharge](https://support.google.com/google-ads/answer/9750227?hl=en-GB) is 2% of UK ad serving cost. Actual invoice tax treatment depends on the billing profile; this plan conservatively reserves up to a further 20% on media plus surcharge **as a sensitivity, not a tax determination**. Maximum planned media £24 × 1.02 × 1.20 = **£29.376**. £0.624 rounding/other buffer remains. If actual fees exceed this reserve, reduce media before activation. Account verification or minimum deposit can also make this test unavailable; never bypass it or add budget without approval.

| Flight, only after approval | All-in envelope | Media cap | Fee/tax/buffer reserve | Purpose/audience | CPC assumption | Expected clicks | Signup assumption | Expected signups | All-in cost/signup at endpoints | Stop rule |
|---|---:|---:|---:|---|---|---|---|---|---|---|
| F1, three days | £5 | £4 | £1 | UK Windows-reseller search intent and working landing funnel | £0.50–£2 | 2–8 | 2–10% | 0.04–0.80 | £6.25–£125 | No qualified signup: hold F2; wrong intent/data problem: pause now |
| F2, new three-day flight | £10 | £8 | £2 | Replicate qualified acquisition after one F1 signup activates | £0.50–£2 | 4–16 | 2–10% | 0.08–1.60 | £6.25–£125 | £10 cumulative all-in spent with zero qualified signup, or £15 with zero activation: stop |
| F3, new three-day flight | £15 | £12 | £3 | Repeat only a promising activated-user source | £0.50–£2 | 6–24 | 2–10% | 0.12–2.40 | £6.25–£125 | Requires at least 2 activated ad users and cumulative cost/activated ≤£7.50; otherwise keep reserve |
| Total conditional allocation | **£30** | **£24** | **£6** | One Search campaign family, sequential flights | Hypotheses only | **12–48** | Hypotheses only | **0.24–4.80** | **£6.25–£125** | Never spend to complete the table |

These fractional counts are expectations, not people or guaranteed minimums. The broad CPC range is an auction-cost sensitivity; the actual first-flight bid ceiling is £0.75, so expensive auctions may deliver no clicks rather than £2 clicks. Higher bids are not authorised by this model. Google may not deliver at the selected bid; actual clicks can be zero. F1 is a learning expense even if one signup costs £5. The £7.50 continuation ceiling is an exploratory hurdle, **not sustainable Starter economics**. With 20% active-to-paid conversion it implies £37.50 paid CAC. F3 still needs an explicit owner decision to buy that learning; it is not “scale” permission.

### Exact spending control

Use a **campaign total budget** on Search if available, with fixed three-day start/end and the media caps above. Current [Google documentation](https://support.google.com/google-ads/answer/10486938?hl=en-GB) supports campaign-total budgets; [duration/changes](https://support.google.com/google-ads/answer/10487143?hl=en) describes three to ninety days and a total cap. Confirm the actual account UI accepts the cap, bid strategy and dates before activation. Fees/taxes sit outside the media cap. Do not raise a cap mid-flight.

If unavailable, do not treat an average daily budget as a hard total cap: Google can spend up to twice it per day, and same-day reductions do not erase the higher limit. Safest fallback: **keep paid off** until an explicitly approved supervised fallback budget can be contained. Account budgets are generally for [monthly-invoiced advertisers](https://support.google.com/google-ads/answer/7054229?hl=en), not assumed available here. An alert or automatic rule is not an instantaneous billing guarantee. Do not use promotional ad credit requiring a larger spend commitment.

### £30 signup model

Assumptions—not market forecasts or confidence intervals. All cases use **£24 media, £30 conservative total cost**. Impressions = clicks / assumed CTR. Signup means one real new non-test account; activation includes accurate owned import; future paid requires billing later. Trial starts assumed one per new signup in this model; confirm server eligibility. Actual paid users today remain zero while checkout is disabled.

| Scenario | CPC | CTR | Impressions | Clicks | Click→signup | Signups / trials | Signup→active | Activated users | Active→future paid | Future paid expectation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Low | £2 | 2% | 600 | 12 | 2% | 0.24 | 30% | 0.072 | 10% | 0.0072 |
| Mid | £1 | 4% | 600 | 24 | 5% | 1.20 | 50% | 0.60 | 20% | 0.12 |
| High | £0.50 | 6% | 800 | 48 | 10% | 4.80 | 70% | 3.36 | 30% | 1.008 |

Human-scale illustrative outcome bands: **low 0–1, mid 1–2, high 3–6 paid-source signups**. These are scenarios, not statistical bounds; zero is possible in every case, and outcomes can exceed them. Organic users are separate and deduplicated. No measured UK CPC or search volume was available; CPC above £2 or insufficient demand makes even the low case optimistic.

| Scenario | All-in cost/signup | Cost/activated | Modelled paid CAC |
|---|---:|---:|---:|
| Low | £125 | £416.67 | £4,166.67 |
| Mid | £25 | £50 | £250 |
| High | £6.25 | £8.93 | £29.76 |

This deliberately exposes the problem: even the high case exceeds the initial Starter target below. Acquisition should therefore begin with organic proof. With 12 clicks and a true 5% signup rate, the probability of zero signups is about 54%; stopping a tiny test protects cash but does **not** disprove market demand.

## Plan economics: contribution, not exact profit

Monthly provisional prices: Starter £9, Seller £19, Pro £29. Trial and Starter have zero AI credits; future Seller 500 / Pro 1,500 allowances are provisional and disabled. No provider selected, so AI cost is unknown. Do not advertise allowances as available or equate one credit to one token/image.

Base assumptions per paying user/month:

- Payment processing: illustrative [Stripe UK standard card](https://stripe.com/gb/pricing) 1.5% + £0.20, plus **0.7% Billing** if that product is selected. Combined 2.2% + £0.20. This is a benchmark, not a committed payment-provider choice. Other cards, refunds/disputes/FX/tax products can cost more.
- Hosting/storage allocation: **£1**. Free launch can cost £0 within quotas; £1 is an early-customer reserve, not a provider price. Model fixed hosting as `monthly infrastructure / paying customers` when known. Render's [first paid instance](https://render.com/pricing) is advertised at US$7/month; [Neon pricing](https://neon.com/pricing) scales separately. A tiny paid cohort can have higher per-user fixed cost.
- Support reserve: **£3**, equivalent to 12 minutes/month at assumed £15/hour. Track real support time; this may be insufficient for desktop onboarding. Initial assisted onboarding of 15 minutes adds **£3.75 acquisition labour per user**, separate from recurring support.
- Future AI cost reserve: Starter £0 / Seller £2 / Pro £6. Pure planning inputs, equivalent to 0.4p/credit at full provisional allowance. No evidence a selected model can deliver this; stress to 2p/credit (£10/£30) before enabling.
- Price treated as revenue before VAT in the base case. If customer prices include VAT owed, use net revenue; 20% illustration below. Income/corporation tax, refunds, founder development labour, insurance/legal costs and other overhead are not fully modelled. This is **not net profit or tax advice**.

`Monthly contribution C = net revenue − payment fees − hosting allocation − support reserve − AI reserve`.
`Break-even acquisition ceiling over N paid months = C × N − onboarding cost − other acquisition costs`.
The table first shows C×N **before one-off onboarding and other fixed costs**, a mathematical ceiling that leaves no profit. Retention months are scenarios, not a churn forecast.

| Plan | C/month | 1 month | 3 months | 6 months | 12 months | Initial cash CAC target before onboarding* |
|---|---:|---:|---:|---:|---:|---:|
| Starter | £4.602 | £4.60 | £13.81 | £27.61 | £55.22 | £13.81 |
| Seller | £12.382 | £12.38 | £37.15 | £74.29 | £148.58 | £37.15 |
| Pro | £18.162 | £18.16 | £54.49 | £108.97 | £217.94 | £54.49 |

*Target = minimum(three-month contribution, 50% of six-month contribution), only after retention is supported. Subtract £3.75 assisted-onboarding labour: cash targets become **£10.06 / £33.40 / £50.74** before other acquisition costs. Without retention evidence, use the **one-month ceiling minus onboarding**: only £0.85 / £8.63 / £14.41. Keep initial paid acquisition a capped learning expense rather than claiming it passes these economics.

VAT-inclusive 20% sensitivity makes C approximately **£3.10 / £9.22 / £13.33** with the same fees on gross collected price. At full allowance and 2p/AI credit, Seller contribution falls to **£4.382**, Pro to **−£5.838** before VAT. Unlimited AI or guaranteed high margins would be irresponsible before real costs are measured. Extra £2 infrastructure allocation reduces C by £2; an extra 20 support minutes at £15/hour reduces C by £5. Negative contribution means no sustainable positive CAC.

At Starter target £13.81 before onboarding, active→paid 20% and signup→active 50% imply maximum **cost/active £2.76**, **cost/signup £1.38**. With 5% click→signup, maximum all-in cost/click is about **£0.069**. This is a decision formula, not an obtainable bid. Apply the lower after-onboarding target when assistance is actually needed. Recompute using observed plan mix; do not assume customers buy Pro to justify ads.

## Plan C: scale only after evidence

Amounts are **total cumulative cash ceilings**, not automatic additions. A £50 total means only £20 beyond £30. Every request must include actual invoices, qualified signup/activation counts, paid customers, refunds, cohort age, return/renewal, support minutes and net contribution. All future figures need owner approval.

| Total / extra above £30 | Conditional use | Minimum evidence to request—not automatic approval |
|---|---|---|
| £50 / +£20 | Repeat winning Search intent in two small envelopes; no new channel | G0–G4; ≥5 paid-source activations, measured attribution; exploratory ceiling not confused with profitability. If projected CAC exceeds conservative contribution target, do not request |
| £100 / +£70 | Same intent/creative; improve one measured bottleneck | ≥10 activated users and ≥3 actual paid customers from attributable cohorts; at least one complete month; billing gate passed; CAC within target after costs |
| £250 / +£220 | Replicate Search plus one opt-in creator collaboration experiment | ≥10 actual paid users, ≥2 cohorts, ≥30-day renewal evidence; no single creator/friend dominates; support reserve holds |
| £500 / +£470 | Bounded new creative/channel test, keep 80% on proven source | ≥20 paid users, ≥60-day retention, conservative three-month payback and contribution LTV/CAC ≥2 using observed cohorts |
| £1,000 / +£970 | Increase only the demonstrated profitable source gradually | ≥30 paid users, ≥90-day cohorts; after-onboarding CAC target holds even with 25% worse CPC/conversion; cash and support capacity; owner accepts loss exposure |

Counts are governance floors to reduce one-customer luck, not statistical proof. Low sample estimates remain uncertain. A cohort with one payer is not “100% conversion”. No paid customers/renewal can be claimed while billing is closed. If evidence cannot reach a scale gate on £30, obtain it from organic cohorts and longer observation; do not demand more money solely to fill the sample.

## Operating ledger

Record **actual invoice total**, not only Google media cost. Copy rows per approved flight; never put billing details, email addresses or user-level tracking in Git. Actual results stay “not run” until execution. Use aggregate counts only.

| Date/status | Channel | All-in max | Purpose | Expected result | Stop rule | Actual spend/result | Signups | Cost/signup |
|---|---|---:|---|---|---|---|---|---|
| Unscheduled / not approved | Search F1 | £5 | Intent + funnel probe | 0.04–0.80 expected, zero possible | No qualified signup holds next spend | £0 / not run | 0 | N/A |
| Unscheduled / conditional | Search F2 | £10 | Replication | 0.08–1.60 expected | Zero activation at £15 cumulative stops | £0 / not run | 0 | N/A |
| Unscheduled / conditional | Search F3 | £15 | Repeat promising source | 0.12–2.40 expected | F3 activation/cost gate fails | £0 / not run | 0 | N/A |
| Unscheduled / organic | Pilot/community/content | £0 | Ten-user goal | 0–15 distinct signup planning envelope | No permission/value, stop route | £0 / not run | 0 | N/A |

Actual spend £0; remaining £30. “N/A” for no observations; after positive spend with zero conversions, report **no conversions / undefined CPA**, never £0 CPA. Calculator/checker: `node scripts/check-marketing-plan.mjs`.
