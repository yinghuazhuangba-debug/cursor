import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const SETTINGS_FILE = 'settings.json'

function settingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

/**
 * @returns {{ dbPath?: string }}
 */
export function readSettings() {
  try {
    const file = settingsPath()
    if (!fs.existsSync(file)) return {}
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * @param {{ dbPath?: string | null }} patch
 */
export function writeSettings(patch) {
  const current = readSettings()
  const next = { ...current, ...patch }
  if (patch.dbPath === null) delete next.dbPath
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function getDefaultDbPath() {
  return path.join(app.getPath('userData'), 'ledger.db')
}

export function getConfiguredDbPath() {
  const settings = readSettings()
  if (settings.dbPath && typeof settings.dbPath === 'string') {
    return settings.dbPath
  }
  return getDefaultDbPath()
}
