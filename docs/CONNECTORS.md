# Connector expansion plan

Updated 10 September 2026. Vinted-to-eBay UK is the immediate implementation focus. Depop, Etsy, Shopify, WooCommerce, Facebook and Gumtree are planned, not connected or advertised as live. Access to a documented API does not mean Lane has approved credentials or a working integration. Official references below were checked for planning; no new marketplace account or provider application was created.

## Shared contract and release gate

Each connector must declare its capabilities separately: import, draft validation, publish, edit, delist, sold detection, quantity sync and background operation. Unknown capability is not true. Store source account, remote listing ID, schema version, canonical item ID, destination category and per-channel overrides. Keep money in currency-aware minor units; distinguish asking price, shipping paid by buyer and estimated proceeds. Preserve images and their order without assuming one marketplace's URL is permanent or acceptable to another.

Use official seller consent and scoped credentials where available. Encrypt credentials, isolate tenants, record expiry and revoke on disconnect. A user-operated bridge must be separately justified against the service's available integration route and policy; do not use one as a default workaround for an unavailable API. No stored marketplace passwords or bypassing identity checks. Existing account ownership is not proof of seller or integration eligibility.

The minimum lifecycle test is import → validate → publish → edit → delist, followed by a separate sold-event test. Include duplicate event delivery, partial quantity, stale tokens, rate limiting, a network timeout after a possible successful publish and reconciliation without duplicate listings. Record the exact approved account, market, category, response and remote outcome. Publishing a listing can incur seller fees: show the seller the action and applicable cost before proceeding.

## Vinted and eBay — NOW

Existing Lane code provides an eBay OAuth/Inventory route and a Vinted session/bridge route; these need seller-specific live verification. Core work preserves imported detail, maps categories, validates destination item specifics and keeps optional AI suggestions grounded in source text. Vinted bridge operation and category mapping, eBay policy IDs, remotely accessible photos, source listing coverage and unattended sale reconciliation remain release concerns until tested. Do not call one successful account login a completed crosslist.

For eBay, use the seller's authorized account, destination category and business policies. eBay's Inventory API has its own listing-management constraints, including that Inventory API-created listings must be revised through that API. Confirm the import path covers Nate's existing listings as well as API-created inventory. [eBay Inventory API overview](https://www.developer.ebay.com/api-docs/sell/inventory/static/overview.html).

## Depop — planned, official Selling API first

Verified: Depop documents a Selling API and OAuth for third-party applications serving multiple sellers, alongside API keys for other use cases. Its reference covers products, orders and webhooks; shipping fields distinguish manual national shipping from Depop-managed shipping. Lane's access approval, issued credentials and account eligibility are not verified. [Overview](https://partnerapi.depop.com/api-docs/), [authentication](https://partnerapi.depop.com/api-docs/concepts/authentication/), [reference](https://partnerapi.depop.com/api-docs/reference/).

Implementation work: request the appropriate partner access when justified, configure app credentials and redirects, obtain seller consent, and store refreshable tokens/scopes. Map Lane's category, brand, size, condition, colour, material and product images to the accepted taxonomy and schema. Preserve currency and account-specific shipping choices; reject mutually exclusive shipping options before dispatch. Quantity and variant behaviour must be verified for the chosen categories rather than copied from eBay.

