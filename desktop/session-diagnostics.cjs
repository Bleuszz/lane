// Explicit allowlist only. Never serialize a Cookie, page body, error object or request.
function cookieMetadata(cookies) {
  return cookies.map((c) => ({
    name: c.name,
    domain: c.domain,
    path: c.path,
    secure: Boolean(c.secure),
    httpOnly: Boolean(c.httpOnly),
    sameSite: c.sameSite,
    session: Boolean(c.session),
    expiryPresent: Number.isFinite(c.expirationDate),
  }));
}
function pageSummary(e = {}) {
  return {
    identityResolved: Boolean(e.identity),
    pageAccessConfirmed: Boolean(e.pageAccessConfirmed),
    validationResult: e.challenge
      ? "challenge"
      : e.pageError
        ? "error"
        : e.loginRequired
          ? "logged_out"
          : e.protectedPage && e.pageAccessConfirmed
            ? "authenticated"
            : "unknown",
    sellerHubAccessible: Boolean(e.sellerHub),
    listingStateKnown: Boolean(e.listingStateKnown),
    linksFound: e.links?.length || 0,
    visibleListingCount: Number.isInteger(e.visibleListingCount) ? e.visibleListingCount : null,
    countsAgree: Number.isInteger(e.visibleListingCount)
      ? (e.links?.length || 0) === e.visibleListingCount
        ? "yes"
        : "no"
      : "unknown",
    signals: Object.fromEntries(
      Object.entries(e.signals || {}).filter(
        ([, v]) => typeof v === "boolean" || Number.isInteger(v),
      ),
    ),
  };
}
function profileDiagnostics(p) {
  const d = p.diagnostic || {};
  return {
    marketplace: p.marketplace,
    status: p.status,
    operation: p.operation || null,
    stage: d.stage || null,
    lastErrorCode: d.lastErrorCode || null,
    lastErrorCategory: d.lastErrorCategory || null,
    lastErrorAt: d.lastErrorAt || null,
    lastSuccessfulStage: d.lastSuccessfulStage || null,
    identityResolved: Boolean(p.identity),
    sessionPresent: Boolean(d.sessionPresent),
    cookieCount: d.cookieCount ?? null,
    httpOnlyCookieCount: d.httpOnlyCookieCount ?? null,
    sessionCookieCount: d.sessionCookieCount ?? null,
    cookiesBeforeLogin: d.cookiesBeforeLogin ?? null,
    cookiesAfterLoginClosed: d.cookiesAfterLoginClosed ?? null,
    cookiesAfterNavigation: d.cookiesAfterNavigation ?? null,
    sessionCookiesAppeared: d.sessionCookiesAppeared ?? null,
    sessionId: d.sessionId || null,
    visibleSessionMatches: d.visibleSessionMatches ?? null,
    backgroundSessionMatches: d.backgroundSessionMatches ?? null,
    navigationBlocked: Boolean(d.navigationBlocked),
    validationResult: d.validationResult || "unknown",
    listingStateKnown: Boolean(d.listingStateKnown),
    linksFound: d.linksFound ?? p.links?.length ?? 0,
    visibleListingCount: d.visibleListingCount ?? null,
    countsAgree: d.countsAgree || "unknown",
    lastSyncAt: p.lastSyncAt || null,
    lastProbeAt: d.lastProbeAt || null,
    visiblePage: d.visiblePage ? pageSummary(d.visiblePage) : null,
    backgroundPage: d.backgroundPage ? pageSummary(d.backgroundPage) : null,
  };
}
module.exports = { cookieMetadata, pageSummary, profileDiagnostics };
