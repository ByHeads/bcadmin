import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { VirtualTable } from '@/components/VirtualTable'
import { useConnectionStore } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'

interface ReceiverLogEntry {
  WorkstationId: string
  LastActive: string
  IsConnected?: boolean
  Modules?: Record<string, { IsActive?: boolean; ReplicationVersion?: string; AwaitsInitialization?: boolean; [k: string]: unknown }>
  [key: string]: unknown
}

function CopyableCell({ value }: { value: string }): React.ReactNode {
  const [copied, setCopied] = useState(false)
  const handleCopy = (): void => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="group/cell flex items-center gap-1.5">
      <span className="min-w-0 truncate font-mono" title={value}>{value}</span>
      <button
        onClick={handleCopy}
        className={`shrink-0 rounded p-0.5 opacity-0 transition-all group-hover/cell:opacity-100 ${copied ? 'text-success' : 'text-muted hover:text-accent'}`}
        title={copied ? 'Copied!' : 'Copy'}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </div>
  )
}

const columnHelper = createColumnHelper<ReceiverLogEntry>()

export function StatusTab(): React.ReactNode {
  const { t } = useTranslation('replication')
  const { client, activeConnection } = useConnectionStore()
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(() => [
    columnHelper.accessor('WorkstationId', {
      header: t('status.column.workstationId'),
      cell: (info) => info.getValue()
    }),
    columnHelper.accessor('LastActive', {
      header: t('status.column.lastActive'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    }),
    columnHelper.accessor('IsConnected', {
      header: t('status.column.connected'),
      cell: (info) => {
        const val = info.getValue()
        return val == null ? '—' : (
          <span className={val ? 'text-success' : 'text-muted'}>{val ? t('label.yes', { ns: 'common' }) : t('label.no', { ns: 'common' })}</span>
        )
      }
    }),
    columnHelper.display({
      id: 'ReplicationVersion',
      header: t('status.column.replicationVersion'),
      cell: (props) => {
        const val = props.row.original.Modules?.Replication?.ReplicationVersion
        if (!val) return '—'
        return <CopyableCell value={String(val)} />
      }
    }),
    columnHelper.display({
      id: 'AwaitsInitialization',
      header: t('status.column.awaitsInit'),
      cell: (props) => {
        const val = props.row.original.Modules?.Replication?.AwaitsInitialization
        return val == null ? '—' : (
          <span className={val ? 'text-warning' : 'text-success'}>{val ? t('label.yes', { ns: 'common' }) : t('label.no', { ns: 'common' })}</span>
        )
      }
    })
  ], [t])

  const { data, isLoading, error } = useQuery({
    queryKey: ['replication-status', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ReceiverLogEntry>(
        'Broadcaster.Admin.ReceiverLog',
        'modules.replication.isactive=true',
        undefined,
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

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
    return (
      <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('status.error')}
        </div>
      </div>
    )
  }

  if (tableData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        {t('status.empty')}
      </div>
    )
  }

  return (
    <div className="p-6">
      <VirtualTable table={table} />
      <div className="mt-3 text-xs text-muted">
        {t('status.footer', { count: tableData.length })}
      </div>
    </div>
  )
}
