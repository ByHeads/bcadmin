import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useConnectionStore } from '@/stores/connection'
import type { ReplicationSequence } from '@/api/types'

export function DetailsTab(): React.ReactNode {
  const { t } = useTranslation('replication')
  const { client, activeConnection, hasAccess } = useConnectionStore()
  const canAccess = hasAccess('Broadcaster.Replication.ReplicationSequence', 'GET')

  const { data, isLoading, error } = useQuery({
    queryKey: ['replication-sequence', activeConnection?.id],
    queryFn: async ({ signal }) => {
      if (!client) throw new Error('No client')
      const rows = await client.get<ReplicationSequence>(
        'Broadcaster.Replication.ReplicationSequence',
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
      <div className="flex h-64 items-center justify-center text-muted">
        {t('details.noAccess')}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">{t('state.loading', { ns: 'common' })}</div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-error/10 p-4 text-error">
          {error instanceof Error ? error.message : t('details.error')}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        {t('details.empty')}
      </div>
    )
  }

  const atLimit = data.FileCount >= data.MaxNumberOfReplicationFiles

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-1">
        <DetailRow label={t('details.sequenceStart')} value={String(data.Start)} mono />
        <DetailRow label={t('details.sequenceEnd')} value={String(data.End)} mono />
        <DetailRow label={t('details.fileCount')} value={String(data.FileCount)} highlight={atLimit} />
        <DetailRow
          label={t('details.maxReplicationFiles')}
          value={String(data.MaxNumberOfReplicationFiles)}
          highlight={atLimit}
        />
      </div>
      {atLimit && (
        <div className="mt-4 max-w-2xl rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {t('details.atLimitWarning')}
        </div>
      )}
      <div className="mt-4 text-xs text-muted">{t('details.refreshing')}</div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
  highlight
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}): React.ReactNode {
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group flex items-center gap-4 rounded-md px-3 py-2.5 hover:bg-hover/50">
      <div className="w-48 shrink-0 text-sm text-muted">{label}</div>
      <div
        className={`min-w-0 flex-1 text-sm ${mono ? 'font-mono' : ''} ${highlight ? 'font-medium text-warning' : 'text-foreground'}`}
        title={value}
      >
        {value}
      </div>
      <button
        onClick={handleCopy}
        className={`shrink-0 rounded p-1 opacity-0 transition-all group-hover:opacity-100 ${copied ? 'text-success' : 'text-muted hover:text-accent'}`}
        title={copied ? 'Copied!' : 'Copy'}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}
