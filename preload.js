const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  onToggleRegions: (cb) => ipcRenderer.on("toggle-regions", cb),
});