const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  safeStorage,
  shell,
  clipboard,
  Menu,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const {
  MARKETPLACES,
  laneOrigin,
  marketplaceUrl,
  cookieAllowed,
  profileKey,
  createVault,
  diagnostics,
} = require("./security.cjs");
const { readScript } = require("./session-reader.cjs");
const qaSmoke = process.argv.includes("--qa-smoke") && !app.isPackaged;
if (qaSmoke) app.setPath("userData", path.resolve(__dirname, "../artifacts/desktop-ui-state"));
let vault,
  state,
  mainWindow,
  quitting = false;
const profiles = new Map();
const uiFile = path.join(__dirname, "client", "index.html");
const uiUrl = pathToFileURL(uiFile).href;
function save() {
  vault.write("settings", state);
}
async function apiRequest(route, body, access) {
  const response = await fetch(state.origin + "/api/desktop/" + route, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: "Bearer " + access } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Device request failed.");
  return response.json();
}
let pairingTimer = null,
  heartbeatBusy = false;
async function deviceHeartbeat() {
  if (!state?.deviceToken || heartbeatBusy) return;
  heartbeatBusy = true;
  try {
    if (!state.accessToken || Date.now() > state.accessUntil - 60000) {
      const next = await apiRequest("refresh", { refreshToken: state.deviceToken });
      state.accessToken = next.accessToken;
      state.accessUntil = Date.now() + next.expiresIn * 1000;
      save();
    }
    await apiRequest(
      "heartbeat",
      {
        version: app.getVersion(),
        paused: Boolean(state.paused),
        vinted: state.profiles.find((p) => p.marketplace === "vinted_uk")?.status || "unknown",
        ebay: state.profiles.find((p) => p.marketplace === "ebay_uk")?.status || "unknown",
      },
      state.accessToken,
    );
    state.bridgeHealth = "online";
    state.lastHeartbeat = new Date().toISOString();
    save();
  } catch {
    state.bridgeHealth = "offline";
    state.errorCode = "BRIDGE_UNAVAILABLE";
  } finally {
    heartbeatBusy = false;
  }
}

