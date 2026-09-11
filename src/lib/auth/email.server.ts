export const passwordResetConfigured = Boolean(
  process.env.RESEND_API_KEY && process.env.LANE_EMAIL_FROM,
);
export async function sendPasswordReset(email: string, url: string) {
  if (!passwordResetConfigured) throw new Error("Password reset email is not configured");
  const target = new URL(url),
    origin = new URL(process.env.BETTER_AUTH_URL!);
  if (target.origin !== origin.origin) throw new Error("Invalid password reset origin");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.LANE_EMAIL_FROM,
      to: [email],
      subject: "Reset your Lane password",
      text:
        "You requested a Lane password reset. Open this link to choose a new password:\n\n" +
        url +
        "\n\nIf you did not request this, you can ignore this email.",
    }),
  });
  if (!response.ok) throw new Error("Password reset email could not be delivered");
}
