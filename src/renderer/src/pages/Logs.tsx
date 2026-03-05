import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState
} from '@tanstack/react-table'
import { FileText, Eye, Download, Loader2, RefreshCw, Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestamp } from '@/lib/utils'
import { useConnectionStore } from '@/stores/connection'
import { VirtualTable } from '@/components/VirtualTable'
import type { LogFileEntry, ConnectionAttempt } from '@/api/types'

const TABS = [
  { id: 'broadcaster-logs', labelKey: 'tab.broadcaster', resource: 'Broadcaster.Admin.Log' },
  { id: 'connection-attempts', labelKey: 'tab.connections', resource: 'Broadcaster.Admin.ConnectionAttempt' },
  { id: 'receiver-logs', labelKey: 'tab.receiverLogs', resource: 'Broadcaster.Admin.ReceiverLogFile' }
] as const

type TabId = (typeof TABS)[number]['id']

const logColumnHelper = createColumnHelper<LogFileEntry>()

export function LogsPage(): React.ReactNode {
  const { client, activeConnection, hasAccess } = useConnectionStore()
  const [activeTab, setActiveTab] = useState<TabId>('broadcaster-logs')
  const { t } = useTranslation(['logs', 'common'])

  const accessibleTabs = TABS.filter((tab) => {
    if (tab.id === 'broadcaster-logs') return hasAccess('Broadcaster.Admin.Log', 'GET')
    if (tab.id === 'connection-attempts') return hasAccess('Broadcaster.Admin.ConnectionAttempt', 'GET')
    if (tab.id === 'receiver-logs') return hasAccess('Broadcaster.Admin.ReceiverLogFile', 'GET')
    return true
  })

  const currentTab = accessibleTabs.find((t) => t.id === activeTab) ?? accessibleTabs[0]

  if (!currentTab) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <div className="text-sm">{t('empty.noAccessible')}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="border-b border-border px-6">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <div className="mt-2 flex gap-4">
          {accessibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 pb-2 text-sm font-medium transition-colors ${
                currentTab.id === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {currentTab.id === 'broadcaster-logs' && <BroadcasterLogsTab />}
        {currentTab.id === 'connection-attempts' && <ConnectionAttemptsTab />}
        {currentTab.id === 'receiver-logs' && <ReceiverLogsTab />}
      </div>
    </div>
  )
}

function fetchLogContent(
  baseUrl: string,
  connectionId: string,
  fileName: string,
  signal?: AbortSignal
): Promise<string> {
  const dateMatch = fileName.match(/(\d{8})/)
  const dateParam = dateMatch
    ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}`
    : undefined
  const url = `${baseUrl}/Broadcaster.Admin.Log${dateParam ? `/Date=${dateParam}` : ''}`
  return window.api.getCredential(connectionId).then((apiKey) => {
    const bytes = new TextEncoder().encode(`any:${apiKey}`)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return fetch(url, {
      headers: {
        Authorization: `Basic ${btoa(binary)}`,
        Accept: 'text/plain'
      },
      signal
    }).then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch log: ${res.status} ${res.statusText}`)
      return res.text()
    })
  })
}

function LogSearchBar({ content }: { content: string }): React.ReactNode {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const { t } = useTranslation('logs')

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchTerm('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen])

  useEffect(() => {
    if (!searchTerm) { setMatchCount(0); setMatchIndex(0); return }
    const container = contentRef.current
    if (!container) return
    const marks = container.querySelectorAll('mark')
    setMatchCount(marks.length)
    setMatchIndex(marks.length > 0 ? 1 : 0)
    marks[0]?.scrollIntoView({ block: 'center' })
  }, [searchTerm, content])

  const goToMatch = useCallback((delta: number) => {
    const container = contentRef.current
    if (!container) return
    const marks = container.querySelectorAll('mark')
    if (marks.length === 0) return
    const next = ((matchIndex - 1 + delta + marks.length) % marks.length)
    setMatchIndex(next + 1)
    marks[next]?.scrollIntoView({ block: 'center' })
  }, [matchIndex])

  const htmlContent = useMemo(() => {
    const safe = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    if (!searchTerm) return safe
    const safeSearch = searchTerm.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const safeEscaped = safeSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      return safe.replace(
        new RegExp(`(${safeEscaped})`, 'gi'),
        '<mark class="rounded-sm bg-warning/30 text-inherit">$1</mark>'
      )
    } catch {
      return safe
    }
  }, [content, searchTerm])

  return (
    <>
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-1.5">
          <Search size={13} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') goToMatch(e.shiftKey ? -1 : 1)
              if (e.key === 'Escape') { setSearchOpen(false); setSearchTerm('') }
            }}
            placeholder={t('search')}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
            autoFocus
          />
          {searchTerm && (
            <span className="shrink-0 text-xs text-muted">
              {matchCount > 0 ? `${matchIndex}/${matchCount}` : t('noMatches')}
            </span>
          )}
          <button onClick={() => goToMatch(-1)} disabled={matchCount === 0} className="rounded p-0.5 text-muted transition-colors hover:text-foreground disabled:opacity-30">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => goToMatch(1)} disabled={matchCount === 0} className="rounded p-0.5 text-muted transition-colors hover:text-foreground disabled:opacity-30">
            <ChevronDown size={14} />
          </button>
          <button onClick={() => { setSearchOpen(false); setSearchTerm('') }} className="rounded p-0.5 text-muted transition-colors hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}
      <div ref={contentRef} className="flex-1 overflow-auto bg-background p-4">
        <pre
          className="whitespace-pre-wrap break-words font-mono text-xs text-foreground"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </>
  )
}

