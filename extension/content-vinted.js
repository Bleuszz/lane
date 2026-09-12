/**
 * Isolated-world content script on vinted.co.uk.
 * Injects the MAIN-world Vinted client (so session cookies + CSRF are available),
 * keeps the service worker awake, heartbeats Lane, and runs jobs.
 */

const MSG = "LANE_BRIDGE";
let busy = false;
let lastSoldCheck = 0;
let lastCatalogCheck = 0;

(function injectMain() {
  if (document.documentElement.dataset.laneBridge === "1") return;
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("injected.js");
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
})();

function callPage(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = `lane_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    function onMessage(ev) {
      if (ev.source !== window) return;
      const data = ev.data;
      if (!data || data.channel !== MSG || data.id !== id || data.kind !== "result") return;
      window.removeEventListener("message", onMessage);
      if (data.ok === false) {
        const err = new Error(data.error || "Vinted call failed");
        if (data.body) err.body = data.body;
        reject(err);
      } else resolve(data.payload);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ channel: MSG, kind: "call", id, action, payload }, "*");
    setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(`Vinted page call timed out: ${action}`));
    }, 90_000);
  });
}

async function runJob(job) {
  if (job.type === "publish" || job.type === "relist" || job.type === "update" || job.type === "delist") {
    const result = await callPage(job.type, job);
    const ack = await chrome.runtime.sendMessage({
      type: "JOB_RESULT",
      jobId: job.id,
      claimToken: job.claimToken,
      ok: true,
      remoteId: result?.remoteId ?? job.listing?.remoteId ?? null,
      url: result?.url ?? job.listing?.url ?? null,
    });
    if (ack?.error) throw new Error(ack.error);
    return;
  }
  await chrome.runtime.sendMessage({
    type: "JOB_RESULT",
    jobId: job.id,
    claimToken: job.claimToken,
    ok: false,
    error: `Lane Bridge does not handle job type ${job.type} on Vinted.`,
  });
}

async function poll() {
  if (busy) return;
  busy = true;
  try {
    let identity = { username: null, userId: null };
    let catalog = [];
    try {
      identity = (await callPage("identity")) ?? identity;
      if (Date.now() - lastCatalogCheck > 120_000) {
        catalog = (await callPage("wardrobe")) ?? [];
        lastCatalogCheck = Date.now();
      }
    } catch {
      /* user may not be signed in yet */
    }
    const res = await chrome.runtime.sendMessage({
      type: "POLL",
      username: identity?.username ?? null,
      userId: identity?.userId ?? null,
      catalog,
      forceCatalog: catalog.length > 0 && Date.now() - lastSoldCheck > 120_000,
    });
    if (res?.error) {
      console.warn("[Lane Bridge]", res.error);
      return;
    }
    for (const job of res?.jobs ?? []) {
      try {
        await runJob(job);
      } catch (err) {
        await chrome.runtime.sendMessage({
          type: "JOB_RESULT",
          jobId: job.id,
          claimToken: job.claimToken,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          errorBody: err && typeof err === "object" && "body" in err ? String(err.body) : undefined,
        });
      }
    }
    if (Date.now() - lastSoldCheck > 90_000) {
      lastSoldCheck = Date.now();
      try {
        const sold = (await callPage("sold")) ?? [];
        for (const row of sold) {
          await chrome.runtime.sendMessage({
            type: "SOLD",
            remoteId: row.remoteId,
            soldPriceGbp: row.priceGbp,
          });
        }
      } catch {
        /* ignore sold-poll failures */
      }
    }
  } finally {
    busy = false;
  }
}

setTimeout(() => void poll(), 1200);
setInterval(() => void poll(), 4000);
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "NUDGE") void poll();
});
