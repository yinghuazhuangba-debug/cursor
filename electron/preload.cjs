const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopLedger', {
  isDesktop: true,
  getPath: () => ipcRenderer.invoke('ledger:getPath'),
  load: () => ipcRenderer.invoke('ledger:load'),
  save: (state) => ipcRenderer.invoke('ledger:save', state),
  reveal: () => ipcRenderer.invoke('ledger:reveal'),
})
