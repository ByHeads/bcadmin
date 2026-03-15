import { ipcMain, dialog, app, nativeTheme, BrowserWindow } from 'electron'
import { dirname, join } from 'path'
import { readFile, writeFile, access } from 'fs/promises'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { hostname } from 'os'

const execAsync = promisify(execCb)
import { getCredential, setCredential, deleteCredential, isEncryptionAvailable } from './keychain'
import { getConnections, saveConnection, deleteConnection, reorderConnections } from './connections'
import type { SavedConnection } from '@shared/types'

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${name}: expected non-empty string`)
  }
}

function assertConnection(value: unknown): asserts value is SavedConnection {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as Record<string, unknown>).id !== 'string' ||
    typeof (value as Record<string, unknown>).name !== 'string' ||
    typeof (value as Record<string, unknown>).url !== 'string'
  ) {
    throw new Error('Invalid connection object')
  }
}

export function registerIpcHandlers(): void {
  // Keychain
  ipcMain.handle('keychain:isEncryptionAvailable', () => {
    return isEncryptionAvailable()
  })

  ipcMain.handle('keychain:get', (_event, connectionId: unknown) => {
    assertString(connectionId, 'connectionId')
    return getCredential(connectionId)
  })

  ipcMain.handle('keychain:set', (_event, connectionId: unknown, apiKey: unknown) => {
    assertString(connectionId, 'connectionId')
    assertString(apiKey, 'apiKey')
    return setCredential(connectionId, apiKey)
  })

  ipcMain.handle('keychain:delete', (_event, connectionId: unknown) => {
    assertString(connectionId, 'connectionId')
    return deleteCredential(connectionId)
  })

  // Connections
  ipcMain.handle('connections:list', () => {
    return getConnections()
  })

  ipcMain.handle('connections:save', (_event, connection: unknown) => {
    assertConnection(connection)
    return saveConnection(connection)
  })

  ipcMain.handle('connections:delete', (_event, connectionId: unknown) => {
    assertString(connectionId, 'connectionId')
    return deleteConnection(connectionId)
  })

  ipcMain.handle('connections:reorder', (_event, ids: unknown) => {
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
      throw new Error('Invalid ids: expected string array')
    }
    return reorderConnections(ids)
  })

  // Default browser
  ipcMain.handle('system:defaultBrowser', () => {
    return app.getApplicationNameForProtocol('https')
  })

  // Native theme (controls matchMedia for webviews)
  ipcMain.handle('nativeTheme:set', (_event, mode: unknown) => {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') {
      throw new Error('Invalid theme mode')
    }
    nativeTheme.themeSource = mode
  })

  // Window button visibility (macOS traffic lights)
  ipcMain.handle('window:setButtonVisibility', (event, visible: unknown) => {
    if (typeof visible !== 'boolean') throw new Error('Invalid visibility value')
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && process.platform === 'darwin') {
      win.setWindowButtonVisibility(visible)
    }
  })

  // Directory chooser dialog
  ipcMain.handle('dialog:openDirectory', async (_event, defaultPath?: string) => {
    const opts = {
      properties: ['openDirectory', 'createDirectory'] as const,
      defaultPath: typeof defaultPath === 'string' && defaultPath.length > 0 ? defaultPath : undefined,
    }
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  // JSON file read/write (for local appsettings.json editing)
  ipcMain.handle('file:readJson', async (_event, filePath: unknown) => {
    assertString(filePath, 'filePath')
    // Check existence first to avoid noisy ENOENT logs from Electron's IPC error handler
    try { await access(filePath) } catch { throw new Error(`File not found: ${filePath}`) }
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  })

  ipcMain.handle('file:writeJson', async (_event, filePath: unknown, data: unknown) => {
    assertString(filePath, 'filePath')
    if (typeof data !== 'object' || data === null) throw new Error('Invalid data: expected object')
    await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  })

  // Detect local Broadcaster by finding the running process and reading its appsettings.json
  ipcMain.handle('broadcaster:detectLocal', async () => {
    try {
      // Find the Broadcaster process and its executable path
      let appDir: string | null = null

      if (process.platform === 'win32') {
        // Query for Broadcaster process executable path via wmic
        const { stdout } = await execAsync(
          'wmic process where "name like \'Broadcaster%\'" get ExecutablePath /value',
          { timeout: 5000 }
        )
        const match = stdout.match(/ExecutablePath=(.+)/)
        if (match) appDir = dirname(match[1].trim())
      } else {
        // macOS/Linux: find Broadcaster in process list
        const { stdout } = await execAsync('ps -axo command', { timeout: 5000 })
        for (const line of stdout.split('\n')) {
          // Skip Electron app processes and shell noise
          if (/Administrator|Helper|grep|wmic/.test(line)) continue
          // Match dotnet hosting a Broadcaster DLL, or a direct Broadcaster executable
          const dllMatch = line.match(/(\/\S+Broadcaster\S+\.dll)/)
          if (dllMatch) { appDir = dirname(dllMatch[1]); break }
          const exeMatch = line.match(/(\/\S+Broadcaster\S+)/)
          if (exeMatch) { appDir = dirname(exeMatch[1]); break }
        }
      }

      if (!appDir) return null

      // Walk up from appDir to find appsettings.json or appsettings.Development.json
      const settingsNames = ['appsettings.json', 'appsettings.Development.json']
      let settingsDir: string | null = null
      let dir = appDir
      for (let i = 0; i < 5; i++) {
        for (const name of settingsNames) {
          try {
            await access(join(dir, name))
            settingsDir = dir
            break
          } catch { /* not found, keep looking */ }
        }
        if (settingsDir) break
        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
      }

      if (!settingsDir) { console.log('[bcadmin] No appsettings found walking up from', appDir); return null }

      for (const name of settingsNames) {
        try {
          const content = await readFile(join(settingsDir, name), 'utf-8')
          const settings = JSON.parse(content)
          const urls: string | undefined = settings.Urls
          if (!urls) continue

          const apiKeys: Array<{
            ApiKey?: string
            AllowAccess?: Array<{ Resources?: string[]; Methods?: string[] }>
          }> = settings.Authentication?.ApiKeys ?? []

          // Find most permissive key: prefer wildcard methods, then most resource patterns
          let bestKey = ''
          let bestScore = -1
          for (const entry of apiKeys) {
            if (!entry.ApiKey) continue
            let score = 0
            for (const ac of entry.AllowAccess ?? []) {
              const methodWeight = ac.Methods?.includes('*') ? 10 : (ac.Methods?.length ?? 0)
              score += (ac.Resources?.length ?? 0) * methodWeight
            }
            if (score > bestScore) {
              bestScore = score
              bestKey = entry.ApiKey
            }
          }

          if (!bestKey) continue

          // Resolve "http://*:8101" → "http://localhost:8101/api"
          // Urls may contain multiple bindings separated by ";" — take the first one
          const firstUrl = urls.split(';').map(s => s.trim()).find(s => s.length > 0) ?? urls
          const resolvedUrl = firstUrl.replace('*', 'localhost').replace(/\/$/, '') + '/api'
          const hostName = hostname().replace(/\.local$/, '')
          return { url: resolvedUrl, apiKey: bestKey, appDir: settingsDir, hostName }
        } catch {
          continue
        }
      }

      return null
    } catch {
      return null
    }
  })

  // File save
  ipcMain.handle(
    'file:saveToDownloads',
    async (_event, filename: unknown, content: unknown): Promise<string | null> => {
      assertString(filename, 'filename')
      if (typeof content !== 'string') throw new Error('Invalid content: expected string')
      const downloadsPath = app.getPath('downloads')
      const filePath = join(downloadsPath, filename)
      const { canceled, filePath: chosenPath } = await dialog.showSaveDialog({
        defaultPath: filePath,
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })
      if (canceled || !chosenPath) return null
      await writeFile(chosenPath, content, 'utf-8')
      return chosenPath
    }
  )
}
