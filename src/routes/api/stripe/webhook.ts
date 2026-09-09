import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { planForPriceId, verifyStripeSignature } from "@/lib/lane/server/stripe";
import type { PlanId } from "@/lib/lane/types";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) {
          return new Response("invalid signature", { status: 400 });
        }
        const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
        const sql = await getSql();
        const obj = event.data.object;

        if (event.type === "checkout.session.completed") {
          const userId = String(obj.client_reference_id ?? (obj.metadata as { userId?: string } | undefined)?.userId ?? "");
          if (!userId) return new Response("ok");
          const plan = ((obj.metadata as { plan?: string } | undefined)?.plan ?? "starter") as PlanId;
          const aiPack = (obj.metadata as { aiPack?: string } | undefined)?.aiPack === "1";
          await sql`
            update user_settings set
              plan = ${plan === "seller" || plan === "pro" ? plan : "starter"},
              ai_pack = ${aiPack},
              billing_status = 'active',
              stripe_customer_id = ${obj.customer ? String(obj.customer) : null},
              stripe_subscription_id = ${obj.subscription ? String(obj.subscription) : null}
            where user_id = ${userId}
          `;
        }

        if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
          const customer = String(obj.customer ?? "");
          const status = String(obj.status ?? "");
          const items = obj.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
          const priceId = items?.data?.[0]?.price?.id ?? "";
          const plan = priceId ? planForPriceId(priceId) : null;
          const billing =
            event.type === "customer.subscription.deleted" || status === "canceled"
              ? "canceled"
              : status === "past_due"
                ? "past_due"
                : "active";
          if (customer) {
            await sql`
              update user_settings set
                billing_status = ${billing},
                plan = ${plan ?? "starter"},
                stripe_subscription_id = ${obj.id ? String(obj.id) : null}
              where stripe_customer_id = ${customer}
            `;
          }
        }

        if (event.type === "invoice.payment_failed") {
          const customer = String(obj.customer ?? "");
          if (customer) {
            await sql`update user_settings set billing_status = ${"past_due"} where stripe_customer_id = ${customer}`;
          }
        }

        return new Response("ok");
      },
    },
  },
});
