/**
 * Lane for Windows.
 * Main window is the Lane website. Connect opens the real marketplace in an
 * isolated WebView, captures the session (cookie jar + Bearer), then closes
 * the tab — same shape as Crosslist.
 */
const { app, BrowserWindow, ipcMain, session, Menu, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const CHANNELS = require("./channels.cjs");

const PROTOCOL = "lane";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function configPath() {
  return path.join(path.dirname(process.execPath), "lane.json");
}
function statePath() {
  return path.join(app.getPath("userData"), "lane.json");
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function loadConfig() {
  const disk = { ...readJson(statePath()), ...readJson(configPath()) };
  const appUrl = String(process.env.LANE_APP_URL || disk.appUrl || "").trim();
  return {
    appUrl,
    pairingToken: String(disk.pairingToken || ""),
    origin: String(disk.origin || appUrl || ""),
    theme: disk.theme === "light" ? "light" : "dark",
  };
}
function saveConfig(partial) {
  const next = { ...loadConfig(), ...partial };
  writeJson(statePath(), next);
  try {
    writeJson(configPath(), { appUrl: next.appUrl });
  } catch {
    /* portable folder may be read-only */
  }
  return next;
}
function isConfiguredUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname === "github.com" || u.hostname === "www.github.com") return false;
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

let mainWindow = null;

function createMain() {
  const cfg = loadConfig();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "Lane",
    backgroundColor: "#0d0d0d",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;
  win.setMenuBarVisibility(false);
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  if (isConfiguredUrl(cfg.appUrl)) win.loadURL(cfg.appUrl.replace(/\/$/, ""));
  else win.loadFile(path.join(__dirname, "first-run.html"));

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { type: "separator" },
          {
            label: "Change Lane URL…",
            click: () => {
              saveConfig({ appUrl: "" });
              if (!win.isDestroyed()) win.loadFile(path.join(__dirname, "first-run.html"));
            },
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Connect",
        submenu: Object.values(CHANNELS).map((ch) => ({
          label: ch.label,
          click: () => {
            const c = loadConfig();
            void openConnect(ch.id, { pairingToken: c.pairingToken, origin: c.origin || c.appUrl });
          },
        })),
      },
      { label: "View", submenu: [{ role: "toggleDevTools" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }] },
      { label: "Help", submenu: [{ label: "GitHub", click: () => shell.openExternal("https://github.com/Bleuszz/lane") }] },
    ]),
  );
  return win;
}

const HOOK_JS = `(() => {
  if (window.__LANE_HOOKED__) return true;
  window.__LANE_HOOKED__ = true;
  window.__LANE_BEARER__ = window.__LANE_BEARER__ || "";
  window.__LANE_FORCE_CAPTURE = window.__LANE_FORCE_CAPTURE || false;
  const save = (v) => {
    if (typeof v !== "string") return;
    const t = v.replace(/^(bearer|token)\\s+/i, "").trim();
    if (t.length > 24) window.__LANE_BEARER__ = t;
  };
  try {
    const orig = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
      if (String(k).toLowerCase() === "authorization") save(v);
      return orig.apply(this, arguments);
    };
  } catch (e) {}
  try {
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        const h = init && init.headers;
        if (h) {
          if (typeof h.get === "function") save(h.get("authorization") || h.get("Authorization") || "");
          else if (typeof h === "object") {
            for (const [k, v] of Object.entries(h)) if (String(k).toLowerCase() === "authorization") save(v);
          }
        }
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  } catch (e) {}
  return true;
})()`;

