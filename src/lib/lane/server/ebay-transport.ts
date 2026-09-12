/** Only errors from the eBay transport boundary qualify for unattended retry. */
export class EbayTemporaryError extends Error {
  readonly retryAfterMs: number;
  constructor(message: string, retryAfterMs = 0) {
    super(message);
    this.name = "EbayTemporaryError";
    this.retryAfterMs = retryAfterMs;
  }
}

function retryDelay(header: string | null): number {
  if (!header) return 0;
  if (/^\d+(\.\d+)?$/.test(header.trim())) return Number(header) * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

export async function ebayRequest(url: string, options: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(url, { ...options, redirect: "error" }); }
  catch { throw new EbayTemporaryError("eBay connection interrupted. Lane will check the marketplace before retrying eligible work."); }
  if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
    await response.body?.cancel().catch(() => undefined);
    throw new EbayTemporaryError(`eBay is temporarily unavailable (HTTP ${response.status}).`, retryDelay(response.headers.get("retry-after")));
  }
  return response;
}

export async function ebayResponseText(response: Response): Promise<string> {
  try { return await response.text(); }
  catch { throw new EbayTemporaryError("The eBay response was interrupted. Its result must be checked before retrying."); }
}

/** Up to five total attempts; honour Retry-After or leave long holds for review. */
export function ebayRetryAt(error: unknown, attempt: number, maxAttempts: number, now = Date.now(), random = Math.random): string | null {
  if (!(error instanceof EbayTemporaryError) || !Number.isInteger(attempt) || attempt < 1 || attempt >= Math.min(maxAttempts, 5)) return null;
  if (!Number.isFinite(error.retryAfterMs) || error.retryAfterMs > 86_400_000) return null;
  const delay = Math.max(30_000 * 2 ** (attempt - 1), error.retryAfterMs) + Math.floor(random() * 5_000);
  return new Date(now + delay).toISOString();
}
