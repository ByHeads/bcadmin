import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initAutoUpdater } from './updater'
import { registerIpcHandlers } from './ipc'

app.name = 'Broadcaster Administrator'

// Renaming the Electron binary for dock name causes app.isPackaged to return true
// in dev, so we use ELECTRON_RENDERER_URL (set by electron-vite) to detect dev mode.
const isDev = !!process.env['ELECTRON_RENDERER_URL']

function getIconPath(): string {
  return isDev
    ? join(__dirname, '../../build/icon.png')
    : join(process.resourcesPath, 'icon.png')
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'customButtonsOnHover' : 'default',
    backgroundColor: '#ffffff',
    icon: getIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: !isDev
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      }
    } catch {
      // Invalid URL — ignore
    }
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = getIconPath()
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      console.error(`[bcadmin] Failed to load dock icon from: ${iconPath}`)
    } else {
      console.log(`[bcadmin] Setting dock icon (${icon.getSize().width}x${icon.getSize().height}) from: ${iconPath}`)
      app.dock.setIcon(icon)
    }
  }
  registerIpcHandlers()
  const mainWindow = createWindow()
  if (!isDev) initAutoUpdater(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
