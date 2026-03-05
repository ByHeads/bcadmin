import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { createWebSocketClient, type WebSocketClient } from '@/api/websocket'
import { Loader2, WifiOff, Copy, Check } from 'lucide-react'
import { useThemeStore } from '@/stores/theme'

interface TerminalEmulatorProps {
  baseUrl: string
  apiKey: string
  resource: string
}

export function TerminalEmulator({ baseUrl, apiKey, resource }: TerminalEmulatorProps): JSX.Element {
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(
    'connecting'
  )
  const [copied, setCopied] = useState(false)

  const { t } = useTranslation('terminals')

  const theme = useThemeStore((s) => s.theme)
  const clientRef = useRef<WebSocketClient | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const MAX_LINES = 5000

  const appendLines = useCallback((...texts: string[]) => {
    setLines((prev) => {
      const next = [...prev, ...texts]
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  }, [])

  useEffect(() => {
    const wsUrl = `${baseUrl}/${resource}`
    const client = createWebSocketClient({
      url: wsUrl,
      apiKey,
      onMessage: (data) => {
        // RESTable terminal may send multi-line responses
        appendLines(...data.split('\n'))
      },
      onOpen: () => {
        setStatus('connected')
        appendLines(`Connected to ${resource}`)
      },
      onClose: (_code, reason) => {
        setStatus('disconnected')
        appendLines(`Disconnected${reason ? `: ${reason}` : ''}`)
      },
      onError: () => {
        setStatus('error')
      }
    })
    clientRef.current = client

    return () => {
      client.close()
      clientRef.current = null
    }
  }, [baseUrl, apiKey, resource, appendLines])

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines])

  // Focus input on mount and clicks
  useEffect(() => {
    inputRef.current?.focus()
  }, [status])

  function handleSend(): void {
    if (!clientRef.current?.isConnected()) return

    appendLines(`> ${input}`)
    clientRef.current.send(input)

    // Update history (only non-empty commands)
    if (input.trim()) {
      const trimmed = input.trim()
      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== trimmed)
        return [...filtered, trimmed]
      })
    }
    setHistoryIndex(-1)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(nextIndex)
      setInput(history[nextIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return
      const nextIndex = historyIndex + 1
      if (nextIndex >= history.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(nextIndex)
        setInput(history[nextIndex])
      }
    }
  }

  function handleCopy(): void {
    const text = lines.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const statusIndicator = {
    connecting: <Loader2 size={14} className="animate-spin text-warning" />,
    connected: <div className="h-2 w-2 rounded-full bg-success" />,
    disconnected: <WifiOff size={14} className="text-muted" />,
    error: <WifiOff size={14} className="text-error" />
  }

  const isDark = theme === 'dark'
  const termBg = isDark ? 'bg-[#0d0d0d]' : 'bg-[#f5f7fa]'
  const termBorder = isDark ? 'border-[#222]' : 'border-border'
  const termText = isDark ? 'text-[#d4d4d4]' : 'text-foreground'
  const termMuted = isDark ? 'text-[#777]' : 'text-muted'
  const termInput = isDark ? 'text-[#d4d4d4] placeholder:text-[#555]' : 'text-foreground placeholder:text-muted/50'
  const termCmd = isDark ? 'text-[#6cb6ff]' : 'text-accent'
  const termSystem = isDark ? 'text-[#777]' : 'text-muted'

  return (
    <div
      className={`flex h-full flex-col rounded-lg border ${termBorder} ${termBg}`}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className={`flex items-center justify-between border-b px-4 py-2 ${termBorder}`}>
        <div className={`flex items-center gap-2 text-sm ${termMuted}`}>
          {statusIndicator[status]}
          <span className="font-mono text-xs">{resource}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${termMuted} hover:${isDark ? 'text-white' : 'text-foreground'}`}
          title={t('terminal.copyOutput')}
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? t('button.copied', { ns: 'common' }) : t('button.copy', { ns: 'common' })}
        </button>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className={`flex-1 overflow-y-auto px-4 py-2 font-mono text-sm leading-relaxed ${termText}`}
        style={{ minHeight: 0 }}
      >
        {lines.map((line, i) => {
          const isCommand = line.startsWith('> ')
          const isSystem = line.startsWith('Connected to ') || line.startsWith('Disconnected') || line.startsWith('###')
          return (
            <div key={i} className={`whitespace-pre ${isCommand ? termCmd : isSystem ? termSystem : ''}`}>
              {line || '\u00A0'}
            </div>
          )
        })}
      </div>

      {/* Input line */}
      <div className={`flex items-center border-t px-4 py-2 ${termBorder}`}>
        <span className={`mr-2 font-mono text-sm ${termCmd}`}>&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setHistoryIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          disabled={status !== 'connected'}
          placeholder={status === 'connected' ? t('terminal.typeCommand') : t('terminal.waitingConnection')}
          className={`flex-1 bg-transparent font-mono text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${termInput}`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
