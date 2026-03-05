import { useRef } from 'react'
import { flexRender, type Table, type Row } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUpDown } from 'lucide-react'
import { useDateTimeStore } from '@/stores/datetime'

const ROW_HEIGHT = 44

interface VirtualTableProps<T> {
  table: Table<T>
  onRowClick?: (row: Row<T>) => void
  rowClassName?: (row: Row<T>) => string
  maxHeight?: string
}

export function VirtualTable<T>({
  table,
  onRowClick,
  rowClassName,
  maxHeight = '600px'
}: VirtualTableProps<T>): React.ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { utc, toggleUtc } = useDateTimeStore()
  const rows = table.getRowModel().rows

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

  return (
    <div
      ref={scrollRef}
      className="overflow-auto rounded-lg border border-border"
      style={{ maxHeight }}
    >
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
                          title={utc ? 'Showing UTC — click for local time' : 'Showing local time — click for UTC'}
                        >
                          {utc ? 'UTC' : 'Local'}
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td colSpan={table.getVisibleFlatColumns().length} style={{ height: paddingTop, padding: 0 }} />
            </tr>
          )}
          {virtualItems.map((virtualItem) => {
            const row = rows[virtualItem.index]
            const className = rowClassName ? rowClassName(row) : 'border-b border-border transition-colors last:border-b-0 hover:bg-hover'
            return (
              <tr
                key={row.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={className}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-4 py-3 font-mono text-foreground">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={table.getVisibleFlatColumns().length} style={{ height: paddingBottom, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
