const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  sendSettings: (content) => ipcRenderer.send('sendSettings', content),
});

