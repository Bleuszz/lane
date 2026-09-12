# Launch creative and campaign drafts

12 September 2026. **Nothing published or activated.** Replace origin placeholders only after real HTTPS deployment. All copy must pass current product gates in [master plan](LAUNCH_MARKETING_PLAN.md). The normal-use Windows installer, accurate import and measurement gates currently block paid acquisition. No AI, auto-delist, bulk, unsupported-marketplace or quantified savings claims.

## Google Search campaign setup

Campaign naming: `uk_launch_pilot_search_f1`, then f2/f3 as separately approved, non-overlapping flights. One ad group active initially: `vinted_ebay_workflow`. Search network only; turn off Display expansion, Search Partners, broad-match expansion/AI Max and auto-applied recommendations that add keywords or raise bids/budgets. Current UI/eligibility may differ; verify before activation, never bypass a restriction.

Location: United Kingdom, **presence**, not people merely interested in UK. Language English. Start with computers; exclude mobile/tablet for paid trial acquisition while Windows is mandatory. Search cannot be assumed to distinguish Windows from Mac reliably: disclose Windows in the ad and landing page, review device friction. Organic mobile can still learn and sign up, but do not pretend mobile activation works.

Schedule: weekdays 18:00–21:00 **Europe/London**, matched to owner's previously stated evening availability; verify ad-account timezone and daylight-saving mapping. No weekend schedule without available support. These are oversight hours, not a claim that buyers convert best then.

Bidding: manual CPC where offered, provisional maximum **£0.75/click**, chosen to avoid losing a £4-media test to one expensive click, not based on measured auction CPC. If unavailable, Maximise Clicks with an explicit CPC limit only where compatible with campaign total budget. No tCPA/tROAS/Maximise Conversions learning strategy on zero conversion evidence. If total-budget/limited-bid combination unavailable, hold until owner approves a contained alternative. Low bid can produce zero impressions; do not raise blindly or switch broad match.

Flight media caps **£4 / £8 / £12**, each three days, corresponding to **£5 / £10 / £15 all-in envelopes** including surcharge/tax buffer. See [budget mechanics](MARKETING_BUDGET.md); total £30 all-in is not £30 ad media. £5 diagnostic flight, £10 standalone replication flight and £30 staged plan share identical safety controls. £30 must never be enabled at once.

### Keywords

Initial exact candidates (**G5 required for this crosslisting-intent bank**, in addition to G0–G4; imports alone are insufficient):

- `[vinted ebay crosslisting]`
- `[vinted to ebay listing tool]`
- `[uk crosslisting software]`

After G5 permits a publishing promise, consider `[import vinted listings to ebay]`. Phrase candidates for a later separately reviewed test: `"vinted ebay crosslisting"`, `"uk crosslisting app"`. Do not activate all variants just to get volume. Exact match still has close variants; inspect actual search terms where reporting provides them. Terms may be hidden at low volume; unknown query coverage is a measurement limitation.

Reserved ad group `uk_reseller_workflow` uses `[uk crosslisting app]` or `[crosslisting software uk]` only if the first intent has insufficient eligible demand. Never run multiple groups/ads to claim an A/B winner from a handful of clicks. Competitor group **disabled**: Crosslist, CrossLister, Vendoo alternatives saved for later evidence, not £30 conquesting.

Negative phrase candidates: `"customer service"`, `"free download"`, `"meaning of"`, `"how to buy"`, `"vinted to ebay flipping"`; negative word candidates: `login`, `jobs`, `careers`, `support`, `crack`, `apk`, `torrent`, `definition`, `autobuy`, `bot`, `followers`, `likes`, `scam`, `dropshipping`, `wholesale`, `iphone`, `android`, `mac`, `macos`, `poshmark`, `depop`, `etsy`, `shopify`.

Adapt negatives to real intent: `support` deliberately excludes existing-tool support searches, but may also exclude commercial questions about marketplace support; review before applying. **Do not negate “free” globally** because Lane offers a trial. Do not negate bare “listing” or “eBay”. Add singular/plural variants where needed; negative matching does not automatically cover every synonym. Check that no negative blocks an intended positive keyword. Competitor names can be excluded initially to prevent navigational waste.

### Responsive Search Ad A: beta workflow

Headlines (validated by `node scripts/check-marketing-plan.mjs`, each ≤30 characters):

- H: Lane for UK Resellers
- H: Vinted & eBay Workspace
- H: Windows Desktop Beta
- H: Start a 7-Day Free Trial
- H: No Card for the Lane Trial
- H: See the Lane Beta Workflow
- H: Your Accounts, One Workspace
- H: Explore Lane for Windows
- H: See What the Beta Can Do
- H: Connect Your Own Accounts
- H: Review Before You Publish
- H: Seven Days to Explore Lane

Descriptions (each ≤90 characters):

