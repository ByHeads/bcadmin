import { formatTimestamp } from '@/lib/utils'

export function formatDateTimeDisplay(dt: string): string {
  if (!dt) return '—'
  return formatTimestamp(dt)
}

/**
 * Parse a user-entered date-time value into an ISO string for the API.
 * @param input - The raw value from a datetime-local input or text field
 * @param inputIsUtc - If true, interpret the value as UTC; otherwise as local time
 */
export function parseDateTimeInput(input: string, inputIsUtc?: boolean): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return new Date().toISOString()
  }
  if (trimmed.startsWith('+')) {
    const match = trimmed.match(/^\+(\d{1,2}):(\d{2})$/)
    if (match) {
      const hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const future = new Date(Date.now() + (hours * 60 + minutes) * 60_000)
      return future.toISOString()
    }
  }
  if (inputIsUtc) {
    // datetime-local gives "YYYY-MM-DDTHH:MM" — treat as UTC by appending Z
    const d = new Date(trimmed + 'Z')
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  // Try as local time
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString()
  // Pass through as-is and let the API handle it
  return trimmed
}

export function extractTicksFromDateTime(dt: string): string | null {
  // .NET DateTime is often returned as "/Date(ticks)/" or ISO string
  // For ISO strings, compute ticks from epoch
  if (!dt) return null
  try {
    const d = new Date(dt)
    if (isNaN(d.getTime())) return null
    // .NET ticks = (unix ms + epoch offset) * 10000
    // Epoch offset: ticks from 0001-01-01 to 1970-01-01 = 621355968000000000
    const NET_EPOCH_OFFSET = 621355968000000000n
    const ticks = BigInt(d.getTime()) * 10000n + NET_EPOCH_OFFSET
    return ticks.toString()
  } catch {
    return null
  }
}

export function parseVersion(v: string): { major: string; minor: string; build: string; revision: string } | null {
  const parts = v.split('.')
  if (parts.length < 2) return null
  return {
    major: parts[0] ?? '0',
    minor: parts[1] ?? '0',
    build: parts[2] ?? '0',
    revision: parts[3] ?? '0'
  }
}

export function buildVersionConditions(version: string): string {
  const parsed = parseVersion(version)
  if (!parsed) return `Version=${version}`
  return `version.major=${parsed.major}&version.minor=${parsed.minor}&version.build=${parsed.build}&version.revision=${parsed.revision}`
}

/**
 * Validate retail version format: XX.X to XX.XXX or XX.X.XXXX.N+ format.
 * Users can bypass validation with @ prefix.
 */
export function isValidRetailVersion(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  // @ prefix bypasses validation
  if (trimmed.startsWith('@')) return true
  // XX.X to XX.XXX format (e.g. "23.1", "23.123")
  if (/^\d{2}\.\d{1,3}$/.test(trimmed)) return true
  // XX.X.XXXX.N+ format (e.g. "23.1.1234.1")
  if (/^\d{2}\.\d{1,3}\.\d{1,4}\.\d+$/.test(trimmed)) return true
  return false
}
