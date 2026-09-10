import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { planForPriceId, retrieveBillingSubscription, verifyStripeSignature } from "@/lib/lane/server/stripe";
import { parseBillingEvent, reconcileBillingEvent } from "@/lib/lane/server/billing-webhooks";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const raw = await request.text();
    if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) return new Response("invalid signature", { status: 400 });
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return new Response("invalid event", { status: 400 }); }
    const event = parseBillingEvent(value);
    if (!event) return new Response("invalid event", { status: 400 });
    try {
      await reconcileBillingEvent(await getSql(), event, { retrieve: retrieveBillingSubscription, planForPrice: planForPriceId });
      return new Response("ok");
    } catch {
      // Failed transactions must be retried; never expose provider/customer data.
      return new Response("billing reconciliation unavailable", { status: 503 });
    }
  } } },
});
