const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("laneDesktop", {
  isDesktop: true,
  version: "0.1.0",
  connect: (marketplace) => ipcRenderer.invoke("lane:connect", marketplace),
  theme: () => ipcRenderer.invoke("lane:theme"),
  setTheme: (theme) => ipcRenderer.invoke("lane:set-theme", theme),
  appUrl: () => ipcRenderer.invoke("lane:app-url"),
  finishWizard: (payload) => ipcRenderer.invoke("lane:finish-wizard", payload),
});
