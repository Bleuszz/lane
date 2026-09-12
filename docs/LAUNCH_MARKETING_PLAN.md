# Lane: first customers, £30 launch playbook

Research date: **12 September 2026**. Product baseline: `77db991`, branch `codex/lane-smart-crosslisting`. **Preparation only: no campaigns, messages, purchases or public posts authorised by this document. Spent £0.** Prices are vendor-published monthly prices, in their original currency, before unconfirmed checkout taxes. Recheck before using comparisons publicly.

## Decision in one minute

Recruit a small, permission-based UK clothing-reseller pilot first. Help each person complete a useful workflow, observe where they stop, and earn permission to show the result. Use organic demonstrations and approved community participation to reach ten real users. Reserve the entire £30 until a stranger can install Lane and accurately import an item. Then use **£5 → £10 → £15 maximum all-in envelopes**, conditionally, on one narrow Google Search experiment. Every envelope includes fees/tax contingency; unused money stays unspent. No paid social, boosts, bought posts or competitor-brand bidding in the base plan.

The strongest current channel is **opt-in pilot recruitment with assisted onboarding**. Second is **useful demonstrations in reseller communities that explicitly permit them**. Google Search is the first *paid experiment*, not an established winner. A £30 sample cannot establish reliable CAC or retention. Zero paid signups is entirely possible.

Execution files: [budget and economics](MARKETING_BUDGET.md), [experiments](GROWTH_EXPERIMENTS.md), [ad/content drafts](AD_CREATIVE_BANK.md), [SEO](SEO_GROWTH_PLAN.md), [communities and recruitment](COMMUNITY_ACQUISITION.md), [measurement](GROWTH_METRICS.md). These are the authoritative launch documents; older broad product ideas are not current feature claims.

## 1. Product truth and release gates

Code/source audit and [local deployment evidence](qa/deployment-readiness/README.md) show a tested web account, seven-day server-side trial, device approval/revocation, public pages and safe disabled integrations. The owner reports real eBay/Vinted authentication and listing discovery. **Vinted rows still showing “Title unknown” mean accurate full import is unproven.** Discovery is not import; import is not publishing. No public deployed URL or downloadable final release was verified in this pass. Billing, AI and automation remain disabled.

| Gate | Evidence required before proceeding | Current status |
|---|---|---|
| G0: public pilot | HTTPS staging, durable DB, real signup/login/trial/revoke, working support route, privacy/operator details reviewed | Local checks passed; hosted proof pending |
| G1: usable Windows release | Public installer URL, SHA256/version, honest unsigned notice; fresh-user install and pairing | Public release pending |
| G2: useful activation | At least three independent target users pair, connect, accurately import one owned item, return within seven days; record defects/time | Not proven; Vinted details first app follow-up |
| G3: measurable acquisition | Campaign attribution or consented manual pilot reconciliation, real activation evidence, expense controls, matching claim/demo | Current aggregate analytics insufficient |
| G4: paid test | G0–G3 pass; **G5 also passes for the drafted crosslisting Search terms**; owner approves exact all-in envelope, available onboarding time | HOLD all paid spend |
| G5: crosslisting claim | Owner-approved item accurately published/reviewed on destination; remote result confirmed without duplicates | Not verified; do not advertise live crosslisting yet |
| G6: commercial scaling | Billing release gate, real paid/renewal cohorts, contribution margin and support capacity | Closed |

Before G0, conduct only owner-approved research conversations about the workflow; do not send people to a non-existent launch. Before G2, explicitly call participation a connection/discovery pilot. The default Search bank targets crosslisting intent, so it remains paused until G5 too; successful imports alone do not satisfy someone seeking publishing. If a pilot's trial expires while Lane is unusable, discuss a documented discretionary extension later; do not promise an implemented extension feature or reset trials silently.

## 2. Evidence method and limitations