const DETECT_JS = `(() => {
  const text = ((document.body && document.body.innerText) || "").slice(0, 12000);
  const path = location.pathname || "";
  const onAuth = /(\\/member\\/signup|\\/member\\/login|\\/users\\/login|\\/login\\/?$)/i.test(path);
  const labels = Array.from(document.querySelectorAll("a,button,span,[role='menuitem'],[role='button']"))
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean);
  const hasLogout = labels.some((t) => /^(log out|sign out|se déconnecter|uitloggen|wyloguj|logout)$/i.test(t))
    || /\\b(log out|sign out)\\b/i.test(text);
  const hasSellNow = labels.some((t) => /^sell now$/i.test(t)) || !!document.querySelector('a[href*="/items/new"]');
  const hasLoginCta = labels.some((t) => /^(log in|sign in|sign up)$/i.test(t));
  const hasProfile = labels.some((t) => /^profile$/i.test(t));
  const hasUserChip = !!(
    document.querySelector('[data-testid*="user"], [data-testid*="avatar"], a[href*="/member/general"], a[href*="/member/profile"]')
    || document.querySelector('a[href*="/member/"]')
    || document.querySelector('img[alt*="avatar" i], img[alt*="profile" i]')
  );
  let lsRefresh = "", lsAccess = "";
  const scanStore = (store) => {
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i) || "";
        const v = store.getItem(k) || "";
        if (!v || v.length < 20) continue;
        if (/refresh/i.test(k) && v.length > lsRefresh.length) lsRefresh = v;
        if ((/access_token/i.test(k) || /accessToken/i.test(k)) && v.length > lsAccess.length) lsAccess = v;
        if (!lsAccess && /^eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/.test(v)) lsAccess = v;
        if ((v.startsWith("{") || v.startsWith("[")) && v.length < 20000) {
          try {
            const j = JSON.parse(v);
            const walk = (o) => {
              if (!o || typeof o !== "object") return;
              for (const [kk, vv] of Object.entries(o)) {
                if (typeof vv === "string" && vv.length > 20) {
                  if (/refresh/i.test(kk) && vv.length > lsRefresh.length) lsRefresh = vv;
                  if (/access/i.test(kk) && vv.length > lsAccess.length) lsAccess = vv;
                } else if (vv && typeof vv === "object") walk(vv);
              }
            };
            walk(j);
          } catch (e) {}
        }
      }
    } catch (e) {}
  };
  try { scanStore(localStorage); } catch (e) {}
  try { scanStore(sessionStorage); } catch (e) {}
  const signedInUi = !onAuth && (hasLogout || (hasSellNow && !hasLoginCta) || (hasUserChip && hasSellNow) || (hasProfile && hasSellNow));
  return {
    onAuth,
    hasLogout,
    hasSellNow,
    hasLoginCta,
    hasUserChip,
    hasProfile,
    lsRefresh,
    lsAccess,
    bearer: typeof window.__LANE_BEARER__ === "string" ? window.__LANE_BEARER__ : "",
    force: Boolean(window.__LANE_FORCE_CAPTURE),
    signedInUi,
    path,
  };
})()`;

function cookieTokens(all, hints) {
  const names = all.map((c) => c.name);
  const byName = (want) => all.find((c) => c.name === want)?.value || "";
  const byRe = (re) => all.find((c) => re.test(c.name) && String(c.value || "").length > 20)?.value || "";
  let refresh = byName("refresh_token_web") || byName("refresh_token") || byRe(/refresh[_-]?token/i) || "";
  let access = byName("access_token_web") || byName("access_token") || byRe(/access[_-]?token/i) || "";
  for (const c of all) {
    const v = String(c.value || "");
    if (!access && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(v) && v.length > 40) access = v;
  }
  const hinted = (hints || []).some((h) => names.includes(h));
  return { refresh, access, names, hinted };
}

function domainMatches(cookie, origin) {
  try {
    const host = new URL(origin).hostname.replace(/^www\./, "");
    const d = String(cookie.domain || "").replace(/^\./, "");
    return d === host || d.endsWith("." + host) || host.endsWith("." + d) || d.includes(host.split(".").slice(-2).join("."));
  } catch {
    return true;
  }
}

async function jarFor(ses, origin) {
  let host = "";
  try {
    host = new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    host = "vinted.co.uk";
  }
  const batches = await Promise.all([
    ses.cookies.get({}).catch(() => []),
    ses.cookies.get({ url: origin }).catch(() => []),
    ses.cookies.get({ domain: host }).catch(() => []),
    ses.cookies.get({ domain: "." + host }).catch(() => []),
    ses.cookies.get({ domain: "www." + host }).catch(() => []),
  ]);
  const map = new Map();
  for (const list of batches) {
    for (const c of list) {
      map.set(`${c.domain}|${c.name}|${c.path || "/"}`, c);
    }
  }
  const all = [...map.values()];
  const scoped = all.filter((c) => domainMatches(c, origin));
  return scoped.length ? scoped : all;
}

function slimCookies(all) {
  return all
    .filter((c) => c && c.name && c.value)
    .map((c) => ({
      name: String(c.name),
      value: String(c.value).slice(0, 8000),
      domain: String(c.domain || ""),
      httpOnly: Boolean(c.httpOnly),
    }))
    .slice(0, 80);
}

