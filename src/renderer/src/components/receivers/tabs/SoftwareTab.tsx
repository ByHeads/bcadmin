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
import { formatTimestamp } from '@/lib/utils'
import { VirtualTable } from '@/components/VirtualTable'
import { useConnectionStore } from '@/stores/connection'
import { ProductSelector, type ProductName } from '@/components/dashboard/ProductSelector'
import type { ReceiverLog, ModuleInfo } from '@/api/types'

interface SoftwareRow {
  WorkstationId: string
  LastActive: string
  IsRunning: boolean
  CurrentVersion: string
  DeployedVersions: string
  LaunchedVersion: string
}

function extractSoftwareRows(receivers: ReceiverLog[], product: ProductName): SoftwareRow[] {
  return receivers.map((r) => {
    const mod = r.Modules?.[product] as ModuleInfo | undefined
    return {
      WorkstationId: r.WorkstationId,
      LastActive: r.LastActive,
      IsRunning: !!mod?.IsRunning,
      CurrentVersion: mod?.CurrentVersion ?? mod?.Version ?? '—',
      DeployedVersions: Array.isArray(mod?.DeployedVersions)
        ? mod.DeployedVersions.join(', ')
        : '—',
      LaunchedVersion: mod?.LaunchedVersion ?? '—'
    }
  })
}

const softwareColumnHelper = createColumnHelper<SoftwareRow>()

export function SoftwareTab(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('receivers')
  const [product, setProduct] = useState<ProductName>('Receiver')
  const [sorting, setSorting] = useState<SortingState>([])

  const softwareColumns = useMemo(() => [
    softwareColumnHelper.accessor('WorkstationId', {
      header: t('software.column.workstationId'),
      cell: (info) => info.getValue()
    }),
    softwareColumnHelper.accessor('LastActive', {
      header: t('software.column.lastActive'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    }),
    softwareColumnHelper.accessor('IsRunning', {
      header: t('software.column.running'),
      cell: (info) => (
        <span className={info.getValue() ? 'text-success' : 'text-muted'}>
          {info.getValue() ? t('label.yes', { ns: 'common' }) : t('label.no', { ns: 'common' })}
        </span>
      )
    }),
    softwareColumnHelper.accessor('CurrentVersion', {
      header: t('software.column.currentVersion'),
      cell: (info) => info.getValue()
    }),
    softwareColumnHelper.accessor('DeployedVersions', {
      header: t('software.column.deployedVersions'),
      cell: (info) => info.getValue()
    }),
    softwareColumnHelper.accessor('LaunchedVersion', {
      header: t('software.column.launchedVersion'),
      cell: (info) => info.getValue()
    })
  ], [t])

  const { data, isLoading, error } = useQuery({
    queryKey: ['receivers-software', activeConnection?.id, product],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<ReceiverLog>(
        'Broadcaster.Admin.ReceiverLog',
        `modules.${product}.isinstalled=true`,
        undefined,
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000
  })

  const tableData = useMemo(
    () => (data ? extractSoftwareRows(data, product) : []),
    [data, product]
  )

  const table = useReactTable({
    data: tableData,
    columns: softwareColumns,
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
          {error instanceof Error ? error.message : t('software.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-medium text-muted">{t('label.product', { ns: 'common' })}</span>
        <ProductSelector value={product} onChange={setProduct} />
      </div>

      {tableData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted">
          {t('software.empty')}
        </div>
      ) : (
        <>
          <VirtualTable table={table} />
          <div className="mt-3 text-xs text-muted">
            {t('software.footer', { count: tableData.length })}
          </div>
        </>
      )}
    </div>
  )
}
