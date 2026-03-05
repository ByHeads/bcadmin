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

export interface ApiError {
  status: number
  errorType?: string
  message: string
  isAuthError?: boolean
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

  async function aggregate(
    requests: Record<string, string>,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
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
    return res.json()
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

  return { get, getText, post, patch, delete: del, head, report, aggregate, baseUrl }
}

async function parseError(res: Response): Promise<ApiError> {
  const isAuthError = res.status === 401 || res.status === 403
  const apiError: ApiError = {
    status: res.status,
    message: isAuthError
      ? 'Authentication failed — check your API key'
      : `API error ${res.status}: ${res.statusText}`,
    isAuthError
  }
  try {
    const body = await res.json()
    if (body.Message) apiError.message = body.Message
    if (body.ErrorType) apiError.errorType = body.ErrorType
  } catch {
    // Response body not JSON — use default message
  }
  return apiError
}

export type BroadcasterClient = ReturnType<typeof createClient>
