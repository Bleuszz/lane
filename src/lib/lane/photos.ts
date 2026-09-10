// Lane's own upload bound, not a claim about the marketplace's maximum.
export const MAX_LOCAL_PHOTO_BYTES = 2_000_000;
export const MAX_LISTING_PHOTOS = 12;

export function isHttpsPhoto(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

/** Shared browser/server validation. No network access or image transformation. */
export function localPhoto(value: string): { mime: "image/jpeg" | "image/png"; base64: string } | null {
  if (value.length > 4 * Math.ceil(MAX_LOCAL_PHOTO_BYTES / 3) + 32) return null;
  const match = /^data:(image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
  const bytes = match[2].length / 4 * 3 - padding;
  if (!bytes || bytes > MAX_LOCAL_PHOTO_BYTES) return null;
  // Check the signature as well as the MIME label; the provider verifies decoding.
  const prefix = atob(match[2].slice(0, 16));
  const valid = match[1] === "image/jpeg"
    ? prefix.startsWith("\xff\xd8\xff")
    : prefix.startsWith("\x89PNG\r\n\x1a\n");
  return valid ? { mime: match[1] as "image/jpeg" | "image/png", base64: match[2] } : null;
}

export function ebayPhotoError(urls: string[]): string | null {
  if (!urls.length || urls.length > MAX_LISTING_PHOTOS) return "Choose between 1 and 12 photos for eBay.";
  const index = urls.findIndex(url => !isHttpsPhoto(url) && !localPhoto(url));
  return index < 0 ? null : `Photo ${index + 1} needs a public HTTPS URL or a JPEG/PNG file up to 2 MB. Replace it before publishing; every selected photo is included.`;
}
