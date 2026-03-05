import { useState, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState
} from '@tanstack/react-table'
import { formatTimestamp } from '@/lib/utils'
import { VirtualTable } from '@/components/VirtualTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { useConnectionStore } from '@/stores/connection'
import { formatDuration } from './shared'
import type { Receiver } from '@/api/types'

const columnHelper = createColumnHelper<Receiver>()

export function ConnectedTab({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [sorting, setSorting] = useState<SortingState>([])
  const [searchTerm, setSearchTerm] = useState('')

  const columns = useMemo(() => [
    columnHelper.accessor('WorkstationId', {
      header: t('connected.column.workstationId'),
      cell: (info) => info.getValue()
    }),
    columnHelper.accessor('LastActive', {
      header: t('connected.column.lastActive'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    }),
    columnHelper.display({
      id: 'duration',
      header: t('connected.column.connected'),
      cell: (props) => formatDuration(props.row.original.LastActive)
    })
  ], [t])

  const { data, isLoading, error } = useQuery({
    queryKey: ['receivers-connected', activeConnection?.id, searchTerm],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<Receiver>(
        'Broadcaster.Admin.Receiver',
        undefined,
        { select: 'WorkstationId,LastActive', ...(searchTerm ? { search: searchTerm } : {}) },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData
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
          {error instanceof Error ? error.message : t('connected.error')}
        </div>
      </div>
    )
  }

  if (tableData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        {t('connected.empty')}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('search')} />
      </div>
      <VirtualTable
        table={table}
        onRowClick={(row) => onSelect(row.original.WorkstationId === selectedId ? null : row.original.WorkstationId)}
        rowClassName={(row) =>
          `cursor-pointer border-b border-border transition-colors last:border-b-0 ${
            row.original.WorkstationId === selectedId ? 'bg-accent/10' : 'hover:bg-hover'
          }`
        }
      />
      <div className="mt-3 text-xs text-muted">
        {t('connected.footer', { count: tableData.length })}
      </div>
    </div>
  )
}
