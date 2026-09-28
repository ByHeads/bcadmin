import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { win32 } from 'path'

const execAsync = promisify(execCb)

interface WindowsProcess {
  name: string
  pid: string
  /** Empty when Windows hides the path from the current user */
  path: string
}

/** Parse `wmic ... /value` output into one record per instance */
function parseWmicValues(stdout: string): Record<string, string>[] {
  const records: Record<string, string>[] = []
  let current: Record<string, string> = {}
  for (const line of stdout.split(/[\r\n]+/)) {
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    // A repeated key means the next instance has started
    if (key in current) {
      records.push(current)
      current = {}
    }
    current[key] = line.slice(eq + 1).trim()
  }
  if (Object.keys(current).length > 0) records.push(current)
  return records
}

/** Broadcaster processes from a wmic process query, leaving out this app's own processes */
export function parseBroadcasterProcesses(stdout: string, ownExePath: string): WindowsProcess[] {
  const ownName = win32.basename(ownExePath).toLowerCase()
  return parseWmicValues(stdout)
    .map((r) => ({ name: r.Name ?? '', pid: r.ProcessId ?? '', path: r.ExecutablePath ?? '' }))
    .filter((p) => p.name.length > 0 && p.name.toLowerCase() !== ownName)
}

/** Executable path from a wmic service query: `"E:\bc\bin\Broadcaster.exe" "E:\bc"` → `E:\bc\bin\Broadcaster.exe` */
export function parseServiceExecutable(stdout: string): string | null {
  for (const record of parseWmicValues(stdout)) {
    const pathName = record.PathName ?? ''
    const match = pathName.match(/^"([^"]+)"/) ?? pathName.match(/^(.+?\.exe)(?=\s|$)/i)
    if (match) return match[1]
  }
  return null
}

/** Find the executable of the locally running Broadcaster on Windows */
export async function findWindowsBroadcasterExe(): Promise<string | null> {
  const { stdout } = await execAsync(
    'wmic process where "name like \'Broadcaster%\'" get ExecutablePath,Name,ProcessId /value',
    { timeout: 5000 }
  )
  const processes = parseBroadcasterProcesses(stdout, process.execPath)
  const visible = processes.find((p) => p.path.length > 0)
  if (visible) return visible.path

  // Windows hides the path of another account's process from non-elevated users.
  // A Broadcaster running as a service has its path in the service registration.
  for (const { pid } of processes) {
    if (!/^\d+$/.test(pid)) continue
    const { stdout: service } = await execAsync(
      `wmic service where "ProcessId=${pid}" get PathName /value`,
      { timeout: 5000 }
    )
    const exePath = parseServiceExecutable(service)
    if (exePath) return exePath
  }

  return null
}
