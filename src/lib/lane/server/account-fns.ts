import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureUser } from "./map";
export const getAccountOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const settings = await ensureUser(sql, context.userId);
    const counts = await sql<{
      n: number;
    }>`select count(*)::int as n from items where user_id=${context.userId} and status<>'archived'`;
    return {
      userId: context.userId,
      plan: settings.plan,
      trialStartedAt: settings.trialStartedAt,
      trialEndsAt: settings.trialEndsAt,
      trialStatus: settings.trialActive ? "active" : settings.trialEndsAt ? "ended" : "not_started",
      billingStatus: settings.billingStatus,
      aiCredits: settings.aiCreditsLimit,
      inventoryCount: counts[0].n,
    };
  });
