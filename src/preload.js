const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bunchoAPI", {
  closeOverlay: () => ipcRenderer.invoke("overlay:close-request"),
  getSettingsData: () => ipcRenderer.invoke("settings:get-data"),
  onBreakFinished: (callback) => {
    ipcRenderer.on("break:finished", (_event, payload) => callback(payload));
  },
  onBreakPayload: (callback) => {
    ipcRenderer.on("break:payload", (_event, payload) => callback(payload));
  },
  onSettingsUpdated: (callback) => {
    ipcRenderer.on("settings:updated", (_event, payload) => callback(payload));
  },
  onTimerState: (callback) => {
    ipcRenderer.on("timer:state", (_event, payload) => callback(payload));
  },
  pauseTimer: () => ipcRenderer.invoke("timer:pause"),
  resetTimer: () => ipcRenderer.invoke("timer:reset"),
  resumeTimer: () => ipcRenderer.invoke("timer:resume"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  showBreakNow: () => ipcRenderer.invoke("timer:show-now"),
  skipNextBreak: () => ipcRenderer.invoke("timer:skip")
});
