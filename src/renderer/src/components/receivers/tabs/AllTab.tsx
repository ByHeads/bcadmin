import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState
} from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'
import { VirtualTable } from '@/components/VirtualTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { useConnectionStore } from '@/stores/connection'
import { FilterButton } from './shared'
import type { ReceiverLog } from '@/api/types'

const allColumnHelper = createColumnHelper<ReceiverLog>()

export function AllTab({ selectedId, onSelect, onSelectConnected }: { selectedId: string | null; onSelect: (id: string | null) => void; onSelectConnected: (connected: boolean) => void }): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([])
  const [filterConnected, setFilterConnected] = useState<boolean | null>(null)
  const [pendingForget, setPendingForget] = useState<ReceiverLog | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const allColumns = useMemo(() => [
    allColumnHelper.accessor('WorkstationId', {
      header: t('all.column.workstationId'),
      cell: (info) => info.getValue()
    }),
    allColumnHelper.accessor('LastActive', {
      header: t('all.column.lastActive'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    }),
    allColumnHelper.accessor('IsConnected', {
      header: t('all.column.connected'),
      cell: (info) => (
        <span className={info.getValue() ? 'text-success' : 'text-muted'}>
          {info.getValue() ? t('label.yes', { ns: 'common' }) : t('label.no', { ns: 'common' })}
        </span>
      )
    }),
    allColumnHelper.display({
      id: 'actions',
      header: '',
      cell: (props) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setPendingForget(props.row.original)
          }}
          className="rounded p-1 text-muted transition-colors hover:text-error"
          title={t('all.forgetReceiver')}
        >
          <Trash2 size={14} />
        </button>
      )
    })
  ], [t])

  const { data, isLoading, error } = useQuery({
    queryKey: ['receivers-all', activeConnection?.id, searchTerm],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ReceiverLog>(
        'Broadcaster.Admin.ReceiverLog',
        undefined,
        { select: 'WorkstationId,LastActive,IsConnected', ...(searchTerm ? { search: searchTerm } : {}) },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData
  })

  const forgetMutation = useMutation({
    mutationFn: async (workstationId: string) => {
      if (!client) throw new Error('No client')
      await client.delete(
        'Broadcaster.Admin.ReceiverLog',
        { WorkstationId: workstationId },
        { unsafe: true }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivers-all'] })
      queryClient.invalidateQueries({ queryKey: ['receivers-connected'] })
      setPendingForget(null)
    }
  })

  const tableData = useMemo(() => {
    const items = data ?? []
    if (filterConnected === null) return items
    return items.filter((r) => r.IsConnected === filterConnected)
  }, [data, filterConnected])

  const table = useReactTable({
    data: tableData,
    columns: allColumns,
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
          {error instanceof Error ? error.message : t('all.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">{t('label.filter', { ns: 'common' })}</span>
          <FilterButton label={t('all.filterAll')} active={filterConnected === null} onClick={() => setFilterConnected(null)} />
          <FilterButton label={t('all.filterConnected')} active={filterConnected === true} onClick={() => setFilterConnected(true)} />
          <FilterButton label={t('all.filterDisconnected')} active={filterConnected === false} onClick={() => setFilterConnected(false)} />
        </div>
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('search')} />
      </div>

      {tableData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted">
          {t('all.empty')}
        </div>
      ) : (
        <>
          <VirtualTable
            table={table}
            onRowClick={(row) => {
              const isToggle = row.original.WorkstationId === selectedId
              onSelect(isToggle ? null : row.original.WorkstationId)
              if (!isToggle) onSelectConnected(row.original.IsConnected ?? false)
            }}
            rowClassName={(row) =>
              `cursor-pointer border-b border-border transition-colors last:border-b-0 ${
                row.original.WorkstationId === selectedId ? 'bg-accent/10' : 'hover:bg-hover'
              }`
            }
          />
          <div className="mt-3 text-xs text-muted">
            {t('all.footer', { count: tableData.length })}
          </div>
        </>
      )}

      {/* Forget confirmation dialog */}
      {pendingForget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">{t('all.forgetTitle')}</h2>
            <p className="mt-2 text-sm text-muted">
              {t('all.forgetMessage', { id: pendingForget.WorkstationId })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingForget(null)}
                className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
                disabled={forgetMutation.isPending}
              >
                {t('button.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={() => forgetMutation.mutate(pendingForget.WorkstationId)}
                className="rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-error/90"
                disabled={forgetMutation.isPending}
              >
                {forgetMutation.isPending ? t('state.removing', { ns: 'common' }) : t('all.forgetButton')}
              </button>
            </div>
            {forgetMutation.isError && (
              <p className="mt-2 text-xs text-error">
                {forgetMutation.error instanceof Error ? forgetMutation.error.message : t('all.error')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
