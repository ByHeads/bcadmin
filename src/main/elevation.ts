import { app } from 'electron'
import { execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { readFile, writeFile, unlink } from 'fs/promises'
import type { LaunchIntent } from '@shared/types'

const execFileAsync = promisify(execFileCb)

const INTENT_FILE = join(app.getPath('userData'), 'launch-intent.json')
const INTENT_MAX_AGE_MS = 60_000

/** True when `whoami /groups` output shows a High or System integrity token */
export function isElevatedToken(whoamiGroups: string): boolean {
  return /S-1-16-(12288|16384)(?!\d)/.test(whoamiGroups)
}

/** Validate a launch intent coming from the renderer or from disk */
export function parseLaunchIntent(value: unknown): LaunchIntent | null {
  if (typeof value !== 'object' || value === null) return null
  const { connectionId, route } = value as Record<string, unknown>
  if (typeof connectionId !== 'string' || connectionId.length === 0) return null
  if (typeof route !== 'string' || !/^\/[a-z/-]*$/.test(route)) return null
  return { connectionId, route }
}

/** Whether restarting as administrator is possible and would change anything */
export async function canElevate(): Promise<boolean> {
  // In dev the executable is the bare Electron binary, which cannot be relaunched on its own
  if (process.platform !== 'win32' || process.env['ELECTRON_RENDERER_URL']) return false
  try {
    const { stdout } = await execFileAsync('whoami', ['/groups'], { timeout: 5000, windowsHide: true })
    return !isElevatedToken(stdout)
  } catch {
    return false
  }
}

/**
 * Start an elevated copy of the app and quit this one.
 * Returns false when the user declines the UAC prompt.
 */
export async function relaunchElevated(intent: LaunchIntent | null): Promise<boolean> {
  if (!(await canElevate())) return false

  // Handed over through a file so nothing from the renderer ends up on a command line
  if (intent) {
    await writeFile(INTENT_FILE, JSON.stringify({ ...intent, createdAt: Date.now() }), 'utf-8')
  }

  const exePath = process.execPath.replace(/'/g, "''")
  try {
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `try { Start-Process -FilePath '${exePath}' -Verb RunAs -ErrorAction Stop } catch { exit 1 }`
      ],
      { windowsHide: true }
    )
  } catch {
    await unlink(INTENT_FILE).catch(() => {})
    return false
  }

  app.quit()
  return true
}

/** Read and remove the intent left by the instance that restarted as administrator */
export async function takeLaunchIntent(): Promise<LaunchIntent | null> {
  try {
    const raw = await readFile(INTENT_FILE, 'utf-8')
    await unlink(INTENT_FILE).catch(() => {})
    const data = JSON.parse(raw)
    const age = Date.now() - data?.createdAt
    if (!(age >= 0 && age <= INTENT_MAX_AGE_MS)) return null
    return parseLaunchIntent(data)
  } catch {
    return null
  }
}
