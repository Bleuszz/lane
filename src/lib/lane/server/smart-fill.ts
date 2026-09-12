import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { findCategory } from "../categories";
import { acceptedSuggestions, sourceAspects } from "../aspects";
import { ebayAspectRules } from "./taxonomy";

import { ensureUser } from "./map";

export const getEbayFields = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { categoryCanonical: string }) => z.object({ categoryCanonical: z.string().max(100) }).parse(data))
  .handler(async ({ data }) => {
    const category = findCategory(data.categoryCanonical);
    if (!category?.ebayUk.id) throw new Error("Choose a category to see its eBay fields.");
    return { categoryId: category.ebayUk.id, rules: await ebayAspectRules(category.ebayUk.id) };
  });

export const setAiPreference = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { enabled: boolean }) => z.object({ enabled: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const settings = await ensureUser(sql, context.userId);
    if (data.enabled) throw new Error("Legacy inline AI is disabled. Use the explicit mock workbench.");
    await sql`update user_settings set ai_autofill_enabled = ${data.enabled} where user_id = ${context.userId}`;
    return { ok: true };
  });

export const suggestEbayFields = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({
    categoryCanonical: z.string().max(100),
    title: z.string().max(200), description: z.string().max(10000), notes: z.string().max(5000),
    brand: z.string().max(100), sizeUk: z.string().max(100), colour: z.string().max(100), material: z.string().max(100),
    channelFields: z.object({ ebay_uk: z.object({ aspects: z.record(z.string().max(80), z.array(z.string().max(256)).max(30)), categoryId: z.string().max(30).optional() }).optional() }).optional(),
  }).parse(data))
  .handler(async (): Promise<{suggestions:{name:string;value:string;evidence:string}[];remaining:number|null;message:string}> => {
    throw Error("Production AI is disabled. Save the listing and open AI Studio for development previews.");
  });
