// Reads rendered pages only. No private API calls, token interception or hidden endpoint discovery.
function readPage(marketplace, expectedIdentity = null, supportMode = false) {
  const heading = [
    document.title,
    ...[...document.querySelectorAll('h1,h2,h3,[role="heading"],[role="alert"]')].map(
      (el) => el.textContent,
    ),
  ].join(" ");
  const challenge =
    /verify (you are|you.re) human|security challenge|enter.*verification code|pardon our interruption/i.test(
      heading,
    ) ||
    Boolean(document.querySelector('iframe[src*="captcha"],input[autocomplete="one-time-code"]'));
  const pageError = /page not found|page doesn.t exist|we couldn.t find|404 not found/i.test(
    heading,
  );
  const loginRequired =
    /\/member\/(?:general\/login|register|signup)|\/signin|\/SignIn/i.test(location.pathname) ||
    /signin\./i.test(location.hostname) ||
    Boolean(document.querySelector('input[type="password"]'));
  const header = document.querySelector('#gh,header,[data-testid="header"]');
  // Only account chrome is eligible for identity, never seller links in listing rows.
  const accountRoots = [
    ...new Set(
      [
        header,
        ...document.querySelectorAll(
          '#gh-eb-u,#gh-user-account,.gh-identity,[data-testid="user-menu"],[data-testid="profile-menu"],[aria-label="Account menu"]',
        ),
      ].filter(Boolean),
    ),
  ];
  const accountLinks = accountRoots.flatMap((root) => [...root.querySelectorAll("a[href]")]);
  const trusted = (a) => {
    try {
      const u = new URL(a.href);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        (marketplace === "ebay_uk"
          ? /(^|\.)ebay\.(co\.uk|com)$/.test(u.hostname)
          : /(^|\.)vinted\.co\.uk$/.test(u.hostname))
      );
    } catch {
      return false;
    }
  };
  const headerLinks = accountLinks
    .filter(trusted)
    .map((a) => ({ url: a.href, text: (a.textContent || "").trim() }));
  const logout = headerLinks.some(
    (a) => /sign out|log out/i.test(a.text) || /logout|signout/i.test(a.url),
  );
  const profile = headerLinks.find((a) => /\/member\/\d+/.test(a.url));
  const ebayProfile = headerLinks.find((a) => /\/usr\/[^/?#]+/.test(a.url));
  const ebayUser = document.querySelector("#gh_user,#gh-ug")?.textContent?.trim() || "";
  const vintedId = profile?.url.match(/\/member\/(\d+)/)?.[1];
  const ebayId = ebayProfile?.url.match(/\/usr\/([^/?#]+)/)?.[1];
  const loggedInNavigation = headerLinks.some((a) =>
    /\/(inbox|settings|notifications)(\/|\?|$)/.test(a.url),
  );
  const guest = headerLinks.some((a) =>
    /^(sign in|log in|sign up|sign up \| log in)$/i.test(a.text),
  );
  const sellerRoute = /^\/sh\/lst\/active(?:\/|$)/.test(location.pathname);
  const sellerHeading = /manage active listings/i.test(heading);
  const listingRoot = document.querySelector("#shlistings-cntr,#listings-content-target");
  const grid = document.querySelector('main table,main [role="grid"],#mainContent table');
  const sellerHub = sellerRoute && sellerHeading && Boolean(listingRoot || grid);
  const identity =
    marketplace === "vinted_uk"
      ? vintedId
        ? "vinted:" + vintedId
        : null
      : ebayId
        ? "ebay:" + ebayId.toLowerCase()
        : null;
  // Greeting helps diagnose account chrome, but is NEVER an account identifier.
  const pageAccessConfirmed =
    !challenge &&
    !pageError &&
    !loginRequired &&
    !guest &&
    (marketplace === "vinted_uk"
      ? Boolean(loggedInNavigation && (profile || logout))
      : Boolean(
          (logout && ebayProfile) ||
          (sellerHub && (logout || ebayProfile || /hi[\s,!]/i.test(ebayUser))),
        ));
  const authenticated = pageAccessConfirmed && Boolean(identity);
  const protectedPage =
    pageAccessConfirmed &&
    (marketplace === "vinted_uk" ? /^\/inbox(?:\/|$)/.test(location.pathname) : sellerRoute);
  const ownPage =
    authenticated &&
    (marketplace === "vinted_uk"
      ? Boolean(
          expectedIdentity &&
          identity === expectedIdentity &&
          location.pathname.match(/^\/member\/(\d+)/)?.[1] === vintedId,
        )
      : sellerHub);
  const pattern = marketplace === "vinted_uk" ? /\/items\/(\d+)/ : /\/itm\/(?:[^/]+\/)?(\d+)/;
  const main = listingRoot || document.querySelector("main,#mainContent");
  const found = [];
  if (ownPage) {
    for (const a of main?.querySelectorAll("a[href]") || []) {
      if (!trusted(a)) continue;
      const id = a.pathname.match(pattern)?.[1];
      if (id)
        found.push({
          remoteId: id,
          url: a.origin + a.pathname,
          title: a.textContent.trim() || null,
        });
    }
    // Explicit row item IDs are eligible only on the verified owned Seller Hub page.
    if (marketplace === "ebay_uk")
      for (const row of main?.querySelectorAll("[data-listing-id],[data-item-id],[data-itemid]") ||
        []) {
        const id =
          row.getAttribute("data-listing-id") ||
          row.getAttribute("data-item-id") ||
          row.getAttribute("data-itemid");
        if (/^\d{9,15}$/.test(id || ""))
          found.push({ remoteId: id, url: "https://www.ebay.co.uk/itm/" + id, title: null });
      }
  }
  const owned = [...new Map(found.map((a) => [a.remoteId, a])).values()].slice(0, 200);
  const countMatch =
    marketplace === "ebay_uk" ? heading.match(/manage active listings\s*\(([\d,]+)\)/i) : null;
  const empty = /no active listings|no items|wardrobe is empty/i.test(main?.innerText || "");
  const visibleListingCount = countMatch
    ? Number(countMatch[1].replaceAll(",", ""))
    : empty
      ? 0
      : null;
  const listingStateKnown = ownPage && (owned.length > 0 || visibleListingCount === 0);
  const next = [
    ...(main?.querySelectorAll('a[rel="next"],a[aria-label],.pagination a') || []),
  ].find(
    (a) =>
      trusted(a) &&
      (a.rel === "next" ||
        /^(next|next page)$/i.test(a.getAttribute("aria-label") || a.textContent.trim())) &&
      a.getAttribute("aria-disabled") !== "true" &&
      a.origin === location.origin &&
      a.pathname === location.pathname,
  );
  const nextPage = next?.href || null;
  const signals = {
    header: Boolean(header),
    logout,
    profileLink: Boolean(profile),
    sellerProfileLink: Boolean(ebayProfile),
    greeting: Boolean(ebayUser),
    guest,
    sellerRoute,
    sellerHeading,
    listingContainer: Boolean(listingRoot),
    grid: Boolean(grid),
    main: Boolean(main),
    accountLinks: headerLinks.length,
    itemAnchors: found.length,
    paginationNext: Boolean(nextPage),
    loggedInNavigation,
    loginRequired,
    challenge,
    pageError,
    greetingRecognised: /hi[\s,!]/i.test(ebayUser),
    passwordNodes: document.querySelectorAll('input[type="password"]').length,
    captchaFrames: document.querySelectorAll('iframe[src*="captcha"]').length,
  };
  const candidates = [];
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(el.textContent);
      const visit = (v) => {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === "object") {
          if (v["@type"] === "Product" || v["@type"]?.includes?.("Product")) candidates.push(v);
          if (v["@graph"]) visit(v["@graph"]);
        }
      };
      visit(data);
    } catch {
      /* missing metadata remains unknown */
    }
  }
  const product = candidates[0],
    remoteId = location.pathname.match(pattern)?.[1];
  let item = null;
  if (product && remoteId) {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const images = Array.isArray(product.image)
      ? product.image
      : product.image
        ? [product.image]
        : [];
    const photoUrls = images
      .map((i) => (typeof i === "string" ? i : i?.url))
      .filter((u) => typeof u === "string" && u.startsWith("https://"))
      .slice(0, 12);
    const attributes = {};
    for (const row of document.querySelectorAll('[data-testid$="-attribute"],.ux-labels-values')) {
      const parts = (row.innerText || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) attributes[parts[0].replace(/:$/, "")] = parts.slice(1).join(" ");
    }
    const price =
      offer?.priceCurrency === "GBP" && offer.price !== undefined ? Number(offer.price) : null;
    item = {
      remoteId,
      url: location.href,
      title: product.name || null,
      description: product.description || null,
      priceGbp: Number.isFinite(price) ? price : null,
      photoUrls,
      brand:
        typeof product.brand === "string"
          ? product.brand
          : product.brand?.name || attributes.Brand || null,
      categoryName: product.category || null,
      sizeLabel: attributes.Size || null,
      conditionLabel: attributes.Condition || null,
      colour: attributes.Colour || attributes.Color || null,
      material: attributes.Material || null,
      attributes,
      status: null,
      quantity: null,
      evidence: "rendered-page-metadata",
      complete: false,
    };
  }
  return {
    domEvidence: supportMode
      ? {
          accountNodes: [
            ...document.querySelectorAll(
              '[id*="gh_user"],[class*="identity"],[class*="account"],[class*="username"]',
            ),
          ]
            .slice(0, 35)
            .map((n) => ({
              tag: n.tagName,
              id: /^[a-zA-Z_-]+$/.test(n.id) ? n.id : null,
              classes: [...n.classList].filter((c) => /^[a-zA-Z_-]+$/.test(c)).slice(0, 8),
              popup: n.getAttribute("aria-haspopup"),
              expanded: n.getAttribute("aria-expanded"),
              hasProfileLink: Boolean(n.querySelector('a[href*="/usr/"],a[href*="/member/"]')),
            })),
          listingHeadings: [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
            .map(
              (n) => (n.textContent || "").match(/(?:manage )?active listings\s*\([\d,]+\)/i)?.[0],
            )
            .filter(Boolean),
          itemAnchorCount: [...document.querySelectorAll("a[href]")].filter((a) =>
            pattern.test(a.pathname),
          ).length,
          listingRootChildren: listingRoot?.children.length || 0,
        }
      : undefined,
    signals,
    sellerHub,
    pageAccessConfirmed,
    visibleListingCount,
    nextPage,
    state: authenticated ? "authenticated" : "unknown",
    authenticated,
    protectedPage,
    challenge,
    pageError,
    loginRequired,
    listingStateKnown,
    identity,
    wardrobeUrl: profile?.url || null,
    ownPage,
    links: owned,
    item,
  };
}
module.exports = {
  readScript: (marketplace, identity = null, supportMode = false) =>
    `(${readPage.toString()})(${JSON.stringify(marketplace)},${JSON.stringify(identity)},${JSON.stringify(supportMode)})`,
};