Lifecycle: implement API-backed import/publish/edit/delist only after confirming endpoint semantics with granted scopes. Ingest order/sold events using authenticated webhooks where available and reconcile against order retrieval. Keep remote product and purchase IDs for deduplication. Use the assigned rate limits and backoff; do not turn a marketing action allowance into unrestricted API traffic. [Rate limits](https://partnerapi.depop.com/api-docs/concepts/rate-limits/).

Unknowns before release: Lane partner acceptance and fees, credentials, exact category/image limits, supported condition mapping, inventory multiplicity, webhook verification contract, deletion-versus-sold semantics and sandbox availability. A browser bridge is not the default implementation while an official partner route exists.

## Etsy — planned, limited to eligible inventory

Verified: Etsy uses scoped OAuth; listing creation involves seller/category-specific information and shipping configuration. Seller Apps are for the owner's shop; broader apps follow Personal App approval and, for broader scale, Commercial Access review. Rate limits are assigned at app level and exposed through the portal/headers. Lane has no verified approved app. [Access paths](https://developers.etsy.com/documentation/), [OAuth](https://developers.etsy.com/documentation/essentials/authentication/), [listing tutorial](https://developers.etsy.com/documentation/tutorials/listings/), [rate limits](https://developers.etsy.com/documentation/essentials/rate-limits/).

Implementation work: app credentials, OAuth/PKCE, refresh handling and shop identity; category taxonomy/properties; images and ordering; price/currency, inventory offerings and variants; seller shipping/processing profiles. Require explicit seller information for who made an item and when it was made where the schema requires it. Do not infer vintage eligibility from visual style or send ordinary resale inventory indiscriminately. Confirm the actual listing's policy eligibility before enabling the destination.

Lifecycle: create drafts first, validate images and required fields, then activate with a clear seller action and applicable listing fees. Test edit, deactivate and quantity updates separately. Reconcile orders/receipts and cancellations into inventory; investigate available notification routes with granted scopes before promising real-time sold detection. Respect app-wide quotas, cache taxonomy within permitted terms and avoid scraping as an alternate posting path.

Unknowns: Lane review outcome, credentials/scopes, precise seller policies, fees, category-specific eligibility, current image limits, event delivery guarantees and production rate allowance. Keep this connector planned until the approval and lifecycle evidence exists.

## Shopify — planned, merchant store integration

Verified: Shopify's GraphQL Admin API uses merchant-authorized scoped access tokens; standalone apps have an authorization-code route. Offline tokens serve background work, and current public-app guidance includes token expiry/refresh requirements. GraphQL limits are query-cost based, per app/store. [Authentication](https://shopify.dev/docs/apps/build/authentication-authorization), [access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens), [rate limits](https://shopify.dev/docs/api/usage/limits).

Implementation work: registered app, allowed distribution route, shop domain validation, app secret and exact OAuth redirects; product/variant/media mapping; merchant product categories, metafields, collections and inventory locations. Use each store's currency and tax configuration. Shipping belongs to the merchant's delivery setup; do not copy a marketplace postage price into a product price. Condition is not a universally equivalent field: agree a merchant schema/metafield rather than inventing a platform mapping.

Lifecycle: implement import and draft product creation, media processing, product/variant edits, publish/unpublish to selected sales channels and inventory adjustments. Define whether Lane or Shopify is the inventory authority. Order and inventory webhooks need signature validation, deduplication and reconciliation, including returns and multiple locations. A store product existing does not prove it is published to every sales channel. Read throttle status and queue requests accordingly.

Unknowns: app distribution approval requirements for Lane's intended customers, granted scopes, any protected order data access, merchant plans and locations, current mutations/versions and tested media limits. Verify these from the chosen API version during implementation. No browser bridge is planned for an official merchant API integration.

## WooCommerce — planned, store-specific compatibility

Verified: WooCommerce exposes a REST API with consumer-key/secret authentication tied to a WordPress user's permissions; its webhooks support signed delivery. Each merchant operates their own installation. [REST API](https://developer.woocommerce.com/docs/apis/rest-api/), [authentication](https://developer.woocommerce.com/docs/apis/rest-api/authentication), [webhooks](https://developer.woocommerce.com/docs/best-practices/urls-and-routing/webhooks).

Implementation work: validate the merchant-owned HTTPS store URL without permitting requests to internal/private network targets; use revocable scoped credentials and avoid putting them in query logs. Map product categories, attributes, simple/variable products, images, regular/sale prices, currency, stock management and tax class. Shipping classes/zones are store configuration. Condition may need a merchant-agreed attribute; no universal condition conversion should be assumed.

Lifecycle: implement import, draft/publish, edit, trash/unpublish and explicit quantity updates. Use signed order/product webhooks plus periodic reconciliation; handle order status transitions, cancellation/restocking and plugin-driven events. Store-level hosting/security plugins may throttle or block requests; probe conservatively and respect Retry-After, avoiding a fixed global throughput promise.

Unknowns: supported WordPress/WooCommerce versions, store plugins, image upload authorization/size limits, variations, API filtering by security services and webhook reliability. Test against a documented support matrix, starting with a standard installation. No browser bridge is needed for the intended REST route.

## Facebook Marketplace — discovery, no supported publishing claim

Official Meta commerce documentation and policy entry points could not be fully retrieved in this research session (developer pages returned errors and the policy page required login). Consequently general UK personal Marketplace publishing access, partner eligibility, authentication and available lifecycle operations are unverified. Do not equate a Meta catalog or Facebook Login with permission to publish personal Marketplace listings. Official entry points for further verification: [commerce developer documentation](https://developers.facebook.com/docs/commerce-platform/marketplace/), [commerce policies](https://www.facebook.com/policies_center/commerce).

Discovery work: establish the exact authorized product and account route before building. Record approved permissions, credentials, market/category eligibility and policy restrictions. Then obtain the actual listing schema, category/condition values, image limits, price/currency rules, location, collection/delivery options and quantity model. These are requirements to discover, not confirmed API capabilities.

Lifecycle publish/edit/delist/sold semantics, inventory authority, rate limits and event delivery all remain unknown. A seller-facing copy/export checklist may be a useful interim workflow, explicitly marked manual; do not label it connected or stock-synchronized. A bridge would need separate permission and reliability assessment. No session scraping or private endpoint implementation is authorized by this document.

## Gumtree — discovery, UK seller and listing requirements first

Verified: Gumtree's business policy for For Sale requires appropriate business identification and UK locality, with account and item requirements. This is a seller policy, not an integration API or blanket permission to automate. A general official self-service publishing API was not established by this research. [Business seller policy](https://www.gumtree.com/info/safety/p/policies/gumtree-business-seller-policy-for-sale-category/), [Gumtree for Business](https://www.gumtree.com/info/safety/gumtree-for-business/).

Discovery work: confirm an appropriate business/partner feed or written integration route, costs and seller eligibility; no new verification is assumed. Authentication, credentials, bridge permission and API quotas are unknown. Build schema mappings only after obtaining the actual category, condition, image, price, location, collection/delivery and quantity rules. Seller type and item location must not be invented by AI.

Lifecycle publish/edit/delist/sold operations, whether Gumtree supplies a definitive sale event, rate limits and allowed inventory updates all need confirmation. Until then, offer only clearly manual draft/export help if useful; mark sold manually with source attribution rather than claiming automatic synchronization. Account ownership or third-party data-scraping products do not establish authorized publishing support.

## Expansion decision

Choose the next connector using observed pilot demand, approved access, maintenance cost and a full lifecycle test. An API with a clear seller authorization path is a stronger first expansion candidate than an unverified bridge. Recheck official schemas and rules at implementation time; this document is a feasibility plan, not a frozen technical specification or legal opinion.
