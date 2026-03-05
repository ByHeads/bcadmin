import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Download, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import type { BroadcasterUpdate } from '@/api/types'

type UpdatePhase = 'idle' | 'confirm' | 'installing' | 'reconnecting' | 'success' | 'error'

export function UpdateTab(): React.ReactNode {
  const { t } = useTranslation('settings')
  const { client, activeConnection, setSuppressConnectionDrop } = useConnectionStore()
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [newVersion, setNewVersion] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      setSuppressConnectionDrop(false)
    }
  }, [setSuppressConnectionDrop])

  // Current version
  const { data: currentVersionData, isLoading: loadingVersion } = useQuery({
    queryKey: ['settings-current-version', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<{ Version: string }>(
        'Broadcaster.Admin.Config',
        undefined,
        { select: 'Version', rename: 'General.CurrentVersion->Version' },
        signal
      )
    },
    enabled: !!client,
    staleTime: 30_000
  })

  // Available update
  const { data: updateData, isLoading: loadingUpdate, refetch: refetchUpdate } = useQuery({
    queryKey: ['settings-broadcaster-update', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      return client.get<BroadcasterUpdate>(
        'Broadcaster.Admin.BroadcasterUpdate',
        undefined,
        { order_desc: 'Version', limit: 1 },
        signal
      )
    },
    enabled: !!client,
    staleTime: 30_000
  })

  const currentVersion = currentVersionData?.[0]?.Version ?? null
  const availableUpdate = updateData?.[0] ?? null
  const hasUpdate = availableUpdate && !availableUpdate.IsInstalled

  const startPolling = useCallback((previousVersion: string | null) => {
    if (!client) return
    setPhase('reconnecting')
    let attempts = 0
    const maxAttempts = 90 // 3 minutes at 2s intervals

    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setSuppressConnectionDrop(false)
        setPhase('error')
        setErrorMsg(t('update.timeout'))
        return
      }
      try {
        const configs = await client.get<{ Version: string }>(
          'Broadcaster.Admin.Config',
          undefined,
          { select: 'Version', rename: 'General.CurrentVersion->Version' }
        )
        const ver = configs?.[0]?.Version
        if (ver && ver !== previousVersion) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setSuppressConnectionDrop(false)
          setNewVersion(ver)
          setPhase('success')
        }
      } catch {
        // Expected — Broadcaster is restarting
      }
    }, 2000)
  }, [client, setSuppressConnectionDrop, t])

  const handleInstall = useCallback(async () => {
    if (!client || !availableUpdate) return
    setPhase('installing')
    setErrorMsg('')
    setSuppressConnectionDrop(true)
    try {
      await client.patch(
        'Broadcaster.Admin.BroadcasterUpdate',
        { Install: true },
        { FullName: availableUpdate.FullName }
      )
      // Broadcaster will restart — start polling for reconnection
      startPolling(currentVersion)
    } catch {
      // The request may fail because the Broadcaster restarts mid-response
      // Start polling anyway — the update may have been triggered
      startPolling(currentVersion)
    }
  }, [client, availableUpdate, currentVersion, startPolling, setSuppressConnectionDrop])

  if (loadingVersion || loadingUpdate) {
    return <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
  }

  return (
    <div className="p-6">
      <div className="max-w-lg space-y-6">
        {/* Current version */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-sm text-muted">{t('update.currentVersion')}</div>
          <div className="mt-1 text-lg font-mono font-semibold text-foreground">
            {currentVersion ?? '—'}
          </div>
        </div>

        {/* Available update */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">{t('update.availableUpdate')}</div>
            <button
              onClick={() => refetchUpdate()}
              className="text-muted hover:text-foreground transition-colors"
              title={t('update.checkForUpdates')}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {hasUpdate ? (
            <div className="mt-2">
              <div className="font-mono text-lg font-semibold text-accent">
                {availableUpdate.Version}
              </div>
              <div className="mt-1 text-xs text-muted">
                Runtime: {availableUpdate.RuntimeId}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-success">
              <CheckCircle size={16} />
              <span className="text-sm">{t('update.upToDate')}</span>
            </div>
          )}
        </div>

        {/* Install / progress area */}
        {phase === 'idle' && hasUpdate && (
          <button
            onClick={() => setPhase('confirm')}
            className="flex items-center gap-2 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            <Download size={16} />
            {t('update.installUpdate')}
          </button>
        )}

        {phase === 'confirm' && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
              <div>
                <div className="font-medium text-foreground">
                  {t('update.confirmTitle', { version: availableUpdate?.Version })}
                </div>
                <div className="mt-1 text-sm text-muted">
                  {t('update.confirmMessage')}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleInstall}
                    className="rounded-md bg-accent px-4 pt-[5px] pb-[7px] text-sm font-medium text-white hover:bg-accent/90 transition-colors"
                  >
                    {t('update.confirmButton')}
                  </button>
                  <button
                    onClick={() => setPhase('idle')}
                    className="rounded-md border border-border px-4 pt-[5px] pb-[7px] text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {t('button.cancel', { ns: 'common' })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'installing' && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <Loader2 size={20} className="animate-spin text-accent" />
            <span className="text-sm text-foreground">{t('update.installing')}</span>
          </div>
        )}

        {phase === 'reconnecting' && (
          <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 p-4">
            <Loader2 size={20} className="animate-spin text-accent" />
            <div>
              <div className="text-sm font-medium text-foreground">{t('update.restarting')}</div>
              <div className="text-xs text-muted">{t('update.waitingReconnection')}</div>
            </div>
          </div>
        )}

        {phase === 'success' && (
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
            <CheckCircle size={20} className="text-success" />
            <div>
              <div className="text-sm font-medium text-foreground">{t('update.complete')}</div>
              <div className="text-xs text-muted font-mono font-semibold">
                {t('update.nowRunning', { version: newVersion })}
              </div>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-lg border border-error/30 bg-error/10 p-4">
            <div className="text-sm text-error">{errorMsg}</div>
            <button
              onClick={() => { setPhase('idle'); refetchUpdate() }}
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
