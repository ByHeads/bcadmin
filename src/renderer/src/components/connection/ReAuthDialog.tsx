import { useState, useEffect, useCallback } from 'react'
import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'

export function ReAuthDialog(): React.ReactNode {
  const { t } = useTranslation(['connection', 'common'])
  const { authErrorConnection, reauth, dismissReauth, status } = useConnectionStore()
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isSubmitting = status === 'connecting'

  const handleSubmit = async (): Promise<void> => {
    if (!apiKey.trim()) {
      setError(t('reauth.apiKeyRequired'))
      return
    }
    setError(null)
    await reauth(apiKey.trim())
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!authErrorConnection) return
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissReauth()
      }
    },
    [authErrorConnection, dismissReauth]
  )

  useEffect(() => {
    if (!authErrorConnection) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [authErrorConnection, handleKeyDown])

  // Reset form when dialog opens
  useEffect(() => {
    if (authErrorConnection) {
      setApiKey('')
      setError(null)
    }
  }, [authErrorConnection])

  if (!authErrorConnection) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <KeyRound size={20} className="text-warning" />
          <h2 className="text-lg font-semibold text-foreground">{t('reauth.title')}</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          {t('reauth.message', { name: authErrorConnection.name })}
        </p>

        {error && (
          <div className="mt-3 rounded-md bg-error/10 p-2 text-sm text-error">{error}</div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="mt-4 space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm text-muted">{t('form.newApiKey')}</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('placeholder.enterApiKey')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              autoFocus
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={dismissReauth}
              disabled={isSubmitting}
              className="rounded-md border border-border px-4 pt-[7px] pb-[9px] text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              {t('button.disconnect', { ns: 'common' })}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !apiKey.trim()}
              className="rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {isSubmitting ? t('state.connecting', { ns: 'common' }) : t('reauth.reconnect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
