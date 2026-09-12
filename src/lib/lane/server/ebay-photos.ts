import { createHash } from "node:crypto";
import type { Sql } from "../../db";
import { ebayPhotoError, isHttpsPhoto, localPhoto } from "../photos";
import { ebayEnv } from "./secret";
import { ebayRequest, ebayResponseText } from "./ebay-transport";

const EXPIRY_MARGIN_MS = 5 * 60_000;

/** Called only by an authorized listing job, never by draft save or preview. */
export async function prepareEbayPhotos(
  sql: Sql,
  userId: string,
  accountId: string,
  accessToken: string,
  urls: string[],
  beforeWrite: () => Promise<void>,
): Promise<string[]> {
  const error = ebayPhotoError(urls);
  if (error) throw new Error(error); // Validate the whole set before any upload.
  const environment = ebayEnv();
  const host = environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const result: string[] = [];
  for (const url of urls) {
    if (isHttpsPhoto(url)) { result.push(url); continue; }
    const source = localPhoto(url)!;
    const bytes = Buffer.from(source.base64, "base64");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const cached = await sql<{image_url:string;expires_at:string}>`select image_url,expires_at from ebay_photo_uploads
      where user_id=${userId} and account_id=${accountId} and environment=${environment} and content_hash=${hash}`;
    if (cached[0] && isHttpsPhoto(cached[0].image_url) && new Date(cached[0].expires_at).getTime() > Date.now() + EXPIRY_MARGIN_MS) {
      result.push(cached[0].image_url);
      continue;
    }
    await beforeWrite(); // Renew the job lease before each outward write.
    const body = new FormData();
    body.append("image", new Blob([bytes], { type: source.mime }), `${hash}.${source.mime === "image/png" ? "png" : "jpg"}`);
    const response = await ebayRequest(`${host}/commerce/media/v1_beta/image/create_image_from_file`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      body, // Fetch supplies the multipart boundary; do not set Content-Type.
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`eBay photo upload failed (HTTP ${response.status}). Successful photos are saved for retry.`);
    const receipt = JSON.parse(await ebayResponseText(response)) as {imageUrl?:unknown;expirationDate?:unknown};
    const expiry = typeof receipt.expirationDate === "string" ? Date.parse(receipt.expirationDate) : NaN;
    if (typeof receipt.imageUrl !== "string" || !isHttpsPhoto(receipt.imageUrl) || !Number.isFinite(expiry) || expiry <= Date.now() + EXPIRY_MARGIN_MS) {
      throw new Error("eBay returned an incomplete or expired photo receipt. No listing was sent with this photo.");
    }
    // Persist each receipt immediately so a later photo's failure does not discard it.
    await sql`insert into ebay_photo_uploads(user_id,account_id,environment,content_hash,image_url,expires_at)
      values (${userId},${accountId},${environment},${hash},${receipt.imageUrl},${new Date(expiry).toISOString()})
      on conflict(user_id,account_id,environment,content_hash) do update
      set image_url=excluded.image_url,expires_at=excluded.expires_at,updated_at=now()`;
    result.push(receipt.imageUrl);
  }
  return result;
}
