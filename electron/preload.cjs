const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopLedger', {
  isDesktop: true,
  getPath: () => ipcRenderer.invoke('ledger:getPath'),
  getInfo: () => ipcRenderer.invoke('ledger:getInfo'),
  load: () => ipcRenderer.invoke('ledger:load'),
  save: (state) => ipcRenderer.invoke('ledger:save', state),
  reveal: () => ipcRenderer.invoke('ledger:reveal'),
  chooseSavePath: () => ipcRenderer.invoke('ledger:chooseSavePath'),
  chooseOpenPath: () => ipcRenderer.invoke('ledger:chooseOpenPath'),
  resetPath: () => ipcRenderer.invoke('ledger:resetPath'),
})
