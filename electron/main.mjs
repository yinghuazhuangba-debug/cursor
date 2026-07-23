import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDefaultDbPath } from './config.mjs'
import {
  closeDatabase,
  getDbInfo,
  getDbPath,
  initDatabase,
  loadState,
  resetDatabasePath,
  saveState,
  switchDatabase,
} from './db.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '鲜邻超市 · 销售管理',
    backgroundColor: '#eef4ef',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpc() {
  ipcMain.handle('ledger:getPath', () => getDbPath())
  ipcMain.handle('ledger:getInfo', () => getDbInfo())
  ipcMain.handle('ledger:load', () => loadState())
  ipcMain.handle('ledger:save', (_event, state) => {
    saveState(state)
    return true
  })
  ipcMain.handle('ledger:reveal', async () => {
    const file = getDbPath()
    if (file) shell.showItemInFolder(file)
    return file
  })

  ipcMain.handle('ledger:chooseSavePath', async () => {
    const result = await dialog.showSaveDialog(mainWindow ?? undefined, {
      title: '选择 ledger.db 保存位置',
      defaultPath: getDbPath() || getDefaultDbPath(),
      filters: [{ name: 'SQLite 数据库', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) return null
    const info = await switchDatabase(result.filePath, { mode: 'copy' })
    return { info, state: loadState() }
  })

  ipcMain.handle('ledger:chooseOpenPath', async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: '打开已有 ledger.db',
      defaultPath: path.dirname(getDbPath() || getDefaultDbPath()),
      properties: ['openFile'],
      filters: [{ name: 'SQLite 数据库', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePaths?.[0]) return null
    const info = await switchDatabase(result.filePaths[0], { mode: 'open' })
    return { info, state: loadState() }
  })

  ipcMain.handle('ledger:resetPath', async () => {
    const info = await resetDatabasePath()
    return { info, state: loadState() }
  })
}

app.whenReady().then(async () => {
  await initDatabase()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