- D: Explore Lane's Windows beta for Vinted and eBay sellers. See current limits first.
- D: Start a seven-day Lane trial with no card. A Windows computer is required.
- D: Sign into marketplaces yourself. See how Lane's desktop connection works.
- D: One Lane account for web and desktop. Review the beta workflow before you start.

Use at most the relevant verified assets; “Review Before You Publish” is **G5-only**, excluded from the initial import/read beta. Pin **Windows Desktop Beta** to a position guaranteed to display where supported; otherwise ensure every active description contains the device/beta qualifier or decline a misleading layout. Do not depend on a headline that may never display to qualify an otherwise overbroad claim.

Final URL: `${BASE_URL}/how-it-works?utm_source=google&utm_medium=cpc&utm_campaign=uk_launch_pilot&utm_content=search_workflow_f1` (literal template, not a deployed address). Display paths `lane` / `windows-beta`, not competitor trademarks. Primary CTA: Start free for 7 days, conditional on useful access. Sitelinks only to working `/pricing`, `/security`, `/download`, `/help`; omit download until release is real. Do not claim a download is available when button says pending.

Conversion setup: primary business outcome **verified activated user**; signup secondary. Until properly implemented consented/server-reconciled tracking exists, no automated bid optimisation on frontend clicks. [Metrics contract](GROWTH_METRICS.md) defines actual success. Exclude staff/test events; respect consent. Form start, pricing view and download click are not primary conversions.

### Preflight and kill decisions

1. G0–G4 and exact owner envelope approval; live landing/installer/support/trial tested. Read current platform advertiser-verification requirements; if user-only action needed, hold.
2. Confirm total media cap, fees, dates/timezone, negative/positive compatibility, CPC ceiling and all URLs. Capture settings privately; keep ad account paused until approval.
3. Run first flight. Pause at a product/security/measurement error, clearly irrelevant query, or exhausted envelope. At £5 with zero qualified signup do not release £10; investigate organically.
4. F2 only after a real F1 signup activates and funnel friction is understood. At £10 cumulative all-in and no signup, stop. At £15 cumulative with no accurate-import activation, stop. These are cash-protection rules, not statistically significant tests.
5. F3 requires ≥2 activated ad users, cost/activated ≤£7.50 so far, seven-day follow-up and owner acceptance that this remains learning, not proven profit. Scaling above £30 requires [economics gates](MARKETING_BUDGET.md).

## Paid social decision and reusable creative

