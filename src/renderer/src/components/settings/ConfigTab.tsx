import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { JsonTree } from '@/components/ui/JsonTree'

export function ConfigTab(): React.ReactNode {
  const { client, activeConnection } = useConnectionStore()
  const { t } = useTranslation('settings')

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings-config', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<Record<string, unknown>>(
        'Broadcaster.Admin.Config',
        undefined,
        undefined,
        signal
      )
    },
    enabled: !!client,
    staleTime: 60_000
  })

  const config = useMemo(() => (data && data.length > 0 ? data[0] : null), [data])

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('config.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {config ? (
        <div className="rounded-lg border border-border bg-surface p-4 font-mono text-sm">
          <JsonTree data={config} maskSecrets />
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center text-muted">
          {t('config.empty')}
        </div>
      )}
    </div>
  )
}
