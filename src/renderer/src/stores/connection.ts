import { create } from 'zustand'
import { createClient, type BroadcasterClient } from '@/api/client'
import { queryClient } from '@/lib/query-client'
import type { SavedConnection } from '@shared/types'
import type { AvailableResource } from '@/api/types'

export type ConnectionErrorCode = 'auth' | 'network' | 'server' | 'no-key' | 'unknown'

export interface ConnectionError {
  code: ConnectionErrorCode
  connectionName: string
  detail?: string
}

interface ConnectionState {
  connections: SavedConnection[]
  activeConnection: SavedConnection | null
  client: BroadcasterClient | null
  availableResources: AvailableResource[]
  status: 'loading' | 'disconnected' | 'connecting' | 'connected' | 'error'
  error: ConnectionError | null
  authErrorConnection: SavedConnection | null
  connectionDropped: boolean
  reconnecting: boolean
  suppressConnectionDrop: boolean

  loadConnections: () => Promise<void>
  connect: (connection: SavedConnection) => Promise<void>
  disconnect: () => void
  addConnection: (connection: SavedConnection, apiKey: string) => Promise<void>
  removeConnection: (id: string) => Promise<void>
  reorderConnections: (ids: string[]) => Promise<void>
  hasAccess: (resourceName: string, method: string) => boolean
  reauth: (newApiKey: string) => Promise<void>
  clearError: () => void
  dismissReauth: () => void
  setSuppressConnectionDrop: (suppress: boolean) => void
  attemptReconnect: () => Promise<void>
}

