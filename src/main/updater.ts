import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow, ipcMain } from 'electron'

export function initAutoUpdater(initialWindow: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Silently fail — unsigned local builds won't receive auto-updates
    })
  }, 5000)

  // Check every 30 minutes
  const intervalId = setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {})
    },
    30 * 60 * 1000
  )

  // Clean up interval when app is quitting
  app.on('before-quit', () => clearInterval(intervalId))

  function sendToWindow(channel: string, ...args: unknown[]): void {
    const win =
      BrowserWindow.getFocusedWindow() ??
      (!initialWindow.isDestroyed() ? initialWindow : BrowserWindow.getAllWindows()[0])
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  autoUpdater.on('update-available', (info) => {
    sendToWindow('update-available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendToWindow('update-downloaded', info)
  })

  ipcMain.handle('check-for-updates', async () => {
    const result = await autoUpdater.checkForUpdates()
    if (!result) return null
    return {
      updateInfo: result.updateInfo,
      isUpdateAvailable: result.updateInfo.version !== app.getVersion()
    }
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })
}
