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

interface SystemInfoRow {
  WorkstationId: string
  OsName: string
  OsVersion: string
  Architecture: string
  DotNetVersion: string
}

function extractSystemInfoRows(receivers: ReceiverLog[]): SystemInfoRow[] {
  return receivers.map((r) => {
    const machine = r.Modules?.Machine
    const osStatus = machine?.OsStatus
    return {
      WorkstationId: r.WorkstationId,
      OsName: osStatus?.OS ?? '—',
      OsVersion: osStatus?.OsVersion ?? '—',
      Architecture: osStatus?.Architecture ?? '—',
      DotNetVersion: osStatus?.DotNetVersion ?? '—'
    }
  })
}

const systemInfoColumnHelper = createColumnHelper<SystemInfoRow>()

export function SystemInfoTab(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [sorting, setSorting] = useState<SortingState>([])

  const systemInfoColumns = useMemo(() => [
    systemInfoColumnHelper.accessor('WorkstationId', {
      header: t('systemInfo.column.workstationId'),
      cell: (info) => info.getValue()
    }),
    systemInfoColumnHelper.accessor('OsName', {
      header: t('systemInfo.column.os'),
      cell: (info) => info.getValue()
    }),
    systemInfoColumnHelper.accessor('OsVersion', {
      header: t('systemInfo.column.osVersion'),
      cell: (info) => info.getValue()
    }),
    systemInfoColumnHelper.accessor('Architecture', {
      header: t('systemInfo.column.architecture'),
      cell: (info) => info.getValue()
    }),
    systemInfoColumnHelper.accessor('DotNetVersion', {
      header: t('systemInfo.column.dotNetVersion'),
      cell: (info) => info.getValue()
    })
  ], [t])

  const { data, isLoading, error } = useQuery({
    queryKey: ['receivers-systeminfo', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ReceiverLog>(
        'Broadcaster.Admin.ReceiverLog',
        undefined,
        { select: 'workstationid,modules.machine.osstatus' },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  const tableData = useMemo(
    () => (data ? extractSystemInfoRows(data) : []),
    [data]
  )

  const table = useReactTable({
    data: tableData,
    columns: systemInfoColumns,
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
          {error instanceof Error ? error.message : t('systemInfo.error')}
        </div>
      </div>
    )
  }

  if (tableData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        {t('systemInfo.empty')}
      </div>
    )
  }

  return (
    <div className="p-6">
      <VirtualTable table={table} />
      <div className="mt-3 text-xs text-muted">
        {t('systemInfo.footer', { count: tableData.length })}
      </div>
    </div>
  )
}
