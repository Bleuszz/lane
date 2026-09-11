// Reads rendered pages only. No private API calls, token interception or hidden endpoint discovery.
function readPage(marketplace, expectedIdentity = null, supportMode = false) {
  const heading = [
    document.title,
    ...[...document.querySelectorAll('h1,[role="alert"]')].map((el) => el.textContent),
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
  const header =
    document.querySelector("#gh") ||
    document.querySelector("header") ||
    document.querySelector('[data-testid="header"]');
  const headerLinks = [...(header?.querySelectorAll("a[href]") || [])].map((a) => ({
    url: a.href,
    text: (a.textContent || "").trim(),
  }));
  const logout = headerLinks.some(
    (a) => /sign out|log out/i.test(a.text) || /logout|signout/i.test(a.url),
  );
  const profile = headerLinks.find((a) => /\/member\/\d+/.test(a.url));
  const ebayProfile = headerLinks.find((a) => /\/usr\/[^/?#]+/.test(a.url));
  const ebayUser =
    (document.querySelector("#gh_user") || document.querySelector("#gh-ug"))?.textContent?.trim() ||
    "";
  const vintedId = profile?.url.match(/\/member\/(\d+)/)?.[1];
  const ebayId = ebayProfile?.url.match(/\/usr\/([^/?#]+)/)?.[1];
  const loggedInNavigation = headerLinks.some((a) =>
    /\/(inbox|settings|notifications)(\/|\?|$)/.test(a.url),
  );
  const guest = headerLinks.some((a) =>
    /^(sign in|log in|sign up|sign up \| log in)$/i.test(a.text),
  );
  const sellerHub =
    location.pathname.startsWith("/sh/lst/active") &&
    /manage active listings/i.test(document.title) &&
    Boolean(document.querySelector("#shlistings-cntr,#listings-content-target"));
  const identity =
    marketplace === "vinted_uk"
      ? vintedId
        ? "vinted:" + vintedId
        : null
      : ebayId
        ? "ebay:" + ebayId
        : (logout || sellerHub) && /hi[\s,!]/i.test(ebayUser) && !/sign in|register/i.test(ebayUser)
          ? "ebay:" + ebayUser.replace(/\s+/g, " ").slice(0, 150)
          : null;
  const authenticated =
    !challenge &&
    !pageError &&
    !loginRequired &&
    !guest &&
    Boolean(identity) &&
    (marketplace === "vinted_uk" ? loggedInNavigation || logout : logout || sellerHub);
  const protectedPage =
    authenticated &&
    (marketplace === "vinted_uk"
      ? /^\/inbox(?:\/|$)/.test(location.pathname)
      : /^\/sh\/lst\/active(?:\/|$)/.test(location.pathname));
  const ownPage =
    authenticated &&
    (marketplace === "vinted_uk"
      ? Boolean(
          expectedIdentity &&
          identity === expectedIdentity &&
          location.pathname.match(/^\/member\/(\d+)/)?.[1] === vintedId,
        )
      : protectedPage);
  const pattern = marketplace === "vinted_uk" ? /\/items\/(\d+)/ : /\/itm\/(?:[^/]+\/)?(\d+)/;
  const main =
    (marketplace === "ebay_uk"
      ? document.querySelector("#shlistings-cntr,#listings-content-target")
      : null) ||
    document.querySelector("main") ||
    document.querySelector("#mainContent");
  const links = [...(main?.querySelectorAll("a[href]") || [])].map((a) => ({
    url: a.href,
    text: (a.textContent || "").trim(),
  }));
  const owned = ownPage
    ? [
        ...new Map(
          links
            .filter((a) => pattern.test(a.url))
            .map((a) => [
              a.url.match(pattern)[1],
              { remoteId: a.url.match(pattern)[1], url: a.url, title: a.text || null },
            ]),
        ).values(),
      ].slice(0, 200)
    : [];
  const listingStateKnown =
    ownPage &&
    (owned.length > 0 ||
      /no active listings|no items|wardrobe is empty/i.test(main?.innerText || ""));
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
    support: {
      headerText: supportMode ? header?.innerText?.slice(0, 1800) : undefined,
      nodes: supportMode
        ? [...document.querySelectorAll("[id]")]
            .map((n) => n.id)
            .filter((id) => /user|account|greet|header|main|list/i.test(id))
            .slice(0, 50)
        : undefined,
      title: document.title.slice(0, 120),
      path: location.pathname,
      header: Boolean(header),
      logout,
      profileLink: Boolean(profile || ebayProfile),
      greeting: Boolean(ebayUser),
      main: Boolean(main),
    },
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
