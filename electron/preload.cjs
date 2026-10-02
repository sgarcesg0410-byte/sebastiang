const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  print: (options) => ipcRenderer.invoke('app:print', options),
  sendNotification: (title, body) => ipcRenderer.invoke('app:notification', { title, body }),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url)
});
