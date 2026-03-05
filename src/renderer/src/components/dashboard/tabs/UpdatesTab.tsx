import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { useConnectionStore } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'
import { SearchInput } from '@/components/ui/SearchInput'
import {
  DashboardTable,
  StatusCell,
  FilterBar,
  ProductSelector,
  type StatusVariant,
  type ProductName
} from '@/components/dashboard'
import type { ReceiverLog, Modules, DownloadProgress } from '@/api/types'
import { type ReceiverKind, type PosFilter, classifyKind, getModuleVersion } from './shared'

type UpdateStatus = 'Up to date' | 'Updating' | 'Offline' | 'Downloading' | 'Waiting'

interface UpdateRow {
  WorkstationId: string
  Kind: ReceiverKind
  Status: UpdateStatus
  Version: string
  DownloadPct: number | null
  LastActive: string
  IsConnected: boolean | undefined
}

function getStatusVariant(status: UpdateStatus): StatusVariant {
  switch (status) {
    case 'Up to date': return 'success'
    case 'Updating': return 'warning'
    case 'Downloading': return 'warning'
    case 'Waiting': return 'warning'
    case 'Offline': return 'error'
  }
}

function getDownloadPercent(modules: Modules, product: ProductName, currentVersion: string): number | null {
  const downloads = modules?.Downloads
  if (!downloads) return null

  for (const [key, value] of Object.entries(downloads)) {
    if (key.startsWith(`SoftwareBinary/${product}-`) && key.includes(currentVersion)) {
      const dl = value as DownloadProgress | undefined
      if (dl?.Progress !== undefined) return dl.Progress
    }
  }
  return null
}

function classifyStatus(
  receiver: ReceiverLog,
  product: ProductName,
  currentVersion: string | null,
  downloadPct: number | null
): UpdateStatus {
  if (!receiver.IsConnected) return 'Offline'

  const version = getModuleVersion(receiver.Modules, product)
  if (!currentVersion || version === '—') return 'Waiting'

  if (downloadPct !== null && downloadPct > 0 && downloadPct < 100) return 'Downloading'

  if (version === currentVersion) return 'Up to date'

  return 'Updating'
}

const statusKeys: Record<UpdateStatus, string> = {
  'Up to date': 'updates.status.upToDate',
  'Updating': 'updates.status.updating',
  'Offline': 'updates.status.offline',
  'Downloading': 'updates.status.downloading',
  'Waiting': 'updates.status.waiting'
}

export function UpdatesTab(): React.ReactNode {
  const { t } = useTranslation(['dashboards', 'common'])
  const { client, activeConnection } = useConnectionStore()
  const [product, setProduct] = useState<ProductName>('Receiver')
  const [posFilter, setPosFilter] = useState<PosFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-updates', activeConnection?.id, product, searchTerm],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const receiverUrl = searchTerm
        ? `GET /Broadcaster.Admin.ReceiverLog/_/search=${encodeURIComponent(searchTerm)}`
        : 'GET /Broadcaster.Admin.ReceiverLog'
      const result = await client.aggregate(
        {
          receivers: receiverUrl,
          versions: `GET /Broadcaster.Deployment.LaunchSchedule.CurrentVersions/_/select=${product}.Version`
        },
        signal
      )
      return result
    },
    enabled: !!client,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData
  })

  const currentVersion = useMemo(() => {
    if (!data?.versions) return null
    const versions = data.versions as Record<string, unknown>[] | Record<string, unknown>
    if (Array.isArray(versions) && versions.length > 0) {
      const v = versions[0]
      if (v.Version) return v.Version as string
      const productObj = v[product] as Record<string, unknown> | undefined
      return (productObj?.Version as string) ?? null
    }
    if (!Array.isArray(versions)) {
      if ((versions as Record<string, unknown>).Version) return (versions as Record<string, unknown>).Version as string
      const productObj = (versions as Record<string, unknown>)[product] as Record<string, unknown> | undefined
      return (productObj?.Version as string) ?? null
    }
    return null
  }, [data?.versions, product])

  const rows: UpdateRow[] = useMemo(() => {
    if (!data?.receivers) return []
    const receivers = data.receivers as ReceiverLog[]
    return receivers.map((r) => {
      const kind = classifyKind(r.Modules)
      const version = getModuleVersion(r.Modules, product)
      const downloadPct = getDownloadPercent(r.Modules, product, currentVersion ?? '')
      const status = classifyStatus(r, product, currentVersion, downloadPct)
      return {
        WorkstationId: r.WorkstationId,
        Kind: kind,
        Status: status,
        Version: version,
        DownloadPct: downloadPct,
        LastActive: r.LastActive,
        IsConnected: r.IsConnected
      }
    })
  }, [data?.receivers, product, currentVersion])

  const filteredRows = useMemo(() => {
    if (posFilter === 'pos') return rows.filter((r) => r.Kind === 'POS')
    return rows
  }, [rows, posFilter])

  const columnHelper = createColumnHelper<UpdateRow>()

  const updateColumns = useMemo(() => [
    columnHelper.accessor('WorkstationId', {
      header: t('updates.column.workstationId'),
      cell: (info) => info.getValue()
    }),
    columnHelper.accessor('Kind', {
      header: t('updates.column.kind'),
      cell: (info) => info.getValue()
    }),
    columnHelper.accessor('Status', {
      header: t('updates.column.status'),
      cell: (info) => <StatusCell label={t(statusKeys[info.getValue()])} variant={getStatusVariant(info.getValue())} />
    }),
    columnHelper.accessor('Version', {
      header: t('updates.column.version'),
      cell: (info) => info.getValue()
    }),
    columnHelper.accessor('DownloadPct', {
      header: t('updates.column.downloadPct'),
      cell: (info) => {
        const pct = info.getValue()
        if (pct === null) return '—'
        return `${Math.round(pct)}%`
      }
    }),
    columnHelper.accessor('LastActive', {
      header: t('updates.column.lastActive'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    })
  ], [t, columnHelper])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('updates.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <ProductSelector value={product} onChange={setProduct} />
          <FilterBar
            options={[
              { value: 'all' as PosFilter, label: t('label.all', { ns: 'common' }) },
              { value: 'pos' as PosFilter, label: t('label.posOnly', { ns: 'common' }) }
            ]}
            value={posFilter}
            onChange={setPosFilter}
            label={t('label.show', { ns: 'common' })}
          />
          {currentVersion && (
            <span className="text-xs text-muted">
              {t('label.currentVersion', { ns: 'common' })} <span className="font-mono text-foreground">{currentVersion}</span>
            </span>
          )}
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('updates.searchPlaceholder')} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
        <DashboardTable
          data={filteredRows}
          columns={updateColumns as ColumnDef<UpdateRow, unknown>[]}
          getRowId={(row) => row.WorkstationId}
        />
      </div>
    </div>
  )
}
