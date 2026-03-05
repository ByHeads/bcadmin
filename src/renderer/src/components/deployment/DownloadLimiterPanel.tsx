import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useConnectionStore } from '@/stores/connection'
import type { DownloadLimiterState } from '@/api/types'
import { Download } from 'lucide-react'

export function DownloadLimiterPanel(): React.ReactNode {
  const { t } = useTranslation('deployment')
  const { client, activeConnection, hasAccess } = useConnectionStore()

  const canAccess = hasAccess('Broadcaster.Deployment.DownloadLimiterState', 'GET')

  const { data } = useQuery({
    queryKey: ['download-limiter', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const rows = await client.get<DownloadLimiterState>(
        'Broadcaster.Deployment.DownloadLimiterState',
        undefined,
        undefined,
        signal
      )
      return rows[0] ?? null
    },
    enabled: !!client && canAccess,
    refetchInterval: 5_000
  })

  if (!canAccess) {
    return (
      <div className="p-6 text-sm text-muted">{t('downloadLimiter.noAccess')}</div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted">
        <Download size={14} className="animate-pulse" />
        {t('state.loading', { ns: 'common' })}
      </div>
    )
  }

  const activeDownloads = data.ActiveDownloads ?? []
  const used = data.MaxSeats - data.AvailableSeats
  const atCapacity = data.AvailableSeats === 0

  return (
    <div className="p-6">
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Download size={16} className="text-muted" />
          <span className="text-muted">{t('downloadLimiter.seats')}</span>
          <span className={`font-semibold ${atCapacity ? 'text-warning' : 'text-foreground'}`}>
            {used} / {data.MaxSeats}
          </span>
        </div>
        <div>
          <span className="text-muted">{t('downloadLimiter.available')}</span>{' '}
          <span className="font-semibold text-foreground">{data.AvailableSeats}</span>
        </div>
        {atCapacity && (
          <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">{t('downloadLimiter.throttled')}</span>
        )}
      </div>

      {activeDownloads.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-foreground">{t('downloadLimiter.activeDownloads')}</h3>
          <div className="mt-2 space-y-1">
            {activeDownloads.map((dl: string, i: number) => (
              <div key={i} className="rounded border border-border bg-surface px-3 py-1.5 font-mono text-xs text-foreground">
                {dl}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeDownloads.length === 0 && (
        <div className="mt-4 text-sm text-muted">{t('downloadLimiter.noDownloads')}</div>
      )}
    </div>
  )
}
