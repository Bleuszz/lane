import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { recordActivation } from "./events";

export const getActivation = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({context}) => {
  const sql = await getSql();
  const events = await sql<{event_name:string}>`select event_name from activation_events where user_id = ${context.userId}`;
  return events.map(e => e.event_name);
});

// Client events describe review decisions only; successful import/publish events
// are recorded by the server after the operation actually succeeds.
export const trackReview = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator((data: unknown) => z.object({ event: z.enum(["destination_preview", "ai_suggestion_accepted", "ai_suggestion_rejected"]) }).parse(data))
  .handler(async ({context, data}) => {
    await recordActivation(await getSql(), context.userId, data.event);
    return {ok:true};
  });
