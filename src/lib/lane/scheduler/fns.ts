import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { ensureUser } from "../server/map";
import { SchedulerService } from "./service.server";
import { MODES, OPERATIONS } from "./policy";
import { settingsSchema } from "./settings";
import { NormalizationService } from "../normalization/service.server";
import { normalizationSchema } from "../normalization/options";
const services = async (user: string) => {
  const sql = await getSql();
  await ensureUser(sql, user);
  return {
    scheduler: new SchedulerService(sql, {
      scheduler: process.env.SCHEDULER_ENABLED === "true",
      bulk: process.env.BULK_AUTOMATION_ENABLED === "true",
    }),
    images: new NormalizationService(sql, process.env.IMAGE_NORMALIZATION_ENABLED === "true"),
  };
};
const queueSchema = z
  .object({
    accountId: z.string().min(1).max(100),
    itemIds: z.array(z.string().min(1).max(100)).min(1).max(50),
    operation: z.enum(OPERATIONS),
    mode: z.enum(MODES),
    startAt: z.string().datetime(),
    approved: z.boolean(),
    largeApproved: z.boolean().optional(),
    requestKey: z.string().min(8).max(100),
  })
  .strict();
const id = z.object({ id: z.string().uuid() }).strict();
export const getScheduleState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await services(context.userId)).scheduler.state(context.userId));
export const saveScheduleSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(settingsSchema)
  .handler(async ({ context, data }) => {
    await (await services(context.userId)).scheduler.saveSettings(context.userId, data);
    return { ok: true };
  });
export const previewSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(queueSchema)
  .handler(async ({ context, data }) =>
    (await services(context.userId)).scheduler.dryRun(context.userId, data),
  );
export const queueSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(queueSchema)
  .handler(async ({ context, data }) =>
    (await services(context.userId)).scheduler.queue(context.userId, data),
  );
export const checkSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    (await services(context.userId)).scheduler.runNext(context.userId),
  );
export const pauseSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z
      .object({
        scope: z.string().max(130),
        paused: z.boolean(),
        reviewed: z.boolean().default(false),
      })
      .strict(),
  )
  .handler(async ({ context, data }) => {
    await (
      await services(context.userId)
    ).scheduler.pause(context.userId, data.scope, data.paused, data.reviewed);
    return { ok: true };
  });
export const cancelSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z
      .object({
        jobId: z.string().uuid().optional(),
        batchId: z.string().uuid().optional(),
        futureOnly: z.boolean().optional(),
      })
      .strict(),
  )
  .handler(async ({ context, data }) => {
    await (await services(context.userId)).scheduler.cancel(context.userId, data);
    return { ok: true };
  });
export const rescheduleAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(id.extend({ at: z.string().datetime(), reviewed: z.boolean() }))
  .handler(async ({ context, data }) => {
    await (
      await services(context.userId)
    ).scheduler.reschedule(context.userId, data.id, data.at, data.reviewed);
    return { ok: true };
  });
export const getNormalizationState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await services(context.userId)).images.state(context.userId));
export const queueNormalization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z
      .object({
        photoIds: z.array(z.string().min(1).max(100)).min(1).max(12),
        options: normalizationSchema,
        requestKey: z.string().min(8).max(100),
      })
      .strict(),
  )
  .handler(async ({ context, data }) =>
    (await services(context.userId)).images.queue(
      context.userId,
      data.photoIds,
      data.options,
      data.requestKey,
    ),
  );
export const runNormalization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(id)
  .handler(async ({ context, data }) => {
    await (await services(context.userId)).images.run(context.userId, data.id);
    return { ok: true };
  });
export const reviewNormalization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(id.extend({ decision: z.enum(["accepted", "rejected", "deleted"]) }))
  .handler(async ({ context, data }) => {
    await (await services(context.userId)).images.review(context.userId, data.id, data.decision);
    return { ok: true };
  });
export const getNormalizedImage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(id)
  .handler(async ({ context, data }) =>
    (await services(context.userId)).images.image(context.userId, data.id),
  );
