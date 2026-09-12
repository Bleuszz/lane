import sharp from "sharp";
import { normalizationSchema } from "./options.ts";
export const PROCESSING_VERSION = `lane-normalize-1/sharp-${sharp.versions.sharp}/vips-${sharp.versions.vips}`;
export const MAX_IMAGE_BYTES = 2_000_000;
sharp.cache({ memory: 16, files: 0, items: 16 });
sharp.concurrency(1);
// Bound CPU/memory to one decoding operation in this process. Durable jobs live in SQL.
let tail: Promise<unknown> = Promise.resolve();
export function normalizeImage(input: Buffer, options: unknown) {
  const task = tail.then(() => processImage(input, options));
  tail = task.catch(() => {});
  return task;
}
async function processImage(input: Buffer, raw: unknown) {
  const o = normalizationSchema.parse(raw);
  if (o.preset === "WHITE_BACKGROUND") throw Error("BACKGROUND_REPLACEMENT_UNSUPPORTED");
  if (!input.length || input.length > MAX_IMAGE_BYTES) throw Error("IMAGE_SIZE_LIMIT");
  const reader = sharp(input, { limitInputPixels: 20_000_000, failOn: "error" });
  const m = await reader.metadata();
  if (!["jpeg", "png"].includes(m.format || "") || (m.pages ?? 1) !== 1)
    throw Error("IMAGE_FORMAT_UNSUPPORTED");
  if (o.preset === "ORIGINAL")
    return {
      data: Buffer.from(input),
      width: m.width!,
      height: m.height!,
      format: m.format!,
      size: input.length,
      version: PROCESSING_VERSION,
    };
  let pipeline = reader.autoOrient().toColourspace("srgb");
  const custom = o.preset === "CUSTOM",
    max =
      o.preset === "THUMBNAIL"
        ? 320
        : custom
          ? o.maxDimension
          : o.preset === "MARKETPLACE_READY"
            ? 1600
            : undefined;
  if (max)
    pipeline = pipeline.resize({
      width: max,
      height: max,
      fit: custom && o.cropSquare ? "cover" : "inside",
      withoutEnlargement: true,
      position: "centre",
    });
  if (custom) {
    if (o.brightness !== 1) pipeline = pipeline.modulate({ brightness: o.brightness });
    if (o.contrast !== 1) pipeline = pipeline.linear(o.contrast, 128 * (1 - o.contrast));
    if (o.sharpen) pipeline = pipeline.sharpen({ sigma: 0.3, m1: 0.5, m2: 1 });
    if (o.fillTransparencyWhite) pipeline = pipeline.flatten({ background: "#ffffff" });
  }
  const format = custom ? o.format : m.format;
  if (format === "jpeg" && m.hasAlpha && !(custom && o.fillTransparencyWhite))
    throw Error("TRANSPARENCY_NEEDS_EXPLICIT_BACKGROUND");
  // No keepMetadata/withMetadata: decoded output strips EXIF/GPS/XMP/ICC metadata.
  pipeline =
    format === "jpeg"
      ? pipeline.jpeg({
          quality: custom ? o.quality : 90,
          chromaSubsampling: "4:4:4",
          mozjpeg: false,
        })
      : pipeline.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false });
  const { data, info } = await pipeline
    .timeout({ seconds: 15 })
    .toBuffer({ resolveWithObject: true });
  if (data.length > MAX_IMAGE_BYTES) throw Error("OUTPUT_TOO_LARGE");
  return {
    data,
    width: info.width,
    height: info.height,
    format: info.format,
    size: info.size,
    version: PROCESSING_VERSION,
  };
}
