const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptGen', {
  updateTrayProgress: (text) => ipcRenderer.send('tray-progress', text),
});