function publicState() {
  return {
    version: app.getVersion(),
    origin: state.origin || "",
    paired: Boolean(state.deviceToken),
    pairingCode: state.pairing?.code || null,
    bridgeHealth: state.bridgeHealth || "offline",
    paused: Boolean(state.paused),
    startup: app.getLoginItemSettings().openAtLogin,
    encryption: safeStorage.isEncryptionAvailable(),
    error: state.error || null,
    profiles: state.profiles.map((p) => ({
      id: p.id,
      marketplace: p.marketplace,
      status: p.status,
      identity: p.identity || null,
      lastSeen: p.lastSeen || null,
      found: p.links?.length || 0,
      read: p.items?.length || 0,
    })),
    lastSuccessfulAction: state.lastSuccessfulAction || null,
  };
}
function guard(event) {
  if (
    event.sender !== mainWindow?.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame ||
    event.senderFrame.url !== uiUrl
  )
    throw new Error("Untrusted desktop request.");
}
function action(name, fn) {
  ipcMain.handle("client:" + name, async (event, ...args) => {
    guard(event);
    try {
      return { ok: true, ...(await fn(...args)) };
    } catch {
      state.error =
        "This step could not finish. Reopen the marketplace and try again. Your saved session has been kept.";
      state.errorCode = "ACTION_FAILED";
      save();
      return { ok: false, error: state.error };
    }
  });
}
function secureSession(ses) {
  ses.setPermissionRequestHandler((_w, _p, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.on("will-download", (e) => e.preventDefault());
}
async function persist(profile) {
  const runtime = profiles.get(profile.id);
  if (!runtime || profile.disconnected) return;
  const cookies = (await runtime.session.cookies.get({})).filter((c) =>
    cookieAllowed(c, profile.marketplace),
  );
  if (!profile.disconnected) vault.write(profile.key, { cookies });
}
async function openProfile(profile) {
  let runtime = profiles.get(profile.id);
  if (!runtime) {
    const ses = session.fromPartition("lane-memory-" + profile.key, { cache: false });
    secureSession(ses);
    const saved = vault.read(profile.key);
    for (const c of saved?.cookies || []) {
      if (
        !cookieAllowed(c, profile.marketplace) ||
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
    runtime = { session: ses, window: null, dirty: false };
    profiles.set(profile.id, runtime);
    ses.cookies.on("changed", () => {
      runtime.dirty = true;
    });
  }
  if (runtime.window && !runtime.window.isDestroyed()) {
    runtime.window.show();
    runtime.window.focus();
    return runtime.window;
  }
  const win = new BrowserWindow({
    width: 1160,
    height: 820,
    title: `Lane — ${MARKETPLACES[profile.marketplace].label}`,
    autoHideMenuBar: true,
    webPreferences: {
      session: runtime.session,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  runtime.window = win;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (!marketplaceUrl(url, profile.marketplace)) event.preventDefault();
  });
  win.webContents.on("will-redirect", (event, url) => {
    if (!marketplaceUrl(url, profile.marketplace)) event.preventDefault();
  });
  win.on("closed", () => {
    runtime.window = null;
    void persist(profile).catch(() => {
      state.errorCode = "SESSION_SAVE_FAILED";
    });
  });
  await win.loadURL(MARKETPLACES[profile.marketplace].listings);
  return win;
}
function getProfile(id) {
  const p = state.profiles.find((p) => p.id === id);
  if (!p) throw new Error("Account missing.");
  return p;
}
action("status", async () => publicState());
action("configure", async (origin) => {
  const next = laneOrigin(origin, !app.isPackaged);
  if (state.deviceToken && next !== state.origin)
    throw new Error("Disconnect this Lane device before changing websites.");
  state.origin = next;
  save();
  return publicState();
});
action("sign-in", async () => {
  if (state.deviceToken) throw new Error("Disconnect Lane before pairing again.");
  if (!state.origin) throw new Error("Set up Lane first.");
  if (pairingTimer) clearInterval(pairingTimer);
  const verifier = randomBytes(32).toString("base64url"),
    challenge = createHash("sha256").update(verifier).digest("hex");
  const start = await apiRequest("pair", { deviceId: state.deviceId, challenge });
  state.pairing = { id: start.id, code: start.code, expiresAt: Date.now() + 600000 };
  save();
  await shell.openExternal(
    state.origin +
      "/devices?pair=" +
      encodeURIComponent(start.id) +
      "&code=" +
      encodeURIComponent(start.code),
  );
  let busy = false;
  pairingTimer = setInterval(async () => {
    if (busy || state.pairing?.id !== start.id) return;
    if (Date.now() > state.pairing.expiresAt) {
      clearInterval(pairingTimer);
      state.pairing = null;
      save();
      return;
    }
    busy = true;
    try {
      const result = await apiRequest("exchange", { id: start.id, verifier });
      if (state.pairing?.id !== start.id) return;
      if (!result.pending) {
        if (state.userId && state.userId !== result.userId && state.profiles.length)
          throw new Error("Disconnect local marketplaces before changing Lane accounts.");
        state.userId = result.userId;
        state.serverDeviceId = result.deviceId;
        state.deviceToken = result.refreshToken;
        state.accessToken = result.accessToken;
        state.accessUntil = Date.now() + result.expiresIn * 1000;
        state.pairing = null;
        clearInterval(pairingTimer);
        save();
        await deviceHeartbeat();
      }
    } catch {
      if (state.pairing?.id !== start.id) return;
      state.errorCode = "PAIRING_RETRY_REQUIRED";
      clearInterval(pairingTimer);
      state.pairing = null;
      save();
    } finally {
      busy = false;
    }
  }, 3000);
  return {
    message: "Approve this device in your browser after checking the code.",
    ...publicState(),
  };
});
action("open-web", async () => {
  if (!state.origin) throw new Error("Set up Lane first.");
  await shell.openExternal(state.origin + "/inbox");
  return {};
});
action("unpair", async () => {
  if (state.deviceToken) await apiRequest("revoke", { refreshToken: state.deviceToken });
  if (pairingTimer) clearInterval(pairingTimer);
  state.pairing = null;
  state.deviceToken = null;
  state.accessToken = null;
  state.accessUntil = 0;
  state.serverDeviceId = null;
  state.bridgeHealth = "offline";
  save();
  return {
    message:
      "Lane access revoked. Local marketplace sessions are kept; disconnect each marketplace to remove them.",
    ...publicState(),
  };
});
action("connect", async (marketplace) => {
  if (!MARKETPLACES[marketplace]) throw new Error("Unsupported marketplace.");
  let profile = state.profiles.find((p) => p.marketplace === marketplace);
  if (!profile) {
    const id = randomUUID();
    profile = {
      id,
      marketplace,
      key: profileKey(state.deviceId, marketplace, id),
      status: "unknown",
      links: [],
      items: [],
    };
    state.profiles.push(profile);
    save();
  }
  await openProfile(profile);
  return publicState();
});
action("inspect", async (id) => {
  const profile = getProfile(id),
    win = await openProfile(profile);
  if (!marketplaceUrl(win.webContents.getURL(), profile.marketplace))
    throw new Error("Unsupported page.");
  const result = await win.webContents.executeJavaScript(readScript(profile.marketplace));
  profile.status =
    result.state === "challenge"
      ? "needs_attention"
      : result.state === "authenticated"
        ? "authenticated"
        : "needs_reauth";
  if (profile.identity !== result.identity || profile.status !== "authenticated") {
    profile.links = [];
    profile.items = [];
  }
  profile.identity = result.identity;
  if (result.ownPage && result.state === "authenticated") {
    profile.links = result.links;
    state.lastSuccessfulAction = "Read marketplace listings page";
  }
  profile.lastSeen = new Date().toISOString();
  await persist(profile);
  save();
  return publicState();
});
action("read", async (id) => {
  if (state.paused) throw new Error("Lane is paused.");
  const profile = getProfile(id);
  if (profile.status !== "authenticated" || !profile.links?.length)
    throw new Error("Read your own listings page first.");
  const win = await openProfile(profile);
  let readCount = 0;
  // Deliberately bounded visible browser assistance. No background crawl or write action.
  for (const listing of profile.links.slice(0, 2)) {
    if (!marketplaceUrl(listing.url, profile.marketplace)) continue;
    await win.loadURL(listing.url);
    const result = await win.webContents.executeJavaScript(readScript(profile.marketplace));
    if (result.state !== "authenticated") {
      profile.status = result.state === "challenge" ? "needs_attention" : "needs_reauth";
      break;
    }
    if (result.item?.remoteId === listing.remoteId) {
      profile.items = profile.items.filter((i) => i.remoteId !== listing.remoteId);
      profile.items.push(result.item);
      readCount++;
    }
  }
  if (readCount) state.lastSuccessfulAction = `Read ${readCount} owned listing pages locally`;
  await persist(profile);
  save();
  return {
    message: readCount
      ? `${readCount} pages read locally. Inventory import is not yet connected.`
      : "No listing details read. Check the signed-in page and try again.",
    ...publicState(),
  };
});
action("observations", async (id) => {
  const profile = getProfile(id);
  // Return listing data only, never the profile's encrypted session or Lane credentials.
  const fields = [
    "remoteId",
    "url",
    "title",
    "description",
    "priceGbp",
    "brand",
    "categoryName",
    "sizeLabel",
    "conditionLabel",
    "colour",
    "material",
    "status",
    "quantity",
  ];
  return {
    items: (profile.items || []).map((item) => ({
      ...Object.fromEntries(
        fields.map((field) => [
          field,
          typeof item[field] === "string" || typeof item[field] === "number" ? item[field] : null,
        ]),
      ),
      photoUrls: (item.photoUrls || []).filter((url) => typeof url === "string"),
      attributes: Object.fromEntries(
        Object.entries(item.attributes || {}).filter(([, value]) => typeof value === "string"),
      ),
    })),
  };
});
action("disconnect", async (id) => {
  const profile = getProfile(id),
    runtime = profiles.get(id);
  profile.disconnected = true;
  if (runtime) {
    runtime.window?.destroy();
    profiles.delete(id);
    await runtime.session.clearStorageData();
    await runtime.session.clearCache();
  }
  vault.remove(profile.key);
  state.profiles = state.profiles.filter((p) => p.id !== id);
  save();
  return publicState();
});
action("pause", async (value) => {
  state.paused = Boolean(value);
  save();
  return publicState();
});
action("startup", async (value) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(value) });
  return publicState();
});
action("diagnostics", async () => {
  clipboard.writeText(JSON.stringify(diagnostics(state, app.getVersion()), null, 2));
  return {
    message: "Diagnostics copied. No session values, account names or website addresses included.",
  };
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(() => {
    vault = createVault(path.join(app.getPath("userData"), "protected"), safeStorage);
    try {
      state = vault.read("settings") || { deviceId: randomUUID(), profiles: [], paused: false };
      state.pairing = null;
      state.bridgeHealth = "offline";
      for (const p of state.profiles) p.status = "unknown";
      save();
    } catch {
      require("electron").dialog.showErrorBox(
        "Lane protected storage unavailable",
        "Lane cannot safely unlock local session storage. No marketplace session was opened.",
      );
      app.quit();
      return;
    }
    mainWindow = new BrowserWindow({
      show: !qaSmoke,
      width: 1060,
      height: 790,
      minWidth: 760,
      minHeight: 600,
      title: "Lane Desktop",
      backgroundColor: "#f4f2ed",
      icon: path.join(__dirname, "assets", "lane.ico"),
      webPreferences: {
        preload: path.join(__dirname, "secure-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    Menu.setApplicationMenu(null);
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
    secureSession(mainWindow.webContents.session);
    mainWindow.loadFile(uiFile);
    if (qaSmoke)
      mainWindow.webContents.once("did-finish-load", () =>
        setTimeout(async () => {
          try {
            const checks = await mainWindow.webContents.executeJavaScript(
              `({title:document.title,cards:document.querySelectorAll('.shop').length,overflow:document.documentElement.scrollWidth>innerWidth})`,
            );
            if (checks.cards !== 2 || checks.overflow) throw new Error("UI smoke failed");
            require("node:fs").writeFileSync(
              path.resolve(__dirname, "../artifacts/desktop-ui.png"),
              (await mainWindow.webContents.capturePage()).toPNG(),
            );
            state.profiles.push({
              id: "qa-observation",
              items: [
                {
                  remoteId: "synthetic",
                  title: "<b>Fixture title</b>",
                  description: "Synthetic local review only.",
                  priceGbp: 12,
                  brand: "Fixture",
                  photoUrls: [],
                  attributes: { Size: "L" },
                  accessToken: "DO_NOT_EXPOSE",
                },
              ],
            });
            const review = await mainWindow.webContents.executeJavaScript(
              `(async()=>{await reviewItems('qa-observation');const d=document.querySelector('dialog');return {open:d.open,title:d.querySelector('h3').textContent,injected:d.querySelectorAll('b').length,unknown:d.innerText.includes('Unknown'),secret:d.innerText.includes('DO_NOT_EXPOSE'),overflow:d.scrollWidth>d.clientWidth};})()`,
            );
            if (
              !review.open ||
              review.title !== "<b>Fixture title</b>" ||
              review.injected ||
              !review.unknown ||
              review.secret ||
              review.overflow
            )
              throw new Error("Review smoke failed");
            require("node:fs").writeFileSync(
              path.resolve(__dirname, "../artifacts/desktop-review.png"),
              (await mainWindow.webContents.capturePage()).toPNG(),
            );
            state.profiles = state.profiles.filter((p) => p.id !== "qa-observation");
            console.log(
              "PASS: local review renders escaped listing fields, unknown values and no extra token fields.",
            );
            console.log(
              "PASS: desktop starts, both marketplace cards render, no horizontal overflow.",
            );
            app.quit();
          } catch {
            console.error("FAIL: desktop UI smoke");
            app.exit(1);
          }
        }, 1000),
      );
    setInterval(() => void deviceHeartbeat(), 30000).unref();
    setInterval(async () => {
      for (const profile of state.profiles) {
        const runtime = profiles.get(profile.id);
        if (runtime?.dirty) {
          runtime.dirty = false;
          try {
            await persist(profile);
          } catch {
            state.errorCode = "SESSION_SAVE_FAILED";
          }
        }
      }
    }, 2000).unref();
  });
  app.on("second-instance", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  app.on("before-quit", (event) => {
    if (quitting || !state) return;
    event.preventDefault();
    quitting = true;
    Promise.all(state.profiles.map((p) => persist(p)))
      .then(() => save())
      .catch(() => undefined)
      .finally(() => app.quit());
  });
  app.on("window-all-closed", () => app.quit());
}
