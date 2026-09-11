const { BrowserWindow, session } = require("electron");
const { MARKETPLACES, marketplaceUrl, cookieAllowed } = require("./security.cjs");
const { readScript } = require("./session-reader.cjs");
const { failure } = require("./connection-manager.cjs");
const { cookieMetadata, pageSummary, profileDiagnostics } = require("./session-diagnostics.cjs");
const identityHosts = [
  "accounts.google.com",
  "appleid.apple.com",
  "www.facebook.com",
  "m.facebook.com",
];
function loginUrlAllowed(value, marketplace) {
  try {
    const u = new URL(value);
    return (
      marketplaceUrl(value, marketplace) ||
      (u.protocol === "https:" && !u.username && !u.password && identityHosts.includes(u.hostname))
    );
  } catch {
    return false;
  }
}
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(failure("CANCELLED"));
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(failure("CANCELLED"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
function createSessionTransport({
  vault,
  runtimes,
  changed = () => {},
  supportMode = false,
  showLoginWindows = true,
}) {
  async function runtime(p) {
    if (p.disconnected) throw failure("CANCELLED");
    let r = runtimes.get(p.id);
    if (r) return r;
    const partition = "lane-memory-" + p.key;
    const ses = session.fromPartition(partition, { cache: false });
    p.diagnostic ||= {};
    p.diagnostic.sessionId = partition;
    ses.setPermissionRequestHandler((_w, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    ses.on("will-download", (e) => e.preventDefault());
    r = { session: ses, windows: new Set(), loginWindows: new Set(), window: null, dirty: false };
    runtimes.set(p.id, r);
    const saved = vault.read(p.key);
    for (const c of saved?.cookies || []) {
      if (
        !cookieAllowed(c, p.marketplace) ||
        (c.expirationDate && c.expirationDate < Date.now() / 1000)
      )
        continue;
      const host = c.domain.replace(/^\./, "");
      await ses.cookies
        .set({
          url: `https://${host}${c.path || "/"}`,
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || "/",
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
          ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
        })
        .catch(() => undefined);
    }
    ses.cookies.on("changed", () => {
      r.dirty = true;
    });
    return r;
  }
  function secureWindow(win, p, r, interactive) {
    const same = win.webContents.session === r.session;
    p.diagnostic ||= {};
    p.diagnostic[interactive ? "visibleSessionMatches" : "backgroundSessionMatches"] = same;
    if (!same) {
      win.destroy();
      throw failure("SESSION_MISMATCH");
    }
    r.windows.add(win);
    if (interactive) r.loginWindows.add(win);
    const allowed = interactive ? loginUrlAllowed : marketplaceUrl;
    const navigate = (event, url) => {
      if (!allowed(url, p.marketplace)) {
        event.preventDefault();
        p.diagnostic.navigationBlocked = true;
        p.connectionError =
          "This sign-in redirect is not supported. Try the marketplace email login or report the blocked step.";
        changed(p);
      }
    };
    win.webContents.on("will-navigate", navigate);
    win.webContents.on("will-redirect", navigate);
    win.webContents.setWindowOpenHandler(({ url }) =>
      interactive && loginUrlAllowed(url, p.marketplace)
        ? {
            action: "allow",
            overrideBrowserWindowOptions: {
              autoHideMenuBar: true,
              webPreferences: {
                session: r.session,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
              },
            },
          }
        : { action: "deny" },
    );
    win.webContents.on("did-create-window", (child) => secureWindow(child, p, r, interactive));
    win.on("closed", () => {
      r.windows.delete(win);
      r.loginWindows.delete(win);
      if (r.window === win) r.window = null;
    });
  }
  async function makeWindow(p, interactive) {
    const r = await runtime(p);
    if (interactive && r.window && !r.window.isDestroyed()) {
      r.window.show();
      r.window.focus();
      return r.window;
    }
    const win = new BrowserWindow({
      show: interactive && showLoginWindows,
      width: 1100,
      height: 800,
      title: `Sign in to ${MARKETPLACES[p.marketplace].label} — Lane`,
      autoHideMenuBar: true,
      webPreferences: {
        session: r.session,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    secureWindow(win, p, r, interactive);
    if (interactive) r.window = win;
    return win;
  }
  async function inspect(win, p) {
    if (win.isDestroyed()) return { closed: true };
    if (!marketplaceUrl(win.webContents.getURL(), p.marketplace)) return { authenticated: false };
    try {
      let result = await win.webContents.executeJavaScript(
        readScript(p.marketplace, p.identity || null, supportMode),
      );
      // Observed Seller Hub identity is lazy-rendered on hover. Open only that account
      // flyout using Chromium input; never click sign-out, listing or write controls.
      if (
        p.marketplace === "ebay_uk" &&
        (result.sellerHub || p.identity) &&
        !result.identity &&
        !result.loginRequired &&
        !result.challenge
      ) {
        const point = await win.webContents.executeJavaScript(
          `(()=>{const e=document.querySelector('.gh-identity__greeting');if(!e)return null;const r=e.getBoundingClientRect();return r.width&&r.height?{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}:null})()`,
        );
        if (point) {
          win.webContents.sendInputEvent({ type: "mouseMove", ...point });
          for (let i = 0; i < 4; i++) {
            await delay(350);
            if (win.isDestroyed()) return { closed: true };
            result = await win.webContents.executeJavaScript(
              readScript(p.marketplace, p.identity || null, supportMode),
            );
            if (result.identity || result.challenge || result.loginRequired) break;
          }
        }
      }
      return result;
    } catch {
      return win.isDestroyed() ? { closed: true } : { authenticated: false, navigating: true };
    }
  }
  async function visit(p, url, signal) {
    if (!marketplaceUrl(url, p.marketplace)) throw failure("PAGE_UNAVAILABLE");
    const win = await makeWindow(p, false);
    const abort = () => {
      if (!win.isDestroyed()) win.destroy();
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      let timeout;
      try {
        await Promise.race([
          win.loadURL(url),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(failure("NETWORK")), 20000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      // Wait for hydrated account chrome, never interact with a hidden challenge/login page.
      for (let i = 0; i < 8; i++) {
        await delay(500, signal);
        const result = await inspect(win, p);
        if (
          result.ownPage &&
          result.visibleListingCount > (result.links?.length || 0) &&
          !result.nextPage &&
          i < 7
        ) {
          await win.webContents.executeJavaScript(
            "window.scrollTo(0, document.documentElement.scrollHeight)",
          );
          continue;
        }
        if (
          result.challenge ||
          result.pageError ||
          result.loginRequired ||
          (result.authenticated && (!result.ownPage || result.listingStateKnown))
        )
          return result;
      }
      return await inspect(win, p);
    } catch (error) {
      if (!win.isDestroyed()) {
        const result = await inspect(win, p);
        p.diagnostic.backgroundPage = result;
        Object.assign(p.diagnostic, pageSummary(result));
        if (result.challenge || result.loginRequired || result.authenticated) return result;
      }
      p.diagnostic.lastErrorCode = "PAGE_LOAD_FAILED";
      p.diagnostic.lastErrorCategory = "navigation";
      p.diagnostic.lastErrorAt = new Date().toISOString();
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (!win.isDestroyed()) win.destroy();
    }
  }
  async function sessionInfo(p) {
    const r = await runtime(p);
    const cookies = (await r.session.cookies.get({})).filter((c) =>
      cookieAllowed(c, p.marketplace),
    );
    const d = (p.diagnostic ||= {});
    d.cookieCount = cookies.length;
    d.httpOnlyCookieCount = cookies.filter((c) => c.httpOnly).length;
    d.sessionCookieCount = cookies.filter((c) => c.session).length;
    d.sessionPresent = cookies.some(
      (c) => c.secure && c.value && (!c.expirationDate || c.expirationDate > Date.now() / 1000),
    );
    if (r.cookiesBefore)
      d.sessionCookiesAppeared = cookies.some(
        (c) => c.session && !r.cookiesBefore.has(c.domain + "|" + c.path + "|" + c.name),
      );
    return {
      sessionPresent: d.sessionPresent,
      cookieCount: cookies.length,
      cookies: cookieMetadata(cookies),
    };
  }
  async function discover(p, evidence, signal) {
    let result =
      p.marketplace === "ebay_uk"
        ? evidence
        : p.wardrobeUrl
          ? await visit(p, p.wardrobeUrl, signal)
          : evidence;
    const all = new Map((result.links || []).map((a) => [a.remoteId, a]));
    const visited = new Set();
    for (let i = 0; i < 9 && result.nextPage && all.size < 200; i++) {
      if (visited.has(result.nextPage)) break;
      visited.add(result.nextPage);
      const next = await visit(p, result.nextPage, signal);
      if (!next.authenticated || next.identity !== p.identity || !next.ownPage) return next;
      for (const a of next.links || []) all.set(a.remoteId, a);
      result = {
        ...next,
        visibleListingCount: result.visibleListingCount ?? next.visibleListingCount,
      };
    }
    return { ...result, links: [...all.values()].slice(0, 200) };
  }
  return {
    delay,
    runtime,
    sessionInfo,
    async probe(p, signal) {
      const info = await sessionInfo(p);
      const r = await runtime(p);
      const visible = r.window && !r.window.isDestroyed() ? await inspect(r.window, p) : {};
      const d = (p.diagnostic ||= {});
      d.visiblePage = visible;
      try {
        const background = await visit(p, MARKETPLACES[p.marketplace].validate, signal);
        const after = await sessionInfo(p);
        d.cookiesAfterNavigation = after.cookieCount;
        d.backgroundPage = background;
        Object.assign(d, pageSummary(background));
        d.lastProbeAt = new Date().toISOString();
        changed(p);
        return {
          ...profileDiagnostics(p),
          identityResolved: Boolean(background.identity),
          cookies: after.cookies,
          ...(supportMode ? { domEvidence: background.domEvidence } : {}),
        };
      } catch (error) {
        d.validationResult = "error";
        d.lastProbeAt = new Date().toISOString();
        d.lastErrorCode =
          error.code === "SESSION_MISMATCH" ? "SESSION_MISMATCH" : "PROBE_NAVIGATION_FAILED";
        d.lastErrorCategory = error.code === "SESSION_MISMATCH" ? "session_boundary" : "navigation";
        d.lastErrorAt = new Date().toISOString();
        changed(p);
        return { ...profileDiagnostics(p), cookies: info.cookies };
      }
    },
    async hasSession(p) {
      return (await sessionInfo(p)).sessionPresent;
    },
    async persist(p) {
      const r = runtimes.get(p.id);
      if (!r || p.disconnected) return;
      const cookies = (await r.session.cookies.get({})).filter((c) =>
        cookieAllowed(c, p.marketplace),
      );
      if (!p.disconnected) vault.write(p.key, { cookies });
    },
    async openLogin(p, signal) {
      await sessionInfo(p);
      const r = await runtime(p);
      r.cookiesBefore = new Set(
        (await r.session.cookies.get({}))
          .filter((c) => cookieAllowed(c, p.marketplace))
          .map((c) => c.domain + "|" + c.path + "|" + c.name),
      );
      p.diagnostic.cookiesBeforeLogin = r.cookiesBefore.size;
      const win = await makeWindow(p, true);
      const abort = () => {
        if (!win.isDestroyed()) win.destroy();
      };
      signal.addEventListener("abort", abort, { once: true });
      win.once("closed", () => signal.removeEventListener("abort", abort));
      let timer;
      try {
        await Promise.race([
          win.loadURL(MARKETPLACES[p.marketplace].login),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(failure("NETWORK")), 20000);
          }),
        ]);
      } catch (error) {
        if (win.isDestroyed()) throw failure("CANCELLED");
        // A user can navigate before the initial page finishes loading. Keep the
        // permitted auth window; the state machine still requires independent validation.
        if (
          (error.errno === -3 || error.code === "ERR_ABORTED") &&
          loginUrlAllowed(win.webContents.getURL(), p.marketplace)
        )
          return win;
        if (!win.isDestroyed()) win.destroy();
        throw error;
      } finally {
        clearTimeout(timer);
      }
      return win;
    },
    async inspectLogin(p, win) {
      const evidence = await inspect(win, p);
      await sessionInfo(p);
      p.diagnostic.visiblePage = evidence;
      return evidence;
    },
    async closeLogin(p, win) {
      const r = runtimes.get(p.id);
      for (const child of r?.loginWindows || []) if (!child.isDestroyed()) child.destroy();
      if (win && !win.isDestroyed()) win.destroy();
      await sessionInfo(p);
      p.diagnostic.cookiesAfterLoginClosed = p.diagnostic.cookieCount;
    },
    async validate(p, signal) {
      const result = await visit(p, MARKETPLACES[p.marketplace].validate, signal);
      p.diagnostic.backgroundPage = result;
      Object.assign(p.diagnostic, pageSummary(result));
      return result;
    },
    listings: discover,
    async readItems(p, links, signal) {
      const items = [];
      for (const link of links) {
        const result = await visit(p, link.url, signal);
        if (result.challenge) throw failure("CHALLENGE");
        if (!result.authenticated || result.identity !== p.identity)
          throw failure("NOT_AUTHENTICATED");
        if (result.item?.remoteId === link.remoteId) items.push(result.item);
      }
      return items;
    },
    async clear(p) {
      const r = runtimes.get(p.id);
      if (r) {
        for (const win of r.windows) if (!win.isDestroyed()) win.destroy();
        await r.session.clearStorageData();
        await r.session.clearCache();
        runtimes.delete(p.id);
      }
      vault.remove(p.key);
    },
  };
}
module.exports = { createSessionTransport, loginUrlAllowed };
