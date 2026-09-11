const { BrowserWindow, session } = require("electron");
const { MARKETPLACES, marketplaceUrl, cookieAllowed } = require("./security.cjs");
const { readScript } = require("./session-reader.cjs");
const { failure } = require("./connection-manager.cjs");
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
    const ses = session.fromPartition("lane-memory-" + p.key, { cache: false });
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
    r.windows.add(win);
    if (interactive) r.loginWindows.add(win);
    const allowed = interactive ? loginUrlAllowed : marketplaceUrl;
    const navigate = (event, url) => {
      if (!allowed(url, p.marketplace)) {
        event.preventDefault();
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
      return await win.webContents.executeJavaScript(
        readScript(p.marketplace, p.identity || null, supportMode),
      );
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
          result.challenge ||
          result.pageError ||
          result.loginRequired ||
          (result.authenticated && (!result.ownPage || result.listingStateKnown))
        )
          return result;
      }
      return await inspect(win, p);
    } finally {
      signal?.removeEventListener("abort", abort);
      if (!win.isDestroyed()) win.destroy();
    }
  }
  return {
    delay,
    runtime,
    async hasSession(p) {
      const r = await runtime(p);
      return (await r.session.cookies.get({})).some(
        (c) =>
          cookieAllowed(c, p.marketplace) &&
          c.secure &&
          c.value &&
          (!c.expirationDate || c.expirationDate > Date.now() / 1000),
      );
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
        if (!win.isDestroyed()) win.destroy();
        throw error;
      } finally {
        clearTimeout(timer);
      }
      return win;
    },
    inspectLogin: (p, win) => inspect(win, p),
    async closeLogin(p, win) {
      const r = runtimes.get(p.id);
      for (const child of r?.loginWindows || []) if (!child.isDestroyed()) child.destroy();
      if (win && !win.isDestroyed()) win.destroy();
    },
    validate: (p, signal) => visit(p, MARKETPLACES[p.marketplace].validate, signal),
    async listings(p, evidence, signal) {
      if (p.marketplace === "ebay_uk") return evidence;
      if (!p.wardrobeUrl) return { ...evidence, ownPage: false };
      return visit(p, p.wardrobeUrl, signal);
    },
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
