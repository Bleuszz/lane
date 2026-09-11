// Reads rendered pages only. No private API calls, token interception or hidden endpoint discovery.
function readPage(marketplace) {
  const text = (document.body?.innerText || "").slice(0, 60000);
  if (
    /verify (you are|you're) human|captcha|security challenge|enter.*verification code/i.test(
      text.slice(0, 8000),
    )
  )
    return { state: "challenge", items: [], links: [] };
  const links = [...document.querySelectorAll("a[href]")].map((a) => ({
    url: a.href,
    text: (a.textContent || "").trim(),
  }));
  const logout = links.some(
    (a) => /sign out|log out/i.test(a.text) || /logout|signout/i.test(a.url),
  );
  const profile = links.find(
    (a) => /\/member\/\d+/.test(a.url) && /profile|wardrobe/i.test(a.text),
  );
  const ebayUser = document.querySelector("#gh-ug")?.textContent?.trim() || "";
  const ownPage =
    marketplace === "vinted_uk"
      ? location.pathname === "/member/items"
      : /^\/sh\/lst\/active/.test(location.pathname);
  const signedIn =
    logout ||
    (marketplace === "vinted_uk"
      ? Boolean(profile)
      : Boolean(ebayUser && !/sign in|register/i.test(ebayUser)));
  const pattern = marketplace === "vinted_uk" ? /\/items\/(\d+)/ : /\/itm\/(?:[^/]+\/)?(\d+)/;
  const owned =
    ownPage && signedIn
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
    state: signedIn ? "authenticated" : "unknown",
    identity: marketplace === "vinted_uk" ? profile?.url || null : ebayUser || null,
    ownPage,
    links: owned,
    item,
  };
}
module.exports = {
  readScript: (marketplace) => `(${readPage.toString()})(${JSON.stringify(marketplace)})`,
};
