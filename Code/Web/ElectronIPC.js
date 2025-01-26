const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  _fabCallback: (content) => ipcRenderer.send('_fabCallback', content),
  hide: () => ipcRenderer.send('hide'),
  settings: () => ipcRenderer.send('settings'),
});

