import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown, Maximize2, Minimize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDateTimeStore } from '@/stores/datetime'

const ROW_HEIGHT = 44

interface DashboardTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  selectedId?: string | null
  onRowClick?: (row: T) => void
  getRowId?: (row: T) => string
  footer?: React.ReactNode
}

export function DashboardTable<T>({
  data,
  columns,
  selectedId,
  onRowClick,
  getRowId,
  footer
}: DashboardTableProps<T>): React.ReactNode {
  const { t } = useTranslation('common')
  const [sorting, setSorting] = useState<SortingState>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { utc, toggleUtc } = useDateTimeStore()

  const tableData = useMemo(() => data, [data])

  const table = useReactTable({
    data: tableData,
    columns: columns as ColumnDef<T, unknown>[],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  const { rows } = table.getRowModel()

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20
  })

  const virtualItems = virtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 flex flex-col bg-background p-6' : 'flex h-full flex-col'}>
      {/* Table */}
      <div className="relative min-h-0 flex-1">
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 z-20 rounded border border-border/30 bg-surface/30 p-1.5 text-muted backdrop-blur-sm transition-colors hover:text-foreground"
          title={isFullscreen ? t('table.exitFullScreen') : t('table.fullScreen')}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <div ref={scrollRef} className="h-full overflow-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-surface">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wider text-muted"
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        {header.column.getCanSort() ? (
                          <button
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <ArrowUpDown size={12} />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                        {(header.column.columnDef.meta as Record<string, unknown>)?.datetime && (
                          <button
                            onClick={toggleUtc}
                            className={`ml-1 w-[42px] rounded border py-0.5 text-center text-[10px] font-medium transition-colors ${utc ? 'border-accent/40 text-accent' : 'border-border text-muted hover:border-foreground/30 hover:text-foreground'}`}
                            title={utc ? t('table.showingUtc') : t('table.showingLocal')}
                          >
                            {utc ? t('table.utc') : t('table.local')}
                          </button>
                        )}
                      </div>
                    )}
                  </th>
                ))}
                <th className="min-w-[40px]" />
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={table.getVisibleFlatColumns().length + 1} style={{ height: paddingTop, padding: 0 }} />
              </tr>
            )}
            {virtualItems.map((virtualItem) => {
              const row = rows[virtualItem.index]
              const rowId = getRowId ? getRowId(row.original) : undefined
              const isSelected = selectedId != null && rowId === selectedId
              return (
                <tr
                  key={row.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={`border-b border-border transition-colors last:border-b-0 ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${isSelected ? 'bg-accent/10' : onRowClick ? 'hover:bg-hover' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3 font-mono text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td />
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={table.getVisibleFlatColumns().length + 1} style={{ height: paddingBottom, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {footer}
    </div>
  )
}
