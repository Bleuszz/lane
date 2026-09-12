export const PUBLIC_PAGES = {
  "/": [
    "Lane — Crosslisting Workspace for UK Resellers",
    "Bring your Vinted and eBay workflow into one Lane account. Explore the desktop beta, manage devices and start a seven-day trial with no card.",
  ],
  "/features": [
    "Crosslisting & Reseller Workspace Features | Lane",
    "Explore Lane’s Vinted and eBay session connections, shared account and listing workflow. See what works in the beta and what is still being verified.",
  ],
  "/pricing": [
    "Lane Pricing — 7-Day Free Trial & Planned Plans",
    "Start Lane’s seven-day trial with no card and zero AI credits. Explore provisional £9, £19 and £29 monthly plans. Paid checkout is not open yet.",
  ],
  "/how-it-works": [
    "How Lane Works — From Account to Marketplace Connection",
    "Create your Lane account, approve your Windows desktop and sign into Vinted or eBay yourself. Learn the beta workflow and its current limits.",
  ],
  "/download": [
    "Download Lane Desktop for Windows | Lane",
    "Find Windows release availability, installation guidance and security information for Lane Desktop. Verified installer details appear when the release is ready.",
  ],
  "/help": [
    "Lane Help — Accounts, Trials & Marketplace Connections",
    "Straight answers about Lane accounts, seven-day trials, local marketplace sessions, reconnecting and the limits of the Vinted and eBay beta.",
  ],
  "/privacy": [
    "Lane Privacy Notice — Account & Marketplace Session Data",
    "How Lane handles account data, device approval and local marketplace sessions. Beta privacy notice, with operator details pending review.",
  ],
  "/terms": [
    "Lane Beta Terms — Trial, Use & Service Limits",
    "Read Lane’s beta terms, trial conditions, marketplace independence and current service limitations. Owner legal review is pending.",
  ],
  "/security": [
    "Lane Security — Local Sessions & Revocable Devices",
    "Learn how Lane separates cloud accounts from local marketplace sessions, protects device access and handles reconnection. Understand the security limits.",
  ],
  "/contact": [
    "Contact Lane — Beta Support & Account Help",
    "Get help with Lane accounts and desktop connections. Find guidance for safe diagnostics and the current beta support arrangements.",
  ],
  "/legal/cookies": [
    "Lane Cookie Information & Measurement Choices",
    "Understand essential account cookies and optional measurement choices in Lane. Marketplace cookies remain separate from your Lane web account.",
  ],
} as const;
export function publicHead(path: keyof typeof PUBLIC_PAGES) {
  const [title, description] = PUBLIC_PAGES[path];
  return { meta: [{ title }, { name: "description", content: description }] };
}
export const FAQ = [
  [
    "What does Lane do?",
    "Lane is a web account and Windows desktop workspace for UK resellers. The beta connects your own Vinted and eBay sessions and discovers listings. Complete import and reliable publishing are still being verified.",
  ],
  [
    "Which marketplaces work?",
    "Vinted and eBay login and listing discovery work in the owner pilot. Other marketplaces are planned, not available. Full Vinted detail extraction is the next desktop milestone.",
  ],
  [
    "Does Lane store my marketplace passwords?",
    "No. You enter marketplace passwords directly into the marketplace login window. Lane keeps the resulting session locally under Windows-protected encryption. Your Lane web account is separate.",
  ],
  [
    "What happens after the seven-day trial?",
    "The trial ends without an automatic charge. Your account and inventory are not deleted just because it expires. Paid checkout is closed during beta; available actions remain subject to your plan and release status.",
  ],
  [
    "Does the trial include AI?",
    "No. The £0 trial has zero AI credits. You do not need AI credits to create an account or connect a desktop. Optional AI features are planned and are not a promise of this beta.",
  ],
  [
    "Can I cancel?",
    "There is no paid subscription to cancel in the current beta. You can sign out or revoke a desktop at any time. Account deletion requests use the operator’s confirmed support route when available.",
  ],
  [
    "Does Lane automatically delist sold items?",
    "Automatic sold-state synchronisation and reliable delisting are not verified release features. Continue managing sales and stock on your marketplaces to avoid duplicate sales.",
  ],
  [
    "What if my marketplace login expires?",
    "Lane asks you to reconnect. Complete sign-in, MFA or any CAPTCHA yourself in the marketplace window. Lane does not bypass those checks.",
  ],
  [
    "Is Lane affiliated with Vinted or eBay?",
    "No. Lane is an independent product. Vinted and eBay are trademarks of their respective owners.",
  ],
] as const;