export function normalizeUrl(input: string): string {
  let url = input.trim()

  // Leading @ means "use literally" — strip it but skip domain expansion and /api append
  const isLiteral = url.startsWith('@')
  if (isLiteral) {
    url = url.slice(1)
  }

  // Add protocol if missing
  if (!url.includes('://')) {
    if (!isLiteral && !url.includes('.')) {
      url = `https://broadcaster.${url}.heads-api.com`
    } else {
      url = `https://${url}`
    }
  }

  // Append /api if not present (skip for literal URLs — user controls the path)
  if (!isLiteral && !url.endsWith('/api') && !url.endsWith('/api/')) {
    url = url.replace(/\/$/, '') + '/api'
  }

  // Validate the result is a valid URL
  try {
    new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  return url
}

/** Test whether a connection is reachable with the given credentials (without saving anything) */
export async function testConnectionReachable(url: string, apiKey: string): Promise<void> {
  const res = await fetch(`${url}/AvailableResource`, {
    headers: {
      Authorization: `Basic ${btoa(`any:${apiKey}`)}`,
      Accept: 'application/json;raw=true'
    },
    signal: AbortSignal.timeout(10_000)
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error('auth')
  }
  if (!res.ok) {
    throw new Error('server')
  }
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnection: null,
  client: null,
  availableResources: [],
  status: 'loading',
  error: null,
  authErrorConnection: null,
  connectionDropped: false,
  reconnecting: false,
  suppressConnectionDrop: false,

  loadConnections: async () => {
    try {
      const connections = await window.api.getConnections()
      set((state) => {
        const activeId = state.activeConnection?.id
        const refreshedActive = activeId ? connections.find((c) => c.id === activeId) : undefined
        return {
          connections,
          status: state.status === 'loading' ? 'disconnected' : state.status,
          ...(refreshedActive ? { activeConnection: { ...state.activeConnection!, ...refreshedActive } } : {})
        }
      })
    } catch (e) {
      console.error('Failed to load connections:', e)
      set({ connections: [], status: 'disconnected' })
    }
  },

  connect: async (connection: SavedConnection) => {
    set({ status: 'connecting', error: null })
    try {
      const apiKey = await window.api.getCredential(connection.id)
      if (!apiKey) throw new Error('No API key found for this connection')

      const client = createClient(connection.url, apiKey, {
        onAuthError: () => {
          set({
            authErrorConnection: get().activeConnection,
            client: null,
            availableResources: []
          })
          queryClient.clear()
        },
        onNetworkError: () => {
          // Only trigger connection-drop UI for an established connection, not during initial connect
          if (!get().activeConnection) return
          if (get().suppressConnectionDrop || get().connectionDropped) return
          set({ connectionDropped: true })
        }
      })

      // Verify connection and fetch available resources
      const resources = await client.get<AvailableResource>('AvailableResource')

      // Update last connected
      const updated = { ...connection, lastConnected: new Date().toISOString() }
      await window.api.saveConnection(updated)

      set({
        activeConnection: updated,
        client,
        availableResources: resources,
        status: 'connected',
        error: null
      })

      // Refresh connection list
      await get().loadConnections()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      const isAuth = (e && typeof e === 'object' && 'isAuthError' in e && (e as { isAuthError?: boolean }).isAuthError) || false
      const isNetwork = e instanceof TypeError && /fetch|network/i.test(msg)
      const code: ConnectionErrorCode = msg === 'No API key found for this connection' ? 'no-key'
        : isAuth ? 'auth'
        : isNetwork ? 'network'
        : 'unknown'
      set({
        status: 'error',
        error: {
          code,
          connectionName: connection.name,
          detail: e instanceof Error ? e.message : undefined
        },
        client: null,
        activeConnection: null,
        connectionDropped: false
      })
    }
  },

  disconnect: () => {
    queryClient.clear()
    set({
      activeConnection: null,
      client: null,
      availableResources: [],
      status: 'disconnected',
      error: null,
      connectionDropped: false,
      reconnecting: false,
      suppressConnectionDrop: false
    })
  },

  addConnection: async (connection: SavedConnection, apiKey: string) => {
    try {
      await window.api.setCredential(connection.id, apiKey)
      await window.api.saveConnection(connection)
      await get().loadConnections()
    } catch (e) {
      // Roll back: try to clean up the credential if save failed
      try {
        await window.api.deleteCredential(connection.id)
      } catch {
        // Best-effort cleanup
      }
      throw e
    }
  },

  removeConnection: async (id: string) => {
    await window.api.deleteConnection(id)
    if (get().activeConnection?.id === id) {
      get().disconnect()
    }
    await get().loadConnections()
  },

  reorderConnections: async (ids: string[]) => {
    await window.api.reorderConnections(ids)
    await get().loadConnections()
  },

  hasAccess: (resourceName: string, method: string): boolean => {
    const resource = get().availableResources.find(
      (r) => r.Name.toLowerCase() === resourceName.toLowerCase()
    )
    if (!resource) return false
    return resource.Methods.some((m) => m.toUpperCase() === method.toUpperCase())
  },

  reauth: async (newApiKey: string) => {
    const connection = get().authErrorConnection
    if (!connection) return
    set({ authErrorConnection: null })
    try {
      await window.api.setCredential(connection.id, newApiKey)
      await get().connect(connection)
    } catch {
      // connect() already handles its own error state
    }
  },

  clearError: () => {
    set({ error: null, status: 'disconnected' })
  },

  dismissReauth: () => {
    set({
      authErrorConnection: null,
      status: 'disconnected',
      error: null,
      client: null,
      activeConnection: null,
      availableResources: []
    })
    queryClient.clear()
  },

  setSuppressConnectionDrop: (suppress: boolean) => {
    set({ suppressConnectionDrop: suppress })
  },

  attemptReconnect: async () => {
    const { client, reconnecting } = get()
    if (!client || reconnecting) return
    set({ reconnecting: true })
    try {
      // Try a lightweight request to verify connectivity
      await client.get<AvailableResource>('AvailableResource')
      // Success — connection restored
      set({ connectionDropped: false, reconnecting: false })
      queryClient.invalidateQueries()
    } catch {
      // Still unreachable
      set({ reconnecting: false })
    }
  }
}))
