export function authConfiguration(env: Record<string, string | undefined>, origin: string) {
  const present = (key: string) => Boolean(env[key]?.trim());
  const enabled = env.VITE_AUTH_ENABLED !== "false";
  const preview = new URL(origin).hostname.endsWith(".grok-sandbox.com");
  const base = env.BETTER_AUTH_URL?.trim();
  const originMatches = !base ? preview : base.replace(/\/$/, "") === origin;
  const explicitBroker = present("GROK_AUTH_CLIENT_ID") && present("GROK_AUTH_CLIENT_SECRET");
  const broker = enabled && originMatches && (explicitBroker || preview);
  const direct =
    enabled && originMatches && present("GOOGLE_CLIENT_ID") && present("GOOGLE_CLIENT_SECRET");
  const reason = !enabled
    ? "Lane sign-in is disabled on this server."
    : !originMatches
      ? "Social sign-in is not configured for this Lane website address. Use email sign-in or ask the Lane administrator to configure its callback URL."
      : "This provider is not configured. Use email sign-in or ask the Lane administrator to enable it.";
  return {
    enabled,
    passwordResetAvailable: enabled && present("RESEND_API_KEY") && present("LANE_EMAIL_FROM"),
    providers: [
      {
        providerId: direct ? "google" : "grok-google",
        label: "Google",
        available: direct || broker,
        reason: direct || broker ? null : reason,
      },
      { providerId: "grok-x", label: "X", available: broker, reason: broker ? null : reason },
    ],
  };
}
