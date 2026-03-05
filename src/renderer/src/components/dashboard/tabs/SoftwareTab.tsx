import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Check, X, Minus } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'
import { SearchInput } from '@/components/ui/SearchInput'
import {
  DashboardTable,
  StatusCell,
  FilterBar,
  type StatusVariant
} from '@/components/dashboard'
import type { ReceiverLog, Modules, ModuleInfo } from '@/api/types'
import { type ReceiverKind, type PosFilter, type RunningStatus, classifyKind, getModuleInfo } from './shared'

interface SoftwareRow {
  WorkstationId: string
  Status: 'Online' | 'Offline'
  Kind: ReceiverKind
  LastActive: string
  ReceiverVersion: string
  ReceiverRunning: RunningStatus
  WpfClientVersion: string
  WpfClientRunning: RunningStatus
  PosServerVersion: string
  PosServerRunning: RunningStatus
  CsaVersion: string
  CsaRunning: RunningStatus
}

interface CurrentVersions {
  Receiver: string | null
  WpfClient: string | null
  PosServer: string | null
  CustomerServiceApplication: string | null
}

function compareVersions(version: string, current: string | null): 'match' | 'newer' | 'older' | 'unknown' {
  if (!current || version === '—') return 'unknown'
  if (version === current) return 'match'

  const parse = (v: string): number[] => v.split('.').map((n) => parseInt(n, 10) || 0)
  const a = parse(version)
  const b = parse(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av > bv) return 'newer'
    if (av < bv) return 'older'
  }
  return 'match'
}

function VersionCell({ version, current }: { version: string; current: string | null }): React.ReactNode {
  const cmp = compareVersions(version, current)
  const colorClass =
    cmp === 'match' ? 'text-success' :
    cmp === 'newer' ? 'text-[#d946ef]' :
    cmp === 'older' ? 'text-error' :
    'text-foreground'
  return <span className={colorClass}>{version}</span>
}

function RunningIndicator({ status }: { status: RunningStatus }): React.ReactNode {
  if (status === 'running') return <Check size={14} className="inline text-success" />
  if (status === 'stopped') return <X size={14} className="inline text-error" />
  return <Minus size={14} className="inline text-muted" />
}

function SoftwareVersionCell({ version, running, current }: { version: string; running: RunningStatus; current: string | null }): React.ReactNode {
  if (running === 'not-installed') return <span className="text-muted">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <RunningIndicator status={running} />
      <VersionCell version={version} current={current} />
    </span>
  )
}

function parseSoftwareCurrentVersions(versionsData: unknown): CurrentVersions {
  const result: CurrentVersions = { Receiver: null, WpfClient: null, PosServer: null, CustomerServiceApplication: null }
  if (!versionsData) return result

  const items = Array.isArray(versionsData) ? versionsData : [versionsData]
  if (items.length === 0) return result

  const item = items[0] as Record<string, unknown>

  for (const product of ['Receiver', 'WpfClient', 'PosServer', 'CustomerServiceApplication'] as const) {
    const productObj = item[product] as Record<string, unknown> | undefined
    if (productObj?.Version) {
      result[product] = productObj.Version as string
    } else if (item[`${product}.Version`]) {
      result[product] = item[`${product}.Version`] as string
    }
  }
  return result
}

