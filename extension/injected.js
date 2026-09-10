/**
 * MAIN-world Vinted client. Runs as the page so fetch() includes the user's
 * session cookies and CSRF. Talks to the content script via window.postMessage.
 *
 * Endpoints are versioned here on purpose. If Vinted change a path, update this
 * file — do not put marketplace passwords on the Lane server.
 */
(() => {
  if (window.__LANE_BRIDGE_INJECTED) return;
  window.__LANE_BRIDGE_INJECTED = true;
  document.documentElement.dataset.laneBridge = "1";

  const CHANNEL = "LANE_BRIDGE";
  const VINTED_STATUS = {
    new_with_tags: 6,
    new_without_tags: 1,
    very_good: 2,
    good: 3,
    satisfactory: 4,
  };

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta?.content) return meta.content;
    const match = document.cookie.match(/(?:^|; )(?:csrf_token|anon_csrf)=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    const next = document.getElementById("__NEXT_DATA__");
    if (next?.textContent) {
      try {
        const json = JSON.parse(next.textContent);
        const hit = JSON.stringify(json).match(/"csrf(?:Token)?"\s*:\s*"([^"]+)"/);
        if (hit) return hit[1];
      } catch {
        /* ignore */
      }
    }
    return "";
  }

  async function vintedFetch(path, opts = {}) {
    const csrf = csrfToken();
    const headers = {
      Accept: "application/json, text/plain, */*",
      "X-CSRF-Token": csrf,
      "X-Money-Object": "true",
      ...(opts.headers ?? {}),
    };
    if (opts.json) headers["Content-Type"] = "application/json";
    const res = await fetch(path, {
      method: opts.method ?? "GET",
      credentials: "include",
      headers,
      body: opts.json ? JSON.stringify(opts.json) : opts.body,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err = new Error(
        (json && (json.message || json.error || json.errors?.[0]?.field)) || `Vinted HTTP ${res.status} ${path}`,
      );
      err.body = text.slice(0, 4000);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  async function identity() {
    const tries = ["/api/v2/users/current", "/web/api/users/current", "/api/v2/users/my_info"];
    for (const path of tries) {
      try {
        const json = await vintedFetch(path);
        const user = json.user ?? json;
        if (user?.id) {
          return {
            userId: String(user.id),
            username: user.login || user.username || user.name || String(user.id),
          };
        }
      } catch {
        /* try next */
      }
    }
    throw new Error("Not signed in on vinted.co.uk. Sign in, then leave this tab open.");
  }

  function mapItem(raw) {
    const photo =
      raw.photo?.url ||
      raw.photos?.[0]?.url ||
      raw.photos?.[0]?.full_size_url ||
      null;
    const price =
      Number(raw.price?.amount ?? raw.price ?? 0) || 0;
    return {
      remoteId: String(raw.id),
      url: raw.url || `https://www.vinted.co.uk/items/${raw.id}`,
      title: raw.title || "",
      description: raw.description || "",
      priceGbp: price,
      quantity: raw.is_closed ? 0 : 1,
      photoUrl: photo,
      photoUrls: (raw.photos ?? []).map((p) => p.url || p.full_size_url).filter(Boolean).slice(0, 12),
      brand: raw.brand?.title || raw.brand_dto?.title || raw.brand_title || null,
      sizeLabel: raw.size_title || raw.size || null,
      categoryName: raw.catalog?.title || raw.catalog_title || null,
      categoryId: raw.catalog_id != null ? String(raw.catalog_id) : raw.catalog?.id != null ? String(raw.catalog.id) : null,
      categoryPath: typeof raw.catalog_path === "string" ? raw.catalog_path : null,
      material: typeof raw.material === "string" ? raw.material : raw.material_title || null,
      attributes: { itemAttributes: Array.isArray(raw.item_attributes) ? raw.item_attributes.slice(0, 50).map((a) => ({ id: a.id ?? null, name: a.name ?? a.title ?? null, value: typeof a.value === "string" ? a.value : null })) : [] },
      colour: Array.isArray(raw.color ?? raw.colour ?? raw.colors) ? (raw.color ?? raw.colour ?? raw.colors).map((c) => typeof c === "string" ? c : c.title).filter(Boolean).join(", ") : (typeof (raw.color ?? raw.colour) === "string" ? (raw.color ?? raw.colour) : raw.colour_title || null),
      conditionLabel: raw.condition_title || raw.status_title || ({6:"New with tags",1:"New without tags",2:"Very good",3:"Good",4:"Satisfactory"})[raw.status_id ?? raw.status] || null,
      status: raw.is_closed ? (raw.item_closing_action === "sold" ? "sold" : "ended") : "live",
    };
  }

  async function wardrobe() {
    const me = await identity();
    const items = [];
    for (let page = 1; page <= 8 && items.length < 200; page += 1) {
      const json = await vintedFetch(
        `/api/v2/users/${encodeURIComponent(me.userId)}/items?page=${page}&per_page=96&order=newest_first`,
      );
      const batch = json.items ?? json.wardrobe_items ?? [];
      if (batch.length === 0) break;
      for (const row of batch) {
        const mapped = mapItem(row);
        if (mapped.status === "live") items.push(mapped);
      }
      if (batch.length < 96) break;
    }
    return items.slice(0, 200);
  }

  async function soldItems() {
    const me = await identity();
    const json = await vintedFetch(
      `/api/v2/users/${encodeURIComponent(me.userId)}/items?page=1&per_page=96&order=newest_first`,
    );
    const batch = json.items ?? [];
    return batch
      .filter((row) => row.is_closed && (row.item_closing_action === "sold" || row.status === "sold"))
      .map(mapItem);
  }

  async function catalogs() {
    const json = await vintedFetch("/api/v2/catalogs");
    return json.catalogs ?? json ?? [];
  }

  function flattenCatalogs(nodes, prefix = []) {
    const out = [];
    for (const n of nodes ?? []) {
      const path = [...prefix, n.title || n.code || ""];
      out.push({ id: String(n.id), path: path.join(" / "), title: n.title });
      if (n.catalogs || n.children) out.push(...flattenCatalogs(n.catalogs || n.children, path));
    }
    return out;
  }

  async function resolveCatalog(job) {
    const given = job.item?.vintedCatalogId;
    if (given) return Number(given);
    const want = (job.item?.vintedCatalogPath || job.item?.vintedCatalogName || "").toLowerCase();
    if (!want) {
      throw new Error(
        "Vinted catalog id is not confirmed for this item. Pick a category in Lane and set vintedUk.catalogId in src/lib/lane/categories.ts.",
      );
    }
    const tree = flattenCatalogs(await catalogs());
    const hit =
      tree.find((c) => c.path.toLowerCase() === want) ||
      tree.find((c) => c.path.toLowerCase().endsWith(want)) ||
      tree.find((c) => c.title && want.includes(c.title.toLowerCase()));
    if (!hit) {
      throw new Error(
        `Could not map Vinted catalog for "${want}". Confirm the leaf in categories.ts. Sample: ${tree
          .slice(0, 8)
          .map((c) => c.path)
          .join(" | ")}`,
      );
    }
    return Number(hit.id);
  }

  async function blobFromUrl(url) {
    if (url.startsWith("data:")) {
      const res = await fetch(url);
      return res.blob();
    }
    const res = await fetch(url, { credentials: url.includes("vinted") ? "include" : "omit" });
    if (!res.ok) throw new Error(`Could not download photo (${res.status}).`);
    return res.blob();
  }

  async function uploadPhoto(url) {
    const blob = await blobFromUrl(url);
    const fd = new FormData();
    fd.append("photo[type]", "item");
    fd.append("photo[file]", blob, "photo.jpg");
    try {
      const json = await vintedFetch("/api/v2/photos", { method: "POST", body: fd });
      const id = json.photo?.id ?? json.id;
      if (id) return id;
    } catch {
      /* try upload session */
    }
    const fd2 = new FormData();
    fd2.append("photo", blob, "photo.jpg");
    const json = await vintedFetch("/api/v2/item_upload/photos", { method: "POST", body: fd2 });
    const id = json.photo?.id ?? json.id;
    if (!id) throw new Error("Vinted photo upload did not return an id.");
    return id;
  }

  async function findBrandId(name) {
    if (!name) return null;
    const q = encodeURIComponent(name);
    for (const path of [`/api/v2/brands?search=${q}`, `/api/v2/brands/search?keyword=${q}`]) {
      try {
        const json = await vintedFetch(path);
        const list = json.brands ?? [];
        const lower = String(name).toLowerCase();
        const hit =
          list.find((b) => (b.title || b.name || "").toLowerCase() === lower) ||
          list.find((b) => (b.title || b.name || "").toLowerCase().includes(lower));
        if (hit?.id) return Number(hit.id);
      } catch {
        /* try next */
      }
    }
    return null;
  }

  async function findColourIds(name) {
    if (!name) return [];
    try {
      const json = await vintedFetch("/api/v2/colors");
      const list = json.colors ?? [];
      const lower = String(name).toLowerCase();
      const hit =
        list.find((c) => (c.title || c.code || "").toLowerCase() === lower) ||
        list.find((c) => (c.title || "").toLowerCase().includes(lower));
      return hit?.id ? [Number(hit.id)] : [];
    } catch {
      return [];
    }
  }

  async function findSizeId(catalogId, sizeLabel) {
    if (!catalogId || !sizeLabel) return null;
    const lower = String(sizeLabel).toLowerCase();
    for (const path of [
      `/api/v2/item_upload/sizes?catalog_id=${catalogId}`,
      `/api/v2/catalogs/${catalogId}`,
    ]) {
      try {
        const json = await vintedFetch(path);
        const raw = json.sizes || json.size_groups || [];
        const flat = [];
        for (const row of raw) {
          if (Array.isArray(row.sizes)) flat.push(...row.sizes);
          else flat.push(row);
        }
        const hit =
          flat.find((s) => (s.title || s.name || "").toLowerCase() === lower) ||
          flat.find((s) => (s.title || s.name || "").toLowerCase().includes(lower));
        if (hit?.id) return Number(hit.id);
      } catch {
        /* try next */
      }
    }
    return null;
  }

  async function publish(job) {
    const item = job.item;
    if (!item?.title) throw new Error("Job missing item payload.");
    if (!item.condition || item.condition === "unknown") throw new Error("Confirm the item condition in Lane before publishing.");
    const catalogId = await resolveCatalog(job);
    const photos = item.photos ?? [];
    if (photos.length === 0) throw new Error("Vinted publish needs at least one photo.");
    const photoIds = [];
    for (const p of photos.slice(0, 12)) {
      photoIds.push(await uploadPhoto(p.url));
    }
    const brandId = await findBrandId(item.brand);
    const colourIds = await findColourIds(item.colour);
    const sizeId = await findSizeId(catalogId, item.sizeUk);
    const payload = {
      item: {
        currency: "GBP",
        title: String(item.title).slice(0, 100),
        description: item.description || item.title,
        price: Number(item.priceGbp),
        catalog_id: catalogId,
        status_id: VINTED_STATUS[item.condition] ?? 3,
        package_size_id: Number(item.packageSizeId) || 1,
        photo_ids: photoIds,
        is_unisex: item.gender === "unisex",
        item_attributes: [],
        ...(brandId ? { brand_id: brandId } : {}),
        ...(colourIds.length ? { color_ids: colourIds } : {}),
        ...(sizeId ? { size_id: sizeId } : {}),
      },
    };
    const json = await vintedFetch("/api/v2/items", { method: "POST", json: payload });
    const created = json.item ?? json;
    const id = created.id;
    if (!id) throw new Error("Vinted create item did not return an id.");
    return {
      remoteId: String(id),
      url: created.url || `https://www.vinted.co.uk/items/${id}`,
    };
  }

  async function delist(job) {
    const remoteId = job.listing?.remoteId;
    if (!remoteId) throw new Error("No Vinted item id on this listing.");
    try {
      await vintedFetch(`/api/v2/items/${encodeURIComponent(remoteId)}`, { method: "DELETE" });
    } catch {
      await vintedFetch(`/api/v2/items/${encodeURIComponent(remoteId)}/delete`, { method: "POST", json: {} });
    }
    return { remoteId };
  }

  async function update(job) {
    const remoteId = job.listing?.remoteId;
    if (!remoteId) throw new Error("No Vinted item id on this listing.");
    const item = job.item;
    await vintedFetch(`/api/v2/items/${encodeURIComponent(remoteId)}`, {
      method: "PUT",
      json: {
        item: {
          title: item.title,
          description: item.description,
          price: Number(item.priceGbp),
        },
      },
    });
    return { remoteId, url: job.listing?.url };
  }

  const actions = { identity, wardrobe, sold: soldItems, publish, delist, update, relist: publish };

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.channel !== CHANNEL || data.kind !== "call") return;
    const fn = actions[data.action];
    Promise.resolve()
      .then(() => {
        if (!fn) throw new Error(`Unknown Vinted action ${data.action}`);
        return fn(data.payload);
      })
      .then((payload) => {
        window.postMessage({ channel: CHANNEL, kind: "result", id: data.id, ok: true, payload }, "*");
      })
      .catch((err) => {
        window.postMessage(
          {
            channel: CHANNEL,
            kind: "result",
            id: data.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            body: err && typeof err === "object" && "body" in err ? String(err.body) : undefined,
          },
          "*",
        );
      });
  });
})();
