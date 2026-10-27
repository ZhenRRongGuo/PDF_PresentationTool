const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isElectron: true,
  version: process.versions.electron,
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  toggleFullscreen: () => ipcRenderer.send('toggle-presentation-fullscreen'),
  closePresentation: () => ipcRenderer.send('close-presentation-window'),
});
