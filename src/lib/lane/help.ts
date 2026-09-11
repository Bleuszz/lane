export const HELP = [
  {
    category: "Getting started",
    question: "How do I start?",
    answer:
      "Create one Lane account on the website. Your seven-day trial starts when you open account onboarding. Install the verified Windows release when available, then approve that desktop using the same Lane account.",
  },
  {
    category: "Connections",
    question: "Which marketplaces work?",
    answer:
      "Vinted and eBay desktop session connections and owner listing discovery work in the owner pilot. Other marketplaces are planned. Full Vinted detail extraction and reliable publishing are not yet release-proven.",
  },
  {
    category: "Connections",
    question: "Why does a listing say Title unknown?",
    answer:
      "Discovery has found its marketplace ID and URL, but has not extracted a reliable title. Full Vinted item detail extraction is the first desktop follow-up. Lane keeps unknown data unknown.",
  },
  {
    category: "Connections",
    question: "How do I reconnect?",
    answer:
      "Open Lane Desktop, choose Reconnect beside the affected marketplace and complete its sign-in or verification. Do not send cookies, passwords or tokens to support.",
  },
  {
    category: "Plans",
    question: "How does the trial work?",
    answer:
      "Seven days, no card and zero AI credits. Trial dates belong to your Lane account on the server. Reinstalling Desktop does not reset them. There is no automatic payment.",
  },
  {
    category: "Security",
    question: "Does Desktop need a separate account?",
    answer:
      "No. It opens the Lane website for sign-in and device approval. You can revoke that device on the website. Your marketplace browser sessions remain local.",
  },
  {
    category: "Plans",
    question: "Can I pay for Lane?",
    answer:
      "Paid checkout is closed until billing and release checks pass. Provisional monthly prices are Starter £9, Seller £19 and Pro £29.",
  },
  {
    category: "AI",
    question: "Is AI required?",
    answer:
      "No. The trial has zero AI credits. Optional assisted listing tools are planned; they will require review and will not invent unsupported item details.",
  },
] as const;
