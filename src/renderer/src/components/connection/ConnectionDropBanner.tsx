import { useEffect, useRef } from 'react'
import { WifiOff, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'

const RETRY_INTERVAL_MS = 5_000

export function ConnectionDropBanner(): React.ReactNode {
  const { t } = useTranslation(['connection', 'common'])
  const { connectionDropped, reconnecting, attemptReconnect, disconnect } = useConnectionStore()
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptReconnectRef = useRef(attemptReconnect)
  attemptReconnectRef.current = attemptReconnect

  useEffect(() => {
    if (!connectionDropped) {
      if (retryRef.current) {
        clearInterval(retryRef.current)
        retryRef.current = null
      }
      return
    }

    // Start auto-retry
    attemptReconnectRef.current()
    retryRef.current = setInterval(() => attemptReconnectRef.current(), RETRY_INTERVAL_MS)

    return () => {
      if (retryRef.current) {
        clearInterval(retryRef.current)
        retryRef.current = null
      }
    }
  }, [connectionDropped])

  if (!connectionDropped) return null

  return (
    <div className="flex items-center gap-3 border-b border-error/20 bg-error/10 px-4 py-2.5 text-sm text-error">
      <WifiOff size={16} className="shrink-0" />
      <span className="flex-1">
        {t('drop.message')} — {reconnecting ? t('drop.reconnecting') : t('drop.retrying')}
      </span>
      {reconnecting && <Loader2 size={14} className="animate-spin" />}
      <button
        onClick={attemptReconnect}
        disabled={reconnecting}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-error/20 disabled:opacity-50"
      >
        <RefreshCw size={12} />
        {t('button.retry', { ns: 'common' })}
      </button>
      <button
        onClick={disconnect}
        className="rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-error/20"
      >
        {t('button.disconnect', { ns: 'common' })}
      </button>
    </div>
  )
}
