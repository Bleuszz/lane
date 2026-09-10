# Lane roadmap

Updated 10 September 2026. This is the delivery order, not a promise that all stages exist. The immediate commercial test is whether Nate and a small reseller pilot complete Vinted-to-eBay UK listings with materially less retyping and fewer errors.

## NOW — finish one dependable workflow

Continue the current redesign and local Photo studio. Preserve imported descriptions, categories, item attributes and all available photos. Map the destination category and fetch its required item specifics; preserve seller-entered values. Offer AI only when enabled, with evidence-backed suggestions, editable acceptance and explicit unknowns. Do not invent material, measurements, authenticity or condition. Seller-defined templates should fill stable shipping and business preferences without an AI call.

Make account connection useful: distinguish authentication from readiness to publish, show per-seller policy and image requirements, explain expired connections and make recovery obvious. Store publication outcomes and expose failures without falsely marking items live. Publish, edit and delist must operate on the intended listing and account. A retry after an uncertain response must reconcile the remote result before creating another listing.

Keep the interface focused on inventory, item preparation, connection health and publishing progress. The Photo studio should preserve the original, make crop/rotate/exposure/framing reversible and work without paid API calls. It must not imply background removal or generated studio scenes are already supported.

Apply the seven-day, no-card trial with 25 lifetime actions and zero AI; provisional paid tiers are £9/£19/£29, 150/600/2,000 monthly actions and 0/150/500 AI credits. Server-side reservations must prevent concurrent overuse. Track successful usage separately from provider attempts and provider costs. Keep billing disabled until entitlement and economic gates pass.

Acceptance evidence:

- Ten real, consented clothing listings tested from import through destination preparation; record manual fields, elapsed time, corrections and failures against the same Crosslister task. Proposed target: reduce roughly ten extra fields to two or fewer where the source actually supports them. This is a hypothesis, not a measured result.
- One seller-approved end-to-end publish/edit/delist test per enabled destination, with photos, category specifics and business policies verified. Test token expiry, rate limiting and an ambiguous network result.
- Trial expiry/month-boundary tests, concurrent usage tests, paid-plan enforcement and AI failure/refund tests pass. A build alone is not integration proof.
- Keyboard and narrow-screen UI review; FAQ answers match behaviour; no clickable fake connector states.
- Durable database, authenticated job execution, tenant isolation, encrypted tokens, recoverable backup, photo hosting and observability are ready for the pilot. No new KYC or provider spend is assumed.

Commercial exit: 3–5 resellers complete the workflow; at least one chooses to pay after seeing the limitations and price. Record money received separately from a trial signup or verbal interest. If users still need substantial assisted input, fix that before buying ads.

## NEXT — reliable operations and deliberate expansion

Add durable inventory events, idempotent sold-event handling, unattended processing and reconciliation. Show last successful check and stale-channel warnings; test quantity greater than one, partial orders, duplicate events, cancellation and returns before broader stock-sync claims. Add resumable bulk publishing, duplicate detection and per-marketplace price previews.

Introduce a sale ledger with source order ID, quantity, gross price, actual marketplace/payment fees, postage, acquisition cost, refunds and payout state. The seller may enter missing costs. Distinguish estimated contribution, booked sale profit and cash actually paid out. Export the raw ledger. Do not present estimated fees as definitive accounting.

Expand one connector at a time using [CONNECTORS.md](CONNECTORS.md). Prioritize measured pilot demand plus a workable official integration route: investigate Depop, then Etsy, Shopify and WooCommerce. Facebook/Gumtree remain discovery work until access and seller eligibility are established. Every connector needs its own publish/edit/delist/sold tests; a logo or successful OAuth exchange does not constitute support.

Improve photo workflow with consistent batch framing and background-removal research. Test garment edges, transparency, labels, dark items and actual colour fidelity. Compare local inference against paid processing for quality, device performance and commercial licensing. Never silently erase damage or alter the product. Price any paid processing separately from text credits once measured.

Commercial exit: users return weekly, support burden is measured, churn/refunds are understood, token cost has a defensible upper bound, and acquisition tests fit a known contribution margin. Do not schedule broad expansion before these are known.

## LATER — finance, intelligence and controlled automation

Build finance analytics on the verified ledger: channel contribution, sell-through, ageing stock, stock value at cost, cash pending, returns and purchase profitability. Add configurable fee versions and time ranges; keep source transactions accessible. Tax exports need country-specific review and should not claim to replace an accountant.

Add useful intelligence: highlight incomplete listings, explain slow-moving inventory, suggest seller-approved price experiments and prioritise easy-to-complete items. Recommendations should state their evidence and uncertainty. Market price intelligence requires licensed or otherwise permitted data, dated comparisons and a separate cost case.

Automation comes after reliable event handling: seller-configured floors, previewable rules, spending/action limits, audit history, pause controls and undo where feasible. Start with low-risk draft changes before automated repricing or relisting. Stock synchronization should expose its latency and failure states rather than imply a universal guarantee.

Consider team roles, scan-to-find stock locations and purchase-batch tracking only when active users request them. The durable advantage should be less seller effort, trustworthy data and dependable operation; feature count alone is not the objective.

## Stop rules

Do not activate live billing, claim new connectors are supported, buy traffic or add a paid image provider while the corresponding acceptance or cost gate is incomplete. The mission's total £30 spending ceiling includes fees and infrastructure. A public production launch is separate from a local build or repository push.
