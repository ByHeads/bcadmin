import i18n from '@/i18n'

export interface MetaConditions {
  limit?: number
  offset?: number
  order_asc?: string
  order_desc?: string
  select?: string
  rename?: string
  distinct?: boolean
  unsafe?: boolean
  add?: string
  search?: string
  search_regex?: string
  safepost?: string
}

export interface ApiResponse<T> {
  Status: string
  Data: T[]
  DataCount: number
  TimeElapsedMs: number
}

export class ApiError extends Error {
  status: number
  errorType?: string
  isAuthError: boolean
  /** What the API key lacks access to, as "METHOD Resource", when that is why the request failed */
  missingAccess: string[]

  constructor(status: number, message: string, errorType?: string, missingAccess: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorType = errorType
    this.isAuthError = status === 401 || status === 403
    this.missingAccess = missingAccess
  }
}

/** A request inside an Aggregator call that the Broadcaster answered with an error */
interface AggregateFailure {
  StatusCode: number
  Message: string
}

// RESTable's answer (405) when the API key has no access to a method on a resource
const MISSING_ACCESS = /^Method '(\w+)' is not available for resource '([^']+)' due to the current client's access rights/

function parseMissingAccess(message: string): string | null {
  const match = MISSING_ACCESS.exec(message)
  return match ? `${match[1]} ${match[2]}` : null
}

function missingAccessError(status: number, missing: string[], errorType?: string): ApiError {
  const access = [...new Set(missing)]
  const message = i18n.t('error.missingAccess', { ns: 'common', access: access.join(', ') })
  return new ApiError(status, message, errorType, access)
}

function createApiError(status: number, message: string, errorType?: string): ApiError {
  const missing = parseMissingAccess(message)
  return missing ? missingAccessError(status, [missing], errorType) : new ApiError(status, message, errorType)
}

function isAggregateFailure(value: unknown): value is AggregateFailure {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { StatusCode, Message } = value as Record<string, unknown>
  return typeof StatusCode === 'number' && StatusCode >= 400 && typeof Message === 'string'
}

/** One error for all failed requests in an Aggregator call; missing access is reported first */
function combineAggregateFailures(failures: AggregateFailure[]): ApiError | null {
  if (failures.length === 0) return null
  const missing = failures.map((f) => parseMissingAccess(f.Message)).filter((m) => m !== null)
  if (missing.length > 0) return missingAccessError(405, missing)
  return new ApiError(failures[0].StatusCode, failures[0].Message)
}

export interface ClientOptions {
  onAuthError?: () => void
  onNetworkError?: () => void
}

const OPERATORS = ['!=', '>=', '<=', '>', '<', '='] as const

function parseConditionKey(key: string): [string, string] {
  for (const op of OPERATORS) {
    if (op !== '=' && key.endsWith(op)) {
      return [key.slice(0, -op.length), op]
    }
  }
  return [key, '=']
}

function buildUrl(
  baseUrl: string,
  resource: string,
  conditions?: string | Record<string, string>,
  meta?: MetaConditions
): string {
  let url = `${baseUrl}/${resource}`

  let hasConditions = false
  if (conditions) {
    if (typeof conditions === 'string') {
      url += `/${conditions}`
      hasConditions = true
    } else {
      const condParts: string[] = []
      for (const [key, value] of Object.entries(conditions)) {
        const [field, op] = parseConditionKey(key)
        condParts.push(`${field}${op}${encodeURIComponent(value)}`)
      }
      if (condParts.length > 0) {
        url += `/${condParts.join('&')}`
        hasConditions = true
      }
    }
  }

  const metaParts: string[] = []
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (value !== undefined) {
        metaParts.push(`${key}=${encodeURIComponent(String(value))}`)
      }
    }
  }
  if (metaParts.length > 0) {
    url += `${hasConditions ? '/' : '/_/'}${metaParts.join('&')}`
  }

  return url
}

function basicAuthHeader(apiKey: string): string {
  const bytes = new TextEncoder().encode(`any:${apiKey}`)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return 'Basic ' + btoa(binary)
}

