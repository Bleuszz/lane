/**
 * Lane Bridge service worker.
 * Holds the pairing token, talks to the Lane control plane, and forwards
 * jobs to the open vinted.co.uk tab. Does not talk to Vinted itself —
 * that happens in the page MAIN world so the user's session cookies ride.
 */

const STORAGE_KEYS = ["origin", "token"];

async function getConfig() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS);
  const origin = String(stored.origin ?? "").replace(/\/$/, "");
  const token = String(stored.token ?? "").trim();
  return { origin, token, ready: Boolean(origin && token.startsWith("lnb_")) };
}

async function laneFetch(path, { method = "GET", body } = {}) {
  const { origin, token, ready } = await getConfig();
  if (!ready) throw new Error("Not paired. Open the Lane Bridge popup and paste the token from Settings → Channels.");
  const res = await fetch(`${origin}/api/bridge/${path.replace(/^\//, "")}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text.slice(0, 400) };
  }
  if (!res.ok) {
    throw new Error(json.error || `Lane HTTP ${res.status}`);
  }
  return json;
}

async function uploadVintedCookies() {
  // Session-first transport: marketplace credentials must remain in the browser.
  // Retain the call boundary for older popup flows, but never upload cookie jars.
  return;
}

const lastCatalogAt = { t: 0 };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  (async () => {
    if (msg?.type === "GET_CONFIG") {
      const cfg = await getConfig();
      return { ...cfg, tabId };
    }
    if (msg?.type === "SAVE_CONFIG") {
      const origin = String(msg.origin ?? "").replace(/\/$/, "");
      const token = String(msg.token ?? "").trim();
      if (origin) {
        const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
        if (!granted) throw new Error("Lane origin permission was not granted.");
      }
      await chrome.storage.local.set({ origin, token });
      await uploadVintedCookies();
      return { ok: true };
    }
    if (msg?.type === "POLL") {
      const cfg = await getConfig();
      if (!cfg.ready) return { paired: false, jobs: [] };
      await uploadVintedCookies();
      const heartbeat = await laneFetch("heartbeat", {
        method: "POST",
        body: {
          username: msg.username ?? null,
          userId: msg.userId ?? null,
        },
      });
      const now = Date.now();
      let catalog = null;
      if (Array.isArray(msg.catalog) && (now - lastCatalogAt.t > 45_000 || msg.forceCatalog)) {
        catalog = await laneFetch("catalog", {
          method: "POST",
          body: {
            username: msg.username ?? null,
            userId: msg.userId ?? null,
            items: msg.catalog.slice(0, 200),
          },
        });
        lastCatalogAt.t = now;
      }
      return { paired: true, jobs: heartbeat.jobs ?? [], catalog };
    }
    if (msg?.type === "JOB_RESULT") {
      await laneFetch(`jobs/${msg.jobId}/result`, {
        method: "POST",
        body: {
          ok: Boolean(msg.ok),
          claimToken: msg.claimToken ?? null,
          remoteId: msg.remoteId ?? null,
          url: msg.url ?? null,
          error: msg.error ?? null,
          errorBody: msg.errorBody ?? null,
        },
      });
      return { ok: true };
    }
    if (msg?.type === "SOLD") {
      await laneFetch("sold", {
        method: "POST",
        body: {
          remoteId: msg.remoteId,
          soldPriceGbp: msg.soldPriceGbp,
        },
      });
      return { ok: true };
    }
    if (msg?.type === "IDENTITY") {
      await laneFetch("identity", {
        method: "POST",
        body: { username: msg.username, userId: msg.userId },
      });
      return { ok: true };
    }
    return { error: "unknown_message" };
  })()
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true;
});

chrome.alarms.create("lane-bridge-nudge", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async () => {
  await uploadVintedCookies();
  const tabs = await chrome.tabs.query({ url: ["https://www.vinted.co.uk/*", "https://vinted.co.uk/*"] });
  if (tabs.length === 0) return;
  for (const tab of tabs) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "NUDGE" }).catch(() => {});
  }
});
