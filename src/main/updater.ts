import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'

export function initAutoUpdater(initialWindow: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (msg: string) => console.log('[updater]', msg),
    warn: (msg: string) => console.warn('[updater]', msg),
    error: (msg: string) => console.error('[updater]', msg),
    debug: (msg: string) => console.log('[updater:debug]', msg),
  }

  console.log(`[updater] App version: ${app.getVersion()}, packaged: ${app.isPackaged}`)

  // Track whether the check was user-initiated (menu click)
  let userInitiated = false

  // Check for updates after a short delay
  setTimeout(() => {
    console.log('[updater] Initial update check...')
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] Initial check failed:', err?.message ?? err)
    })
  }, 5000)

  // Check every 30 minutes
  const intervalId = setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[updater] Periodic check failed:', err?.message ?? err)
      })
    },
    30 * 60 * 1000
  )

  app.on('before-quit', () => clearInterval(intervalId))

  function sendToWindow(channel: string, ...args: unknown[]): void {
    const win =
      BrowserWindow.getFocusedWindow() ??
      (!initialWindow.isDestroyed() ? initialWindow : BrowserWindow.getAllWindows()[0])
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update available: ${info.version}`)
    sendToWindow('update-available', info)
    if (userInitiated) {
      userInitiated = false
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available`,
        detail: 'The update is being downloaded in the background. You will be notified when it is ready to install.',
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log(`[updater] No update available (latest: ${info.version}, current: ${app.getVersion()})`)
    if (userInitiated) {
      userInitiated = false
      dialog.showMessageBox({
        type: 'info',
        title: 'No Updates',
        message: 'You are running the latest version',
        detail: `Current version: ${app.getVersion()}`,
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] Update downloaded: ${info.version}`)
    sendToWindow('update-downloaded', info)
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded`,
      detail: 'The update will be installed when you restart the application. Restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err?.message ?? err)
    if (userInitiated) {
      userInitiated = false
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Error',
        message: 'Failed to check for updates',
        detail: err?.message ?? String(err),
        buttons: ['OK'],
      })
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] Download: ${Math.round(progress.percent)}%`)
  })

  ipcMain.handle('check-for-updates', async () => {
    console.log('[updater] Manual update check triggered')
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

  // Trigger a user-initiated check (with dialog feedback)
  function checkForUpdatesFromMenu(): void {
    userInitiated = true
    console.log('[updater] Menu: Check for Updates clicked')
    autoUpdater.checkForUpdates().catch((err) => {
      userInitiated = false
      console.error('[updater] Menu check failed:', err?.message ?? err)
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Error',
        message: 'Failed to check for updates',
        detail: err?.message ?? String(err),
        buttons: ['OK'],
      })
    })
  }

  // Add "Check for Updates" to the application menu
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { label: 'Check for Updates...', click: checkForUpdatesFromMenu },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ]
        }]
      : []),
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const },
    ...(!process.platform || process.platform !== 'darwin'
      ? [{
          label: 'Help',
          submenu: [
            { label: 'Check for Updates...', click: checkForUpdatesFromMenu },
          ]
        }]
      : []),
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