export function createClient(baseUrl: string, apiKey: string, options?: ClientOptions) {
  const auth = basicAuthHeader(apiKey)

  function isNetworkError(e: unknown): boolean {
    return e instanceof TypeError && /fetch|network/i.test(e.message)
  }

  async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
    const method = init?.method ?? 'GET'
    try {
      const res = await fetch(input, init)
      if (!res.ok) {
        console.warn(`[bcadmin] ${method} ${input} → ${res.status} ${res.statusText}`)
      }
      return res
    } catch (e) {
      console.error(`[bcadmin] ${method} ${input} — network error:`, e)
      if (isNetworkError(e) && options?.onNetworkError) {
        options.onNetworkError()
      }
      throw e
    }
  }

  async function handleResponse(res: Response): Promise<never> {
    const error = await parseError(res)
    console.error(`[bcadmin] ${res.status} ${res.url}:`, error.message)
    if (error.isAuthError && options?.onAuthError) {
      options.onAuthError()
    }
    throw error
  }

  async function get<T>(
    resource: string,
    conditions?: string | Record<string, string>,
    meta?: MetaConditions,
    signal?: AbortSignal
  ): Promise<T[]> {
    const url = buildUrl(baseUrl, resource, conditions, meta)
    const res = await safeFetch(url, {
      method: 'GET',
      headers: {
        Authorization: auth,
        Accept: 'application/json;raw=true'
      },
      signal
    })
    if (!res.ok) return handleResponse(res)
    return res.json()
  }

  async function post<T>(
    resource: string,
    body: unknown,
    conditions?: string | Record<string, string>,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    const url = buildUrl(baseUrl, resource, conditions)
    const res = await safeFetch(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) return handleResponse(res)
    return res.json()
  }

  async function patch<T>(
    resource: string,
    body: unknown,
    conditions?: string | Record<string, string>,
    meta?: MetaConditions,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    const url = buildUrl(baseUrl, resource, conditions, meta)
    const res = await safeFetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal
    })
    if (!res.ok) return handleResponse(res)
    return res.json()
  }

  async function del(
    resource: string,
    conditions?: string | Record<string, string>,
    meta?: MetaConditions,
    signal?: AbortSignal
  ): Promise<void> {
    const url = buildUrl(baseUrl, resource, conditions, meta)
    const res = await safeFetch(url, {
      method: 'DELETE',
      headers: { Authorization: auth },
      signal
    })
    if (!res.ok) return handleResponse(res)
  }

  async function head(
    resource: string,
    conditions?: string | Record<string, string>,
    signal?: AbortSignal
  ): Promise<boolean> {
    const url = buildUrl(baseUrl, resource, conditions)
    try {
      const res = await safeFetch(url, {
        method: 'HEAD',
        headers: { Authorization: auth },
        signal
      })
      return res.ok
    } catch {
      return false
    }
  }

  async function report(
    resource: string,
    conditions?: string | Record<string, string>,
    signal?: AbortSignal
  ): Promise<number> {
    const url = buildUrl(baseUrl, resource, conditions)
    const res = await safeFetch(url, {
      method: 'REPORT',
      headers: {
        Authorization: auth,
        Accept: 'application/json'
      },
      signal
    })
    if (!res.ok) return handleResponse(res)
    const data = await res.json()
    return (data.Count ?? data.DataCount ?? 0) as number
  }

  /**
   * Run several requests in one call. A request that fails is left out of `data`
   * and reported in `error`, so the caller can still use the rest.
   */
  async function aggregateSettled(
    requests: Record<string, string>,
    signal?: AbortSignal
  ): Promise<{ data: Record<string, unknown>; error: ApiError | null }> {
    const url = `${baseUrl}/Aggregator`
    const res = await safeFetch(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        // single=true tells RESTable to return the Aggregator dict directly
        // instead of wrapping the POST result in a Change array: [{...}] → {...}
        Accept: 'application/json;raw=true;single=true'
      },
      body: JSON.stringify(requests),
      signal
    })
    if (!res.ok) return handleResponse(res)
    const data: Record<string, unknown> = await res.json()
    const failures: AggregateFailure[] = []
    for (const [key, value] of Object.entries(data)) {
      if (!isAggregateFailure(value)) continue
      console.error(`[bcadmin] ${requests[key]} (in Aggregator) → ${value.StatusCode}:`, value.Message)
      failures.push(value)
      delete data[key]
    }
    return { data, error: combineAggregateFailures(failures) }
  }

  /** Run several requests in one call; fails if any of them fails */
  async function aggregate(
    requests: Record<string, string>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const { data, error } = await aggregateSettled(requests, signal)
    if (error) throw error
    return data
  }

  async function getText(
    resource: string,
    conditions?: string | Record<string, string>,
    signal?: AbortSignal
  ): Promise<string> {
    const url = buildUrl(baseUrl, resource, conditions)
    const res = await safeFetch(url, {
      method: 'GET',
      headers: {
        Authorization: auth,
        Accept: 'text/plain'
      },
      signal
    })
    if (!res.ok) return handleResponse(res)
    return res.text()
  }

  return { get, getText, post, patch, delete: del, head, report, aggregate, aggregateSettled, baseUrl }
}

async function parseError(res: Response): Promise<ApiError> {
  const isAuthError = res.status === 401 || res.status === 403
  let message = isAuthError
    ? 'Authentication failed — check your API key'
    : `API error ${res.status}: ${res.statusText}`
  let errorType: string | undefined
  try {
    const body = await res.json()
    if (body.Message) message = body.Message
    if (body.ErrorType) errorType = body.ErrorType
  } catch {
    // Response body not JSON — use default message
  }
  return createApiError(res.status, message, errorType)
}

export type BroadcasterClient = ReturnType<typeof createClient>