export function SoftwareTab(): React.ReactNode {
  const { t } = useTranslation(['dashboards', 'common'])
  const { client, activeConnection } = useConnectionStore()

  const [posFilter, setPosFilter] = useState<PosFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-software', activeConnection?.id, searchTerm],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const receiverUrl = searchTerm
        ? `GET /Broadcaster.Admin.ReceiverLog/_/search=${encodeURIComponent(searchTerm)}`
        : 'GET /Broadcaster.Admin.ReceiverLog'
      return client.aggregate(
        {
          receivers: receiverUrl,
          versions: 'GET /Broadcaster.Deployment.LaunchSchedule.CurrentVersions'
        },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData
  })

  const currentVersions = useMemo(() => parseSoftwareCurrentVersions(data?.versions), [data?.versions])

  const rows: SoftwareRow[] = useMemo(() => {
    if (!data?.receivers) return []
    const receivers = data.receivers as ReceiverLog[]
    return receivers.map((r) => {
      const receiver = getModuleInfo(r.Modules, 'Receiver')
      const wpf = getModuleInfo(r.Modules, 'WpfClient')
      const pos = getModuleInfo(r.Modules, 'PosServer')
      const csa = getModuleInfo(r.Modules, 'CustomerServiceApplication')
      return {
        WorkstationId: r.WorkstationId,
        Status: r.IsConnected ? 'Online' as const : 'Offline' as const,
        Kind: classifyKind(r.Modules),
        LastActive: r.LastActive,
        ReceiverVersion: receiver.version,
        ReceiverRunning: receiver.running,
        WpfClientVersion: wpf.version,
        WpfClientRunning: wpf.running,
        PosServerVersion: pos.version,
        PosServerRunning: pos.running,
        CsaVersion: csa.version,
        CsaRunning: csa.running
      }
    })
  }, [data?.receivers])

  const hasCsa = useMemo(() => rows.some((r) => r.CsaRunning !== 'not-installed'), [rows])

  const filteredRows = useMemo(() => {
    if (posFilter === 'pos') return rows.filter((r) => r.Kind === 'POS')
    return rows
  }, [rows, posFilter])

  const softwareColumnHelper = createColumnHelper<SoftwareRow>()

  const columns = useMemo(() => {
    const cols = [
      softwareColumnHelper.accessor('Status', {
        header: t('software.column.status'),
        cell: (info) => (
          <StatusCell
            label={info.getValue() === 'Online' ? t('software.status.online') : t('software.status.offline')}
            variant={info.getValue() === 'Online' ? 'success' : 'error'}
          />
        )
      }),
      softwareColumnHelper.accessor('Kind', {
        header: t('software.column.kind'),
        cell: (info) => info.getValue()
      }),
      softwareColumnHelper.accessor('WorkstationId', {
        header: t('software.column.workstationId'),
        cell: (info) => info.getValue()
      }),
      softwareColumnHelper.accessor('LastActive', {
        header: t('software.column.lastActive'),
        meta: { datetime: true },
        cell: (info) => formatTimestamp(info.getValue())
      }),
      softwareColumnHelper.accessor('ReceiverVersion', {
        header: t('software.column.receiver'),
        cell: (info) => (
          <SoftwareVersionCell
            version={info.getValue()}
            running={info.row.original.ReceiverRunning}
            current={currentVersions.Receiver}
          />
        )
      }),
      softwareColumnHelper.accessor('WpfClientVersion', {
        header: t('software.column.wpfClient'),
        cell: (info) => (
          <SoftwareVersionCell
            version={info.getValue()}
            running={info.row.original.WpfClientRunning}
            current={currentVersions.WpfClient}
          />
        )
      }),
      softwareColumnHelper.accessor('PosServerVersion', {
        header: t('software.column.posServer'),
        cell: (info) => (
          <SoftwareVersionCell
            version={info.getValue()}
            running={info.row.original.PosServerRunning}
            current={currentVersions.PosServer}
          />
        )
      })
    ]

    if (hasCsa) {
      ;(cols as ColumnDef<SoftwareRow, unknown>[]).push(
        softwareColumnHelper.accessor('CsaVersion', {
          header: t('software.column.csa'),
          cell: (info) => (
            <SoftwareVersionCell
              version={info.getValue()}
              running={info.row.original.CsaRunning}
              current={currentVersions.CustomerServiceApplication}
            />
          )
        }) as ColumnDef<SoftwareRow, unknown>
      )
    }

    return cols as ColumnDef<SoftwareRow, unknown>[]
  }, [hasCsa, currentVersions, softwareColumnHelper, t])

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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <FilterBar
            options={[
              { value: 'all' as PosFilter, label: t('label.all', { ns: 'common' }) },
              { value: 'pos' as PosFilter, label: t('label.posOnly', { ns: 'common' }) }
            ]}
            value={posFilter}
            onChange={setPosFilter}
            label={t('label.show', { ns: 'common' })}
          />
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('software.searchPlaceholder')} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
        <DashboardTable
          data={filteredRows}
          columns={columns}
          getRowId={(row) => row.WorkstationId}
        />
      </div>
    </div>
  )
}