function BroadcasterLogsTab(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const [selectedLog, setSelectedLog] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [downloading, setDownloading] = useState<string | null>(null)
  const [viewerHeight, setViewerHeight] = useState(350)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const { t } = useTranslation(['logs', 'common'])

  const { data: logFiles, isLoading, error } = useQuery({
    queryKey: ['log-files', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const rows = await client.get<{ LogFiles: string[] }>(
        'Broadcaster.Admin.Log.Ls',
        undefined,
        undefined,
        signal
      )
      const names = rows[0]?.LogFiles ?? []
      return names.map((name): LogFileEntry => ({ Name: name }))
    },
    enabled: !!client
  })

  const { data: logContent, isLoading: isLoadingContent, error: contentError } = useQuery({
    queryKey: ['log-content', activeConnection?.id, selectedLog],
    queryFn: async ({ signal }) => {
      if (!client || !selectedLog || !activeConnection) throw new Error('No client or log selected')
      return fetchLogContent(client.baseUrl, activeConnection.id, selectedLog, signal)
    },
    enabled: !!client && !!selectedLog
  })

  const handleDownload = async (fileName: string): Promise<void> => {
    if (!client || !activeConnection) return
    setDownloading(fileName)
    try {
      const content = await fetchLogContent(client.baseUrl, activeConnection.id, fileName)
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to download log:', e)
    } finally {
      setDownloading(null)
    }
  }

  const columns = useMemo(() => [
    logColumnHelper.accessor('Name', {
      header: t('column.logFile'),
      cell: (info) => (
        <span className="flex items-center gap-2">
          <FileText size={14} className="text-muted" />
          {info.getValue()}
        </span>
      )
    }),
    logColumnHelper.display({
      id: 'actions',
      header: '',
      cell: (props) => {
        const name = props.row.original.Name
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedLog(name)
              }}
              className={`rounded p-1 transition-colors ${selectedLog === name ? 'text-accent' : 'text-muted hover:text-accent'}`}
              title={t('viewLog')}
            >
              <Eye size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDownload(name)
              }}
              disabled={downloading === name}
              className="rounded p-1 text-muted transition-colors hover:text-accent disabled:opacity-50"
              title={t('downloadLog')}
            >
              {downloading === name ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
          </div>
        )
      }
    })
  ], [selectedLog, downloading, t])

  const tableData = useMemo(() => logFiles ?? [], [logFiles])

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('error.logFiles')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden px-6 pb-6">
      {/* Log file list */}
      {tableData.length === 0 ? (
        <div className="mt-6 flex h-64 items-center justify-center text-muted">
          {t('empty.logFiles')}
        </div>
      ) : (
        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          <VirtualTable
            table={table}
            maxHeight="100%"
            onRowClick={(row) => setSelectedLog(row.original.Name)}
            rowClassName={(row) =>
              `cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-hover ${
                selectedLog === row.original.Name ? 'bg-accent/10' : ''
              }`
            }
          />
        </div>
      )}

      {/* Log content viewer */}
      {selectedLog && (
        <div className="mt-4 flex shrink-0 flex-col overflow-hidden rounded-lg border border-border" style={{ height: viewerHeight }}>
          {/* Resize handle */}
          <div
            className="h-1.5 shrink-0 cursor-ns-resize bg-surface transition-colors hover:bg-accent/20"
            onMouseDown={(e) => {
              e.preventDefault()
              dragRef.current = { startY: e.clientY, startHeight: viewerHeight }
              const onMove = (ev: MouseEvent): void => {
                if (!dragRef.current) return
                const delta = dragRef.current.startY - ev.clientY
                setViewerHeight(Math.max(150, dragRef.current.startHeight + delta))
              }
              const onUp = (): void => {
                dragRef.current = null
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
          />
          <div className="flex items-center justify-between border-b border-border bg-surface px-4 pb-2">
            <span className="text-sm font-medium text-foreground">{selectedLog}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownload(selectedLog)}
                disabled={downloading === selectedLog}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted transition-colors hover:text-accent disabled:opacity-50"
                title={t('button.download', { ns: 'common' })}
              >
                {downloading === selectedLog ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                {t('button.download', { ns: 'common' })}
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded p-1 text-muted transition-colors hover:text-foreground"
                title={t('button.close', { ns: 'common' })}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {isLoadingContent ? (
            <div className="flex flex-1 items-center gap-2 p-4 text-muted">
              <Loader2 size={14} className="animate-spin" />
              {t('loadingContent')}
            </div>
          ) : contentError ? (
            <div className="p-4 text-error text-sm">
              {contentError instanceof Error ? contentError.message : t('error.logContent')}
            </div>
          ) : (
            <LogSearchBar content={logContent ?? ''} />
          )}
        </div>
      )}
    </div>
  )
}

const attemptColumnHelper = createColumnHelper<ConnectionAttempt>()

function ConnectionAttemptsTab(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const [sorting, setSorting] = useState<SortingState>([])
  const { t } = useTranslation(['logs', 'common'])

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['connection-attempts', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ConnectionAttempt>(
        'Broadcaster.Admin.ConnectionAttempt',
        undefined,
        { order_desc: 'Time', limit: 1000 },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 10_000
  })

  const columns = useMemo(() => [
    attemptColumnHelper.accessor('Time', {
      header: t('column.time'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    }),
    attemptColumnHelper.accessor('WorkstationId', {
      header: t('column.workstation'),
      cell: (info) => info.getValue()
    }),
    attemptColumnHelper.accessor('Ip', {
      header: t('column.ip'),
      cell: (info) => (
        <span className="font-mono">{info.getValue()}</span>
      )
    }),
    attemptColumnHelper.accessor('Token', {
      header: t('column.token'),
      cell: (info) => (
        <span className="max-w-[200px] truncate font-mono" title={info.getValue()}>
          {info.getValue()}
        </span>
      )
    }),
    attemptColumnHelper.accessor('RecentForeignReplacementsCount', {
      header: t('column.foreignReplacements'),
      cell: (info) => {
        const count = info.getValue()
        return (
          <span className={count > 0 ? 'text-warning' : 'text-muted'}>
            {count}
          </span>
        )
      }
    })
  ], [t])

  const tableData = useMemo(() => data ?? [], [data])

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('error.connections')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-50"
          title={t('button.refresh', { ns: 'common' })}
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          {t('button.refresh', { ns: 'common' })}
        </button>
      </div>

      {tableData.length === 0 ? (
        <div className="mt-6 flex h-64 items-center justify-center text-muted">
          {t('empty.connections')}
        </div>
      ) : (
        <>
          <div className="mt-4">
            <VirtualTable table={table} />
          </div>
          <div className="mt-3 text-xs text-muted">
            {tableData.length >= 1000 ? t('count.overflow') : t('count.attempts', { count: tableData.length })}
          </div>
        </>
      )}
    </div>
  )
}

interface ReceiverEntry {
  WorkstationId: string
  IsConnected: boolean
}

function ReceiverLogsTab(): React.ReactNode {
  const { client } = useConnectionStore()
  const { t } = useTranslation(['logs', 'common'])
  const { data: receivers, isLoading: wsLoading } = useQuery({
    queryKey: ['receiver-logs-list'],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<ReceiverEntry>(
        'Broadcaster.Admin.ReceiverLog',
        undefined,
        { select: 'WorkstationId,IsConnected' },
        signal
      )
      return results.sort((a, b) => {
        if (a.IsConnected !== b.IsConnected) return a.IsConnected ? -1 : 1
        return a.WorkstationId.localeCompare(b.WorkstationId)
      })
    },
    enabled: !!client,
    refetchInterval: 10_000
  })
  const [selectedWs, setSelectedWs] = useState<string | null>(null)
  const [wsSearch, setWsSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const filteredWs = useMemo(() => {
    if (!receivers) return []
    if (!wsSearch.trim()) return receivers
    const q = wsSearch.toLowerCase()
    return receivers.filter((r) => r.WorkstationId.toLowerCase().includes(q))
  }, [receivers, wsSearch])

  const selectedReceiver = receivers?.find((r) => r.WorkstationId === selectedWs)

  const { data: logFiles, isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ['receiver-logfiles', selectedWs],
    queryFn: async ({ signal }) => {
      if (!client || !selectedWs) throw new Error('No client')
      const results = await client.get<{ Files?: string[] }>(
        'Broadcaster.Admin.ReceiverLogFile.List',
        { WorkstationId: selectedWs },
        undefined,
        signal
      )
      return results[0]?.Files ?? []
    },
    enabled: !!client && !!selectedWs && !!selectedReceiver?.IsConnected
  })

  const { data: fileContent, isLoading: contentLoading } = useQuery({
    queryKey: ['receiver-logfile-content', selectedWs, selectedFile],
    queryFn: async ({ signal }) => {
      if (!client || !selectedWs || !selectedFile) throw new Error('No client or file')
      // Receiver's LogFile resource uses a Date parameter
      // Extract date from filename (e.g. "Receiver-20260306.txt" → "2026-03-06")
      const dateMatch = selectedFile.match(/(\d{4})(\d{2})(\d{2})/)
      const conditions: Record<string, string> = { WorkstationId: selectedWs }
      if (dateMatch) {
        conditions.Date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      }
      return client.getText(
        'Broadcaster.Admin.ReceiverLogFile',
        conditions,
        signal
      )
    },
    enabled: !!client && !!selectedWs && !!selectedFile
  })

  return (
    <div className="flex h-full">
      {/* Workstation sidebar */}
      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={wsSearch}
              onChange={(e) => setWsSearch(e.target.value)}
              placeholder={t('searchReceiver')}
              className="w-full rounded-md border border-border bg-surface py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {wsLoading ? (
            <div className="flex items-center justify-center p-4 text-muted">
              <Loader2 size={14} className="animate-spin" />
            </div>
          ) : filteredWs.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted">{t('noMatches')}</div>
          ) : (
            filteredWs.map((r) => (
              <button
                key={r.WorkstationId}
                onClick={() => { if (r.IsConnected) { setSelectedWs(r.WorkstationId); setSelectedFile(null) } }}
                disabled={!r.IsConnected}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs transition-colors ${
                  !r.IsConnected
                    ? 'cursor-not-allowed text-muted/50'
                    : selectedWs === r.WorkstationId
                      ? 'bg-accent/10 text-accent'
                      : 'text-foreground hover:bg-hover'
                }`}
              >
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.IsConnected ? 'bg-success' : 'bg-error/50'}`} />
                {r.WorkstationId}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Log files + content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selectedWs ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            {t('empty.selectReceiver')}
          </div>
        ) : filesLoading ? (
          <div className="flex h-64 items-center justify-center text-muted">
            {t('state.loading', { ns: 'common' })}
          </div>
        ) : filesError ? (
          <div className="p-6">
            <div className="rounded-md bg-error/10 p-4 text-sm text-error">
              {filesError instanceof Error ? filesError.message : t('error.receiverLogs')}
            </div>
          </div>
        ) : !logFiles || logFiles.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            {t('empty.receiverLogs')}
          </div>
        ) : !selectedFile ? (
          <div className="overflow-y-auto p-4">
            <ul className="space-y-1">
              {logFiles.map((fileName) => (
                <li key={fileName} className="group flex items-center rounded-md transition-colors hover:bg-hover">
                  <button
                    onClick={() => setSelectedFile(fileName)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-foreground"
                  >
                    <FileText size={14} className="shrink-0 text-muted" />
                    <span className="truncate font-mono text-xs">{fileName}</span>
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!client || !selectedWs) return
                      const dateMatch = fileName.match(/(\d{4})(\d{2})(\d{2})/)
                      const conditions: Record<string, string> = { WorkstationId: selectedWs }
                      if (dateMatch) conditions.Date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
                      try {
                        const content = await client.getText('Broadcaster.Admin.ReceiverLogFile', conditions)
                        const blob = new Blob([content], { type: 'text/plain' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = fileName
                        a.click()
                        URL.revokeObjectURL(url)
                      } catch { /* ignore */ }
                    }}
                    className="shrink-0 rounded p-1.5 text-muted opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
                    title={t('button.download', { ns: 'common' })}
                  >
                    <Download size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-accent hover:underline"
              >
                &larr;
              </button>
              <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">{selectedFile}</span>
              <button
                onClick={() => {
                  if (!fileContent) return
                  const blob = new Blob([fileContent], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = selectedFile
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                disabled={contentLoading || !fileContent}
                className="shrink-0 rounded p-1 text-muted transition-colors hover:text-foreground disabled:opacity-30"
                title={t('button.download', { ns: 'common' })}
              >
                <Download size={14} />
              </button>
            </div>
            {contentLoading ? (
              <div className="flex flex-1 items-center gap-2 p-4 text-muted">
                <Loader2 size={14} className="animate-spin" />
                {t('loadingContent')}
              </div>
            ) : (
              <LogSearchBar content={fileContent ?? ''} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
