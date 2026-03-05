import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { useConnectionStore } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'
import { SearchInput } from '@/components/ui/SearchInput'
import { DashboardTable, StatusCell, type StatusVariant } from '@/components/dashboard'
import type { ReplicationState } from '@/api/types'
import { BooleanCell } from './shared'

type ReplicationStatus = 'Obsolete' | 'Await init' | 'Blocked' | 'Await update' | 'Up to date' | 'Replicating'

interface ReplicationRow {
  WorkstationId: string
  Status: ReplicationStatus
  IsConnected: boolean | undefined
  IncludedInFilter: boolean
  LastReceived: string | undefined
  LastActive: string
  PosServerVersion: string
  ReplicationVersion: string
  ApplicableCount: number
  NonApplicableCount: number
}

function classifyReplicationStatus(state: ReplicationState): ReplicationStatus {
  if (!state.AwaitsInitialization && state.IsInSequence !== true) return 'Obsolete'
  if (state.AwaitsInitialization) return 'Await init'
  if (state.IsBlocked) return 'Blocked'
  if (state.RequiresPosServerUpdate) return 'Await update'
  if (state.ApplicableCount === 0) return 'Up to date'
  return 'Replicating'
}

function getReplicationStatusVariant(status: ReplicationStatus): StatusVariant {
  switch (status) {
    case 'Up to date': return 'success'
    case 'Replicating': return 'info'
    case 'Await init': return 'warning'
    case 'Await update': return 'warning'
    case 'Blocked': return 'error'
    case 'Obsolete': return 'muted'
  }
}

const statusKeys: Record<ReplicationStatus, string> = {
  'Obsolete': 'replication.status.obsolete',
  'Await init': 'replication.status.awaitInit',
  'Blocked': 'replication.status.blocked',
  'Await update': 'replication.status.awaitUpdate',
  'Up to date': 'replication.status.upToDate',
  'Replicating': 'replication.status.replicating'
}

export function ReplicationTab(): React.ReactNode {
  const { t } = useTranslation(['dashboards', 'common'])
  const { client, activeConnection } = useConnectionStore()
  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-replication', activeConnection?.id, searchTerm],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const stateUrl = searchTerm
        ? `GET /Broadcaster.Admin.ReplicationState/_/search=${encodeURIComponent(searchTerm)}`
        : 'GET /Broadcaster.Admin.ReplicationState'
      return client.aggregate(
        {
          replicationState: stateUrl,
          versions: 'GET /Broadcaster.Deployment.LaunchSchedule.CurrentVersions'
        },
        signal
      )
    },
    enabled: !!client,
    refetchInterval: 5_000,
    placeholderData: keepPreviousData
  })

  const rows: ReplicationRow[] = useMemo(() => {
    if (!data?.replicationState) return []
    const states = data.replicationState as ReplicationState[]
    return states.map((s) => ({
      WorkstationId: s.WorkstationId,
      Status: classifyReplicationStatus(s),
      IsConnected: s.IsConnected,
      IncludedInFilter: s.IncludedInFilter,
      LastReceived: s.LastReceived,
      LastActive: s.LastActive,
      PosServerVersion: s.PosServerVersion,
      ReplicationVersion: s.ReplicationVersion,
      ApplicableCount: s.ApplicableCount,
      NonApplicableCount: s.NonApplicableCount
    }))
  }, [data?.replicationState])

  const replicationColumnHelper = createColumnHelper<ReplicationRow>()

  const replicationColumns = useMemo(() => [
    replicationColumnHelper.accessor('Status', {
      header: t('replication.column.status'),
      cell: (info) => <StatusCell label={t(statusKeys[info.getValue()])} variant={getReplicationStatusVariant(info.getValue())} />
    }),
    replicationColumnHelper.accessor('IsConnected', {
      header: t('replication.column.connection'),
      cell: (info) => <BooleanCell value={info.getValue()} />
    }),
    replicationColumnHelper.accessor('IncludedInFilter', {
      header: t('replication.column.filter'),
      cell: (info) => <BooleanCell value={info.getValue()} />
    }),
    replicationColumnHelper.accessor('WorkstationId', {
      header: t('replication.column.id'),
      cell: (info) => info.getValue()
    }),
    replicationColumnHelper.accessor('LastReceived', {
      header: t('replication.column.lastReceived'),
      meta: { datetime: true },
      cell: (info) => { const v = info.getValue(); return v ? formatTimestamp(v) : '—' }
    }),
    replicationColumnHelper.accessor('LastActive', {
      header: t('replication.column.lastActive'),
      meta: { datetime: true },
      cell: (info) => formatTimestamp(info.getValue())
    }),
    replicationColumnHelper.accessor('PosServerVersion', {
      header: t('replication.column.posServer'),
      cell: (info) => info.getValue() || '—'
    }),
    replicationColumnHelper.accessor('ReplicationVersion', {
      header: t('replication.column.replication'),
      cell: (info) => info.getValue() || '—'
    }),
    replicationColumnHelper.accessor('ApplicableCount', {
      header: t('replication.column.applicable'),
      cell: (info) => info.getValue()
    }),
    replicationColumnHelper.accessor('NonApplicableCount', {
      header: t('replication.column.nonApplicable'),
      cell: (info) => info.getValue()
    })
  ], [t, replicationColumnHelper])

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('replication.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder={t('replication.searchPlaceholder')} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-6">
      <DashboardTable
        data={rows}
        columns={replicationColumns as ColumnDef<ReplicationRow, unknown>[]}
        getRowId={(row) => row.WorkstationId}
      />
      </div>
    </div>
  )
}
