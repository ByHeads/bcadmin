import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import type { CheckRetailConnectionResult } from '@/api/types'

export function ConnectionCheckTab(): React.ReactNode {
  const { t } = useTranslation('replication')
  const { client, activeConnection } = useConnectionStore()
  const queryClient = useQueryClient()

  const statusConfig = useMemo(() => ({
    Connected: {
      icon: <CheckCircle size={24} />,
      color: 'text-success',
      label: t('connectionCheck.statusConnected')
    },
    NotConfigured: {
      icon: <AlertTriangle size={24} />,
      color: 'text-warning',
      label: t('connectionCheck.statusNotConfigured')
    },
    Unreachable: {
      icon: <XCircle size={24} />,
      color: 'text-error',
      label: t('connectionCheck.statusUnreachable')
    },
    Unauthorized: {
      icon: <XCircle size={24} />,
      color: 'text-error',
      label: t('connectionCheck.statusUnauthorized')
    },
    InternalError: {
      icon: <XCircle size={24} />,
      color: 'text-error',
      label: t('connectionCheck.statusInternalError')
    }
  }), [t])

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['replication-connection-check', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const results = await client.get<CheckRetailConnectionResult>(
        'Broadcaster.Replication.CheckRetailConnection',
        undefined,
        undefined,
        signal
      )
      return results[0] ?? null
    },
    enabled: false // manual trigger only
  })

  const handleCheck = (): void => {
    queryClient.fetchQuery({
      queryKey: ['replication-connection-check', activeConnection?.id],
      queryFn: async ({ signal }) => {
        if (!client) throw new Error('No client')
        const results = await client.get<CheckRetailConnectionResult>(
          'Broadcaster.Replication.CheckRetailConnection',
          undefined,
          undefined,
          signal
        )
        return results[0] ?? null
      }
    })
  }

  const status = data?.Status
  const config = status ? statusConfig[status] : null

  return (
    <div className="p-6">
      <div className="max-w-lg space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('connectionCheck.title')}</h2>
          <p className="mt-1 text-sm text-muted">
            {t('connectionCheck.description')}
          </p>
        </div>

        <button
          onClick={handleCheck}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? t('state.checking', { ns: 'common' }) : t('connectionCheck.checkButton')}
        </button>

        {error && (
          <div className="rounded-md bg-error/10 p-4 text-error">
            <div className="flex items-center gap-2">
              <Info size={16} />
              <span className="text-sm font-medium">{t('connectionCheck.requestFailed')}</span>
            </div>
            <p className="mt-1 text-sm">
              {error instanceof Error ? error.message : t('connectionCheck.error')}
            </p>
          </div>
        )}

        {data && config && (
          <div className="rounded-lg border border-border p-6">
            <div className={`flex items-center gap-3 ${config.color}`}>
              {config.icon}
              <span className="text-lg font-semibold">{config.label}</span>
            </div>
            {data.Message && (
              <p className="mt-3 text-sm text-muted">{data.Message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
