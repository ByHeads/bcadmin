import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X, FileText, Bug, ScrollText, FolderOpen } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { JsonTree } from '@/components/ui/JsonTree'

interface ReceiverDetailPanelProps {
  workstationId: string
  isConnected: boolean
  onClose: () => void
}

type DetailTab = 'status' | 'logfiles' | 'installlog' | 'textfiles' | 'debug'

export function ReceiverDetailPanel({
  workstationId,
  isConnected,
  onClose
}: ReceiverDetailPanelProps): React.ReactNode {
  const { client, hasAccess } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [activeTab, setActiveTab] = useState<DetailTab>('status')

  const canViewLogFiles = hasAccess('Broadcaster.Admin.ReceiverLogFile', 'GET')
  const canViewInstallLog = hasAccess('Broadcaster.Admin.ReceiverInstallLog', 'GET')
  const canViewTextFiles = hasAccess('Broadcaster.Admin.ReceiverHeadsTextFile', 'GET')
  const canViewDebug = hasAccess('Broadcaster.Debugging.ReceiverDebug', 'GET')

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode; accessible: boolean }[] = [
    { id: 'status', label: t('detail.status'), icon: <ScrollText size={14} />, accessible: true },
    { id: 'logfiles', label: t('detail.logFiles'), icon: <FileText size={14} />, accessible: canViewLogFiles },
    { id: 'installlog', label: t('detail.installLog'), icon: <FileText size={14} />, accessible: canViewInstallLog },
    { id: 'textfiles', label: t('detail.textFiles'), icon: <FolderOpen size={14} />, accessible: canViewTextFiles },
    { id: 'debug', label: t('detail.debug'), icon: <Bug size={14} />, accessible: canViewDebug && isConnected }
  ]

  return (
    <div className="flex h-full w-[480px] flex-col border-l border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-mono text-sm font-semibold text-foreground">{workstationId}</h2>
          <span className={`text-xs ${isConnected ? 'text-success' : 'text-muted'}`}>
            {isConnected ? t('label.connected', { ns: 'common' }) : t('label.disconnected', { ns: 'common' })}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted transition-colors hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 pt-1">
        {tabs.map((tab) =>
          tab.accessible ? (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ) : null
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'status' && <StatusTab workstationId={workstationId} isConnected={isConnected} />}
        {activeTab === 'logfiles' && <LogFilesTab workstationId={workstationId} />}
        {activeTab === 'installlog' && <InstallLogTab workstationId={workstationId} />}
        {activeTab === 'textfiles' && <TextFilesTab workstationId={workstationId} />}
        {activeTab === 'debug' && <DebugTab workstationId={workstationId} />}
      </div>
    </div>
  )
}

// --- Status Tab: Full receiver JSON with modules tree ---

function StatusTab({ workstationId, isConnected }: { workstationId: string; isConnected: boolean }): React.ReactNode {
  const { client } = useConnectionStore()
  const { t } = useTranslation('receivers')

  // Fetch full receiver data (connected) or receiver log (all)
  const resource = isConnected ? 'Broadcaster.Admin.Receiver' : 'Broadcaster.Admin.ReceiverLog'

  const { data, isLoading, error } = useQuery({
    queryKey: ['receiver-detail', workstationId, resource],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<Record<string, unknown>>(
        resource,
        { WorkstationId: workstationId },
        undefined,
        signal
      )
      return results[0] ?? null
    },
    enabled: !!client
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!data) return <EmptyState message={t('detail.receiverNotFound')} />

  return (
    <div className="p-4">
      <JsonTree data={data} />
    </div>
  )
}

// --- Log Files Tab ---

interface LogFileEntry {
  Name: string
  [key: string]: unknown
}

