/**
 * WebSocket client for RESTable terminal resources.
 *
 * SECURITY NOTE: The browser WebSocket API does not support custom HTTP headers,
 * so Basic auth credentials are embedded in the URL (wss://any:apiKey@host/...).
 * This means the API key is visible in browser DevTools (Network tab) and may
 * appear in error logs. This is a known limitation of the WebSocket API standard.
 *
 * RESTable does not currently support subprotocol-based authentication as an
 * alternative. If it does in the future, migrating to subprotocol auth would
 * avoid exposing credentials in the URL.
 */

export interface WebSocketOptions {
  url: string
  apiKey: string
  onMessage: (data: string) => void
  onOpen?: () => void
  onClose?: (code: number, reason: string) => void
  onError?: (error: Event) => void
  reconnect?: boolean
  reconnectDelayMs?: number
  maxReconnectAttempts?: number
}

export interface WebSocketClient {
  send: (message: string) => void
  close: () => void
  isConnected: () => boolean
}

export function createWebSocketClient(options: WebSocketOptions): WebSocketClient {
  const {
    url,
    apiKey,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnect = true,
    reconnectDelayMs = 2000,
    maxReconnectAttempts = 10
  } = options

  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let intentionallyClosed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function getWsUrl(): string {
    // Convert http(s) base URL to ws(s) URL
    return url.replace(/^http/, 'ws')
  }

  function connect(): void {
    // Build Basic auth credentials for WebSocket handshake via protocol header
    // Native WebSocket API doesn't support Authorization headers directly,
    // so we pass credentials via the URL or subprotocol.
    // RESTable supports Basic auth in the URL: wss://any:apiKey@host/api/resource
    const wsUrl = new URL(getWsUrl())
    wsUrl.username = 'any'
    wsUrl.password = apiKey

    ws = new WebSocket(wsUrl.toString())

    ws.onopen = () => {
      reconnectAttempts = 0
      onOpen?.()
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        onMessage(event.data)
      } else if (event.data instanceof Blob) {
        event.data.text().then((text) => onMessage(text))
      } else if (event.data instanceof ArrayBuffer) {
        onMessage(new TextDecoder().decode(event.data))
      }
    }

    ws.onclose = (event) => {
      onClose?.(event.code, event.reason)
      if (!intentionallyClosed && reconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        reconnectTimer = setTimeout(connect, reconnectDelayMs)
      }
    }

    ws.onerror = (event) => {
      onError?.(event)
    }
  }

  connect()

  return {
    send(message: string) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    },
    close() {
      intentionallyClosed = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      ws?.close()
    },
    isConnected() {
      return ws?.readyState === WebSocket.OPEN
    }
  }
}
