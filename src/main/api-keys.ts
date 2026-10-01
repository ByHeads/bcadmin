import bcResources from '@shared/bc-resources.json'

interface AllowAccess {
  Resources?: string[]
  Methods?: string[]
}

export interface ApiKeyEntry {
  ApiKey?: string
  AllowAccess?: AllowAccess[]
}

interface Resource {
  name: string
  dots: number
  methods: string[]
}

const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'REPORT', 'HEAD']

const countDots = (s: string): number => s.split('.').length - 1

const RESOURCES: Resource[] = bcResources.resources.map((r) => ({
  name: r.name.toLowerCase(),
  dots: countDots(r.name),
  methods: r.methods
}))

/** Resources matched by one entry in `Resources`, following RESTable's SafeFindResources */
function findResources(pattern: string): Resource[] {
  const search = pattern.toLowerCase()
  const asterisks = search.split('*').length - 1
  if (asterisks === 0) return RESOURCES.filter((r) => r.name === search)
  // RESTable only accepts a single asterisk, as the last character
  if (asterisks > 1 || !search.endsWith('*')) return []
  // The asterisk covers one namespace level: "Broadcaster.*" does not match "Broadcaster.Admin.Config"
  const prefix = search.slice(0, -1)
  const dots = countDots(prefix)
  return RESOURCES.filter((r) => r.name.startsWith(prefix) && r.dots === dots)
}

/** Resources nested in the given one ("Broadcaster.Admin.Log" → "Broadcaster.Admin.Log.Ls"), which RESTable grants along with it */
function innerResources(resource: Resource): Resource[] {
  const prefix = resource.name + '.'
  return RESOURCES.filter((r) => r.name.startsWith(prefix) && r.dots === resource.dots + 1)
}

function parseMethods(methods: string[]): string[] {
  const parsed = new Set<string>()
  for (const item of methods) {
    const method = String(item).trim().toUpperCase()
    if (method === '*') return METHODS
    if (METHODS.includes(method)) parsed.add(method)
  }
  return [...parsed]
}

/**
 * Number of resource/method combinations a key can actually use, counted against
 * the known Broadcaster resources and the methods each of them supports.
 */
export function countGrantedOperations(entry: ApiKeyEntry): number {
  const granted = new Map<Resource, Set<string>>()
  const rules = Array.isArray(entry.AllowAccess) ? entry.AllowAccess : []
  for (const rule of rules) {
    if (!Array.isArray(rule?.Resources) || !Array.isArray(rule?.Methods)) continue
    const methods = parseMethods(rule.Methods)
    for (const pattern of rule.Resources) {
      for (const matched of findResources(String(pattern))) {
        for (const resource of [matched, ...innerResources(matched)]) {
          const allowed = granted.get(resource) ?? new Set<string>()
          for (const method of methods) {
            if (resource.methods.includes(method)) allowed.add(method)
          }
          granted.set(resource, allowed)
        }
      }
    }
  }
  let count = 0
  for (const allowed of granted.values()) count += allowed.size
  return count
}

/** The API key that grants the most access; the first one wins a tie */
export function pickMostPermissiveKey(apiKeys: ApiKeyEntry[]): string {
  let bestKey = ''
  let bestCount = -1
  for (const entry of apiKeys) {
    if (typeof entry?.ApiKey !== 'string' || !entry.ApiKey) continue
    const count = countGrantedOperations(entry)
    if (count > bestCount) {
      bestCount = count
      bestKey = entry.ApiKey
    }
  }
  return bestKey
}