Primary vendor pricing/support pages outrank affiliate comparisons. Reviews provide hypotheses, not incidence rates or proof of causation. Search results reveal competing content and intent, not search volume, Google rank or paid spend. No logged-in Keyword Planner data, impression-share report or commercial SEO dataset was available. CPC, conversion and reach ranges below are **planning assumptions**, not measured benchmarks. Ad-library checks returned insufficient searchable evidence: [Google Ads Transparency](https://adstransparency.google.com/?region=GB), [Meta Ad Library](https://www.facebook.com/ads/library/). Advertising presence for every competitor remains **unknown**, not “none”. No customer-count/revenue claims are used.

### Competitor landscape

“Advertises” means vendor claim, not Lane testing or marketplace endorsement. All inferred opportunities are conditional on Lane proving the underlying capability. Review status and acquisition observations follow the product table so pricing and opinion remain distinguishable.

| Product / primary evidence | Markets and UK/Vinted/eBay status | Pricing / trial | Positioning, principal features, delivery |
|---|---|---|---|
| [Crosslist](https://crosslist.com/pricing), [marketplaces](https://crosslist.com/marketplaces) | US/UK/CA/AU; advertises Vinted/eBay plus Depop, Etsy and other channels | $29.99/34.99/39.99/44.99; AI +$4.99. Three-day/20-listing refund window, not a no-card trial | Universal listing form, image tools, templates, category mapping; higher tiers autodelisting/analytics. Web/browser workflow and mobile app advertised |
| [Vendoo UK](https://www.vendoo.co/uk/pricing), [current support list](https://help.vendoo.co/en/articles/6260300-which-marketplaces-does-vendoo-support) | UK eBay/Depop/Etsy/FB/Whatnot; **Vinted contradictory**: [UK homepage](https://www.vendoo.co/uk) mentions it, July 2026 help list omits it | UK page £0/5 items; £16.99/27.99/49.99 at 125/250/600 new items. [US page](https://www.vendoo.co/pricing) instead advertises $14.99/29.99/59.99 unlimited and 14-day card trial; old tables also remain. Confirm UK checkout, do not mix regions | Inventory, importing, sale detection, analytics, mobile apps plus desktop/extension. Strong multichannel breadth |
| [List Perfectly pricing](https://listperfectly.com/pricing/), [FAQ](https://listperfectly.com/faq) | US marketplaces officially supported; UK explicitly unsupported. eBay US; Vinted listed as Lite, without automatic sale detection | $29/49/69/99+; FAQ says payment required, five-day/100-listing refund guarantee | Unlimited inventory/crosslisting, feature-tiered field coverage, AI, templates, community onboarding. Browser/extension with mobile access |
| [Vindy](https://vindy.tech/) | Vinted-focused; eBay not established; UK-specific region support not independently verified | €0; €4.99/12.99/19.99; free plan rather than timed trial | Extension, mobile support and web AI tools advertised; reposting, engagement and images. Its speed/automation claims are not evidence for Lane |
| [SellerAider](https://selleraider.com/pricing/), [connector docs](https://guide.selleraider.com/lister/features/crosslist) | UK/US and other regions; Vinted/eBay explicit, plus Depop/Etsy etc | Crosslister $12.99/$29.99; 14-day trial. Separate Grow plans are not the crosslisting subscription | Chrome/web/mobile workflow, inventory, AI and bulk operations. Documentation describes user finishing publication; marketing describes automation—verify exact mode before comparisons |
| [Flyp](https://www.joinflyp.com/), [support](https://resellertools.zendesk.com/hc/en-us/categories/4405098766989--Crosslister-FAQs) | eBay and US-oriented channels; current help includes Vinted despite competitor articles saying otherwise. UK transport compatibility not established | Homepage says 100 days free then $9/month; search title still says free—use current body, verify offer | Browser reseller tools, crosslisting, syncing, delisting, Poshmark tools; help addresses connection issues |
| [OneShop](https://oneshop.com/), [price](https://oneshop.com/pricing) | eBay/Poshmark/Mercari/Depop shown; Vinted and UK not established | $45/month; homepage seven-day trial, card terms unverified | App-led all-in-one listing, templates, delisting, automation, sales graph and community |
| [Zipsale](https://www.zipsale.co.uk/pricing) | Explicit UK product, Vinted/eBay plus other channels | From £15/month **+ VAT**, or £0.18/item + VAT; automation add-ons from £10 + VAT. No-card entry advertised; exact free allowance not verified | PC-first web inventory, importing, templates, analytics and autodelisting advertised. Single-quantity limitation. Strong direct UK comparison |
| [CrossLister.co](https://crosslister.co/pricing), [FAQ](https://crosslister.co/faq) | UK/CA/US, eBay/Vinted plus six named channels | $19.99/29.99/49.99/99.99/149.99; 14-day no-card trial | Inventory, templates, image editor; auto-delist labelled coming soon. Web tool. **Different brand from Crosslist.com**; owner's £40 experience cannot establish which exact vendor/plan without receipt/domain |
| [Wrenlist](https://www.wrenlist.com/pricing) | UK-first; vendor comparison advertises Vinted/eBay/Depop; live integration quality untested here | Free inventory/crosslisting claimed; founding £9/19/24 paid tiers, some higher normal prices shown | Web/extension, inventory, AI, stock/financial tools. Important evidence that £9 alone is not unique |
| [Listelf, formerly Crosslist Magic](https://chromewebstore.google.com/detail/listelf-formerly-crosslis/lkjldebnppchfbcgbeelhpjplklnjfbk?hl=en-gb) | Store description includes UK and Vinted/eBay plus other channels | Current subscription price/trial not verified; do not repeat old Reddit $10 quote | Lightweight Chrome crosslisting helper; low-install-friction alternative |

### Sentiment, distribution and Lane opportunities

No representative review sample was available. “Common” below means recurring *themes in the inspected material*, not a measured percentage of all customers. Do not publish allegations as facts or selectively turn them into attack ads.

| Product | Reviews / complaint evidence | Acquisition and SEO observed | Likely strength / weakness (inference) | Lane opportunity |
|---|---|---|---|---|
| Crosslist | [Trustpilot](https://www.trustpilot.com/review/crosslist.com): positive ease/workflow reports; some setup, entitlement and Vinted-warning reports. Mixed outcomes; warnings do not prove cause | Extensive UK, alternative and pricing articles; public testimonials and trial CTA; appeared in research searches | Mature feature breadth / more complex tiers and onboarding | Prove clear connection errors and accurate fields; do not say its delisting is absent |
| Vendoo | [Trustpilot](https://www.trustpilot.com/review/vendoo.co): praise for support/ease; [older user reports](https://www.reddit.com/r/BehindTheClosetDoor/comments/1apwos9) describe reconnect/field/delist issues; historical, not current defect proof | UK landing/pricing, help, social links and webinars visible; strong content footprint | Multichannel/mobile / region and pricing ambiguity | Explicit UK compatibility and one demonstrated workflow |
| List Perfectly | Vendor testimonials only assessed; no independent current complaint conclusion. FAQ documents US limitation and field-tier differences | Blog, live onboarding, Listing Party, referral programme | Community/support / UK not officially supported | UK-specific setup and supported-field checklist |
| Vindy | No adequate independent review sample; do not label unreliable | Free extension funnel, localized pages, web AI tools | Low/free entry / eBay coverage unverified | Two-marketplace workflow, if proven; not an automation arms race |
| SellerAider | [Trustpilot](https://www.trustpilot.com/review/selleraider.com) has mixed small-sample sentiment; insufficient basis for prevalence estimates | SEO UK pages, extension install, trial, docs | Low entry price and reach / buyer must understand product/mode | Explain exactly what Lane reads and what still needs review |
| Flyp | Vendor help exposes troubleshooting needs; no representative independent sample. Do not confuse property company flyp.co reviews with joinflyp.com | Long free trial, tool-first acquisition, searchable help | Low price / UK support not confirmed | Verified UK session path, not “only tool with Vinted” |
| OneShop | [User thread](https://www.reddit.com/r/poshmark/comments/1pdhpha/does_anyone_here_have_oneshop_i_have_been_using/) reports imports/reconnect problems; anecdotal | App demos, trial, blog, YouTube/social links | Unified mobile workflow / uncertain UK fit | Lower entry price plus UK proof, accepting Lane's Windows friction |
| Zipsale | [Reviews](https://uk.trustpilot.com/review/www.zipsale.co.uk): useful multichannel reports alongside unclear errors and support/cancellation complaints, including 2025 accounts | UK-specific site, tutorials, merchant testimonials, free tool | UK focus / support expectations and VAT-inclusive cost | Precise recovery instructions and honest support availability |
| CrossLister.co | Owner reports £40 cost, account-linking and extra manual fields, but vendor identity unresolved; no public prevalence claim | SEO FAQ/tutorials, social links, no-card trial | Established import workflow / field friction is a hypothesis | Benchmark the owner's actual task before comparative copy |
| Wrenlist | No adequate independent review sample; vendor claims only | Free tier, fee tools, glossary and named competitor pages | Free entry, UK narrative / beta maturity untested | Earn trust through demonstrated reliability, not cheapest claim |
| Listelf | Store listing exists; ratings/sample not assessed | Chrome Store discovery and lightweight install | Small workflow surface / broader operations not established | Same-user inventory persistence if proven useful |

Paid advertising presence and exact organic rank are **unknown for every row**. Before a later competitor campaign, check UK advertiser/domain/date in both ad libraries, record creative URL and date, and check current checkout/support pages. Do not click competitors' live ads to research them.

## 3. First customer selection

Scores are founder hypotheses, **1–5, higher is better for Lane now**, not survey results. P=pain, I=purchase intent, A=ability to pay, F=listing frequency, T=current tool usage, S=potential repetitive work saved (not measured time), R=reachability, X=trial likelihood, L=retention potential. Equal weights for transparency; revise after ten interviews. Some segments overlap; classify each pilot once by primary behaviour.

| Segment | P | I | A | F | T | S | R | X | L | Total /45 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Part-time UK clothing sellers already on Vinted + eBay, Windows | 5 | 4 | 3 | 4 | 3 | 5 | 4 | 4 | 4 | 36 |
| Serious Vinted resellers considering eBay | 5 | 4 | 3 | 4 | 3 | 5 | 4 | 4 | 3 | 35 |
| eBay clothing sellers considering Vinted | 4 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 34 |
| Vintage clothing specialists | 4 | 4 | 4 | 4 | 4 | 5 | 3 | 3 | 4 | 35 |
| Full-time multichannel resellers | 5 | 5 | 5 | 5 | 5 | 5 | 2 | 2 | 3 | 37 |
| High-volume/team sellers | 5 | 5 | 5 | 5 | 5 | 5 | 1 | 1 | 2 | 34 |
| Depop/Vinted expansion sellers | 4 | 3 | 3 | 4 | 3 | 4 | 4 | 3 | 2 | 30 |
| Sneaker/fashion collectors reselling | 3 | 3 | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 28 |
| General thrift/flipping hobbyists | 3 | 2 | 2 | 3 | 2 | 3 | 4 | 4 | 2 | 25 |
| Casual wardrobe clear-outs | 2 | 1 | 2 | 1 | 1 | 2 | 5 | 3 | 1 | 18 |

**Primary:** first row, roughly 20–100 active clothing listings, regular new listing work, willing to test one owned item and return. Range is recruitment focus, not a product limit. **Secondary:** eBay clothing sellers adding Vinted, once their actual account/use is eligible. **Later:** vintage/full-time/high-volume teams. Despite high pain scores, their reliability/bulk/stock requirements fail today's capability gate. Depop-first sellers and mobile-only users are not a fit yet. No new marketplace accounts, verification or bot-oriented communities are required for the pilot.

## 4. Positioning to test

Ratings 1–5 are judgement, not results. Columns: clarity/specificity/credibility now/pain/differentiation/SEO/ad fit.

| Message | Scores | Decision |
|---|---|---|
| A Windows workspace for UK Vinted and eBay sellers | 5/5/4/3/3/4/4 | Primary beta message; supported scope, clear device requirement |
| See your marketplace connections in one Lane account | 4/4/4/3/3/2/4 | Secondary current proof; gated by live pairing |
| Crosslist Vinted and eBay without retyping everything | 5/5/1/5/2/5/5 | Strong future hypothesis, **blocked until measured complete workflow** |
| One inventory for your resale workflow | 4/2/2/4/2/3/4 | Too broad today; cloud import still needs proof |
| Less repeating. More reselling. | 3/2/3/4/2/2/4 | Keep as brand line, support with a concrete explanation |

Homepage proposal (copy plan only): **“A Windows workspace for your Vinted and eBay selling.”** Supporting line: “Connect your own marketplace accounts through Lane Desktop. Explore the beta with one Lane account and a seven-day trial. Check the current import and publishing limits before you start.” Primary CTA **Start free for 7 days** only when signup and useful access exist; before then **See the beta workflow**. Short ad message: **Lane for UK Resellers**. No claims of approved integrations, guaranteed account safety, sales uplift, automatic sold-item delisting, live AI or “best”.

## 5. Channel ranking

All costs exclude founder time unless stated. H/M/L are qualitative hypotheses. I=intent, S=speed, T=targetability, U=trust, C=likely qualified conversion, X=scalability. Score is overall suitability **for this launch**, with permission/product gates applied, not arithmetic precision. Evidence: competitor/public community research above, [Google budget mechanics](https://support.google.com/google-ads/answer/10487143?hl=en), [TikTok budget minimums](https://ads.tiktok.com/help/article/budget?lang=en), and [community rules](COMMUNITY_ACQUISITION.md).

| Rank/channel | I/S/T/U/C/X | Cash now; effort | Rules / constraint | Fit /10 |
|---|---|---|---|---:|
| 1 Opt-in direct pilots | H/H/H/H/H/L | £0; 4–6h initial | Respond only to requests/permission; no cold seller DMs | 9 |
| 2 Approved reseller Facebook groups | H/M/H/H/M/M | £0; 2h/week | Admin permission, actual group rules | 8 |
| 3 UK Reddit reseller communities | H/M/H/M/M/M | £0; 2h/week | No standalone promo where forbidden; disclose founder | 8 |
| 4 Practical tutorial content | H/M/M/H/M/H | £0; 1–2h/asset | Accurate, dated examples; no private seller data | 8 |
| 5 Google Search ads | H/H/H/M/unknown/H | Conditional £30 all-in; 2–3h setup | Hard envelope; exact/phrase; small sample | 7 |
| 6 Organic TikTok/Reels | M/M/M/M/L/H | £0; 1h/video | Real demos, captions, Windows disclosure | 7 |
| 7 YouTube Shorts | M/M/M/H/L/H | £0; reuse video | Link to relevant tutorial; no clickbait | 7 |
| 8 SEO / Google organic | H/L/M/H/M/H | £0; 2–3h/article | Staging noindex; domain later; weeks/months | 7 |
| 9 Opt-in micro-creator pilot | H/M/H/H/M/M | £0; 1h vetting | No paid placement; disclose benefit; editorial freedom | 7 |
| 10 Word of mouth/referral | H/L/H/H/H/M | £0; after value | Future rewards disabled; no address-book harvesting | 7 |
| 11 Vinted reseller discussions | H/M/H/M/M/M | £0; 1h/week | Independent groups only with permission; no in-app sales messages | 6 |
| 12 Honest comparison content | H/L/H/M/M/H | £0; 3h comparison | Hold until side-by-side owner benchmark exists | 6 |
| 13 eBay seller community | H/L/M/H/L/M | £0; 1h/week | Help-only until promotion permission verified | 5 |
| 14 Relevant Discord | M/M/H/M/L/M | £0; 1h rules review | Free permitted channels; reject bot/paid-group funnel | 5 |
| 15 Partnerships / later affiliate | H/L/H/H/M/H | £0 design | Reward costs/terms and fraud review first | 5 |
| 16 Indie Hackers | L/M/L/M/L/M | £0; 30min | Founder feedback, not reliable reseller acquisition | 4 |
| 17 X/Twitter | L/M/L/L/L/M | £0; 30min/week | No bulk mentions/DMs | 4 |
| 18 Meta paid | L/H/M/L/unknown/H | £0 allocated | Mobile-heavy demand generation; insufficient learning budget | 3 |
| 19 Product Hunt | L/H/L/M/L/M | £0; 2h launch | Wait for usable public product; no vote manipulation | 3 |
| 20 Reddit paid | M/H/H/L/unknown/M | £0 allocated | Moderator permission for organic does not imply ad endorsement | 3 |
| 21 TikTok paid | L/H/M/L/unknown/H | £0 allocated | Documented daily minimums consume budget; organic first | 2 |

## 6. Organic plan A: £0 cash

Use 12–16 founder hours over 30 days, principally weekday evenings after 17:30 UK time; weekend availability must be confirmed, not assumed. Reuse assets. This is a capacity allowance, not free labour: at an assumed £15/hour it costs £180–£240 economically.

| Activity | Time | Reach hypothesis, not verified audience | Signup potential | Risk / measurement |
|---|---:|---|---|---|
| 20–30 permission-based conversations over month | 4h + 3h onboarding | 20–30 qualified people, only if reachable | 3–10 | Unknown warm network; track invited/accepted/activated |
| Two approved community demos + useful replies | 2h | 50–300 relevant readers | 0–5 | Removal/rule mismatch; unique source links and permission record |
| Three short videos repurposed across channels | 3h | 100–1,000 plays, not unique people | 0–3 | Mobile/device mismatch; qualified replies and referral visits |
| One substantial tutorial, prepare second | 2–3h | 0–100 first-month visits; staging SEO may be zero | 0–2 | New-site delay; Search Console after indexing allowed |
| Return/feedback follow-up to consenting pilots | 1h | Existing cohort only | Not new acquisition | Count return use; honour no-contact requests |

Do not add these signup ranges: people overlap. Planning envelope **0–15 distinct organic signups; ten is a recruitment goal, not forecast**. Reconcile identities privately. If no approved community or warm route exists, start with help-first participation and interviews; the plan's reach falls toward zero. No scraped marketplace contacts.

## 7. Landing-page conversion review

Reviewed current source and [desktop QA screenshot](qa/deployment-readiness/home-desktop.png), labelled **LOCAL PRODUCTION BUILD**, not live traffic evidence. Hero is visually clear with trial CTA above fold, secondary workflow link, Vinted/eBay explanation, no-card/zero-AI caveat, authentic test-account screenshot, pricing and FAQ. Security/help links and independence text are present. There is no measured five-second comprehension test yet.

Before paid traffic, make only targeted changes if user tests confirm need:

1. Ask five target users, after five seconds: what is it, who is it for, what device is needed, what happens next? Record responses; aim four of five correct, otherwise strengthen concrete hero wording.
2. Put **Windows computer required** adjacent to the CTA, not only small eyebrow text. On mobile explain they can create an account now but need Windows to use Desktop. Do not imply mobile crosslisting.
3. Replace/augment the account skeleton with a real, redacted connection → accurate item import recording after G2. Never use “Title unknown” as proof of complete import.
4. Resolve missing installer and support/operator details. Do not buy traffic to a dead download step. Explain beta trial and no automatic payment clearly.
5. Test cold Render load from UK mobile and desktop; free-host waking can damage the funnel. Record actual latency and abandonment. Do not fake uptime with keep-alive traffic or buy hosting without approval.
6. Link each ad to `/how-it-works` initially; use homepage only if message matches. Dedicated page plans are in [SEO](SEO_GROWTH_PLAN.md); no pages implemented here.

## 8. Trust, pilot and review strategy

Offer ten pilot places because that matches onboarding capacity, **only if Nate actually reserves those slots**. No countdown or fake scarcity. Start in cohorts of three, three, four; invite more only after fixing blocking setup issues. Offer the existing no-card seven-day trial and optional 15-minute evening onboarding, not lifetime access or unimplemented AI rewards. Detailed scripts/feedback process: [community playbook](COMMUNITY_ACQUISITION.md).

Explain local session storage, same Lane account/device revoke, supported beta scope and disconnect honestly. Never claim zero risk or official marketplace approval. Link real release notes/checksum and clearly state unsigned status. Confirm a real support channel; make no one-day response guarantee without owner agreement. Do not post the owner's private email/address as public contact by assumption.

After real use ask what helped, what failed, whether they returned, and whether a specific quote and attribution may be published. Request feedback from unsuccessful users too. Preserve original wording and approval; no reward contingent on positive sentiment. Case study later: exact build, item count, timed manual task, timed Lane task, corrections, failures, and explicit limitations. No invented sales gains.

## 9. Creative asset inventory

| Asset | Format/dimensions | Message/channel | Status / creation |
|---|---|---|---|
| Home desktop capture | PNG 1440px wide | Credible website, pilot link | Local QA exists; recapture HTTPS after deploy |
| Mobile home | PNG 390px wide | Account now, Windows later | Local QA exists; avoid presenting as mobile app |
| Device pairing demo | MP4 1920×1080, 30–45s | Same account, local sessions | Planned; record real flow, redact identity before capture |
| Accurate Vinted import | MP4 1080×1920, 15–30s | One owned item, preserved fields | BLOCKED G2; show actual result only |
| Vinted → eBay publishing | MP4 1080×1920, 15–45s | Real reviewed crosslist | BLOCKED G5, no simulated remote publish |
| Pricing card | PNG 1080×1350 | £0 trial; provisional £9/19/29 | Planned, use current site typography, checkout-closed label |
| Security explainer | SVG/PNG 1200×675 | Cloud account / local marketplace session | Planned from verified architecture, no “100% safe” |
| Social share card | 1200×630 | Brand + beta purpose | Existing public metadata asset; verify deployed URL |
| Comparison checklist | HTML then 1200×675 excerpt | Supported fields, test date | BLOCKED measured comparison; no competitor logos needed |

Use existing screen recording/editor tools and code-native graphics; £0 creative purchases. Captions, legible cursor/zoom and honest cuts. Never film login passwords, tokens, seller addresses or customer order details. All assets remain unpublished until execution approval.

## 10. First 72 hours after G0, not today's date

| Time | Action | Budget | Evidence / decision |
|---|---|---:|---|
| H0–2 | Deploy and complete LIVE_ACCEPTANCE; record HTTPS/build and support route | £0 | Any auth/data defect: hold invitations, fix product |
| H2–4 | Install released Desktop as a new user; verify paired account, revoke, true import scope | £0 | Missing release/details: connection pilot only, no ads |
| H4–8 | Test consent/attribution and counters with labelled test account excluded from totals | £0 | Broken measurement: manual consenting pilot log; no paid campaign |
| H8–24 | Owner-approved soft launch to people who requested updates; offer first three slots | £0 | Aim 3 accepted invitations, not promised results |
| H24–36 | Observe first cohort, record exact gate failures; capture permitted genuine demo | £0 | Two blocked setups: pause more recruitment until diagnosed |
| H36–48 | One permitted community post and one useful video; review questions | £0 | No permission: do not post; substitute own profile content |
| H48–60 | Revisit installations/imports and signup attribution; publish no stronger claim than proven | £0 | G2 needs seven-day return, so new pilot alone cannot pass it in 72h |
| H60–72 | Decide next cohort. Only if earlier pilot already satisfied G2–G3 and owner approves, prepare/enable £5 envelope | £0 or approved £5 cap | Default first 72h paid spend is **£0**, not forced spend |

Nate's hands-on time: about 3–4 hours split across evenings, not 72 hours of constant work. If launch day is a weekend with no availability, shift owner-dependent actions; calendar days are relative.

## 11. Thirty-day calendar

Every budget is an upper bound **after separate execution approval**. Conditional £5/£10/£15 sum to £30; missed gates shift dates rather than force spending. Follow-ups only where previously agreed. Routine review 10–15 minutes may accompany any day; main actions below total roughly 12–16 hours with reusable content.

| Day | Action/channel | Max new cash | Owner time | Success metric / stop or pivot |
|---|---|---:|---:|---|
| 0 | Deployment/release acceptance | £0 | 45m | G0/G1 proof or hold public launch |
| 1 | Soft launch on own profile | £0 | 20m | Qualified replies, not likes |
| 2 | First three opt-in pilot invitations | £0 | 20m | Accepted invitations; no cold-DM substitution |
| 3 | Onboard cohort one | £0 | 45m | Connect/discover; failure pauses expansion |
| 4 | Five-second comprehension test | £0 | 20m | 4/5 understand or clarify copy |
| 5 | V01 real workflow video | £0 | 30m | Relevant questions/referral visits |
| 6 | Help-first community replies | £0 | 15m | Useful response; no link if not allowed |
| 7 | Agreed cohort-one follow-up | £0 | 20m | Accurate import and repeat use; otherwise product work |
| 8 | Second cohort, three invites | £0 | 20m | Three interested prospects, not guaranteed |
| 9 | Onboard second cohort | £0 | 45m | Record activation denominator |
| 10 | Review all spend gates; earliest three-day Search flight | £5 | 25m | G0–G4 or no spend; source test passes |
| 11 | Review search terms / negative matches | £0 | 15m | Relevant clicks; pause clearly wrong intent |
| 12 | End flight; reconcile invoice and qualified signups | £0 | 15m | Zero qualified signup: hold next envelope |
| 13 | Publish T03 field checklist on own channel | £0 | 20m | Qualified workflow questions |
| 14 | First seven-day cohort report | £0 | 25m | Count returned users; don't equate logins with value |
| 15 | Third cohort, four invitations if capacity | £0 | 20m | Fill toward ten users; keep vacancies honest |
| 16 | Two onboarding sessions | £0 | 30m | One accurate item each |
| 17 | Two onboarding sessions | £0 | 30m | Failure fixes before more traffic |
| 18 | Eligible second Search flight, three days | £10 | 20m | First-flight signup + activation and fixed friction required |
| 19 | Publish permissioned feedback/demo | £0 | 25m | Consent and verified fact, or educational post instead |
| 20 | End/reconcile second flight | £0 | 15m | £10 cumulative zero signup or £15 zero activation: stop |
| 21 | Tutorial SEO01, only index on approved canonical site | £0 | 60m | Accurate helpful guide; staging stays noindex |
| 22 | Agreed retention interviews | £0 | 25m | Reasons to return or leave |
| 23 | Micro-creator fit research, no cold solicitations | £0 | 20m | Three suitable public portfolios, no paid booking |
| 24 | Eligible final Search flight, three days | £15 | 20m | Cost/activation gate and owner approval, otherwise reserve |
| 25 | Repurpose best educational clip | £0 | 20m | Qualified inbound, not raw plays |
| 26 | End final flight; paid funnel report | £0 | 20m | Actual all-in CPA/CAC, unknowns explicit |
| 27 | Finish SEO02 or help article from real questions | £0 | 40m | Helpful answer; no thin keyword variant |
| 28 | Cohort check, willingness-to-pay interview | £0 | 25m | Stated intent separate from actual paid users |
| 29 | Cost/support/retention review | £0 | 25m | Model inputs updated with evidence |
| 30 | Continue organic, fix activation, or request justified expansion | £0 | 30m | Scaling gates met or preserve cash |

## 12. Risk register and fallback

| Risk | Early signal | Response |
|---|---|---|
| Product not useful enough | Discovery but missing titles/photos; no repeat use | Spend £0; finish Vinted details and activation proof on product roadmap |
| Trust/install friction | Signups stop at unsigned download | Record objections; improve honest install help/demo; no security overclaims |
| Search economics fail | CPC / conversion exceeds allowable CAC | Stop paid; never broaden merely to spend budget |
| Narrow search has no delivery | Few impressions despite relevant approved terms | Extend observation without higher cap; move effort to pilots |
| Free-host latency | Slow first request, signup abandonment | Measure actual cold start; consider paid upgrade only with approval/economics |
| Small cohort bias | Friends praise but strangers fail | Report assisted vs unassisted and warm vs cold separately |
| Marketplace layout/policy change | Challenges, incorrect extraction | Pause affected claims and acquisition; no bypass; reconnect/review |
| Account/community harm | Moderator removal or unsolicited-message complaint | Stop route immediately, honour rules and consent |
| Price alone loses | Prospects choose free competitors | Test accuracy/support/reuse need; don't promise unmatched breadth |
| Support overload | More than available evening slots | Cap invitations; no response-time guarantee |

Fallback sequence: **pause ads → reconcile actual costs and qualified users → interview three consenting non-activators → fix one proven friction point → retest with three organic users → publish one verified tutorial/demo → ask an interested creator/admin about a permitted pilot → request voluntary feedback/referrals only after value → reconsider Search only when the changed funnel works.** If no one values the workflow after ten qualified interviews, revisit positioning/product need before spending more. More traffic is not evidence of a viable business.
