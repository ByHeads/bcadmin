import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState
} from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { VirtualTable } from '@/components/VirtualTable'
import type { NotificationLog } from '@/api/types'
import { formatTimestamp } from '@/lib/utils'

const columnHelper = createColumnHelper<NotificationLog>()

export function NotificationsPage(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([])
  const [pendingDismiss, setPendingDismiss] = useState<NotificationLog | null>(null)
  const { t } = useTranslation(['notifications', 'common'])

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<NotificationLog>(
        'Broadcaster.Admin.NotificationLog',
        undefined,
        { limit: 1000, order_desc: 'TimestampUtc' },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 10_000
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!client) throw new Error('No client')
      await client.delete(
        'Broadcaster.Admin.NotificationLog',
        { Id: id }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['overview'] })
      setPendingDismiss(null)
    }
  })

  const columns = useMemo(() => [
    columnHelper.accessor('Id', {
      header: t('column.id'),
      cell: (info) => info.getValue()
    }),
    columnHelper.accessor('TimestampUtc', {
      header: t('column.timestamp'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    }),
    columnHelper.accessor('Message', {
      header: t('column.message'),
      cell: (info) => (
        <span className="line-clamp-2">{info.getValue()}</span>
      )
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (props) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setPendingDismiss(props.row.original)
          }}
          className="rounded p-1 text-muted transition-colors hover:text-error"
          title={t('dismissButton')}
        >
          <Trash2 size={14} />
        </button>
      )
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
    return (
      <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
    )
  }

  if (error) {
    return (
      <div className="px-6 pb-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('error')}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 pb-6">
      <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>

      {tableData.length === 0 ? (
        <div className="mt-6 flex h-64 items-center justify-center text-muted">
          {t('empty')}
        </div>
      ) : (
        <>
          <div className="mt-6">
            <VirtualTable table={table} />
          </div>
          <div className="mt-3 text-xs text-muted">
            {tableData.length >= 1000 ? t('countOverflow') : t('count', { count: tableData.length })}
          </div>
        </>
      )}

      {/* Dismiss confirmation dialog */}
      {pendingDismiss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">{t('dismissTitle')}</h2>
            <p className="mt-2 text-sm text-muted">
              {t('dismissMessage')}
            </p>
            <p className="mt-1 text-xs text-muted/70 line-clamp-2 font-mono">
              {pendingDismiss.Message}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingDismiss(null)}
                className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground"
                disabled={dismissMutation.isPending}
              >
                {t('button.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={() => dismissMutation.mutate(pendingDismiss.Id)}
                className="rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-error/90"
                disabled={dismissMutation.isPending}
              >
                {dismissMutation.isPending ? t('state.dismissing', { ns: 'common' }) : t('button.dismiss', { ns: 'common' })}
              </button>
            </div>
            {dismissMutation.isError && (
              <p className="mt-2 text-xs text-error">
                {dismissMutation.error instanceof Error ? dismissMutation.error.message : t('errorDismiss')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
