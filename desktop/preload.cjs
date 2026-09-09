const { contextBridge, ipcRenderer } = require("electron");

const api = {
  isDesktop: true,
  connect: (marketplace, opts) => ipcRenderer.invoke("lane:connect", marketplace, opts || {}),
  setPairing: (token, origin) => ipcRenderer.invoke("lane:set-pairing", token, origin),
  setAppUrl: (url) => ipcRenderer.invoke("lane:set-app-url", url),
  config: () => ipcRenderer.invoke("lane:config"),
};

contextBridge.exposeInMainWorld("lane", api);
contextBridge.exposeInMainWorld("laneDesktop", api);
