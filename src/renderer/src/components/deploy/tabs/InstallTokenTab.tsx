import { useState, useCallback } from 'react'
import { Key, Loader2, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'

export function InstallTokenTab(): React.ReactNode {
  const { t } = useTranslation('deploy')
  const client = useConnectionStore((s) => s.client)
  const [token, setToken] = useState<string | null>(null)
  const [expiration, setExpiration] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!client) return
    setGenerating(true)
    setError(null)
    setCopied(false)
    try {
      const result = await client.get<{ Token?: string; Value?: string; Expiration?: string; ExpiresUtc?: string }>(
        'Broadcaster.Admin.InstallToken'
      )
      if (result.length > 0) {
        const tk = result[0]
        setToken(tk.Token ?? tk.Value ?? null)
        setExpiration(tk.Expiration ?? tk.ExpiresUtc ?? null)
      } else {
        setError(t('installToken.noToken'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('installToken.error'))
    } finally {
      setGenerating(false)
    }
  }, [client, t])

  const handleCopy = useCallback(async () => {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [token])

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-sm text-muted">
          {t('installToken.description')}
        </p>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating || !client}
        className="flex items-center gap-2 rounded-md bg-accent px-4 pt-[7px] pb-[9px] text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
        {generating ? t('state.generating', { ns: 'common' }) : t('installToken.generateToken')}
      </button>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {token && (
        <div className="space-y-3 rounded-md border border-border bg-surface p-4">
          <div>
            <label className="text-xs font-medium text-muted">{t('installToken.token')}</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded bg-background px-3 py-2 text-sm text-foreground font-mono break-all">
                {token}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 rounded-md border border-border bg-surface px-3 pt-[7px] pb-[9px] text-sm text-foreground hover:bg-background"
                title={t('installToken.copyToClipboard')}
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {expiration && (
            <div>
              <label className="text-xs font-medium text-muted">{t('installToken.expires')}</label>
              <p className="mt-1 text-sm text-foreground">{expiration}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
