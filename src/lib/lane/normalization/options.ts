import { z } from "zod";
export const PRESETS = [
  "ORIGINAL",
  "CLEAN_EXPORT",
  "MARKETPLACE_READY",
  "THUMBNAIL",
  "CUSTOM",
  "WHITE_BACKGROUND",
] as const;
export const normalizationSchema = z
  .object({
    preset: z.enum(PRESETS),
    format: z.enum(["jpeg", "png"]).default("jpeg"),
    maxDimension: z.number().int().min(256).max(2048).default(1600),
    quality: z.number().int().min(75).max(95).default(90),
    brightness: z.number().min(0.95).max(1.05).default(1),
    contrast: z.number().min(0.95).max(1.05).default(1),
    sharpen: z.boolean().default(false),
    cropSquare: z.boolean().default(false),
    fillTransparencyWhite: z.boolean().default(false),
  })
  .strict();
export type NormalizationOptions = z.infer<typeof normalizationSchema>;