**Meta, TikTok and Reddit paid budgets are £0.** With £30, splitting channels leaves too little evidence; social usually reaches mobile browsers while Lane requires Windows. TikTok documents campaign budgets above US$50 and ad-group daily budgets above US$20, and recommends [US$30/day for EMEA web conversions](https://ads.tiktok.com/business/en-GB/how-it-works/budgeting). Do not buy a cheap boost merely to spend less than Ads Manager's minimum. Meta/Reddit have not been proven uneconomic—this is a launch-priority decision, not a claim about their exact CPC/minimums. Save creatives for organic learning; consider paid social only after activation/retention and larger approved budget.

| Creative | Hook / script | Visual / caption | CTA, landing, audience, UTM | Success metric |
|---|---|---|---|---|
| C1 Repeating fields | “The second listing is where the extra typing starts.” 0–3s show owned item; 3–10s demonstrate genuine repeated fields; 10–20s show Lane's verified current workflow and unresolved limits | 1080×1920 capture, captions; “Testing a Windows workflow for UK Vinted/eBay sellers. Here's what works today.” No fake before/after time | See beta workflow; `/how-it-works`; regular UK clothing sellers; source=tiktok, medium=organic_social, content=c1_fields | Qualified requests → paired/imported users; publishing segment G5-only |
| C2 Local session | “Your Lane login and your marketplace login are different.” Explain cloud account → local marketplace window → revoke in 20s | Actual paired device, redact account; caption “A look at Lane's connection flow, with its beta limits.” | See setup/security; `/how-it-works`; cautious Windows sellers; source=instagram, medium=organic_social, content=c2_session | Comprehension, completed pairing, fewer support questions |
| C3 Unknown is unknown | “If the material label is missing, don't invent it.” Show photo/label check and unknown field; no AI output | Real owned garment + field review; caption “Accurate listings matter more than a filled-in box.” | Read field checklist; `/help`; clothing sellers; source=youtube, medium=organic_social, content=c3_unknown | Qualified referral visits/opt-ins, not video completion alone |
| C4 Beta invitation | “Would this help your Vinted/eBay routine?” Show 10s actual connection/discovery and ask for feedback | Founder narration and Windows beta label; caption “I'm Nate, building Lane. Full import/publishing still being verified.” | Request current demo in permitted thread; `/how-it-works` when live; UK Windows; source=reddit, medium=community, content=c4_pilot | Consented pilot requests and eventual activation |

Future Meta paid variant (not enabled): “Selling clothes on Vinted and eBay? See Lane's Windows beta workflow before starting a seven-day trial. No card, and clear limits on what's available.” CTA Learn More → actual workflow URL. Do not suggest Meta can target verified Vinted sellers; interest audiences are imperfect proxies. Future TikTok paid variant uses C1 only after true feature demo exists; audience UK adults, with Windows requirement explained. Future paid UTMs use `cpc`, not `organic_social`, and include distinct creative ID.

## Ten short videos

All are executable storyboards; record only real supported actions, otherwise explain the manual workflow. CTA URLs remain gated. Reuse on TikTok, Reels and YouTube Shorts rather than making thirty separate videos.

| ID / hook | Content (15–30s) | CTA | Channel | Intent |
|---|---|---|---|---|
| V01: Two logins, different jobs | Explain Lane identity vs marketplace session with real diagram/capture | See how Lane works | Shorts/Reels/TikTok | Trust/evaluation |
| V02: Check the photo order | Compare one owned item's source and import, call out discrepancies | See verified import demo | Shorts | Transactional, G2 required |
| V03: Unknown isn't a mistake | Missing material label; leave unknown instead of guessing | Read field checklist | TikTok/Reels | Educational |
| V04: A SKU can be simple | Number one garment and matching photo folder, no Lane feature assumption | Save this workflow | Reels | Inventory pain |
| V05: What the Lane trial includes | Walk current £0/seven-day/no-card/zero-AI and checkout-closed states | Review trial terms | Shorts/Reels | Buying qualification |
| V06: Before installing any seller app | Verify source, version, permissions and revoke; explain unsigned beta | Read security overview | Shorts | Trust |
| V07: Connecting, honestly | Real connection and known discovery result; show actual duration, no universal time claim | See current beta limits | TikTok | Pilot interest |
| V08: One item on two sites | Manual sold-state checklist; say Lane auto-delist isn't released | Save checklist | Reels | Educational/high pain |
| V09: Try it again tomorrow | Show a real repeat-use result or explain test goal if unavailable | Request pilot details | Shorts | Retention |
| V10: What testers found confusing | Share one anonymised permissioned issue and genuine fix, no fabricated quote | Tell us what confused you | TikTok/Reels | Feedback/trust |

## Ten ready-to-edit text posts

These contain content, not just titles. Use own channels unless a community explicitly allows the post. Adapt to the conversation, never mass-copy. `${WORKFLOW_URL}` means the actual approved live URL at execution.

| ID / hook | Draft content | CTA | Channel / intent |
|---|---|---|---|
| T01: The same item, two forms | “A title isn't the whole listing. Before moving an item, I check the price/currency, size, condition and photo order too. Which field causes you the most rework?” | Reply with the field, no pitch | Own social / research |
| T02: What Lane is today | “I'm building Lane for UK Vinted/eBay sellers using Windows. My account connections and listing discovery work. Complete import and publishing still need proof. Here's the current workflow and its limits: ${WORKFLOW_URL}.” | View accurate beta scope | Own profile / pilot |
| T03: A five-field check | “Before posting clothing: title, condition, size, price and photos. Then check the destination's extra required fields. An empty material field is better than an invented fabric.” | Save checklist | Permitted educational thread / informational |
| T04: Keep the original photos | “Keep an untouched copy of each item's photos. Any edits should make the item clearer, not remove wear or change its colour.” | Share your organisation method | Own social / educational |
| T05: No automatic charge | “Lane's current beta trial is seven days, no card, and zero AI credits. Paid checkout isn't open. Read what's included before creating an account.” | Read `/pricing` | Own profile / qualification |
| T06: Windows first | “You can read Lane's site on a phone, but the current marketplace connection workflow needs Lane Desktop on Windows. I'd rather make that clear before you sign up.” | Read `/how-it-works` | Own social / trust |
| T07: Selling twice is a real problem | “For one-off stock, keep a simple list of where each item is live and check the other listing when it sells. Don't assume a tool's sale detection has worked without confirmation.” | Save manual checklist | Approved helpful reply / informational |
| T08: Your login stays yours | “Lane's web account and marketplace sign-in are separate. You sign into the marketplace yourself; the desktop retains its local session. Read the storage and disconnect details before testing.” | Read `/security` | Own social / evaluation |
| T09: A small feedback request | “If you sell clothing on Vinted and eBay and use Windows, would you like to test Lane's current beta workflow? I'm the builder. I'll explain the limits first and only send details if requested.” | Opt in publicly where allowed | Designated promo thread / pilot |
| T10: What would earn a return visit? | “After the first setup, what task would make a reseller workspace worth opening next week? I'm prioritising accurate imports before adding more features.” | Reply with one real task | Own profile / retention research |

Five SEO briefs **SEO01–SEO05** and five comparison/tutorial briefs **CT01–CT05** are in [SEO_GROWTH_PLAN.md](SEO_GROWTH_PLAN.md). Combined bank: **10 video + 10 text + 5 SEO + 5 tutorial/comparison = 30**. Publish a useful subset within available time, not all by default. Later claims require updated scripts, actual build evidence and owner publication approval.
