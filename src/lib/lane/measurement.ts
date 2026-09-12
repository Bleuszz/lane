export const FUNNEL_EVENTS = [
  "page_view",
  "signup_started",
  "signup_completed",
  "login_completed",
  "trial_started",
  "download_clicked",
  "desktop_device_approval_started",
  "desktop_device_approved",
  "pricing_viewed",
  "upgrade_clicked",
  "contact_submitted",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];
export function measure(event: FunnelEvent) {
  if (!FUNNEL_EVENTS.includes(event)) return;
  if (typeof window === "undefined" || import.meta.env.VITE_LANE_ANALYTICS_ENABLED !== "true")
    return;
  try {
    if (
      localStorage.getItem("lane-measurement") !== "yes" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ||
      navigator.doNotTrack === "1"
    )
      return;
    // Payload deliberately has no extensible properties: no identity, URL, query, title or referrer.
    void fetch("/api/measurement", {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Storage or networking restrictions never block the product. */
  }
}
