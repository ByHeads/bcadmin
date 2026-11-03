import { exec as execCb, execFile as execFileCb } from 'child_process'
import { promisify } from 'util'
import { win32 } from 'path'

const execAsync = promisify(execCb)
const execFileAsync = promisify(execFileCb)

interface WindowsProcess {
  name: string
  pid: string
  /** Empty when Windows hides the path from the current user */
  path: string
}

interface WindowsService {
  pid: string
  pathName: string
}

/**
 * PowerShell script listing Broadcaster processes and the services they run as.
 * Win32_Process hides ExecutablePath of another account's process from non-elevated
 * users, but Win32_Service.PathName is readable by everyone.
 */
export const POWERSHELL_QUERY = [
  // Non-ASCII paths would otherwise come out in the console code page, which Node decodes as UTF-8
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  "$p = @(Get-CimInstance Win32_Process -Filter \"Name LIKE 'Broadcaster%'\" | Select-Object Name, ProcessId, ExecutablePath)",
  '$ids = @($p | ForEach-Object { $_.ProcessId })',
  '$s = @(Get-CimInstance Win32_Service | Where-Object { $ids -contains $_.ProcessId } | Select-Object ProcessId, PathName)',
  '[pscustomobject]@{ processes = $p; services = $s } | ConvertTo-Json -Compress -Depth 3'
].join('; ')

/** The wmic queries kept as a fallback for machines where PowerShell is blocked */
export const WMIC_PROCESS_QUERY =
  'wmic process where "name like \'Broadcaster%\'" get ExecutablePath,Name,ProcessId /value'
export const wmicServiceQuery = (pid: string): string =>
  `wmic service where "ProcessId=${pid}" get PathName /value`

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

/** Leave out this app's own processes, which also match `Broadcaster%` */
function excludeOwn(processes: WindowsProcess[], ownExePath: string): WindowsProcess[] {
  const ownName = win32.basename(ownExePath).toLowerCase()
  return processes.filter((p) => p.name.length > 0 && p.name.toLowerCase() !== ownName)
}

/** Broadcaster processes from a wmic process query, leaving out this app's own processes */
export function parseBroadcasterProcesses(stdout: string, ownExePath: string): WindowsProcess[] {
  const processes = parseWmicValues(stdout).map((r) => ({
    name: r.Name ?? '',
    pid: r.ProcessId ?? '',
    path: r.ExecutablePath ?? ''
  }))
  return excludeOwn(processes, ownExePath)
}

/** Executable from a service PathName: `"E:\bc\bin\Broadcaster.exe" "E:\bc"` → `E:\bc\bin\Broadcaster.exe` */
export function parseServicePathName(pathName: string): string | null {
  const match = pathName.match(/^"([^"]+)"/) ?? pathName.match(/^(.+?\.exe)(?=\s|$)/i)
  return match ? match[1] : null
}

/** Executable path from a wmic service query */
export function parseServiceExecutable(stdout: string): string | null {
  for (const record of parseWmicValues(stdout)) {
    const exePath = parseServicePathName(record.PathName ?? '')
    if (exePath) return exePath
  }
  return null
}

const asString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim()

/** Processes and services from the PowerShell query's JSON output */
export function parsePowerShellOutput(
  stdout: string,
  ownExePath: string
): { processes: WindowsProcess[]; services: WindowsService[] } {
  const start = stdout.indexOf('{')
  if (start < 0) throw new Error('PowerShell query returned no JSON')
  const parsed = JSON.parse(stdout.slice(start)) as {
    processes?: unknown
    services?: unknown
  }
  const asArray = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value : value && typeof value === 'object' ? [value as Record<string, unknown>] : []
  const processes = asArray(parsed.processes).map((r) => ({
    name: asString(r.Name),
    pid: asString(r.ProcessId),
    path: asString(r.ExecutablePath)
  }))
  const services = asArray(parsed.services).map((r) => ({
    pid: asString(r.ProcessId),
    pathName: asString(r.PathName)
  }))
  return { processes: excludeOwn(processes, ownExePath), services }
}

/** Pick the executable of a Broadcaster process, falling back to its service registration */
function pickExecutable(processes: WindowsProcess[], services: WindowsService[]): string | null {
  const visible = processes.find((p) => p.path.length > 0)
  if (visible) return visible.path
  for (const { pid } of processes) {
    const service = services.find((s) => s.pid === pid)
    const exePath = service ? parseServicePathName(service.pathName) : null
    if (exePath) return exePath
  }
  return null
}

async function findWithPowerShell(): Promise<string | null> {
  // -EncodedCommand sidesteps the quoting rules of cmd.exe and powershell.exe
  const encoded = Buffer.from(POWERSHELL_QUERY, 'utf16le').toString('base64')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { timeout: 15000, windowsHide: true }
  )
  const { processes, services } = parsePowerShellOutput(stdout, process.execPath)
  return pickExecutable(processes, services)
}

/** wmic is gone from Windows 11 24H2 onwards, so this only serves older machines */
async function findWithWmic(): Promise<string | null> {
  const { stdout } = await execAsync(WMIC_PROCESS_QUERY, { timeout: 5000 })
  const processes = parseBroadcasterProcesses(stdout, process.execPath)
  const visible = processes.find((p) => p.path.length > 0)
  if (visible) return visible.path

  // Windows hides the path of another account's process from non-elevated users.
  // A Broadcaster running as a service has its path in the service registration.
  for (const { pid } of processes) {
    if (!/^\d+$/.test(pid)) continue
    const { stdout: service } = await execAsync(wmicServiceQuery(pid), { timeout: 5000 })
    const exePath = parseServiceExecutable(service)
    if (exePath) return exePath
  }
  return null
}

/** Find the executable of the locally running Broadcaster on Windows */
export async function findWindowsBroadcasterExe(): Promise<string | null> {
  try {
    return await findWithPowerShell()
  } catch (err) {
    console.warn('[bcadmin] PowerShell process query failed, trying wmic:', err)
  }
  try {
    return await findWithWmic()
  } catch (err) {
    console.warn('[bcadmin] wmic process query failed:', err)
    return null
  }
}
