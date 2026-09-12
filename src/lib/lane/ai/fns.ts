import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureUser } from "../server/map";
import { aiConfig } from "./config.server";
import { AiService } from "./service.server";
import { AI_FIELDS, AI_OPERATIONS, MOCK_MODES, type AiOperation } from "./catalog";
const service = async (user: string) => {
  const sql = await getSql();
  await ensureUser(sql, user);
  return new AiService(sql, aiConfig());
};
const requestSchema = z
  .object({
    itemId: z.string().min(1).max(100),
    operation: z.enum(Object.keys(AI_OPERATIONS) as [AiOperation, ...AiOperation[]]),
    photoId: z.string().max(100).optional(),
    destination: z.enum(["ebay_uk", "vinted_uk"]),
    category: z.string().max(200).optional(),
    userValues: z.partialRecord(z.enum(AI_FIELDS), z.string().max(10000)).optional(),
    mode: z.enum(MOCK_MODES).optional(),
    settings: z
      .object({
        ratio: z.enum(["original", "1:1", "4:5", "marketplace"]).optional(),
        scene: z
          .enum([
            "white studio",
            "soft grey",
            "linen",
            "marble",
            "concrete",
            "bedroom",
            "wardrobe",
            "custom",
          ])
          .optional(),
        presentation: z.enum(["masculine", "feminine", "neutral"]).optional(),
        prompt: z.string().max(1000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const jobSchema = z.object({ id: z.string().uuid() }).strict();
export const getAiState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await service(context.userId)).state(context.userId));
export const queueAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z
      .object({
        requestKey: z.string().min(8).max(100),
        requests: z.array(requestSchema).min(1).max(20),
      })
      .strict(),
  )
  .handler(async ({ context, data }) =>
    (await service(context.userId)).queueBatch(context.userId, data.requestKey, data.requests),
  );
export const runAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(jobSchema)
  .handler(async ({ context, data }) => {
    await (await service(context.userId)).run(context.userId, data.id);
    return { ok: true };
  });
export const cancelAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(jobSchema)
  .handler(async ({ context, data }) => {
    await (await service(context.userId)).cancel(context.userId, data.id);
    return { ok: true };
  });
export const retryAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(jobSchema.extend({ requestKey: z.string().min(8).max(100) }))
  .handler(async ({ context, data }) =>
    (await service(context.userId)).retry(context.userId, data.id, data.requestKey),
  );
export const reviewAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
        confirm: z.boolean().default(false),
      })
      .strict(),
  )
  .handler(async ({ context, data }) => {
    await (
      await service(context.userId)
    ).review(context.userId, data.id, data.decision, data.confirm);
    return { ok: true };
  });
export const acceptSafeAi = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(jobSchema)
  .handler(async ({ context, data }) =>
    (await service(context.userId)).reviewSafe(context.userId, data.id),
  );
export const reviewAiAsset = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z
      .object({ id: z.string().uuid(), status: z.enum(["accepted", "rejected", "deleted"]) })
      .strict(),
  )
  .handler(async ({ context, data }) => {
    await (await service(context.userId)).reviewAsset(context.userId, data.id, data.status);
    return { ok: true };
  });
