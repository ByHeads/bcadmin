import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState
} from '@tanstack/react-table'
import { VirtualTable } from '@/components/VirtualTable'
import { useConnectionStore } from '@/stores/connection'
import type { ReceiverLog } from '@/api/types'

interface ManualClientRow {
  WorkstationId: string
  InstallDir: string
  Version: string
  IsVersionTracked: boolean
}

function extractManualClientRows(receivers: ReceiverLog[]): ManualClientRow[] {
  const rows: ManualClientRow[] = []
  for (const r of receivers) {
    const wpf = r.Modules?.WpfClient
    const clients = wpf?.ExternalClients
    if (!Array.isArray(clients)) continue
    for (const client of clients) {
      rows.push({
        WorkstationId: r.WorkstationId,
        InstallDir: client.InstallDir ?? '—',
        Version: client.Version ?? '—',
        IsVersionTracked: !!client.IsVersionTracked
      })
    }
  }
  return rows
}

const manualClientColumnHelper = createColumnHelper<ManualClientRow>()

export function ManualClientsTab(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [sorting, setSorting] = useState<SortingState>([])

  const manualClientColumns = useMemo(() => [
    manualClientColumnHelper.accessor('WorkstationId', {
      header: t('manualClients.column.workstationId'),
      cell: (info) => info.getValue()
    }),
    manualClientColumnHelper.accessor('InstallDir', {
      header: t('manualClients.column.installDir'),
      cell: (info) => info.getValue()
    }),
    manualClientColumnHelper.accessor('Version', {
      header: t('manualClients.column.version'),
      cell: (info) => info.getValue()
    }),
    manualClientColumnHelper.accessor('IsVersionTracked', {
      header: t('manualClients.column.versionTracked'),
      cell: (info) => (
        <span className={info.getValue() ? 'text-success' : 'text-muted'}>
          {info.getValue() ? t('label.yes', { ns: 'common' }) : t('label.no', { ns: 'common' })}
        </span>
      )
    })
  ], [t])

  const { data, isLoading, error } = useQuery({
    queryKey: ['receivers-manualclients', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ReceiverLog>(
        'Broadcaster.Admin.ReceiverLog',
        'Modules.WpfClient.ExternalClients.Count>0',
        undefined,
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  const tableData = useMemo(
    () => (data ? extractManualClientRows(data) : []),
    [data]
  )

  const table = useReactTable({
    data: tableData,
    columns: manualClientColumns,
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
          {error instanceof Error ? error.message : t('manualClients.error')}
        </div>
      </div>
    )
  }

  if (tableData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        {t('manualClients.empty')}
      </div>
    )
  }

  return (
    <div className="p-6">
      <VirtualTable table={table} />
      <div className="mt-3 text-xs text-muted">
        {t('manualClients.footer', { extCount: tableData.length, rcvCount: data?.length ?? 0 })}
      </div>
    </div>
  )
}
