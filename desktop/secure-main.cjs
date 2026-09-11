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
const { createConnectionManager } = require("./connection-manager.cjs");
const { createSessionTransport } = require("./session-transport.cjs");
const { profileDiagnostics } = require("./session-diagnostics.cjs");
const diagnosticRun = process.argv.includes("--diagnostic-run") && !app.isPackaged;
if (diagnosticRun) app.setPath("userData", path.join(app.getPath("appData"), "Lane"));
let transport, connections;
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
        vinted:
          state.profiles.find((p) => p.marketplace === "vinted_uk")?.status === "CONNECTED"
            ? "authenticated"
            : "unknown",
        ebay:
          state.profiles.find((p) => p.marketplace === "ebay_uk")?.status === "CONNECTED"
            ? "authenticated"
            : "unknown",
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
    diagnosticRun,
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
      busy: connections?.busy(p.id) || false,
      operation: connections?.operation(p.id) || null,
      diagnostic: profileDiagnostics(p),
      connectionError: p.connectionError || null,
      lastSyncAt: p.lastSyncAt || null,
      validatedAt: p.validatedAt || null,
      listingCount: p.listingCount ?? null,
      syncMessage: p.syncMessage || null,
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
        {
          configure:
            "Enter the exact HTTPS address of your Lane website, without a page path. Disconnect Lane before changing a paired address.",
          "sign-in":
            "Lane sign-in could not start. Check the website address and connection, then retry. A staging website must exist before pairing.",
          unpair:
            "Lane access could not be revoked. Check your internet connection and retry, or revoke the device from the Lane website.",
        }[name] ||
        "This step could not finish. Check the connection message on the marketplace card and retry.";
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
  return transport?.persist(profile);
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
      status: "DISCONNECTED",
      connectionVersion: 2,
      links: [],
      items: [],
    };
    state.profiles.push(profile);
    save();
  }
  void connections.connect(profile);
  return {
    ...publicState(),
    message:
      "Complete sign-in in the marketplace window. Lane will validate the account and close the window automatically.",
  };
});
action("inspect", async (id) => {
  if (state.paused) return { error: "Lane is paused. Resume it to refresh listings." };
  if (connections.busy(id))
    return {
      error:
        "Finish the current " +
        connections.operation(id) +
        " operation first. No refresh was started.",
    };
  void connections.refresh(getProfile(id));
  return { ...publicState(), message: "Refreshing your account and listings in the background." };
});
action("read", async (id) => {
  if (state.paused) return { error: "Lane is paused. Resume it to read listings." };
  if (connections.busy(id))
    return {
      error:
        "Finish the current " +
        connections.operation(id) +
        " operation first. No detail read was started.",
    };
  void connections.read(getProfile(id));
  return { ...publicState(), message: "Reading up to two owned listing pages in the background." };
});
const probing = new Set();
action("probe", async (id) => {
  if (probing.has(id)) return { error: "Session probe is already running." };
  probing.add(id);
  try {
    return { probe: await transport.probe(getProfile(id), AbortSignal.timeout(30000)) };
  } finally {
    probing.delete(id);
  }
});
action("listing-links", async (id) => ({
  links: (getProfile(id).links || []).map((a) => ({
    remoteId: a.remoteId,
    url: a.url,
    title: a.title || null,
  })),
}));
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
  const profile = getProfile(id);
  await connections.disconnect(profile);
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
      for (const p of state.profiles) {
        if (p.connectionVersion !== 2) {
          p.identity = null;
          p.connectionVersion = 2;
        }
        p.status = "RECONNECT_REQUIRED";
        p.validatedAt = null;
      }
      save();
    } catch {
      require("electron").dialog.showErrorBox(
        "Lane protected storage unavailable",
        "Lane cannot safely unlock local session storage. No marketplace session was opened.",
      );
      app.quit();
      return;
    }
    transport = createSessionTransport({ vault, runtimes: profiles, changed: () => save() });
    connections = createConnectionManager(transport, {
      changed: (p) => {
        if (p.status === "CONNECTED")
          state.lastSuccessfulAction = p.lastSyncAt
            ? "Marketplace account validated and listings refreshed"
            : "Marketplace account validated";
        save();
      },
    });
    if (!qaSmoke && !state.paused)
      for (const p of state.profiles) if (p.identity) void connections.refresh(p);
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
    setInterval(() => {
      if (!state.paused)
        for (const p of state.profiles) if (p.status === "CONNECTED") void connections.refresh(p);
    }, 300000).unref();
    setInterval(async () => {
      for (const profile of state.profiles) {
        const runtime = profiles.get(profile.id);
        if (runtime?.dirty) {
          runtime.dirty = false;
          try {
            await persist(profile);
          } catch {
            state.errorCode = "SESSION_SAVE_FAILED";
            profile.diagnostic ||= {};
            Object.assign(profile.diagnostic, {
              lastErrorCode: "STORAGE",
              lastErrorCategory: "storage",
              lastErrorAt: new Date().toISOString(),
              stage: "SESSION_PERSIST_FAILED",
            });
            profile.status = "ERROR";
            profile.connectionError =
              "Session persistence failed. Lane could not save the refreshed session securely; reconnect after checking local storage.";
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
    Promise.resolve(connections?.stop())
      .then(() => Promise.all(state.profiles.map((p) => persist(p))))
      .then(() => save())
      .catch(() => undefined)
      .finally(() => app.quit());
  });
  app.on("window-all-closed", () => app.quit());
}
