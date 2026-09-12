# Lane SEO, conversion and trust plan

Evidence checked 12 September 2026. This is a focused launch architecture, not a claim of measured search volume or rankings.

## Search intent and page ownership

Current search results for UK crosslisting queries contain product landing pages, comparison articles and reseller discussions. Competitor content confirms UK/Vinted/eBay language is actively used, but is promotional evidence, not an independent benchmark. No Keyword Planner, Search Console or paid volume dataset is connected. **Volume, difficulty and paid CPC are unknown.** Do not invent them.

- Home owns the commercial topic “UK crosslisting workspace/software”: product/category explanation and beta limitations.
- Features owns commercial evaluation of crosslisting workflow, session connections and inventory preparation. It should answer capability questions rather than repeat the homepage.
- Pricing owns transactional Lane pricing/free-trial intent. No false checkout or comparison savings.
- How it works owns informational onboarding and practical setup. Avoid competing with a later detailed Vinted-to-eBay guide until real import/publish proof exists.
- Download owns navigational/transactional “Lane Desktop Windows download”. Version, hash and date are gates, not invented metadata.
- Help owns support intent: account, trial, reconnect and limitations. Visible FAQs cover genuine objections.
- Account/login/devices are navigational private journeys and are noindex; they are excluded from the sitemap.
- “Crosslist alternative”, “Lane vs Crosslist” and “Vinted to eBay crosslisting” are future commercial pages, deferred until reproducible live workflow comparisons and permissioned evidence exist.

Sources: [current competitor UK topic coverage](https://crosslist.com/blog/best-cross-listing-apps-uk), [reseller product category example](https://relista.co.uk/). Search results are qualitative evidence of intent only. Brand-navigation demand for the new Lane product is not established.

## Implemented foundation

A shared public-page registry defines distinct titles and descriptions. Hosted HTML adds canonical, OpenGraph, Twitter large-image metadata and the original Lane share artwork. Canonicals discard query strings. Legacy `/legal/privacy` and `/legal/terms` permanently redirect to `/privacy` and `/terms`. Private routes and missing pages are noindex. The custom missing-page route returns HTTP 404.

`LANE_ENV=staging` blocks indexing across the temporary hostname and does not publish a sitemap. Production publishes only canonical public routes. Account/device/inventory/auth/API pages never enter the sitemap. Search Console HTML-token support is optional; DNS verification is preferred for the future custom domain. No public address or map is appropriate.

JSON-LD uses WebSite, Organization (brand name and URL only) and SoftwareApplication on the homepage. There are no ratings, invented offers, addresses or awards. JSON shape is tested locally; Google rich-result eligibility is not promised. Top-level pages do not need breadcrumbs. When nested real guides arrive, add matching visible breadcrumbs and BreadcrumbList.

Nine genuine visible FAQs are included. Google [retired FAQ rich results on 7 May 2026](https://developers.google.com/search/updates), so no FAQPage markup is added just to chase a retired feature.

## Conversion and evidence

The hero explicitly identifies UK resellers, Vinted/eBay and the desktop beta, with trial and walkthrough CTAs. The initial CTA is above the fold at tested phone sizes. A sticky signup banner was unnecessary and would compete with optional consent controls, so none is added.

The product screenshot is from a labelled synthetic local account. Share art is a brand/workflow illustration, not a fake customer screenshot. No testimonials, user counts, reviews, team photo or case studies are fabricated. Once a pilot has measured evidence and permission, publish one case study with workflow before/after, sample size, elapsed time and limitations. Store consent and raw measurements privately; publish only approved facts. No empty case-study page is exposed now.

Signup confirmation appears only after successful account creation and loaded trial state. Device confirmation follows successful server approval. Contact confirmation follows a durable database insert. Download clicks are instrumented only on an actual release link; the pending button is disabled. There is no active upgrade click because real checkout is closed.

## Measurement decision

- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/) is free and does not require DNS transfer. Its [privacy design](https://developers.cloudflare.com/web-analytics/faq/) excludes query strings. Useful later for traffic/performance, but does not replace the specific first-party success events requested here.
- GA4 can measure funnels but adds an external processor, configuration and consent work. Proper [Google consent configuration](https://developers.google.com/tag-platform/security/guides/consent) would be required; no Google tag is loaded now.
- [Plausible](https://plausible.io/) is a simpler privacy-oriented paid hosted alternative; there is no reason to spend on it for this free staging phase. Self-hosting would add infrastructure.
- Chosen now: optional first-party **daily aggregate counts**, no new vendor or charge. Both deployment flags are off by default. A visitor must opt in, can decline/change choice, and DNT/GPC suppress events. Payloads contain only an allowlisted event name; fetch omits credentials and referrer. No URLs, query strings, user IDs, device IDs, cookies or listing information are submitted. Hosting access logs still need operator review; “anonymous” does not mean the host never sees an IP.

Tracked hooks: page_view, signup_started/completed, login_completed (email flow), trial_started, pricing_viewed, desktop_device_approval_started/approved, contact_submitted, and download_clicked when a verified asset exists. Schema reserves upgrade_clicked but no event is emitted without a real checkout action. OAuth completion measurement is not proven; never count an OAuth-button click as a completed signup. No per-user conversion attribution or cohort analysis is possible with this aggregate design. Consent declines and browser restrictions mean counts will be incomplete. Counts are not a revenue ledger.

[ICO storage/access guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/) informs the conservative opt-in approach; owner review is still required before enabling collection. Do not market generated legal text as legal advice.

## Next content, after product evidence

First publish a real Lane setup guide, then a verified Vinted-to-eBay walkthrough with real field-preservation results. Add reseller-inventory guidance only when relevant tools ship. Marketplace comparisons require dated competitor sources, matched test items, measured results and limitations. Financial/profit content waits for actual product scope. No mass-generated thin pages.

After a custom-domain launch, use Search Console queries/impressions and aggregate CTA counts to refine titles and content. Establish field LCP/INP/CLS using actual traffic; local Lighthouse is a synthetic diagnostic, not real-user Core Web Vitals. Review failed queries and support requests before choosing another page.
