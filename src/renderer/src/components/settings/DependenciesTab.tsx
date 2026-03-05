import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Download, CheckCircle, RefreshCw, Package, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import { formatTimestamp } from '@/lib/utils'
import type { DependencyStatus, DependencyUpdate } from '@/api/types'
import { BoolBadge } from './shared'

type DepsPhase = 'idle' | 'installing' | 'success' | 'error'

export function DependenciesTab(): React.ReactNode {
  const { t } = useTranslation('settings')
  const { client, activeConnection, hasAccess } = useConnectionStore()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<DepsPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: statusData, isLoading: loadingStatus, error: statusError } = useQuery({
    queryKey: ['settings-dependency-status', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<DependencyStatus>('Broadcaster.Admin.DependencyStatus', undefined, undefined, signal)
    },
    enabled: !!client,
    staleTime: 30_000
  })

  const canUpdate = hasAccess('Broadcaster.Admin.DependencyUpdate', 'PATCH')

  const { data: updateData, isLoading: loadingUpdate, refetch: refetchUpdate } = useQuery({
    queryKey: ['settings-dependency-update', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<DependencyUpdate>('Broadcaster.Admin.DependencyUpdate', undefined, undefined, signal)
    },
    enabled: !!client && hasAccess('Broadcaster.Admin.DependencyUpdate', 'GET'),
    staleTime: 30_000
  })

  const status = statusData?.[0] ?? null
  const update = updateData?.[0] ?? null
  const hasNewerUpdate = update?.IsNewerThanCurrent === true

  const handleInstall = useCallback(async () => {
    if (!client) return
    setPhase('installing')
    setErrorMsg('')
    try {
      await client.patch('Broadcaster.Admin.DependencyUpdate', { Install: true })
      setPhase('success')
      queryClient.invalidateQueries({ queryKey: ['settings-dependency-status'] })
      queryClient.invalidateQueries({ queryKey: ['settings-dependency-update'] })
    } catch (e) {
      setPhase('error')
      setErrorMsg(e instanceof Error ? e.message : t('deps.installError'))
    }
  }, [client, queryClient, t])

  const statusRows = useMemo<{ label: string; value: React.ReactNode }[]>(() => {
    if (!status) return []
    return [
      { label: t('deps.currentPolicy'), value: (
        <span className="flex items-center gap-1.5 font-mono">
          {status.CurrentPolicy}
          <span className="group relative">
            <Info size={13} className="text-muted" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs font-sans text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {t('deps.policyInfo')}
            </span>
          </span>
        </span>
      ) },
      { label: t('deps.powerShell'), value: <BoolBadge value={status.HasPowerShell} /> },
      { label: t('deps.vcRedistX64'), value: <BoolBadge value={status.HasVcRedistx64} /> },
      { label: t('deps.vcRedistX86'), value: <BoolBadge value={status.HasVcRedistx86} /> },
      { label: t('deps.bcman'), value: <BoolBadge value={status.HasBcman} /> },
      {
        label: t('deps.lastUpdated'),
        value: (
          <span className="font-mono text-sm">
            {status.LastUpdated ? formatTimestamp(status.LastUpdated) : '—'}
          </span>
        )
      }
    ]
  }, [t, status])

  if (loadingStatus || loadingUpdate) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  if (statusError) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {statusError instanceof Error ? statusError.message : t('deps.error')}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-lg space-y-6">
        {/* Status table */}
        {status ? (
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-medium text-foreground">{t('deps.status')}</div>
            </div>
            <div className="divide-y divide-border">
              {statusRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted">{row.label}</span>
                  {row.value}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-muted">{t('deps.noStatus')}</div>
        )}

        {/* Update section */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">{t('deps.update')}</div>
            <button
              onClick={() => refetchUpdate()}
              className="text-muted hover:text-foreground transition-colors"
              title={t('deps.checkForUpdates')}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {hasNewerUpdate ? (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-accent">
                <Package size={16} />
                <span className="text-sm font-medium">{t('deps.updateAvailable')}</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-success">
              <CheckCircle size={16} />
              <span className="text-sm">{t('deps.upToDate')}</span>
            </div>
          )}
        </div>

        {/* Install / reinstall button */}
        {phase === 'idle' && canUpdate && (
          <button
            onClick={handleInstall}
            className={`flex items-center gap-2 rounded-md px-4 pt-[7px] pb-[9px] text-sm font-medium transition-colors ${
              hasNewerUpdate
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'border border-border text-foreground hover:bg-hover'
            }`}
          >
            <Download size={16} />
            {hasNewerUpdate ? t('deps.installUpdate') : t('deps.reinstall')}
          </button>
        )}

        {phase === 'installing' && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <Loader2 size={20} className="animate-spin text-accent" />
            <span className="text-sm text-foreground">{t('deps.installing')}</span>
          </div>
        )}

        {phase === 'success' && (
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
            <CheckCircle size={20} className="text-success" />
            <div className="text-sm font-medium text-foreground">{t('deps.installSuccess')}</div>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-lg border border-error/30 bg-error/10 p-4">
            <div className="text-sm text-error">{errorMsg}</div>
            <button
              onClick={() => setPhase('idle')}
              className="mt-2 text-xs text-muted hover:text-foreground transition-colors"
            >
              {t('button.dismiss', { ns: 'common' })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