async function injectBar(win, text, showForce) {
  if (win.isDestroyed()) return;
  const js = `(() => {
    let bar = document.getElementById("lane-capture-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "lane-capture-bar";
      bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;align-items:center;gap:12px;background:#0d0d0d;color:#e6e6e6;font:13px Segoe UI,ui-sans-serif,system-ui,sans-serif;padding:10px 16px;border-bottom:1px solid #2a2a2a;";
      document.documentElement.prepend(bar);
      document.documentElement.style.scrollPaddingTop = "48px";
    }
    bar.innerHTML = "";
    const msg = document.createElement("span");
    msg.style.flex = "1";
    msg.textContent = ${JSON.stringify(text)};
    bar.appendChild(msg);
    ${showForce ? `const btn = document.createElement("button");
    btn.textContent = "I'm signed in — connect";
    btn.style.cssText = "height:28px;padding:0 12px;border:0;border-radius:6px;background:#3b82f6;color:#fff;font:500 12px Segoe UI,sans-serif;cursor:pointer";
    btn.onclick = () => { window.__LANE_FORCE_CAPTURE = true; btn.textContent = "Capturing…"; btn.disabled = true; };
    bar.appendChild(btn);` : ""}
  })()`;
  await win.webContents.executeJavaScript(js).catch(() => null);
}

async function injectHook(win) {
  if (win.isDestroyed()) return;
  await win.webContents.executeJavaScript(HOOK_JS).catch(() => null);
}

async function pingCurrentUser(win) {
  if (win.isDestroyed()) return;
  const js = `(() => {
    try {
      fetch("/api/v2/users/current", { credentials: "include", headers: { Accept: "application/json" } }).catch(() => {});
    } catch (e) {}
    return true;
  })()`;
  await win.webContents.executeJavaScript(js).catch(() => null);
}

async function openConnect(marketplace, opts) {
  const ch = CHANNELS[marketplace];
  if (!ch) return { ok: false, error: "Unknown marketplace" };

  if (ch.mode === "oauth") {
    const origin = String(opts?.origin || loadConfig().appUrl || "").replace(/\/$/, "");
    if (!origin) return { ok: false, error: "Set your Lane URL first." };
    const start = marketplace === "ebay_uk" ? `${origin}/api/ebay/start` : `${origin}/settings/channels`;
    await shell.openExternal(start);
    return { ok: true, mode: "oauth" };
  }

  const partition = `persist:lane-${ch.id}`;
  const ses = session.fromPartition(partition);
  try {
    ses.setUserAgent(CHROME_UA);
  } catch {
    /* older electron */
  }
  const captured = { access: "", refresh: "" };
  try {
    ses.webRequest.onBeforeSendHeaders({ urls: ["https://*/*"] }, (details, cb) => {
      const headers = details.requestHeaders || {};
      for (const [key, value] of Object.entries(headers)) {
        if (typeof value !== "string" || value.length < 24) continue;
        const k = key.toLowerCase();
        if (k === "authorization") {
          const token = value.replace(/^(bearer|token)\s+/i, "").trim();
          if (token.length > 24) captured.access = token;
        }
      }
      cb({ requestHeaders: details.requestHeaders });
    });
  } catch {
    /* ignore */
  }

  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    title: `Connect ${ch.label}`,
    backgroundColor: "#0d0d0d",
    autoHideMenuBar: true,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenu(null);
  win.setMenuBarVisibility(false);
  win.removeMenu();

  const onNav = () => {
    void injectHook(win);
    void injectBar(win, `Sign in on ${ch.label}. This window closes on its own.`, true);
  };
  win.webContents.on("dom-ready", onNav);
  win.webContents.on("did-finish-load", onNav);
  win.webContents.on("did-navigate-in-page", onNav);

  await win.loadURL(ch.startUrl || ch.origin);
  await injectHook(win);
  await injectBar(win, `Sign in on ${ch.label}. This window closes on its own.`, true);

  return await new Promise((resolve) => {
    let settled = false;
    let uiTicks = 0;
    let pokedMember = false;
    const finish = async (ok, extra) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      if (ok) await injectBar(win, extra?.username ? `Connected as ${extra.username}. Closing…` : "Got it. Closing…", false);
      else if (extra?.error) await injectBar(win, extra.error, false);
      setTimeout(() => {
        if (!win.isDestroyed()) win.close();
      }, ok ? 350 : 2400);
      resolve({ ok, ...extra });
    };

    const postSession = async (refresh, access, cookies) => {
      const cfg = loadConfig();
      const origin = String(opts?.origin || cfg.origin || cfg.appUrl || "").replace(/\/$/, "");
      const token = String(opts?.pairingToken || cfg.pairingToken || "");
      const payload = {
        marketplace: ch.id,
        refreshToken: refresh || access || undefined,
        accessToken: access || undefined,
        cookies,
      };
      const post = async (url, headers) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        return { res, json };
      };
      if (origin && token && (refresh || access || (cookies && cookies.length))) {
        const { res, json } = await post(`${origin}/api/bridge/session`, { Authorization: `Bearer ${token}` });
        if (!res.ok) throw new Error(json.error || "Session rejected by Lane.");
        return json.username;
      }
      if (origin && opts?.connectId && opts?.connectSecret && (refresh || access || (cookies && cookies.length))) {
        const { res, json } = await post(
          `${origin}/api/vinted/connect/${encodeURIComponent(opts.connectId)}?k=${encodeURIComponent(opts.connectSecret)}`,
          {},
        );
        if (!res.ok) throw new Error(json.error || "Session rejected by Lane.");
        return json.username;
      }
      if (!token && !opts?.connectId) {
        throw new Error("Sign in to Lane in the main window first so this shop attaches to your account.");
      }
      if (!refresh && !access) {
        throw new Error("Signed in, but Vinted did not expose a session token yet. Click I'm signed in after the page finishes loading.");
      }
      return undefined;
    };

    const tick = async () => {
      if (win.isDestroyed() || settled) return;
      await injectHook(win);
      const cookies = await jarFor(ses, ch.origin);
      const tokens = cookieTokens(cookies, ch.cookieHints);
      let dom = null;
      try {
        dom = await win.webContents.executeJavaScript(DETECT_JS);
      } catch {
        dom = null;
      }
      const refresh = tokens.refresh || (dom && dom.lsRefresh) || captured.refresh || "";
      const access = tokens.access || (dom && dom.lsAccess) || (dom && dom.bearer) || captured.access || "";
      const uiSignedIn = Boolean(dom && (dom.signedInUi || dom.force));
      const forced = Boolean(dom && dom.force);
      const cookieSignedIn = Boolean(refresh || access) || Boolean(ch.signedInWhen && ch.signedInWhen(win.webContents.getURL(), tokens.names));

      if (uiSignedIn) uiTicks += 1;
      if (uiSignedIn && !pokedMember && uiTicks >= 1) {
        pokedMember = true;
        void pingCurrentUser(win);
        const url = win.webContents.getURL();
        if (ch.id === "vinted_uk" && url && !/\/member\//.test(url) && !/\/items\/new/.test(url)) {
          void win.loadURL("https://www.vinted.co.uk/member/items").catch(() => null);
        }
      }

      if (uiSignedIn && !refresh && !access) {
        await injectBar(win, "You're signed in. Capturing the session…", true);
        void pingCurrentUser(win);
        if (!forced && uiTicks < 6) return;
      }

      if (!cookieSignedIn && !uiSignedIn && !access && !forced) return;
      if (!refresh && !access && !forced && !(uiSignedIn && cookies.length >= 3 && uiTicks >= 6)) return;

      await injectBar(win, "Got the session. Saving…", false);
      try {
        const username = await postSession(refresh, access, slimCookies(cookies));
        await finish(true, { username, cookieCount: cookies.length });
      } catch (err) {
        await finish(false, { error: err instanceof Error ? err.message : "Could not save session" });
      }
    };

    const timer = setInterval(tick, 500);
    void tick();
    win.on("closed", () => {
      clearInterval(timer);
      if (!settled) resolve({ ok: false, error: "window closed" });
    });
  });
}

function handleLaneUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== `${PROTOCOL}:`) return;
    const marketplace = u.searchParams.get("marketplace") || "vinted_uk";
    const pairingToken = u.searchParams.get("token") || "";
    const origin = u.searchParams.get("origin") || loadConfig().appUrl;
    const connectId = u.searchParams.get("id") || "";
    const connectSecret = u.searchParams.get("k") || "";
    if (pairingToken) saveConfig({ pairingToken, origin });
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    void openConnect(marketplace, { pairingToken, origin, connectId, connectSecret });
  } catch {
    /* ignore */
  }
}

ipcMain.handle("lane:connect", (_e, marketplace, opts) => openConnect(String(marketplace), opts || {}));
ipcMain.handle("lane:set-pairing", (_e, token, origin) => {
  saveConfig({ pairingToken: String(token || ""), origin: String(origin || "") });
  return { ok: true };
});
ipcMain.handle("lane:set-app-url", (_e, url) => {
  const next = saveConfig({ appUrl: String(url || "").replace(/\/$/, ""), origin: String(url || "").replace(/\/$/, "") });
  if (mainWindow && !mainWindow.isDestroyed() && isConfiguredUrl(next.appUrl)) mainWindow.loadURL(next.appUrl);
  return { ok: true, appUrl: next.appUrl };
});
ipcMain.handle("lane:config", () => loadConfig());
ipcMain.handle("lane:is-desktop", () => true);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const url = argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}:`));
    if (url) handleLaneUrl(url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  if (process.defaultApp) {
    if (process.argv.length >= 2) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
  app.whenReady().then(() => {
    createMain();
    const proto = process.argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}:`));
    if (proto) handleLaneUrl(proto);
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleLaneUrl(url);
});
app.on("window-all-closed", () => app.quit());