function LogFilesTab({ workstationId }: { workstationId: string }): React.ReactNode {
  const { client } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const { data: files, isLoading, error } = useQuery({
    queryKey: ['receiver-logfiles', workstationId],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<LogFileEntry>(
        'Broadcaster.Admin.ReceiverLogFile.List',
        { WorkstationId: workstationId },
        undefined,
        signal
      )
    },
    enabled: !!client
  })

  const { data: fileContent, isLoading: contentLoading } = useQuery({
    queryKey: ['receiver-logfile-content', workstationId, selectedFile],
    queryFn: async ({ signal }) => {
      if (!client || !selectedFile) throw new Error('No client or file')
      const results = await client.get<Record<string, unknown>>(
        'Broadcaster.Admin.ReceiverLogFile',
        { WorkstationId: workstationId, Name: selectedFile },
        undefined,
        signal
      )
      return results[0] ?? null
    },
    enabled: !!client && !!selectedFile
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!files || files.length === 0) return <EmptyState message={t('detail.noLogFiles')} />

  return (
    <div className="p-4">
      {!selectedFile ? (
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.Name}>
              <button
                onClick={() => setSelectedFile(file.Name)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-hover"
              >
                <FileText size={14} className="shrink-0 text-muted" />
                <span className="truncate font-mono text-xs">{file.Name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <button
            onClick={() => setSelectedFile(null)}
            className="mb-3 text-xs text-accent hover:underline"
          >
            &larr; {t('detail.backToList')}
          </button>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 font-mono text-xs font-semibold text-muted">{selectedFile}</div>
            {contentLoading ? (
              <div className="text-xs text-muted">{t('state.loading', { ns: 'common' })}</div>
            ) : fileContent ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                {typeof fileContent === 'string'
                  ? fileContent
                  : JSON.stringify(fileContent, null, 2)}
              </pre>
            ) : (
              <div className="text-xs text-muted">{t('detail.noContent')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Install Log Tab ---

function InstallLogTab({ workstationId }: { workstationId: string }): React.ReactNode {
  const { client } = useConnectionStore()
  const { t } = useTranslation('receivers')

  const { data, isLoading, error } = useQuery({
    queryKey: ['receiver-installlog', workstationId],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<Record<string, unknown>>(
        'Broadcaster.Admin.ReceiverInstallLog',
        { WorkstationId: workstationId },
        undefined,
        signal
      )
    },
    enabled: !!client
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!data || data.length === 0) return <EmptyState message={t('detail.noInstallLog')} />

  return (
    <div className="p-4">
      {data.map((entry, i) => (
        <div key={i} className="mb-3 rounded-md border border-border bg-background p-3">
          <JsonTree data={entry} />
        </div>
      ))}
    </div>
  )
}

// --- Text Files Tab ---

interface TextFileEntry {
  Name: string
  [key: string]: unknown
}

function TextFilesTab({ workstationId }: { workstationId: string }): React.ReactNode {
  const { client } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const { data: files, isLoading, error } = useQuery({
    queryKey: ['receiver-textfiles', workstationId],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<TextFileEntry>(
        'Broadcaster.Admin.ReceiverHeadsTextFile.List',
        { WorkstationId: workstationId },
        undefined,
        signal
      )
    },
    enabled: !!client
  })

  const { data: fileContent, isLoading: contentLoading } = useQuery({
    queryKey: ['receiver-textfile-content', workstationId, selectedFile],
    queryFn: async ({ signal }) => {
      if (!client || !selectedFile) throw new Error('No client or file')
      const results = await client.get<Record<string, unknown>>(
        'Broadcaster.Admin.ReceiverHeadsTextFile',
        { WorkstationId: workstationId, Name: selectedFile },
        undefined,
        signal
      )
      return results[0] ?? null
    },
    enabled: !!client && !!selectedFile
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!files || files.length === 0) return <EmptyState message={t('detail.noTextFiles')} />

  return (
    <div className="p-4">
      {!selectedFile ? (
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.Name}>
              <button
                onClick={() => setSelectedFile(file.Name)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-hover"
              >
                <FolderOpen size={14} className="shrink-0 text-muted" />
                <span className="truncate font-mono text-xs">{file.Name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <button
            onClick={() => setSelectedFile(null)}
            className="mb-3 text-xs text-accent hover:underline"
          >
            &larr; {t('detail.backToList')}
          </button>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 font-mono text-xs font-semibold text-muted">{selectedFile}</div>
            {contentLoading ? (
              <div className="text-xs text-muted">{t('state.loading', { ns: 'common' })}</div>
            ) : fileContent ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                {typeof fileContent === 'string'
                  ? fileContent
                  : JSON.stringify(fileContent, null, 2)}
              </pre>
            ) : (
              <div className="text-xs text-muted">{t('detail.noContent')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Debug Tab ---

function DebugTab({ workstationId }: { workstationId: string }): React.ReactNode {
  const { client } = useConnectionStore()
  const { t } = useTranslation('receivers')

  const { data, isLoading, error } = useQuery({
    queryKey: ['receiver-debug', workstationId],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<Record<string, unknown>>(
        'Broadcaster.Debugging.ReceiverDebug',
        { WorkstationId: workstationId },
        undefined,
        signal
      )
      return results[0] ?? null
    },
    enabled: !!client
  })

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!data) return <EmptyState message={t('detail.noDebugInfo')} />

  return (
    <div className="p-4">
      <JsonTree data={data} />
    </div>
  )
}

// --- Shared Components ---

function LoadingState(): React.ReactNode {
  return <div className="flex h-32 items-center justify-center text-xs text-muted">Loading...</div>
}

function ErrorState({ error }: { error: unknown }): React.ReactNode {
  return (
    <div className="p-4">
      <div className="rounded-md bg-error/10 p-3 text-xs text-error">
        {error instanceof Error ? error.message : 'Failed to load data'}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }): React.ReactNode {
  return <div className="flex h-32 items-center justify-center text-xs text-muted">{message}</div>
}
