const { app, BrowserWindow, ipcMain, session, Menu, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const CHANNELS = require("./channels.cjs");

const APP_URL = process.env.LANE_APP_URL || "https://github.com/Bleuszz/lane";
const STATE_DIR = path.join(app.getPath("userData"), "state");
const STATE_FILE = path.join(STATE_DIR, "lane.json");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { wizardDone: false, theme: "system", pairingToken: "", appUrl: APP_URL };
  }
}

function saveState(partial) {
  const next = { ...loadState(), ...partial };
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}

function createWizard() {
  const win = new BrowserWindow({
    width: 560,
    height: 640,
    title: "Lane setup",
    backgroundColor: "#f2efe8",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "wizard", "index.html"));
  return win;
}

function createMain(state) {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    title: "Lane",
    backgroundColor: state.theme === "dark" ? "#161411" : "#f2efe8",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const url = state.appUrl || APP_URL;
  win.loadURL(url);
  const template = [
    { label: "File", submenu: [{ role: "reload" }, { role: "quit" }] },
    {
      label: "Connect",
      submenu: Object.values(CHANNELS).map((ch) => ({
        label: ch.label,
        click: () => openConnect(ch.id),
      })),
    },
    {
      label: "View",
      submenu: [
        {
          label: "Dark mode",
          type: "checkbox",
          checked: state.theme === "dark",
          click: (item) => {
            const theme = item.checked ? "dark" : "light";
            saveState({ theme });
            win.webContents.send("lane-theme", theme);
          },
        },
        { type: "separator" },
        { role: "toggleDevTools" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "How connect works",
          click: () => shell.openExternal("https://github.com/Bleuszz/lane/blob/main/desktop/README-INSTALL.txt"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  return win;
}

async function openConnect(marketplace) {
  const ch = CHANNELS[marketplace];
  if (!ch) return { ok: false, error: "Unknown marketplace" };
  const state = loadState();

  if (ch.mode === "oauth") {
    const start = `${state.appUrl.replace(/\/$/, "")}/api/${marketplace === "ebay_uk" ? "ebay/start" : "oauth/" + marketplace}`;
    await shell.openExternal(start);
    return { ok: true, mode: "oauth" };
  }

  const partition = `persist:lane-${ch.id}`;
  const ses = session.fromPartition(partition);
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    title: `Connect ${ch.label}`,
    backgroundColor: "#f2efe8",
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await win.loadURL(ch.startUrl || ch.origin);

  return await new Promise((resolve) => {
    let settled = false;
    const finish = async (reason) => {
      if (settled) return;
      settled = true;
      try {
        const cookies = await ses.cookies.get({ url: ch.origin });
        const names = cookies.map((c) => c.name);
        const refresh =
          cookies.find((c) => c.name === "refresh_token_web")?.value ||
          cookies.find((c) => /refresh/i.test(c.name))?.value ||
          "";
        const access =
          cookies.find((c) => c.name === "access_token_web")?.value ||
          cookies.find((c) => /access_token/i.test(c.name))?.value ||
          "";
        if (state.pairingToken && refresh) {
          await fetch(`${state.appUrl.replace(/\/$/, "")}/api/bridge/session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${state.pairingToken}`,
            },
            body: JSON.stringify({
              marketplace: ch.id,
              refreshToken: refresh,
              accessToken: access || undefined,
              cookieNames: names,
            }),
          }).catch(() => null);
        }
        resolve({ ok: true, mode: "session", reason, cookieCount: cookies.length });
      } catch (err) {
        resolve({ ok: false, error: err instanceof Error ? err.message : "connect failed" });
      } finally {
        if (!win.isDestroyed()) win.close();
      }
    };

    const tick = async () => {
      if (win.isDestroyed() || settled) return;
      const url = win.webContents.getURL();
      const cookies = await ses.cookies.get({ url: ch.origin }).catch(() => []);
      const names = cookies.map((c) => c.name);
      if (typeof ch.signedInWhen === "function" && ch.signedInWhen(url, names)) {
        await finish("signed-in");
      }
    };
    const timer = setInterval(tick, 1500);
    win.on("closed", () => {
      clearInterval(timer);
      if (!settled) resolve({ ok: false, error: "window closed" });
    });
  });
}

ipcMain.handle("lane:connect", (_e, marketplace) => openConnect(String(marketplace)));
ipcMain.handle("lane:theme", () => loadState().theme);
ipcMain.handle("lane:set-theme", (_e, theme) => saveState({ theme: String(theme) }).theme);
ipcMain.handle("lane:app-url", () => loadState().appUrl);
ipcMain.handle("lane:finish-wizard", (event, payload) => {
  const state = saveState({
    wizardDone: true,
    appUrl: payload?.appUrl || APP_URL,
    openAtLogin: Boolean(payload?.openAtLogin),
  });
  if (payload?.openAtLogin) app.setLoginItemSettings({ openAtLogin: true });
  const from = BrowserWindow.fromWebContents(event.sender);
  createMain(state);
  if (from && !from.isDestroyed()) from.close();
  return { ok: true };
});

app.whenReady().then(() => {
  const state = loadState();
  if (!state.wizardDone) createWizard();
  else createMain(state);
});

app.on("window-all-closed", () => app.quit());
