import { useDateTimeStore } from '@/stores/datetime'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Extract a short timezone abbreviation (e.g. CET, CEST, EST, IST) for a date. */
function getTzAbbr(d: Date): string {
  // Intl gives good abbreviations for US timezones (EST, CST, PST, etc.)
  const intlTz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value
  if (intlTz && !/^GMT[+-]/.test(intlTz)) return intlTz

  // V8 Date.toString() includes the full name, e.g. "(Central European Standard Time)"
  const match = d.toString().match(/\(([^)]+)\)/)
  if (match) {
    const name = match[1]
    if (/^[A-Z]{2,5}$/.test(name)) return name
    const words = name.split(/\s+/)
    // European tz names use 3-letter base abbreviations: CET, EET, WET
    // "Central European Standard Time" → CET (drop "Standard")
    // "Central European Summer Time" → CEST (keep all)
    if (name.includes('European') && name.includes('Standard')) {
      return words.filter((w) => w !== 'Standard').map((w) => w[0]).join('')
    }
    return words.map((w) => w[0]).join('')
  }

  return intlTz ?? 'Local'
}

export function formatTimestamp(iso: string, utc?: boolean): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const useUtc = utc ?? useDateTimeStore.getState().utc
    if (useUtc) {
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`
    }
    const tz = getTzAbbr(d)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${tz}`
  } catch {
    return iso
  }
}
