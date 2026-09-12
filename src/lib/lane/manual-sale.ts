import { z } from "zod";

const money = z.number().finite().min(0).max(1_000_000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, "Use at most two decimal places.");
export const manualSaleSchema = z.object({
  itemId: z.string().min(1).max(200),
  channelListingId: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(100_000),
  totalGbp: money,
  feesGbp: money.nullable(),
  reference: z.string().trim().min(1, "Enter the order-line ID or a unique sale reference.").max(120),
}).strict();
export type ManualSaleInput = z.infer<typeof manualSaleSchema>;
