import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import type { BroadcasterUpdate } from '@/api/types'

interface OverviewData {
  version?: string
  computerName?: string
  publicIp?: string
  latestUpdate?: string
  notificationCount: number
  receiverCount: number
  replicationFilter?: unknown
}

function parseOverviewResult(result: Record<string, unknown>): OverviewData {
  const config = result.config as Record<string, unknown>[] | undefined
  const updates = result.updates as BroadcasterUpdate[] | undefined
  const notifications = result.notifications as unknown[] | undefined
  const receiverCount = result.receiverCount as Record<string, unknown> | undefined
  const publicIp = result.publicIp as Record<string, unknown>[] | undefined

  // Only show update if it is not already installed
  const availableUpdate = updates?.[0]
  const latestUpdate =
    availableUpdate && !availableUpdate.IsInstalled ? availableUpdate.Version : undefined

  return {
    version: config?.[0]?.Version as string | undefined,
    computerName: config?.[0]?.ComputerName as string | undefined,
    publicIp: (publicIp?.[0]?.Ipv4 as string) ?? undefined,
    latestUpdate,
    notificationCount: Array.isArray(notifications) ? notifications.length : 0,
    receiverCount: (receiverCount?.Count as number) ?? 0,
    replicationFilter: result.filter
  }
}

export function OverviewPage(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('overview')

  const { data, isLoading, error } = useQuery({
    queryKey: ['overview', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')

      const result = await client.aggregate(
        {
          config:
            'GET /Broadcaster.Admin.Config/_/select=Version,ComputerName&rename=General.CurrentVersion->Version',
          updates: 'GET /Broadcaster.Admin.BroadcasterUpdate/_/order_desc=Version&limit=1',
          notifications: 'GET /Broadcaster.Admin.NotificationLog',
          receiverCount: 'REPORT /Broadcaster.Admin.Receiver',
          publicIp: 'GET /Broadcaster.Admin.PublicIp',
          filter: 'GET /Broadcaster.Replication.ReplicationFilter'
        },
        signal
      )

      return parseOverviewResult(result)
    },
    enabled: !!client,
    staleTime: 30_000
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
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

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card label={t('card.broadcaster')} value={activeConnection?.url ?? ''} />
        <Card label={t('card.hostname')} value={data?.computerName ?? '\u2014'} />
        <Card label={t('card.publicIp')} value={data?.publicIp ?? '\u2014'} />
        <Card label={t('card.version')} value={data?.version ?? '\u2014'} />
        <Card
          label={t('card.availableUpdate')}
          value={data?.latestUpdate ?? t('value.upToDate')}
          highlight={!!data?.latestUpdate}
        />
        <Card label={t('card.connectedReceivers')} value={String(data?.receiverCount ?? 0)} />
        <Card
          label={t('card.notifications')}
          value={String(data?.notificationCount ?? 0)}
          highlight={(data?.notificationCount ?? 0) > 0}
        />
        <Card
          label={t('card.replication')}
          value={
            Array.isArray(data?.replicationFilter) && data.replicationFilter.length > 0
              ? t('value.configured')
              : t('value.notConfigured')
          }
        />
      </div>
    </div>
  )
}

function Card({
  label,
  value,
  highlight
}: {
  label: string
  value: string
  highlight?: boolean
}): React.ReactNode {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div
        className={`mt-1 truncate font-mono text-sm ${highlight ? 'text-accent' : 'text-foreground'}`}
      >
        {value}
      </div>
    </div>
  )
}
