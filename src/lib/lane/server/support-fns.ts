import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureUser } from "./map";
import { saveSupport } from "./support";
export const supportAvailable = createServerFn({ method: "GET" }).handler(() => ({
  enabled: process.env.LANE_SUPPORT_ENABLED === "true",
}));
export const submitSupport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      topic: z.enum(["account", "desktop", "privacy", "other"]),
      message: z.string().trim().min(20).max(2000),
      website: z.string().max(0),
    }),
  )
  .handler(async ({ data, context }) => {
    if (process.env.LANE_SUPPORT_ENABLED !== "true") throw Error("Support intake is not open yet.");
    const sql = await getSql();
    await ensureUser(sql, context.userId);
    return saveSupport(sql, context.userId, data.topic, data.message);
  });
