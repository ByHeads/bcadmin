import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState
} from '@tanstack/react-table'
import { X, CheckSquare, Square, SquareMinus } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'
import { VirtualTable } from '@/components/VirtualTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { FilterButton } from '@/components/receivers/tabs/shared'
import { useConnectionStore } from '@/stores/connection'
import type { ReceiverLog } from '@/api/types'

interface WorkstationPickerDialogProps {
  open: boolean
  initialSelected: string[]
  onApply: (selected: string[]) => void
  onClose: () => void
}

const columnHelper = createColumnHelper<ReceiverLog>()

export function WorkstationPickerDialog({
  open,
  initialSelected,
  onApply,
  onClose
}: WorkstationPickerDialogProps): React.ReactNode {
  const { t } = useTranslation('deploy')
  const { client, activeConnection } = useConnectionStore()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterConnected, setFilterConnected] = useState<boolean | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'WorkstationId', desc: false }])

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected))
      setSearchTerm('')
      setFilterConnected(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const { data, isLoading, error } = useQuery({
    queryKey: ['workstation-picker', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ReceiverLog>(
        'Broadcaster.Admin.ReceiverLog',
        undefined,
        { select: 'WorkstationId,LastActive,IsConnected' },
        signal
      )
    },
    enabled: !!client && open,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData
  })

  const tableData = useMemo(() => {
    let items = data ?? []
    if (filterConnected !== null) {
      items = items.filter((r) => (r.IsConnected ?? false) === filterConnected)
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      items = items.filter((r) => r.WorkstationId.toLowerCase().includes(lower))
    }
    return items
  }, [data, filterConnected, searchTerm])

  const allFilteredSelected =
    tableData.length > 0 && tableData.every((r) => selected.has(r.WorkstationId))
  const someFilteredSelected = tableData.some((r) => selected.has(r.WorkstationId))

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered(): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const r of tableData) next.delete(r.WorkstationId)
      } else {
        for (const r of tableData) next.add(r.WorkstationId)
      }
      return next
    })
  }

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => (
          <button
            onClick={toggleAllFiltered}
            className="flex items-center text-muted transition-colors hover:text-foreground"
            title={t('target.selectAll', { count: tableData.length })}
          >
            {allFilteredSelected ? (
              <CheckSquare size={16} className="text-accent" />
            ) : someFilteredSelected ? (
              <SquareMinus size={16} className="text-accent" />
            ) : (
              <Square size={16} />
            )}
          </button>
        ),
        cell: ({ row }) =>
          selected.has(row.original.WorkstationId) ? (
            <CheckSquare size={16} className="text-accent" />
          ) : (
            <Square size={16} className="text-muted" />
          )
      }),
      columnHelper.accessor('WorkstationId', {
        header: t('label.workstation', { ns: 'common' }),
        cell: (info) => info.getValue()
      }),
      columnHelper.accessor('IsConnected', {
        header: t('label.status', { ns: 'common' }),
        cell: (info) => (
          <span className={info.getValue() ? 'text-success' : 'text-muted'}>
            {info.getValue()
              ? t('label.connected', { ns: 'common' })
              : t('label.disconnected', { ns: 'common' })}
          </span>
        )
      }),
      columnHelper.accessor('LastActive', {
        header: t('target.picker.lastActive'),
        meta: { datetime: true },
        cell: (info) => formatTimestamp(info.getValue())
      })
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, selected, tableData, allFilteredSelected, someFilteredSelected]
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('target.picker.title')}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted transition-colors hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">{t('label.filter', { ns: 'common' })}</span>
            <FilterButton label={t('label.all', { ns: 'common' })} active={filterConnected === null} onClick={() => setFilterConnected(null)} />
            <FilterButton label={t('label.connected', { ns: 'common' })} active={filterConnected === true} onClick={() => setFilterConnected(true)} />
            <FilterButton label={t('label.disconnected', { ns: 'common' })} active={filterConnected === false} onClick={() => setFilterConnected(false)} />
          </div>
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('target.search')} />
        </div>

        {/* Table */}
        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-muted">
              {t('state.loading', { ns: 'common' })}
            </div>
          ) : error ? (
            <div className="rounded-md bg-error/10 p-4 text-error">
              {error instanceof Error ? error.message : t('target.picker.error')}
            </div>
          ) : tableData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted">
              {t('target.picker.empty')}
            </div>
          ) : (
            <VirtualTable
              table={table}
              maxHeight="55vh"
              onRowClick={(row) => toggleOne(row.original.WorkstationId)}
              rowClassName={(row) =>
                `cursor-pointer border-b border-border transition-colors last:border-b-0 ${
                  selected.has(row.original.WorkstationId) ? 'bg-accent/10' : 'hover:bg-hover'
                }`
              }
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{t('target.selected', { count: selected.size })}</span>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-muted underline transition-colors hover:text-foreground"
              >
                {t('target.picker.clear')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
            >
              {t('button.cancel', { ns: 'common' })}
            </button>
            <button
              onClick={() => onApply(Array.from(selected).sort())}
              className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              {t('target.picker.apply', { count: selected.size })}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
