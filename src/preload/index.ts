import { contextBridge, ipcRenderer } from 'electron'
import type { SavedConnection } from '@shared/types'

const api = {
  // Platform info
  platform: process.platform,
  seasonOverride: process.env['BCADMIN_SEASON'] ?? null,

  // Credential management
  isEncryptionAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke('keychain:isEncryptionAvailable'),
  getCredential: (connectionId: string): Promise<string | null> =>
    ipcRenderer.invoke('keychain:get', connectionId),
  setCredential: (connectionId: string, apiKey: string): Promise<void> =>
    ipcRenderer.invoke('keychain:set', connectionId, apiKey),
  deleteCredential: (connectionId: string): Promise<void> =>
    ipcRenderer.invoke('keychain:delete', connectionId),

  // Connection persistence
  getConnections: (): Promise<SavedConnection[]> => ipcRenderer.invoke('connections:list'),
  saveConnection: (connection: SavedConnection): Promise<void> =>
    ipcRenderer.invoke('connections:save', connection),
  deleteConnection: (connectionId: string): Promise<void> =>
    ipcRenderer.invoke('connections:delete', connectionId),
  reorderConnections: (ids: string[]): Promise<void> =>
    ipcRenderer.invoke('connections:reorder', ids),

  // Auto-update
  checkForUpdates: (): Promise<unknown> => ipcRenderer.invoke('check-for-updates'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown): void => callback(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateDownloaded: (callback: (info: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown): void => callback(info)
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },

  // System info
  getDefaultBrowser: (): Promise<string> => ipcRenderer.invoke('system:defaultBrowser'),
  setNativeTheme: (mode: 'light' | 'dark' | 'system'): Promise<void> =>
    ipcRenderer.invoke('nativeTheme:set', mode),
  setWindowButtonVisibility: (visible: boolean): Promise<void> =>
    ipcRenderer.invoke('window:setButtonVisibility', visible),

  // Local Broadcaster detection
  detectLocalBroadcaster: (): Promise<{ url: string; apiKey: string; appDir: string; hostName: string } | null> =>
    ipcRenderer.invoke('broadcaster:detectLocal'),

  // Directory chooser
  chooseDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openDirectory', defaultPath),

  // JSON file read/write
  readJsonFile: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('file:readJson', filePath),
  writeJsonFile: (filePath: string, data: unknown): Promise<void> =>
    ipcRenderer.invoke('file:writeJson', filePath, data),

  // File save
  saveToDownloads: (filename: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('file:saveToDownloads', filename, content)
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
