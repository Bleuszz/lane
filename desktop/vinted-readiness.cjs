const { readScript } = require("./session-reader.cjs");
const { marketplaceUrl } = require("./security.cjs");
const { failure } = require("./connection-manager.cjs");
function bounded(promise, signal, ms = 2500) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => finish(reject, failure("CANCELLED"));
    const timer = setTimeout(() => finish(reject, failure("NETWORK")), ms);
    function finish(fn, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      fn(result);
    }
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    promise.then(
      (v) => finish(resolve, v),
      (e) => finish(reject, e),
    );
  });
}
function pause(ms, signal) {
  return bounded(new Promise((r) => setTimeout(r, ms)), signal, ms + 500);
}
function safeRoute(value) {
  try {
    const u = new URL(value);
    if (!marketplaceUrl(u.href, "vinted_uk")) return "outside_marketplace";
    return u.pathname.replace(/\d+[^/]*/g, ":id").slice(0, 100);
  } catch {
    return "unavailable";
  }
}
function observeNavigation(win, p) {
  const d = (p.diagnostic ||= {});
  d.vintedNavigation = { domReady: false, finished: false, inPage: false, route: null };
  const record = (name) => () => {
    if (win.isDestroyed()) return;
    const n = d.vintedNavigation;
    n.route = safeRoute(win.webContents.getURL());
    if (name === "dom-ready") n.domReady = true;
    if (name === "did-finish-load") n.finished = true;
    if (name === "did-navigate-in-page") n.inPage = true;
    n.lastEvent = name;
  };
  for (const name of ["did-navigate", "did-navigate-in-page", "dom-ready", "did-finish-load"])
    win.webContents.on(name, record(name));
}
// Wait for a document, not subresource completion. All auth/identity checks still follow.
function navigate(win, url, p, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const wc = win.webContents;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      wc.removeListener("dom-ready", ready);
      wc.removeListener("did-fail-load", failed);
      win.removeListener("closed", closed);
      signal?.removeEventListener("abort", closed);
      error ? reject(error) : resolve();
    };
    const ready = () => finish();
    const failed = (_event, code, _description, _url, isMain) => {
      if (isMain && code !== -3) finish(failure("PAGE_UNAVAILABLE"));
    };
    const closed = () => finish(failure("CANCELLED"));
    const timer = setTimeout(() => finish(failure("NETWORK")), 20000);
    wc.on("dom-ready", ready);
    wc.on("did-fail-load", failed);
    win.once("closed", closed);
    signal?.addEventListener("abort", closed, { once: true });
    if (signal?.aborted) return closed();
    wc.loadURL(url).catch((error) => {
      if (error.errno !== -3 && error.code !== "ERR_ABORTED") finish(failure("NETWORK"));
    });
  });
}
async function inspect(win, p, signal, supportMode = false) {
  if (win.isDestroyed()) return { closed: true };
  if (!marketplaceUrl(win.webContents.getURL(), "vinted_uk")) return { authenticated: false };
  const read = () =>
    bounded(
      win.webContents.mainFrame.executeJavaScript(
        readScript("vinted_uk", p.identity || null, supportMode),
      ),
      signal,
    );
  let evidence = await read();
  if (
    !evidence.identity &&
    evidence.signals?.loggedInNavigation &&
    !evidence.challenge &&
    !evidence.loginRequired
  ) {
    // The observed header renders before its click handler hydrates. Retry only this
    // read-only menu, at most three times, and stop immediately when identity resolves.
    for (let i = 0; i < 16; i++) {
      if (i % 6 === 0)
        await bounded(
          win.webContents.mainFrame.executeJavaScript(
            `(()=>{const b=document.querySelector('[data-testid="user-menu-button"]');if(!b||b.getAttribute('aria-expanded')==='true'||document.querySelector('[role="menu"],[data-testid="user-menu"],[data-testid="profile-menu"]'))return false;b.click();return true;})()`,
          ),
          signal,
        );
      await pause(250, signal);
      evidence = await read();
      if (evidence.identity || evidence.challenge || evidence.loginRequired) break;
    }
  }
  evidence.currentRoute = safeRoute(win.webContents.getURL());
  evidence.wardrobeFound = Boolean(evidence.wardrobeUrl);
  return evidence;
}
async function visit(win, url, p, signal, supportMode = false) {
  const deadline = Date.now() + 20000;
  await navigate(win, url, p, signal);
  let result;
  do {
    result = await inspect(win, p, signal, supportMode);
    if (result.challenge || result.pageError || result.loginRequired) return result;
    if (result.authenticated) {
      const pathname = new URL(url).pathname;
      const contentReady = /^\/member\/\d+/.test(pathname)
        ? !result.ownPage || result.listingStateKnown
        : /^\/items\/\d+/.test(pathname)
          ? Boolean(result.item)
          : true;
      if (contentReady) return result;
    }
    // The signed-in account controls have rendered; a missing ID is an identity gate.
    if (!result.authenticated && result.signals?.loggedInNavigation) return result;
    await pause(250, signal);
  } while (Date.now() < deadline);
  return result || { pageError: true };
}
module.exports = { navigate, inspect, visit, observeNavigation, safeRoute };
