const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("laneClient", {
  status: () => ipcRenderer.invoke("client:status"),
  configure: (origin) => ipcRenderer.invoke("client:configure", origin),
  signIn: () => ipcRenderer.invoke("client:sign-in"),
  unpair: () => ipcRenderer.invoke("client:unpair"),
  connect: (marketplace) => ipcRenderer.invoke("client:connect", marketplace),
  inspect: (id) => ipcRenderer.invoke("client:inspect", id),
  read: (id) => ipcRenderer.invoke("client:read", id),
  observations: (id) => ipcRenderer.invoke("client:observations", id),
  disconnect: (id) => ipcRenderer.invoke("client:disconnect", id),
  pause: (value) => ipcRenderer.invoke("client:pause", value),
  startup: (value) => ipcRenderer.invoke("client:startup", value),
  diagnostics: () => ipcRenderer.invoke("client:diagnostics"),
  openWeb: () => ipcRenderer.invoke("client:open-web"),
});
