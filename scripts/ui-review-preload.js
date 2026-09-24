const { contextBridge, ipcRenderer } = require('electron');
sessionStorage.setItem('kumakhSession', JSON.stringify({ isAuthenticated: true, sessionToken: 'local-ui-review', userId: 'user-admin', username: 'kcmtadmin', role: 'ADMIN', fullName: 'Administrator', permissions: [] }));
contextBridge.exposeInMainWorld('kumakhApp', {
  isElectron: true,
  readPage: name => ipcRenderer.invoke('review:page', name),
  apiRequest: (action, payload) => ipcRenderer.invoke('review:api', action, payload),
});
