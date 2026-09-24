const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kumakhApp", {
  appName: "Kumakh College Management System",
  getVersion: async () => (await ipcRenderer.invoke('kumakh:update-state')).currentVersion,
  getUpdateState: () => ipcRenderer.invoke('kumakh:update-state'),
  checkForUpdates: () => ipcRenderer.invoke('kumakh:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('kumakh:update-download'),
  installUpdate: () => ipcRenderer.invoke('kumakh:update-install'),
  onUpdateState: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('A callback is required');
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('kumakh:update-state', listener);
    return () => ipcRenderer.removeListener('kumakh:update-state', listener);
  },
  platform: process.platform,
  isElectron: true,
  setupStatus: () => ipcRenderer.invoke('kumakh:setup-status'),
  runInitialImport: (credentials) => ipcRenderer.invoke('kumakh:initial-import', credentials),
  continueToLogin: () => ipcRenderer.invoke('kumakh:setup-continue'),
  exitSetup: () => ipcRenderer.invoke('kumakh:setup-exit'),
  onSetupProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('kumakh:setup-progress', listener);
    return () => ipcRenderer.removeListener('kumakh:setup-progress', listener);
  },
  readPage: (pageFileName) =>
    ipcRenderer.invoke("kumakh:read-page", pageFileName),
  createPurchaseBillPdf: (documentHtml) =>
    ipcRenderer.invoke("kumakh:purchase-bill-pdf", documentHtml),
  apiRequest: (action, payload) =>
    ipcRenderer.invoke("kumakh:api-request", action, payload),
  getSyncStatus: () => ipcRenderer.invoke("kumakh:sync-status"),
  onReportProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('kumakh:report-progress', listener);
    return () => ipcRenderer.removeListener('kumakh:report-progress', listener);
  },
  getEnvironment: () => ({
    mode: process.env.NODE_ENV || "development",
    isSecure: true,
  }),
});

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.textContent = text;
  };

  ipcRenderer.invoke('kumakh:update-state').then(state => replaceText('appVersion', `v${state.currentVersion}`)).catch(() => {});
});
