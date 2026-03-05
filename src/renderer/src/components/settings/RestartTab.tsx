import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'

type RestartPhase = 'idle' | 'confirm' | 'restarting' | 'reconnecting' | 'success' | 'error'

export function RestartTab(): React.ReactNode {
  const { t } = useTranslation('settings')
  const { client, setSuppressConnectionDrop } = useConnectionStore()
  const [phase, setPhase] = useState<RestartPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      setSuppressConnectionDrop(false)
    }
  }, [setSuppressConnectionDrop])

  const startPolling = useCallback(() => {
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
        setErrorMsg(t('restart.timeout'))
        return
      }
      try {
        await client.get<{ Version: string }>(
          'Broadcaster.Admin.Config',
          undefined,
          { select: 'Version', rename: 'General.CurrentVersion->Version' }
        )
        // If we get a response, the Broadcaster is back
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setSuppressConnectionDrop(false)
        setPhase('success')
      } catch {
        // Expected — Broadcaster is restarting
      }
    }, 2000)
  }, [client, setSuppressConnectionDrop, t])

  const handleRestart = useCallback(async () => {
    if (!client) return
    setPhase('restarting')
    setErrorMsg('')
    setSuppressConnectionDrop(true)
    try {
      await client.patch('Broadcaster.Admin.BroadcasterRestart', {})
      startPolling()
    } catch {
      // The request may fail because the Broadcaster restarts mid-response
      startPolling()
    }
  }, [client, startPolling, setSuppressConnectionDrop])

  return (
    <div className="p-6">
      <div className="max-w-lg space-y-6">
        {phase === 'idle' && (
          <div>
            <p className="mb-4 text-sm text-muted">
              {t('restart.description')}
            </p>
            <button
              onClick={() => setPhase('confirm')}
              className="flex items-center gap-2 rounded-md bg-error px-4 pt-[7px] pb-[9px] text-sm font-medium text-white hover:bg-error/90 transition-colors"
            >
              <RotateCcw size={16} />
              {t('restart.button')}
            </button>
          </div>
        )}

        {phase === 'confirm' && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
              <div>
                <div className="font-medium text-foreground">{t('restart.confirmTitle')}</div>
                <div className="mt-1 text-sm text-muted">
                  {t('restart.confirmMessage')}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleRestart}
                    className="rounded-md bg-error px-4 pt-[5px] pb-[7px] text-sm font-medium text-white hover:bg-error/90 transition-colors"
                  >
                    {t('restart.confirmButton')}
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

        {phase === 'restarting' && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <Loader2 size={20} className="animate-spin text-accent" />
            <span className="text-sm text-foreground">{t('restart.restarting')}</span>
          </div>
        )}

        {phase === 'reconnecting' && (
          <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 p-4">
            <Loader2 size={20} className="animate-spin text-accent" />
            <div>
              <div className="text-sm font-medium text-foreground">{t('restart.broadcasterRestarting')}</div>
              <div className="text-xs text-muted">{t('restart.waitingReconnection')}</div>
            </div>
          </div>
        )}

        {phase === 'success' && (
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
            <CheckCircle size={20} className="text-success" />
            <div>
              <div className="text-sm font-medium text-foreground">{t('restart.complete')}</div>
              <div className="text-xs text-muted">{t('restart.backOnline')}</div>
            </div>
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
